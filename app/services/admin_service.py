"""
Admin Dashboard Service
━━━━━━━━━━━━━━━━━━━━━━━
Provides data aggregation for the admin dashboard:
- Revenue metrics
- Subscription details
- AI usage monitoring
- Error logs
- Funnel analytics
- Broadcast & Credit adjustment
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional

import httpx

from app.db.connection import prisma
from app.config import PLAN_CONFIG, BOT_TOKEN, TELEGRAM_API_URL

_logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _fmt_dt(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%d %b %Y %H:%M")


# ══════════════════════════════════════════════════════════
# A. Revenue Dashboard
# ══════════════════════════════════════════════════════════

async def get_revenue_data() -> Dict[str, Any]:
    """Compute revenue metrics."""
    now = _utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total all-time revenue (paid payments)
    all_payments = await prisma.payment.find_many(where={"status": "paid"})
    total_all_time = sum(p.amount for p in all_payments)

    # This month revenue
    month_payments = [p for p in all_payments if p.paidAt and p.paidAt >= month_start]
    this_month = sum(p.amount for p in month_payments)

    # Today revenue
    today_payments = [p for p in all_payments if p.paidAt and p.paidAt >= today_start]
    today_rev = sum(p.amount for p in today_payments)

    # Active subscriptions
    active_subs = await prisma.subscription.count(
        where={"isActive": True, "endDate": {"gte": now}}
    )

    # MRR = active subs * weighted average price
    active_sub_list = await prisma.subscription.find_many(
        where={"isActive": True, "endDate": {"gte": now}}
    )
    mrr = 0
    for sub in active_sub_list:
        plan_cfg = PLAN_CONFIG.get(sub.plan, {})
        mrr += plan_cfg.get("price", 0)

    # Expiring soon (within 7 days)
    seven_days = now + timedelta(days=7)
    expiring_soon = await prisma.subscription.count(
        where={
            "isActive": True,
            "endDate": {"gte": now, "lte": seven_days},
        }
    )

    # Churn rate = expired in last 30d / (expired + active)
    thirty_days_ago = now - timedelta(days=30)
    expired_recent = await prisma.subscription.count(
        where={
            "isActive": False,
            "endDate": {"gte": thirty_days_ago, "lte": now},
        }
    )
    total_base = expired_recent + active_subs
    churn_rate = (expired_recent / total_base * 100) if total_base > 0 else 0.0

    return {
        "total_all_time": total_all_time,
        "this_month": this_month,
        "today": today_rev,
        "mrr": mrr,
        "active_subs": active_subs,
        "expiring_soon": expiring_soon,
        "churn_rate": churn_rate,
    }


async def get_recent_payments(limit: int = 20) -> List[Dict]:
    """Get recent payment records."""
    payments = await prisma.payment.find_many(
        order={"createdAt": "desc"},
        take=limit,
        include={"user": True},
    )
    result = []
    for p in payments:
        result.append({
            "user_name": p.user.displayName if p.user else f"User {p.userId}",
            "plan": p.plan,
            "amount": p.amount,
            "status": p.status,
            "created_at": _fmt_dt(p.createdAt),
        })
    return result


# ══════════════════════════════════════════════════════════
# B. Subscription Management Detail
# ══════════════════════════════════════════════════════════

async def get_subscription_details() -> List[Dict]:
    """Get detailed subscription info for each user with active/recent subs."""
    now = _utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    users = await prisma.user.find_many(
        where={"plan": {"in": ["pro", "elite"]}},
        include={"subscriptions": True, "payments": True, "aiCredits": True},
        order={"createdAt": "desc"},
    )

    result = []
    for u in users:
        # Find active subscription
        active_sub = None
        for s in (u.subscriptions or []):
            if s.isActive and s.endDate >= now:
                if not active_sub or s.endDate > active_sub.endDate:
                    active_sub = s

        # Last payment
        paid_payments = sorted(
            [p for p in (u.payments or []) if p.status == "paid"],
            key=lambda x: x.createdAt,
            reverse=True,
        )
        last_payment = paid_payments[0] if paid_payments else None

        # Next credit refill (weekly for pro/elite)
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        next_refill = week_start + timedelta(days=7)

        # Usage this month
        month_credits = [
            c for c in (u.aiCredits or [])
            if c.weekStartAt >= month_start
        ]
        total_usage = sum(c.usedCredits for c in month_credits)

        # Payment status
        if active_sub and active_sub.endDate >= now:
            payment_status = "active"
        elif active_sub and active_sub.endDate < now:
            payment_status = "expired"
        else:
            payment_status = "trial"

        result.append({
            "user_id": str(u.id),
            "display_name": u.displayName,
            "username": u.username or "-",
            "plan": u.plan,
            "payment_status": payment_status,
            "expired_at": _fmt_dt(active_sub.endDate) if active_sub else None,
            "last_payment_date": _fmt_dt(last_payment.paidAt or last_payment.createdAt) if last_payment else None,
            "next_refill_date": _fmt_dt(next_refill),
            "total_usage_this_month": total_usage,
        })

    return result


# ══════════════════════════════════════════════════════════
# C. AI Usage Monitoring
# ══════════════════════════════════════════════════════════

# Approximate cost per LLM call (gpt-4o-mini is ~$0.00015 per 1k input tokens)
AVG_COST_PER_CALL = 0.002  # rough estimate per call


async def get_ai_usage_data() -> Dict[str, Any]:
    """Compute AI usage metrics."""
    now = _utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # AI calls today
    calls_today = await prisma.llmresponse.count(
        where={"createdAt": {"gte": today_start}}
    )

    # AI calls this month
    calls_month = await prisma.llmresponse.count(
        where={"createdAt": {"gte": month_start}}
    )

    # Unique users today
    today_responses = await prisma.llmresponse.find_many(
        where={"createdAt": {"gte": today_start}, "userId": {"not": None}},
        distinct=["userId"],
    )
    unique_users_today = len(today_responses)

    # Cost estimates
    cost_today = calls_today * AVG_COST_PER_CALL

    # Top 5 heavy users this month
    month_responses = await prisma.llmresponse.find_many(
        where={"createdAt": {"gte": month_start}, "userId": {"not": None}},
        include={"user": True},
    )

    user_call_map: Dict[int, Dict] = {}
    for r in month_responses:
        uid = r.userId
        if uid not in user_call_map:
            user_call_map[uid] = {
                "display_name": r.user.displayName if r.user else f"User {uid}",
                "call_count": 0,
            }
        user_call_map[uid]["call_count"] += 1

    top_users = sorted(user_call_map.values(), key=lambda x: x["call_count"], reverse=True)[:5]
    for u in top_users:
        u["est_cost"] = u["call_count"] * AVG_COST_PER_CALL

    # Usage by source
    source_map: Dict[str, int] = {}
    for r in month_responses:
        src = r.inputSource or "unknown"
        source_map[src] = source_map.get(src, 0) + 1

    total_src = sum(source_map.values()) or 1
    by_source = [
        {"source": k, "count": v, "pct": v / total_src * 100}
        for k, v in sorted(source_map.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "calls_today": calls_today,
        "cost_today": cost_today,
        "calls_month": calls_month,
        "unique_users_today": unique_users_today,
        "top_users": top_users,
        "by_source": by_source,
    }


# ══════════════════════════════════════════════════════════
# D. Logs & Error Monitoring
# ══════════════════════════════════════════════════════════

async def get_error_logs() -> Dict[str, Any]:
    """
    Check for failed AI requests, failed OCR, and system errors.
    Uses LlmResponse and OcrText tables to detect issues.
    """
    now = _utcnow()
    twenty_four_ago = now - timedelta(hours=24)

    # Failed AI = LLM responses where output indicates error (heuristic)
    recent_llm = await prisma.llmresponse.find_many(
        where={"createdAt": {"gte": twenty_four_ago}},
        order={"createdAt": "desc"},
        take=200,
    )

    failed_ai = 0
    error_logs = []
    for r in recent_llm:
        output = r.llmOutput
        if isinstance(output, dict) and output.get("error"):
            failed_ai += 1
            error_logs.append({
                "level": "error",
                "message": f"AI Error: {str(output.get('error', ''))[:100]}",
                "timestamp": _fmt_dt(r.createdAt),
                "source": "LLM Service",
            })

    # Failed OCR = OCR texts that are empty or too short
    recent_ocr = await prisma.ocrtext.find_many(
        where={"createdAt": {"gte": twenty_four_ago}},
        order={"createdAt": "desc"},
        take=100,
    )
    failed_ocr = sum(1 for o in recent_ocr if not o.ocrRaw or len(o.ocrRaw.strip()) < 5)
    for o in recent_ocr:
        if not o.ocrRaw or len(o.ocrRaw.strip()) < 5:
            error_logs.append({
                "level": "warning",
                "message": f"OCR produced empty/minimal result for receipt #{o.receiptId}",
                "timestamp": _fmt_dt(o.createdAt),
                "source": "OCR Service",
            })

    # System errors count (we approximate from AI + OCR failures)
    system_errors = failed_ai + failed_ocr

    # Sort and limit logs
    error_logs.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    error_logs = error_logs[:20]

    return {
        "failed_ai": failed_ai,
        "failed_ocr": failed_ocr,
        "system_errors": system_errors,
        "recent": error_logs,
    }


# ══════════════════════════════════════════════════════════
# E. Credit Adjustment
# ══════════════════════════════════════════════════════════

async def adjust_credits(
    user_id: int,
    action: str,
    amount: int = 0,
    reason: str = "",
) -> Dict[str, Any]:
    """
    Adjust AI credits for a user.
    Actions: add, subtract, reset, bonus
    """
    try:
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user:
            return {"success": False, "error": "User not found"}

        now = _utcnow()
        plan = user.plan
        plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])

        if plan == "free":
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            default_total = plan_config.get("ai_credits_monthly", 5)
        else:
            period_start = now - timedelta(days=now.weekday())
            period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
            default_total = plan_config.get("ai_credits_weekly", 50)

        # Find or create current credit record
        credit = await prisma.aicredit.find_first(
            where={"userId": user_id, "weekStartAt": {"gte": period_start}},
            order={"createdAt": "desc"},
        )

        if not credit:
            credit = await prisma.aicredit.create(
                data={
                    "userId": user_id,
                    "totalCredits": default_total,
                    "usedCredits": 0,
                    "weekStartAt": period_start,
                }
            )

        if action == "add":
            await prisma.aicredit.update(
                where={"id": credit.id},
                data={"totalCredits": credit.totalCredits + amount},
            )
        elif action == "subtract":
            new_used = min(credit.usedCredits + amount, credit.totalCredits)
            await prisma.aicredit.update(
                where={"id": credit.id},
                data={"usedCredits": new_used},
            )
        elif action == "reset":
            await prisma.aicredit.update(
                where={"id": credit.id},
                data={"totalCredits": default_total, "usedCredits": 0},
            )
        elif action == "bonus":
            await prisma.aicredit.update(
                where={"id": credit.id},
                data={"totalCredits": credit.totalCredits + amount},
            )

        _logger.info(f"Credit adjustment: user={user_id} action={action} amount={amount} reason={reason}")
        return {"success": True, "action": action, "amount": amount}

    except Exception as e:
        _logger.error(f"Credit adjustment error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# ══════════════════════════════════════════════════════════
# F. Broadcast / Announcement
# ══════════════════════════════════════════════════════════

async def get_broadcast_stats() -> Dict[str, int]:
    """Get user counts by plan category."""
    all_count = await prisma.user.count()
    free_count = await prisma.user.count(where={"plan": "free"})
    premium_count = all_count - free_count

    return {
        "all": all_count,
        "premium": premium_count,
        "free": free_count,
    }


async def send_broadcast(target: str, message: str) -> Dict[str, Any]:
    """
    Send broadcast message to users via Telegram.
    target: all | premium | pro | elite | free
    """
    try:
        where_clause: Dict[str, Any] = {}
        if target == "premium":
            where_clause = {"plan": {"in": ["pro", "elite"]}}
        elif target == "pro":
            where_clause = {"plan": "pro"}
        elif target == "elite":
            where_clause = {"plan": "elite"}
        elif target == "free":
            where_clause = {"plan": "free"}
        # else "all" = no filter

        users = await prisma.user.find_many(where=where_clause if where_clause else {})

        if not BOT_TOKEN:
            return {"success": False, "error": "BOT_TOKEN not configured"}

        sent_count = 0
        failed_count = 0

        async with httpx.AsyncClient(timeout=10.0) as client:
            for user in users:
                try:
                    resp = await client.post(
                        f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/sendMessage",
                        json={
                            "chat_id": int(user.id),
                            "text": message,
                            "parse_mode": "Markdown",
                        },
                    )
                    if resp.status_code == 200 and resp.json().get("ok"):
                        sent_count += 1
                    else:
                        failed_count += 1
                except Exception:
                    failed_count += 1

        _logger.info(f"Broadcast sent: target={target}, sent={sent_count}, failed={failed_count}")
        return {
            "success": True,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "target": target,
        }

    except Exception as e:
        _logger.error(f"Broadcast error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# ══════════════════════════════════════════════════════════
# G. Analytics Funnel
# ══════════════════════════════════════════════════════════

async def get_funnel_data() -> Dict[str, Any]:
    """Compute conversion funnel metrics."""
    total_signups = await prisma.user.count()
    free_count = await prisma.user.count(where={"plan": "free"})
    pro_count = await prisma.user.count(where={"plan": "pro"})
    elite_count = await prisma.user.count(where={"plan": "elite"})

    # Conversion rates
    trial_to_pro = ((pro_count + elite_count) / total_signups * 100) if total_signups > 0 else 0.0
    pro_to_elite = (elite_count / (pro_count + elite_count) * 100) if (pro_count + elite_count) > 0 else 0.0

    # Trial drop rate = users who are still free / total signups
    trial_drop_rate = (free_count / total_signups * 100) if total_signups > 0 else 0.0

    return {
        "total_signups": total_signups,
        "free_count": free_count,
        "pro_count": pro_count,
        "elite_count": elite_count,
        "trial_to_pro": trial_to_pro,
        "pro_to_elite": pro_to_elite,
        "trial_drop_rate": trial_drop_rate,
    }
