"""
FiNot - AI Financial Assistant Bot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import httpx

from app.db import prisma, connect_db
from app.webhook.telegram import router as telegram_router
from app.webhook.trakteer import router as trakteer_router
from app.routers.admin import router as admin_router
from app.routers.landing_api import router as landing_api_router
from app.routers.user_dashboard import router as user_dashboard_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)



# ═══════════════════════════════════════════
# SCHEDULED TASKS
# ═══════════════════════════════════════════

async def _weekly_summary_job():
    """Send weekly summary to all eligible users every Sunday at 08:00 WIB (01:00 UTC)."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            # Calculate seconds until next Sunday 01:00 UTC (08:00 WIB)
            days_until_sunday = (6 - now.weekday()) % 7
            if days_until_sunday == 0 and now.hour >= 1:
                days_until_sunday = 7  # already past this Sunday's window

            target = now.replace(hour=1, minute=0, second=0, microsecond=0)
            if days_until_sunday > 0:
                from datetime import timedelta
                target = target + timedelta(days=days_until_sunday)

            wait_seconds = (target - now).total_seconds()
            if wait_seconds < 0:
                wait_seconds += 7 * 86400  # next week

            logger.info(
                f"📅 Weekly summary scheduled in {wait_seconds/3600:.1f}h "
                f"(target: {target.isoformat()})"
            )
            await asyncio.sleep(wait_seconds)

            # Execute weekly summary send
            await _send_weekly_summaries()

        except asyncio.CancelledError:
            logger.info("Weekly summary job cancelled")
            break
        except Exception as e:
            logger.error(f"Weekly summary job error: {e}", exc_info=True)
            await asyncio.sleep(3600)  # retry in 1 hour


async def _send_weekly_summaries():
    """Send weekly AI summary to all users with weekly_summary feature."""
    from app.config import PLAN_CONFIG
    from app.services.subscription_service import (
        check_feature_access, get_user_plan, check_ai_credits, consume_ai_credit,
    )
    from app.webhook.telegram import send_telegram_message
    from worker.analysis_service import get_weekly_analysis, get_weekly_strategy

    logger.info("📊 Starting weekly summary broadcast...")

    try:
        # Get all users who have used the bot
        users = await prisma.user.find_many(
            where={"plan": {"in": ["trial", "pro", "elite"]}},
        )

        sent_count = 0
        for user in users:
            try:
                plan = await get_user_plan(int(user.id))
                if not check_feature_access(plan, "weekly_summary"):
                    continue

                # Check credits
                credits = await check_ai_credits(int(user.id))
                if credits.get("remaining", 0) < 3:
                    continue

                # Generate weekly analysis
                result = await get_weekly_analysis(int(user.id))
                if not result.get("success"):
                    continue

                data = result["data"]
                message = (
                    f"📊 <b>Ringkasan Mingguan</b>\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"💰 Pemasukan: <b>Rp{data.get('total_income', 0):,}</b>\n"
                    f"💸 Pengeluaran: <b>Rp{data.get('total_expense', 0):,}</b>\n"
                    f"📈 Selisih: <b>Rp{data.get('net', 0):,}</b>\n\n"
                )

                # Top categories
                top_cats = data.get("top_categories", [])
                if top_cats:
                    message += "Kategori terbesar:\n"
                    for cat in top_cats[:3]:
                        message += f"• {cat.get('category', '?')} — Rp{cat.get('amount', 0):,}\n"
                    message += "\n"

                # Insight
                if data.get("insight"):
                    message += f"💡 {data['insight']}\n\n"

                # Action items
                actions = data.get("action_items", [])
                if actions:
                    message += "<b>Action Items:</b>\n"
                    for item in actions:
                        message += f"• {item}\n"
                    message += "\n"

                # Try to add weekly strategy
                try:
                    strategy_result = await get_weekly_strategy(int(user.id))
                    if strategy_result.get("success"):
                        sdata = strategy_result["data"]
                        if sdata.get("strategy"):
                            message += f"🎯 <b>Strategi Minggu Depan</b>\n{sdata['strategy']}"
                except Exception:
                    pass

                # Send via Telegram (user.id IS the Telegram chat_id)
                await send_telegram_message(int(user.id), message)
                await consume_ai_credit(int(user.id), amount=3)
                sent_count += 1

                # Small delay to avoid Telegram rate limits
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.warning(f"Failed to send weekly summary to user {user.id}: {e}")
                continue

        logger.info(f"📊 Weekly summary sent to {sent_count} users")

    except Exception as e:
        logger.error(f"Error in weekly summary broadcast: {e}", exc_info=True)


async def _daily_notification_job():
    """#19 Smart Notification — send daily alerts at 20:00 WIB (13:00 UTC)."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            # Calculate seconds until next 13:00 UTC (20:00 WIB)
            target = now.replace(hour=13, minute=0, second=0, microsecond=0)
            if now.hour >= 13:
                from datetime import timedelta
                target = target + timedelta(days=1)

            wait_seconds = (target - now).total_seconds()
            logger.info(
                f"📢 Daily notification scheduled in {wait_seconds/3600:.1f}h "
                f"(target: {target.isoformat()})"
            )
            await asyncio.sleep(wait_seconds)

            # Execute daily notifications
            await _send_daily_notifications()

        except asyncio.CancelledError:
            logger.info("Daily notification job cancelled")
            break
        except Exception as e:
            logger.error(f"Daily notification job error: {e}", exc_info=True)
            await asyncio.sleep(3600)  # retry in 1 hour


async def _send_daily_notifications():
    """Send smart notifications to all eligible premium users."""
    from app.services.subscription_service import get_user_plan, check_ai_credits
    from app.webhook.telegram import send_telegram_message
    from worker.analysis_service import get_smart_notification

    logger.info("📢 Starting daily notification broadcast...")

    try:
        users = await prisma.user.find_many(
            where={"plan": {"in": ["trial", "pro", "elite"]}},
        )

        sent_count = 0
        for user in users:
            try:
                plan = await get_user_plan(int(user.id))
                if plan == "free":
                    continue

                # Check credits
                credits = await check_ai_credits(int(user.id))
                if credits.get("remaining", 0) < 1:
                    continue

                result = await get_smart_notification(int(user.id))
                if not result.get("success") or not result.get("data", {}).get("has_alerts"):
                    continue

                alerts = result["data"]["alerts"]

                lines = [
                    "📢 <b>Pengingat FiNot</b>",
                    "━━━━━━━━━━━━━━━━━━━━━━━━",
                    "",
                ]

                for alert in alerts:
                    lines.append(f"{alert.get('emoji', '📢')} {alert['message']}")
                    lines.append("")

                message = "\n".join(lines)
                await send_telegram_message(int(user.id), message)
                sent_count += 1

                await asyncio.sleep(0.5)  # rate limit

            except Exception as e:
                logger.warning(f"Failed to send notification to user {user.id}: {e}")
                continue

        logger.info(f"📢 Daily notifications sent to {sent_count} users")

    except Exception as e:
        logger.error(f"Error in daily notification broadcast: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    logger.info("🚀 FiNot starting up...")

    # Connect to database
    try:
        await prisma.connect()
        logger.info("✅ Database connected")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        raise

    # Set webhook (optional, for production)
    webhook_url = os.getenv("WEBHOOK_URL")
    bot_token = os.getenv("BOT_TOKEN")
    if webhook_url and bot_token:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"https://api.telegram.org/bot{bot_token}/setWebhook",
                    json={"url": f"{webhook_url}/webhook/telegram"},
                )
                data = resp.json()
                if data.get("ok"):
                    logger.info(f"✅ Webhook set: {webhook_url}/webhook/telegram")
                else:
                    logger.warning(f"⚠️ Webhook set failed: {data}")
        except Exception as e:
            logger.warning(f"⚠️ Could not set webhook: {e}")

    logger.info("🧠 FiNot ready!")

    # Start scheduled tasks
    weekly_task = asyncio.create_task(_weekly_summary_job())
    daily_task = asyncio.create_task(_daily_notification_job())
    logger.info("📅 Weekly summary scheduler started")
    logger.info("📢 Daily notification scheduler started")

    yield

    # Cleanup
    logger.info("🛑 FiNot shutting down...")
    weekly_task.cancel()
    daily_task.cancel()
    try:
        await weekly_task
    except asyncio.CancelledError:
        pass
    try:
        await daily_task
    except asyncio.CancelledError:
        pass
    try:
        await prisma.disconnect()
        logger.info("✅ Database disconnected")
    except Exception:
        pass


app = FastAPI(
    title="FiNot - AI Financial Assistant",
    description="Telegram bot for personal finance management with AI insights",
    version="2.0.0",
    lifespan=lifespan,
)

# ── Routes ─────────────────────────────────
app.include_router(telegram_router)
app.include_router(trakteer_router)
app.include_router(admin_router)
app.include_router(landing_api_router)
app.include_router(user_dashboard_router)

# Templates removed — admin dashboard is now part of the React SPA

# ── Serve React SPA build from static/landing ──
LANDING_DIR = Path(__file__).resolve().parent.parent / "static" / "landing"

if LANDING_DIR.exists():
    # Mount static assets (js, css, images) under /assets
    assets_dir = LANDING_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="landing-assets")


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root(request: Request):
    """Serve React SPA index.html."""
    index_file = LANDING_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file), media_type="text/html")
    raise HTTPException(status_code=404, detail="SPA not built yet")


@app.get("/api/status")
async def api_status():
    """API status / health check endpoint."""
    return {
        "name": "FiNot - AI Financial Assistant",
        "version": "2.0.0",
        "status": "running",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "features": [
            "1. Daily AI Insight",
            "2. Weekly Summary",
            "3. Monthly Deep Analysis",
            "4. Balance Age Prediction",
            "5. Savings Recommendation",
            "6. Spending Anomaly Detection",
            "7. Burn Rate Analysis",
            "8. Smart Budget Suggestion",
            "9. Subscription Detector",
            "10. Financial Health Score",
            "11. Goal-based Saving",
            "12. Payday Planning",
            "13. Category Overspending Alert",
            "14. Weekend Spending Pattern",
            "15. Daily Expense Limit Reminder",
            "16. Expense Prediction",
            "17. Savings Opportunity Finder",
            "18. AI Financial Chat",
            "19. Smart Notification",
            "20. Weekly Strategy Suggestion",
        ],
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    db_ok = False
    try:
        await prisma.execute_raw("SELECT 1")
        db_ok = True
    except Exception:
        pass

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# SPA catch-all — MUST be last route registered
# Serves index.html for any path not matched above, allowing React Router to handle it
@app.get("/{path:path}", include_in_schema=False)
async def spa_catchall(path: str):
    """Catch-all for SPA client-side routes."""
    # Block backend API routes from falling through to the SPA
    if path.startswith(("api/", "admin/api", "webhook", "health")):
        raise HTTPException(status_code=404)

    # Serve static files from the landing directory if they exist
    # (e.g. logo.jpeg, favicon.jpeg copied from public/)
    static_file = (LANDING_DIR / path).resolve()
    if static_file.is_file() and str(static_file).startswith(str(LANDING_DIR.resolve())) and not path.endswith(".html"):
        return FileResponse(str(static_file))

    index_file = LANDING_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file), media_type="text/html")
    raise HTTPException(status_code=404)
