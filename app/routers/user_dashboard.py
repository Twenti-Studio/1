"""
User Dashboard API Router
━━━━━━━━━━━━━━━━━━━━━━━━━
Authentication & data endpoints for the React user dashboard.
All endpoints return JSON.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db.connection import prisma
from app.config import PLAN_CONFIG
from app.services.subscription_service import check_ai_credits, get_subscription_status

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user", tags=["user-dashboard"])

# In-memory sessions: session_id -> user_id
USER_SESSIONS: Dict[str, int] = {}


# ─── Helpers ───────────────────────────────────────────────

def _hash_password(password: str) -> str:
    """Simple SHA-256 hash. Use bcrypt in production."""
    return hashlib.sha256(password.encode()).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _fmt_dt(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%d %b %Y %H:%M")


def _fmt_date(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%d %b %Y")


# ─── Auth helpers ──────────────────────────────────────────

async def get_current_user_id(request: Request) -> Optional[int]:
    session_id = request.cookies.get("user_session")
    if not session_id or session_id not in USER_SESSIONS:
        return None
    return USER_SESSIONS[session_id]


async def require_user(request: Request) -> int:
    user_id = await get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


# ─── Auth endpoints ────────────────────────────────────────

class UserLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def user_login(req: UserLoginRequest):
    """Login with web_login + web_password."""
    user = await prisma.user.find_first(
        where={"webLogin": req.username}
    )
    if not user or not user.webPassword:
        return JSONResponse(
            {"success": False, "error": "Username atau password salah"},
            status_code=401,
        )

    if user.webPassword != _hash_password(req.password):
        return JSONResponse(
            {"success": False, "error": "Username atau password salah"},
            status_code=401,
        )

    session_id = secrets.token_hex(24)
    USER_SESSIONS[session_id] = int(user.id)

    # Auto-activate 7-day trial for first-time free users
    plan = user.plan
    trial_ends_at = None
    if user.plan == "free" and user.trialEndsAt is None:
        trial_ends_at = _utcnow() + timedelta(days=7)
        await prisma.user.update(
            where={"id": user.id},
            data={"plan": "trial", "trialEndsAt": trial_ends_at},
        )
        plan = "trial"
        _logger.info(f"Trial activated for user {user.id}, ends at {trial_ends_at}")
    elif user.plan == "trial" and user.trialEndsAt:
        trial_ends_at = user.trialEndsAt
        # Check if expired
        if trial_ends_at <= _utcnow():
            await prisma.user.update(
                where={"id": user.id},
                data={"plan": "free"},
            )
            plan = "free"
            trial_ends_at = None

    resp = JSONResponse({
        "success": True,
        "user": {
            "id": str(user.id),
            "username": user.webLogin,
            "display_name": user.displayName,
            "plan": plan,
            "trial_ends_at": trial_ends_at.isoformat() if trial_ends_at else None,
        },
    })
    resp.set_cookie(
        key="user_session",
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )
    return resp


@router.get("/me")
async def user_me(request: Request):
    """Check if user is authenticated."""
    user_id = await get_current_user_id(request)
    if not user_id:
        return JSONResponse({"authenticated": False}, status_code=401)

    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        return JSONResponse({"authenticated": False}, status_code=401)

    # Check trial status
    plan = user.plan
    trial_ends_at = None
    if user.plan == "trial":
        if user.trialEndsAt and user.trialEndsAt > _utcnow():
            trial_ends_at = user.trialEndsAt
        else:
            await prisma.user.update(where={"id": user.id}, data={"plan": "free"})
            plan = "free"

    return {
        "authenticated": True,
        "user": {
            "id": str(user.id),
            "username": user.webLogin,
            "display_name": user.displayName,
            "plan": plan,
            "trial_ends_at": trial_ends_at.isoformat() if trial_ends_at else None,
        },
    }


@router.get("/logout")
async def user_logout(request: Request):
    session_id = request.cookies.get("user_session")
    if session_id:
        USER_SESSIONS.pop(session_id, None)
    resp = JSONResponse({"success": True})
    resp.delete_cookie("user_session")
    return resp


# ─── Dashboard data endpoints ─────────────────────────────

@router.get("/dashboard")
async def user_dashboard(user_id: int = Depends(require_user)):
    """Main dashboard data: plan status, credits, quick stats."""
    now = _utcnow()
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Subscription status
    sub_status = await get_subscription_status(user_id)

    # Credit info
    credits = await check_ai_credits(user_id)

    # Find active subscription for dates
    active_sub = await prisma.subscription.find_first(
        where={"userId": user_id, "isActive": True, "endDate": {"gte": now}},
        order={"endDate": "desc"},
    )

    # Next credit refill (weekly for pro/elite/trial)
    if user.plan in ("pro", "elite", "trial"):
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        next_refill = week_start + timedelta(days=7)
    else:
        next_refill = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Next month
        if now.month == 12:
            next_refill = next_refill.replace(year=now.year + 1, month=1)
        else:
            next_refill = next_refill.replace(month=now.month + 1)

    # Today's income/expense
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_txs = await prisma.transaction.find_many(
        where={"userId": user_id, "createdAt": {"gte": today_start}},
    )
    today_income = sum(t.amount for t in today_txs if t.intent == "income")
    today_expense = sum(t.amount for t in today_txs if t.intent == "expense")

    # This month's totals (for simulation & balance)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_txs = await prisma.transaction.find_many(
        where={"userId": user_id, "createdAt": {"gte": month_start}},
    )
    month_income = sum(t.amount for t in month_txs if t.intent == "income")
    month_expense = sum(t.amount for t in month_txs if t.intent == "expense")

    # All-time totals for balance
    all_txs = await prisma.transaction.find_many(
        where={"userId": user_id},
    )
    total_income = sum(t.amount for t in all_txs if t.intent == "income")
    total_expense = sum(t.amount for t in all_txs if t.intent == "expense")

    # Check trial status
    current_plan = user.plan
    trial_ends_at = None
    trial_days_left = None
    if user.plan == "trial":
        if user.trialEndsAt and user.trialEndsAt > now:
            trial_ends_at = user.trialEndsAt
            trial_days_left = max(0, (user.trialEndsAt - now).days)
        else:
            await prisma.user.update(where={"id": user.id}, data={"plan": "free"})
            current_plan = "free"

    # Feature access map for frontend gating
    plan_cfg = PLAN_CONFIG.get(current_plan, PLAN_CONFIG["free"])
    features = {
        "daily_insight": plan_cfg.get("daily_insight", False),
        "weekly_summary": plan_cfg.get("weekly_summary", False),
        "monthly_analysis": plan_cfg.get("monthly_analysis", False),
        "scan_receipt": plan_cfg.get("scan_receipt", False),
        "forecast_3month": plan_cfg.get("forecast_3month", False),
        "advanced_tracking": plan_cfg.get("advanced_tracking", False),
        "priority_ai": plan_cfg.get("priority_ai", False),
    }

    return {
        "user": {
            "id": str(user.id),
            "display_name": user.displayName,
            "username": user.webLogin or user.username,
            "plan": current_plan,
            "trial_ends_at": trial_ends_at.isoformat() if trial_ends_at else None,
            "trial_days_left": trial_days_left,
        },
        "plan_status": {
            "plan": current_plan,
            "plan_name": PLAN_CONFIG.get(current_plan, {}).get("name", "Free Plan"),
            "credits_remaining": credits.get("remaining", 0),
            "credits_total": credits.get("total", 0),
            "credits_used": credits.get("total", 0) - credits.get("remaining", 0),
            "refill_date": _fmt_date(next_refill),
            "expiry_date": _fmt_date(active_sub.endDate) if active_sub else None,
            "days_left": max(0, (active_sub.endDate - now).days) if active_sub else None,
        },
        "today": {
            "income": today_income,
            "expense": today_expense,
        },
        "this_month": {
            "income": month_income,
            "expense": month_expense,
        },
        "balance": total_income - total_expense,
        "features": features,
    }


@router.get("/spending")
async def user_spending(user_id: int = Depends(require_user)):
    """Spending breakdown by category for current month."""
    now = _utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    txs = await prisma.transaction.find_many(
        where={
            "userId": user_id,
            "intent": "expense",
            "createdAt": {"gte": month_start},
        },
    )

    # Group by category
    cat_map: Dict[str, int] = {}
    for t in txs:
        cat = t.category or "Lainnya"
        cat_map[cat] = cat_map.get(cat, 0) + t.amount

    # Assign colors
    COLORS = ["#F5841F", "#38BDF8", "#A78BFA", "#34D399", "#FB7185", "#94A3B8",
              "#FBBF24", "#818CF8", "#F472B6", "#2DD4BF"]

    categories = []
    for i, (cat, val) in enumerate(sorted(cat_map.items(), key=lambda x: x[1], reverse=True)):
        categories.append({
            "name": cat,
            "value": val,
            "color": COLORS[i % len(COLORS)],
        })

    return {"categories": categories, "total": sum(cat_map.values())}


@router.get("/cashflow")
async def user_cashflow(
    period: str = "weekly",
    user_id: int = Depends(require_user),
):
    """Cashflow trend data: income vs expense grouped by period."""
    now = _utcnow()

    if period == "daily":
        # Last 7 days
        start = now - timedelta(days=6)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "weekly":
        # Last 4 weeks
        start = now - timedelta(weeks=4)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        # Last 6 months
        start = now - timedelta(days=180)
        start = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    txs = await prisma.transaction.find_many(
        where={
            "userId": user_id,
            "createdAt": {"gte": start},
        },
        order={"createdAt": "asc"},
    )

    if period == "daily":
        # Group by day
        buckets: Dict[str, Dict[str, int]] = {}
        day_labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
        for i in range(7):
            d = start + timedelta(days=i)
            key = d.strftime("%Y-%m-%d")
            label = day_labels[d.weekday()]
            buckets[key] = {"label": label, "income": 0, "expense": 0}
        for t in txs:
            key = (t.txDate or t.createdAt).strftime("%Y-%m-%d")
            if key in buckets:
                buckets[key][t.intent] = buckets[key].get(t.intent, 0) + t.amount
        data = list(buckets.values())

    elif period == "weekly":
        # Group by week
        buckets = {}
        for i in range(4):
            ws = start + timedelta(weeks=i)
            key = ws.strftime("%Y-W%W")
            buckets[key] = {"label": f"Mgg {i + 1}", "income": 0, "expense": 0}
        for t in txs:
            dt = t.txDate or t.createdAt
            key = dt.strftime("%Y-W%W")
            if key in buckets:
                buckets[key][t.intent] = buckets[key].get(t.intent, 0) + t.amount
        data = list(buckets.values())

    else:
        # Group by month
        month_names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
                       "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
        buckets = {}
        for i in range(6):
            d = start + timedelta(days=30 * i)
            key = d.strftime("%Y-%m")
            buckets[key] = {"label": month_names[d.month - 1], "income": 0, "expense": 0}
        for t in txs:
            dt = t.txDate or t.createdAt
            key = dt.strftime("%Y-%m")
            if key in buckets:
                buckets[key][t.intent] = buckets[key].get(t.intent, 0) + t.amount
        data = list(buckets.values())

    return {"data": data, "period": period}


@router.get("/health-score")
async def user_health_score(user_id: int = Depends(require_user)):
    """Financial health score (0-100) with strengths and improvements."""
    now = _utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)

    # This month transactions
    this_month_txs = await prisma.transaction.find_many(
        where={"userId": user_id, "createdAt": {"gte": month_start}},
    )
    # Last month transactions
    last_month_txs = await prisma.transaction.find_many(
        where={"userId": user_id, "createdAt": {"gte": last_month_start, "lt": month_start}},
    )

    this_income = sum(t.amount for t in this_month_txs if t.intent == "income")
    this_expense = sum(t.amount for t in this_month_txs if t.intent == "expense")
    last_income = sum(t.amount for t in last_month_txs if t.intent == "income")
    last_expense = sum(t.amount for t in last_month_txs if t.intent == "expense")

    # Scoring components
    score = 50  # base
    strengths = []
    improvements = []

    # 1. Savings ratio
    if this_income > 0:
        savings_ratio = (this_income - this_expense) / this_income
        if savings_ratio >= 0.3:
            score += 20
            strengths.append("Rasio tabungan di atas 30% — luar biasa!")
        elif savings_ratio >= 0.1:
            score += 10
            strengths.append("Rasio tabungan positif bulan ini")
        elif savings_ratio < 0:
            score -= 15
            improvements.append("Pengeluaran melebihi pemasukan bulan ini")
        else:
            improvements.append("Tingkatkan rasio tabungan (target: 20%+)")

    # 2. Expense control vs last month
    if last_expense > 0 and this_expense > 0:
        change = (this_expense - last_expense) / last_expense
        if change < -0.1:
            score += 10
            strengths.append("Pengeluaran turun dibanding bulan lalu")
        elif change > 0.2:
            score -= 10
            improvements.append("Pengeluaran naik signifikan dari bulan lalu")

    # 3. Transaction consistency (are they recording regularly?)
    tx_count = len(this_month_txs)
    days_elapsed = max(1, (now - month_start).days)
    avg_per_day = tx_count / days_elapsed
    if avg_per_day >= 1:
        score += 10
        strengths.append("Konsisten mencatat pengeluaran harian")
    elif tx_count > 0:
        score += 5
    else:
        improvements.append("Mulai catat transaksi secara rutin")

    # 4. Diversified categories
    categories = set(t.category for t in this_month_txs if t.intent == "expense")
    if len(categories) >= 3:
        score += 5
        strengths.append("Pencatatan kategori beragam dan terorganisir")

    # 5. No large impulsive spending
    if this_month_txs:
        avg_expense = this_expense / max(1, len([t for t in this_month_txs if t.intent == "expense"]))
        large_txs = [t for t in this_month_txs if t.intent == "expense" and t.amount > avg_expense * 3]
        if not large_txs:
            score += 5
            strengths.append("Tidak ada pengeluaran impulsif besar")
        else:
            improvements.append(f"Ada {len(large_txs)} transaksi besar yang perlu diperhatikan")

    score = max(0, min(100, score))

    # Determine label
    if score >= 80:
        label = "Sangat Baik"
    elif score >= 60:
        label = "Baik"
    elif score >= 40:
        label = "Cukup"
    else:
        label = "Perlu Perhatian"

    return {
        "score": score,
        "label": label,
        "strengths": strengths or ["Mulai lacak keuanganmu untuk analisis lebih dalam"],
        "improvements": improvements or ["Pertahankan kebiasaan baikmu!"],
    }


@router.get("/insight")
async def user_insight(user_id: int = Depends(require_user)):
    """AI-like insights based on transaction data."""
    now = _utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Get user
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=404)

    # Month transactions
    month_txs = await prisma.transaction.find_many(
        where={"userId": user_id, "createdAt": {"gte": month_start}},
    )
    month_income = sum(t.amount for t in month_txs if t.intent == "income")
    month_expense = sum(t.amount for t in month_txs if t.intent == "expense")

    # Week transactions for category analysis
    week_txs = await prisma.transaction.find_many(
        where={"userId": user_id, "createdAt": {"gte": week_start}},
    )

    insights = []

    # 1. Balance age (days until balance runs out)
    days_in_month = max(1, (now - month_start).days)
    if month_expense > 0:
        daily_avg_expense = month_expense / days_in_month
        balance = month_income - month_expense
        if daily_avg_expense > 0 and balance > 0:
            days_safe = int(balance / daily_avg_expense)
            insights.append({
                "type": "balance",
                "icon": "shield",
                "color": "emerald" if days_safe >= 7 else "amber",
                "title": f"Saldo aman {days_safe} hari",
                "desc": f"Berdasarkan rata-rata pengeluaran Rp{int(daily_avg_expense):,}/hari, saldo cukup untuk {days_safe} hari ke depan.",
            })

    # 2. Savings recommendation
    if month_income > 0:
        recommended_saving = int(month_income * 0.2)
        actual_saving = month_income - month_expense
        if actual_saving < recommended_saving:
            insights.append({
                "type": "saving",
                "icon": "trending",
                "color": "sky",
                "title": f"Rekomendasi tabungan Rp{recommended_saving:,}",
                "desc": f"Dengan pemasukan Rp{month_income:,} bulan ini, target tabungan 20% adalah Rp{recommended_saving:,}.",
            })
        else:
            insights.append({
                "type": "saving",
                "icon": "trending",
                "color": "emerald",
                "title": f"Tabungan On Track! Rp{actual_saving:,}",
                "desc": f"Kamu sudah menabung Rp{actual_saving:,} bulan ini, melebihi target 20%.",
            })

    # 3. Most expensive category this week
    week_expenses = [t for t in week_txs if t.intent == "expense"]
    if week_expenses:
        cat_totals: Dict[str, int] = {}
        for t in week_expenses:
            cat_totals[t.category] = cat_totals.get(t.category, 0) + t.amount
        top_cat = max(cat_totals, key=cat_totals.get)
        top_amount = cat_totals[top_cat]
        insights.append({
            "type": "category",
            "icon": "alert",
            "color": "amber",
            "title": f"Kategori paling boros: {top_cat}",
            "desc": f"Pengeluaran {top_cat} minggu ini Rp{top_amount:,}. Pertimbangkan untuk mengurangi.",
        })

    # Fallback if no insights
    if not insights:
        insights.append({
            "type": "info",
            "icon": "info",
            "color": "sky",
            "title": "Mulai catat transaksimu",
            "desc": "Kirim pesan ke bot Telegram FiNot untuk mulai mencatat pemasukan dan pengeluaran.",
        })

    return {
        "insights": insights,
        "updated_at": now.strftime("%d %b %Y, %H:%M"),
    }


@router.get("/recommendation")
async def user_recommendation(user_id: int = Depends(require_user)):
    """Generate AI-powered recommendation based on user's financial data."""
    from worker.analysis_service import get_saving_recommendation, get_daily_insight

    now = _utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Current month transactions
    this_txs = await prisma.transaction.find_many(
        where={"userId": user_id, "createdAt": {"gte": month_start}},
    )
    # All-time for balance
    all_txs = await prisma.transaction.find_many(where={"userId": user_id})

    this_income = sum(t.amount for t in this_txs if t.intent == "income")
    this_expense = sum(t.amount for t in this_txs if t.intent == "expense")
    balance = sum(t.amount for t in all_txs if t.intent == "income") - sum(t.amount for t in all_txs if t.intent == "expense")

    if not all_txs:
        return {
            "recommendation": "Kamu belum mencatat transaksi apapun. Mulai kirim pesan ke bot Telegram FiNot untuk mencatat pemasukan dan pengeluaranmu. Semakin banyak data keuanganmu, semakin akurat rekomendasi yang bisa diberikan.",
            "balance": 0,
            "this_month": {"income": 0, "expense": 0},
        }

    # Call real AI analysis
    try:
        ai_result = await get_saving_recommendation(user_id)
        if ai_result.get("success") and ai_result.get("data"):
            data = ai_result["data"]
            # Build recommendation from AI response
            parts = []
            if data.get("strategy"):
                parts.append(data["strategy"])
            if data.get("specific_tips"):
                tips = data["specific_tips"]
                if isinstance(tips, list) and tips:
                    parts.append("Tips: " + "; ".join(tips[:3]) + ".")
            if data.get("recommended_saving"):
                saving = data["recommended_saving"]
                parts.append(f"Target tabungan yang disarankan: Rp{saving:,}.")

            recommendation = " ".join(parts) if parts else None
        else:
            recommendation = None
    except Exception as e:
        _logger.warning(f"AI recommendation failed for user {user_id}: {e}")
        recommendation = None

    # Fallback: try daily insight if saving recommendation failed
    if not recommendation:
        try:
            insight_result = await get_daily_insight(user_id)
            if insight_result.get("success") and insight_result.get("data"):
                idata = insight_result["data"]
                parts = []
                if idata.get("insight"):
                    parts.append(idata["insight"])
                if idata.get("tip"):
                    parts.append(idata["tip"])
                recommendation = " ".join(parts) if parts else None
        except Exception as e:
            _logger.warning(f"AI daily insight fallback failed: {e}")

    # Final fallback
    if not recommendation:
        recommendation = "Rekomendasi AI sedang tidak tersedia. Coba lagi nanti."

    return {
        "recommendation": recommendation,
        "balance": balance,
        "this_month": {"income": this_income, "expense": this_expense},
    }


@router.get("/subscriptions")
async def user_subscription_history(user_id: int = Depends(require_user)):
    """Subscription & payment history for the user."""
    payments = await prisma.payment.find_many(
        where={"userId": user_id},
        order={"createdAt": "desc"},
        take=20,
    )

    subscriptions = await prisma.subscription.find_many(
        where={"userId": user_id},
        order={"createdAt": "desc"},
        take=20,
    )

    history = []
    for p in payments:
        # Find matching subscription
        matching_sub = None
        for s in subscriptions:
            if s.paymentId == p.id:
                matching_sub = s
                break

        history.append({
            "id": p.id,
            "date": _fmt_date(p.paidAt or p.createdAt),
            "plan": p.plan.capitalize(),
            "type": "subscription",
            "status": "active" if (matching_sub and matching_sub.isActive) else p.status,
            "amount": p.amount,
            "method": "QRIS (Trakteer)",
            "invoice": f"#INV-{p.createdAt.strftime('%Y-%m%d')}-{p.id:04d}" if p.createdAt else f"#INV-{p.id}",
        })

    # Add subscriptions without payment (e.g. voucher activated)
    paid_sub_ids = {s.paymentId for s in subscriptions if s.paymentId}
    for s in subscriptions:
        if s.paymentId is None:
            history.append({
                "id": s.id + 100000,
                "date": _fmt_date(s.startDate),
                "plan": s.plan.capitalize(),
                "type": "voucher",
                "status": "active" if s.isActive else "expired",
                "amount": 0,
                "method": "Voucher",
                "invoice": f"#FNT-{s.id:04d}",
            })

    # Sort by date desc
    history.sort(key=lambda x: x["id"], reverse=True)

    return {"history": history}


# ─── Profile / Settings endpoints ──────────────────────────


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    web_login: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/update-profile")
async def update_profile(req: UpdateProfileRequest, user_id: int = Depends(require_user)):
    """Update user display name or web login."""
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = {}
    if req.display_name and req.display_name.strip():
        data["displayName"] = req.display_name.strip()
    if req.web_login and req.web_login.strip():
        new_login = req.web_login.strip()
        existing = await prisma.user.find_first(
            where={"webLogin": new_login, "id": {"not": user_id}}
        )
        if existing:
            return JSONResponse(
                {"success": False, "error": f"Username '{new_login}' sudah digunakan"},
                status_code=400,
            )
        data["webLogin"] = new_login

    if not data:
        return JSONResponse({"success": False, "error": "Tidak ada perubahan"}, status_code=400)

    updated = await prisma.user.update(where={"id": user_id}, data=data)
    return {
        "success": True,
        "user": {
            "id": str(updated.id),
            "username": updated.webLogin,
            "display_name": updated.displayName,
            "plan": updated.plan,
        },
    }


@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, user_id: int = Depends(require_user)):
    """Change user's web password."""
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.webPassword or user.webPassword != _hash_password(req.current_password):
        return JSONResponse(
            {"success": False, "error": "Password lama salah"},
            status_code=400,
        )

    if len(req.new_password) < 6:
        return JSONResponse(
            {"success": False, "error": "Password baru minimal 6 karakter"},
            status_code=400,
        )

    await prisma.user.update(
        where={"id": user_id},
        data={"webPassword": _hash_password(req.new_password)},
    )
    return {"success": True, "message": "Password berhasil diubah"}


# ─── AI Analysis endpoints (real LLM) ──────────────────────


async def _check_ai_access(user_id: int, feature: str):
    """Check plan + credits for AI feature. Raises HTTPException if denied."""
    from app.services.subscription_service import (
        check_feature_access, get_user_plan, consume_ai_credit,
    )
    from app.config import FEATURE_CREDIT_COST
    plan = await get_user_plan(user_id)
    if not check_feature_access(plan, feature):
        raise HTTPException(
            status_code=403,
            detail=f"Fitur ini memerlukan paket Pro/Elite. Paket kamu saat ini: {plan}.",
        )
    cost = FEATURE_CREDIT_COST.get(feature, 1)
    consumed = await consume_ai_credit(user_id, amount=cost)
    if not consumed:
        raise HTTPException(
            status_code=429,
            detail="Kredit AI habis untuk periode ini. Tunggu refill atau upgrade paket.",
        )


class SimulationRequest(BaseModel):
    scenario: str = "hemat 10000 per hari"


@router.get("/ai/daily-insight")
async def ai_daily_insight(user_id: int = Depends(require_user)):
    """AI-powered daily insight using LLM."""
    from worker.analysis_service import get_daily_insight
    await _check_ai_access(user_id, "daily_insight")
    result = await get_daily_insight(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/balance-prediction")
async def ai_balance_prediction(user_id: int = Depends(require_user)):
    """AI-powered balance prediction (how many days left)."""
    from worker.analysis_service import get_balance_prediction
    await _check_ai_access(user_id, "balance_prediction")
    result = await get_balance_prediction(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/health-score")
async def ai_health_score(user_id: int = Depends(require_user)):
    """AI-powered financial health score (LLM version)."""
    from worker.analysis_service import get_financial_health_score
    await _check_ai_access(user_id, "health_score")
    result = await get_financial_health_score(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.post("/ai/simulation")
async def ai_simulation(req: SimulationRequest, user_id: int = Depends(require_user)):
    """AI-powered saving simulation with natural language scenario."""
    from worker.analysis_service import get_saving_simulation
    await _check_ai_access(user_id, "saving_recommendation")
    result = await get_saving_simulation(user_id, user_scenario=req.scenario)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/weekly-analysis")
async def ai_weekly_analysis(user_id: int = Depends(require_user)):
    """AI-powered weekly deep analysis."""
    from worker.analysis_service import get_weekly_analysis
    await _check_ai_access(user_id, "weekly_summary")
    result = await get_weekly_analysis(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/monthly-analysis")
async def ai_monthly_analysis(user_id: int = Depends(require_user)):
    """AI-powered monthly deep analysis."""
    from worker.analysis_service import get_monthly_analysis
    await _check_ai_access(user_id, "monthly_analysis")
    result = await get_monthly_analysis(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


# ─── New AI Feature endpoints (13 features) ────────────────


@router.get("/ai/anomaly-detection")
async def ai_anomaly_detection(user_id: int = Depends(require_user)):
    """#6 Spending Anomaly Detection."""
    from worker.analysis_service import get_anomaly_detection
    await _check_ai_access(user_id, "daily_insight")
    result = await get_anomaly_detection(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/burn-rate")
async def ai_burn_rate(user_id: int = Depends(require_user)):
    """#7 Burn Rate Analysis (Elite)."""
    from worker.analysis_service import get_burn_rate
    await _check_ai_access(user_id, "advanced_tracking")
    result = await get_burn_rate(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/budget-suggestion")
async def ai_budget_suggestion(user_id: int = Depends(require_user)):
    """#8 Smart Budget Suggestion (Elite)."""
    from worker.analysis_service import get_budget_suggestion
    await _check_ai_access(user_id, "advanced_tracking")
    result = await get_budget_suggestion(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/subscription-detector")
async def ai_subscription_detector(user_id: int = Depends(require_user)):
    """#9 Subscription Detector (Elite)."""
    from worker.analysis_service import get_subscription_detector
    await _check_ai_access(user_id, "advanced_tracking")
    result = await get_subscription_detector(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


class GoalSavingRequest(BaseModel):
    goal: str = "Tabungan darurat 3 bulan"


@router.post("/ai/goal-saving")
async def ai_goal_saving(req: GoalSavingRequest, user_id: int = Depends(require_user)):
    """#11 Goal-based Saving (Elite)."""
    from worker.analysis_service import get_goal_saving
    await _check_ai_access(user_id, "forecast_3month")
    result = await get_goal_saving(user_id, goal_text=req.goal)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/payday-planning")
async def ai_payday_planning(user_id: int = Depends(require_user)):
    """#12 Payday Planning (Elite)."""
    from worker.analysis_service import get_payday_planning
    await _check_ai_access(user_id, "forecast_3month")
    result = await get_payday_planning(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/overspending-alert")
async def ai_overspending_alert(user_id: int = Depends(require_user)):
    """#13 Category Overspending Alert."""
    from worker.analysis_service import get_overspending_alert
    await _check_ai_access(user_id, "daily_insight")
    result = await get_overspending_alert(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/weekend-pattern")
async def ai_weekend_pattern(user_id: int = Depends(require_user)):
    """#14 Weekend Spending Pattern (Elite)."""
    from worker.analysis_service import get_weekend_pattern
    await _check_ai_access(user_id, "advanced_tracking")
    result = await get_weekend_pattern(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/expense-limit")
async def ai_expense_limit(user_id: int = Depends(require_user)):
    """#15 Daily Expense Limit Reminder."""
    from worker.analysis_service import get_expense_limit
    await _check_ai_access(user_id, "daily_insight")
    result = await get_expense_limit(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/expense-prediction")
async def ai_expense_prediction(user_id: int = Depends(require_user)):
    """#16 Expense Prediction (Elite)."""
    from worker.analysis_service import get_expense_prediction
    await _check_ai_access(user_id, "forecast_3month")
    result = await get_expense_prediction(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/savings-opportunity")
async def ai_savings_opportunity(user_id: int = Depends(require_user)):
    """#17 Savings Opportunity Finder."""
    from worker.analysis_service import get_savings_opportunity
    await _check_ai_access(user_id, "daily_insight")
    result = await get_savings_opportunity(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


class AIChatRequest(BaseModel):
    question: str


@router.post("/ai/chat")
async def ai_chat(req: AIChatRequest, user_id: int = Depends(require_user)):
    """#18 AI Financial Chat (Elite)."""
    from worker.analysis_service import get_ai_chat
    await _check_ai_access(user_id, "priority_ai")
    result = await get_ai_chat(user_id, question=req.question)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/weekly-strategy")
async def ai_weekly_strategy(user_id: int = Depends(require_user)):
    """#20 Weekly Strategy Suggestion."""
    from worker.analysis_service import get_weekly_strategy
    await _check_ai_access(user_id, "weekly_summary")
    result = await get_weekly_strategy(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


@router.get("/ai/smart-notification")
async def ai_smart_notification(user_id: int = Depends(require_user)):
    """#19 Smart Notification — spending alerts and threshold checks."""
    from worker.analysis_service import get_smart_notification
    result = await get_smart_notification(user_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Gagal menganalisis"))
    return result


# ─── Transaction History endpoints ──────────────────────────


@router.get("/transactions")
async def user_transactions(
    request: Request,
    intent: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    user_id: int = Depends(require_user),
):
    """Get paginated transaction list with filters."""
    where: Dict[str, Any] = {"userId": user_id}

    if intent and intent in ("income", "expense"):
        where["intent"] = intent
    if category:
        where["category"] = category

    date_filters: Dict[str, Any] = {}
    if date_from:
        try:
            date_filters["gte"] = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    if date_to:
        try:
            date_filters["lte"] = datetime.strptime(date_to, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
        except ValueError:
            pass
    if date_filters:
        where["createdAt"] = date_filters

    total = await prisma.transaction.count(where=where)
    skip = (page - 1) * limit

    txs = await prisma.transaction.find_many(
        where=where,
        order={"createdAt": "desc"},
        skip=skip,
        take=limit,
    )

    # Get unique categories for filter dropdown
    all_user_txs = await prisma.transaction.find_many(
        where={"userId": user_id},
        distinct=["category"],
    )
    categories = sorted(set(t.category for t in all_user_txs if t.category))

    items = []
    for t in txs:
        items.append({
            "id": str(t.id),
            "intent": t.intent,
            "amount": t.amount,
            "category": t.category or "Lainnya",
            "note": t.note or "",
            "date": _fmt_date(t.txDate or t.createdAt),
            "created_at": (t.txDate or t.createdAt).isoformat(),
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
        "categories": categories,
    }


@router.get("/transactions/export")
async def export_transactions_csv(
    request: Request,
    intent: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user_id: int = Depends(require_user),
):
    """Export transactions as CSV (Excel-compatible)."""
    import csv
    import io

    where: Dict[str, Any] = {"userId": user_id}

    if intent and intent in ("income", "expense"):
        where["intent"] = intent
    if category:
        where["category"] = category

    date_filters: Dict[str, Any] = {}
    if date_from:
        try:
            date_filters["gte"] = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    if date_to:
        try:
            date_filters["lte"] = datetime.strptime(date_to, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
        except ValueError:
            pass
    if date_filters:
        where["createdAt"] = date_filters

    txs = await prisma.transaction.find_many(
        where=where,
        order={"createdAt": "desc"},
        take=5000,
    )

    output = io.StringIO()
    # BOM for Excel UTF-8 compatibility
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(["Tanggal", "Jenis", "Kategori", "Jumlah (IDR)", "Catatan"])

    for t in txs:
        writer.writerow([
            (t.txDate or t.createdAt).strftime("%Y-%m-%d"),
            "Pemasukan" if t.intent == "income" else "Pengeluaran",
            t.category or "Lainnya",
            t.amount,
            t.note or "",
        ])

    from starlette.responses import Response

    # Build dynamic filename: rekap_username_dateFrom_sampai_dateTo.csv
    user = await prisma.user.find_unique(where={"id": user_id})
    uname = (user.webLogin or user.firstName or str(user_id)).replace(" ", "_")
    parts = [uname]
    if date_from:
        parts.append(date_from)
        parts.append("sampai")
    if date_to:
        parts.append(date_to)
    elif date_from:
        parts.append("sekarang")
    filename = "rekap_" + "_".join(parts) + ".csv"

    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── Report endpoints ─────────────────────────────────────


class ReportCreateRequest(BaseModel):
    subject: str
    message: str
    category: str = "bug"  # bug | feature | complaint | other


@router.post("/reports")
async def create_report(req: ReportCreateRequest, user_id: int = Depends(require_user)):
    """Submit a new report/feedback."""
    try:
        if not req.subject.strip() or not req.message.strip():
            return JSONResponse({"success": False, "error": "Subjek dan pesan wajib diisi"})

        if req.category not in ("bug", "feature", "complaint", "other"):
            req.category = "other"

        report = await prisma.report.create(
            data={
                "userId": user_id,
                "subject": req.subject.strip(),
                "message": req.message.strip(),
                "category": req.category,
                "status": "open",
            }
        )

        return JSONResponse({
            "success": True,
            "report_id": report.id,
            "message": "Laporan berhasil dikirim! Tim kami akan segera menanggapi.",
        })

    except Exception as e:
        _logger.error(f"Error creating report: {e}", exc_info=True)
        return JSONResponse({"success": False, "error": "Gagal mengirim laporan"})


@router.get("/reports")
async def list_reports(user_id: int = Depends(require_user)):
    """List user's own reports."""
    try:
        reports = await prisma.report.find_many(
            where={"userId": user_id},
            order={"createdAt": "desc"},
            take=50,
        )

        items = []
        for r in reports:
            items.append({
                "id": r.id,
                "subject": r.subject,
                "message": r.message,
                "category": r.category,
                "status": r.status,
                "admin_reply": r.adminReply,
                "replied_at": _fmt_dt(r.repliedAt) if r.repliedAt else None,
                "created_at": _fmt_dt(r.createdAt),
            })

        return JSONResponse({"reports": items})

    except Exception as e:
        _logger.error(f"Error listing reports: {e}", exc_info=True)
        return JSONResponse({"reports": []})

