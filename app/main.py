"""
FiNot - AI Financial Assistant Bot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
import os

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import httpx

from app.db import prisma, connect_db
from app.webhook.telegram import router as telegram_router
from app.webhook.trakteer import router as trakteer_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


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

    yield

    # Cleanup
    logger.info("🛑 FiNot shutting down...")
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


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "name": "FiNot - AI Financial Assistant",
        "version": "2.0.0",
        "status": "running",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "features": [
            "Transaction Recording (Text/Photo/Voice)",
            "Daily AI Insight",
            "Balance Age Prediction",
            "Savings Recommendation",
            "Auto Receipt Scanning (OCR)",
            "Financial Health Score",
            "Savings Simulation",
            "Weekly & Monthly Deep Analysis",
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
