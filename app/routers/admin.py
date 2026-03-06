"""
Admin API Router
━━━━━━━━━━━━━━━━
JSON API endpoints for the React admin dashboard.
All endpoints return JSON — no HTML templates.
"""

import hashlib
import logging
import os
import secrets
import string
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db.connection import prisma
from app.services.admin_service import (
    adjust_credits,
    get_ai_usage_data,
    get_broadcast_stats,
    get_error_logs,
    get_funnel_data,
    get_recent_payments,
    get_revenue_data,
    get_subscription_details,
    send_broadcast,
)
from app.services.subscription_service import check_ai_credits, activate_subscription
from app.services.voucher_service import create_voucher

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/api", tags=["admin"])

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "finot123")

# In-memory sessions (restart clears them — acceptable for admin)
SESSIONS: set = set()


# ─── Auth helpers ──────────────────────────────────────────


async def get_current_admin(request: Request) -> Optional[str]:
    session_id = request.cookies.get("admin_session")
    if not session_id or session_id not in SESSIONS:
        return None
    return ADMIN_USERNAME


async def require_admin(request: Request) -> str:
    admin = await get_current_admin(request)
    if not admin:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return admin


# ─── Auth endpoints ────────────────────────────────────────


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(req: LoginRequest):
    if req.username == ADMIN_USERNAME and req.password == ADMIN_PASSWORD:
        session_id = secrets.token_hex(16)
        SESSIONS.add(session_id)
        resp = JSONResponse({"success": True, "admin": ADMIN_USERNAME})
        resp.set_cookie(key="admin_session", value=session_id, httponly=True)
        return resp
    return JSONResponse(
        {"success": False, "error": "Username atau password salah"},
        status_code=401,
    )


@router.get("/me")
async def me(request: Request):
    admin = await get_current_admin(request)
    if not admin:
        return JSONResponse({"authenticated": False}, status_code=401)
    return {"authenticated": True, "admin": admin}


@router.get("/logout")
async def logout(request: Request):
    session_id = request.cookies.get("admin_session")
    if session_id:
        SESSIONS.discard(session_id)
    resp = JSONResponse({"success": True})
    resp.delete_cookie("admin_session")
    return resp


# ─── Dashboard aggregate ──────────────────────────────────


@router.get("/dashboard")
async def dashboard(admin: str = Depends(require_admin)):
    now = datetime.now(timezone.utc)

    # Build user list with credits
    users_raw = await prisma.user.find_many(order={"createdAt": "desc"})
    user_list = []
    for u in users_raw:
        try:
            credits = await check_ai_credits(u.id)
        except Exception:
            credits = {"remaining": 0, "total": 0}
        user_list.append(
            {
                "id": str(u.id),
                "username": u.username or "-",
                "display_name": u.displayName or u.username or "-",
                "plan": u.plan or "free",
                "credits_remaining": credits.get("remaining", 0),
                "credits_total": credits.get("total", 0),
                "created_at": u.createdAt.isoformat() if u.createdAt else None,
            }
        )

    # Gather all dashboard data in parallel-friendly manner
    revenue = await get_revenue_data()
    recent_payments = await get_recent_payments()
    subscriptions = await get_subscription_details()
    ai_usage = await get_ai_usage_data()
    logs = await get_error_logs()
    broadcast_stats_data = await get_broadcast_stats()
    funnel = await get_funnel_data()

    return {
        "admin": admin,
        "now": now.isoformat(),
        "users": user_list,
        "revenue": revenue,
        "recent_payments": recent_payments,
        "subscriptions": subscriptions,
        "ai_usage": ai_usage,
        "logs": logs,
        "broadcast_stats": broadcast_stats_data,
        "funnel": funnel,
    }


# ─── Vouchers ─────────────────────────────────────────────


@router.get("/vouchers")
async def vouchers_list(admin: str = Depends(require_admin)):
    vouchers = await prisma.voucher.find_many(order={"createdAt": "desc"})
    return {
        "vouchers": [
            {
                "id": v.id,
                "code": v.code,
                "target_user": v.targetUser,
                "plan": v.plan,
                "duration_days": v.durationDays,
                "is_used": v.isUsed,
                "created_at": v.createdAt.isoformat() if v.createdAt else None,
            }
            for v in vouchers
        ]
    }


class VoucherCreateRequest(BaseModel):
    target: Optional[str] = None
    plan: str
    duration: int


@router.post("/vouchers/create")
async def create_new_voucher(
    req: VoucherCreateRequest, admin: str = Depends(require_admin)
):
    try:
        voucher = await create_voucher(
            plan=req.plan,
            duration_days=req.duration,
            target_user=req.target or None,
        )
        code = voucher.get("code", "created") if isinstance(voucher, dict) else (
            voucher.code if hasattr(voucher, "code") else "created"
        )
        return {"success": True, "code": code}
    except Exception as e:
        _logger.error(f"Voucher creation failed: {e}")
        return JSONResponse(
            {"success": False, "error": str(e)}, status_code=500
        )


# ─── Credit Adjustment ────────────────────────────────────


class CreditAdjustRequest(BaseModel):
    user_id: str
    action: str
    amount: int = 0
    reason: str = ""


@router.post("/credits/adjust")
async def api_credit_adjust(
    req: CreditAdjustRequest, admin: str = Depends(require_admin)
):
    try:
        user_id = int(req.user_id)
    except ValueError:
        return JSONResponse({"success": False, "error": "Invalid user ID"})

    if req.action not in ("add", "subtract", "reset", "bonus"):
        return JSONResponse({"success": False, "error": "Invalid action"})

    result = await adjust_credits(
        user_id=user_id,
        action=req.action,
        amount=req.amount,
        reason=req.reason,
    )
    return JSONResponse(result)


# ─── Broadcast ────────────────────────────────────────────


class BroadcastRequest(BaseModel):
    target: str
    message: str


@router.post("/broadcast")
async def api_broadcast(
    req: BroadcastRequest, admin: str = Depends(require_admin)
):
    if not req.message.strip():
        return JSONResponse({"success": False, "error": "Message cannot be empty"})
    if req.target not in ("all", "premium", "pro", "elite", "free"):
        return JSONResponse({"success": False, "error": "Invalid target"})

    result = await send_broadcast(target=req.target, message=req.message)
    return JSONResponse(result)


# ─── User Management (App Users) ──────────────────────────

def _hash_password(password: str) -> str:
    """Simple SHA-256 hash."""
    return hashlib.sha256(password.encode()).hexdigest()


def _generate_password(length: int = 8) -> str:
    """Generate a random password."""
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


class AppUserCreateRequest(BaseModel):
    display_name: str
    web_login: Optional[str] = None   # If empty, auto-generate from display_name
    password: Optional[str] = None    # If empty, auto-generate
    plan: str = "free"
    telegram_id: Optional[int] = None


class AppUserUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    web_login: Optional[str] = None
    password: Optional[str] = None
    plan: Optional[str] = None


@router.get("/app-users")
async def list_app_users(admin: str = Depends(require_admin)):
    """List all users with their web login info."""
    users = await prisma.user.find_many(
        order={"createdAt": "desc"},
        include={"subscriptions": True},
    )

    now = datetime.now(timezone.utc)
    user_list = []
    for u in users:
        # Check credits
        try:
            credits = await check_ai_credits(int(u.id))
        except Exception:
            credits = {"remaining": 0, "total": 0}

        # Active subscription
        active_sub = None
        for s in (u.subscriptions or []):
            if s.isActive and s.endDate >= now:
                active_sub = s
                break

        user_list.append({
            "id": str(u.id),
            "username": u.username or "-",
            "display_name": u.displayName or "-",
            "web_login": u.webLogin or "",
            "has_web_access": bool(u.webLogin and u.webPassword),
            "plan": u.plan or "free",
            "credits_remaining": credits.get("remaining", 0),
            "credits_total": credits.get("total", 0),
            "sub_end_date": active_sub.endDate.strftime("%d %b %Y") if active_sub else None,
            "created_at": u.createdAt.isoformat() if u.createdAt else None,
        })

    return {"users": user_list}


@router.post("/app-users/create")
async def create_app_user(
    req: AppUserCreateRequest,
    admin: str = Depends(require_admin),
):
    """Create a new app user with web login credentials."""
    # Auto-generate web_login if not provided
    import time, re as _re
    web_login = req.web_login
    if not web_login:
        base = _re.sub(r"[^a-z0-9]", "", (req.display_name or "user").lower())
        if len(base) < 3:
            base = "user"
        web_login = base + str(int(time.time()) % 10000)

    # Check if web_login already taken
    existing = await prisma.user.find_first(where={"webLogin": web_login})
    if existing:
        return JSONResponse(
            {"success": False, "error": f"Login '{web_login}' sudah digunakan"},
            status_code=400,
        )

    password = req.password or _generate_password()
    hashed = _hash_password(password)

    # Generate a unique ID (positive, based on timestamp)
    new_id = int(time.time() * 1000) % (10**12)
    if req.telegram_id:
        new_id = req.telegram_id

    # Make sure ID doesn't collide
    while await prisma.user.find_unique(where={"id": new_id}):
        new_id += 1

    chosen_plan = req.plan if req.plan in ("free", "pro", "elite") else "free"

    user = await prisma.user.create(
        data={
            "id": new_id,
            "displayName": req.display_name,
            "webLogin": web_login,
            "webPassword": hashed,
            "plan": chosen_plan,
        }
    )

    # If plan is pro/elite, create a subscription record so it doesn't get downgraded
    if chosen_plan in ("pro", "elite"):
        try:
            await activate_subscription(
                user_id=new_id,
                plan=chosen_plan,
                duration_days=30,
            )
        except Exception as e:
            _logger.warning(f"Failed to create subscription for new user {new_id}: {e}")

    return {
        "success": True,
        "user": {
            "id": str(user.id),
            "display_name": user.displayName,
            "web_login": user.webLogin,
            "password_plain": password,  # Show once to admin — SAVE THIS!
            "plan": user.plan,
        },
    }


@router.put("/app-users/{user_id}")
async def update_app_user(
    user_id: str,
    req: AppUserUpdateRequest,
    admin: str = Depends(require_admin),
):
    """Update an existing user's web login, password, display name, or plan."""
    try:
        uid = int(user_id)
    except ValueError:
        return JSONResponse({"success": False, "error": "Invalid user ID"}, status_code=400)

    user = await prisma.user.find_unique(where={"id": uid})
    if not user:
        return JSONResponse({"success": False, "error": "User not found"}, status_code=404)

    data = {}
    if req.display_name:
        data["displayName"] = req.display_name
    if req.web_login:
        # Check uniqueness
        existing = await prisma.user.find_first(
            where={"webLogin": req.web_login, "id": {"not": uid}}
        )
        if existing:
            return JSONResponse(
                {"success": False, "error": f"Login '{req.web_login}' sudah digunakan"},
                status_code=400,
            )
        data["webLogin"] = req.web_login
    if req.password:
        data["webPassword"] = _hash_password(req.password)
    if req.plan and req.plan in ("free", "pro", "elite"):
        data["plan"] = req.plan

    if not data:
        return JSONResponse({"success": False, "error": "Nothing to update"}, status_code=400)

    updated = await prisma.user.update(where={"id": uid}, data=data)

    # If plan changed to pro/elite, create subscription record
    if req.plan and req.plan in ("pro", "elite"):
        try:
            await activate_subscription(
                user_id=uid,
                plan=req.plan,
                duration_days=30,
            )
        except Exception as e:
            _logger.warning(f"Failed to create subscription for user {uid}: {e}")
    elif req.plan == "free":
        # Downgrade: deactivate all subscriptions
        await prisma.subscription.update_many(
            where={"userId": uid, "isActive": True},
            data={"isActive": False},
        )

    return {
        "success": True,
        "user": {
            "id": str(updated.id),
            "display_name": updated.displayName,
            "web_login": updated.webLogin,
            "plan": updated.plan,
        },
    }


@router.post("/app-users/{user_id}/set-password")
async def set_user_password(
    user_id: str,
    admin: str = Depends(require_admin),
):
    """Generate and set a new random password for a user."""
    try:
        uid = int(user_id)
    except ValueError:
        return JSONResponse({"success": False, "error": "Invalid user ID"}, status_code=400)

    user = await prisma.user.find_unique(where={"id": uid})
    if not user:
        return JSONResponse({"success": False, "error": "User not found"}, status_code=404)

    password = _generate_password()
    hashed = _hash_password(password)

    # Create web_login if not exists
    web_login = user.webLogin
    if not web_login:
        # Auto-generate from display name
        base = (user.displayName or f"user{uid}").lower().replace(" ", "")
        web_login = base
        counter = 1
        while await prisma.user.find_first(where={"webLogin": web_login, "id": {"not": uid}}):
            web_login = f"{base}{counter}"
            counter += 1

    await prisma.user.update(
        where={"id": uid},
        data={"webLogin": web_login, "webPassword": hashed},
    )

    return {
        "success": True,
        "web_login": web_login,
        "password_plain": password,
    }


# ─── Bulk Credential Generation ──────────────────────────


@router.post("/app-users/generate-missing-credentials")
async def generate_missing_credentials(admin: str = Depends(require_admin)):
    """Find all users who don't have web dashboard credentials and create them.
    Also sends credentials via Telegram to each user.
    """
    import re as _re

    # Find users without web credentials
    users_without_creds = await prisma.user.find_many(
        where={
            "OR": [
                {"webLogin": None},
                {"webPassword": None},
                {"webLogin": ""},
                {"webPassword": ""},
            ]
        },
        order={"createdAt": "desc"},
    )

    if not users_without_creds:
        return {"success": True, "message": "Semua user sudah punya akun dashboard!", "count": 0}

    results = []
    dashboard_url = os.getenv("WEBHOOK_URL", "https://finot.twenti.studio").rstrip("/")
    # Clean up URL for dashboard
    if "/webhook" in dashboard_url:
        dashboard_url = dashboard_url.split("/webhook")[0]

    for u in users_without_creds:
        try:
            # Generate web_login from display name or username
            base = _re.sub(r"[^a-z0-9]", "", (u.displayName or u.username or f"user{u.id}").lower())
            if len(base) < 3:
                base = "user"
            web_login = base

            # Ensure uniqueness
            counter = 1
            while await prisma.user.find_first(where={"webLogin": web_login, "id": {"not": u.id}}):
                web_login = f"{base}{counter}"
                counter += 1

            password = _generate_password()
            hashed = _hash_password(password)

            # Also set trial plan if they're on free and don't have trialEndsAt set
            update_data = {
                "webLogin": web_login,
                "webPassword": hashed,
            }

            # Give trial plan if they haven't had one yet
            if u.plan in ("free", None) and u.trialEndsAt is None:
                from datetime import timedelta
                update_data["plan"] = "trial"
                update_data["trialEndsAt"] = datetime.now(timezone.utc) + timedelta(days=7)

                # Create trial credits (35 total)
                existing_credits = await prisma.aicredit.find_first(where={"userId": u.id})
                if not existing_credits:
                    await prisma.aicredit.create(
                        data={
                            "userId": u.id,
                            "totalCredits": 35,
                            "usedCredits": 0,
                            "weekStartAt": datetime.now(timezone.utc),
                        }
                    )

            await prisma.user.update(where={"id": u.id}, data=update_data)

            # Send credentials via Telegram
            try:
                from app.webhook.telegram import send_telegram_message

                plan_label = update_data.get("plan", u.plan or "free").upper()
                trial_msg = ""
                if update_data.get("plan") == "trial":
                    trial_msg = (
                        "\n\n🎁 <b>Bonus!</b> Kamu mendapat Trial 7 hari gratis "
                        "dengan akses semua fitur AI (35 kredit)!"
                    )

                msg = (
                    f"🎉 <b>Akun Dashboard FiNot Kamu Sudah Siap!</b>\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"📊 Dashboard: <b>{dashboard_url}/login</b>\n\n"
                    f"👤 Username: <code>{web_login}</code>\n"
                    f"🔑 Password: <code>{password}</code>\n\n"
                    f"Paket: <b>{plan_label}</b>"
                    f"{trial_msg}\n\n"
                    f"⚠️ Segera ubah password setelah login!\n"
                    f"Ketik /help untuk bantuan."
                )
                await send_telegram_message(int(u.id), msg)
            except Exception as e:
                _logger.warning(f"Failed to send credentials to user {u.id}: {e}")

            results.append({
                "user_id": str(u.id),
                "display_name": u.displayName or u.username or "-",
                "web_login": web_login,
                "password": password,
                "plan": update_data.get("plan", u.plan),
                "notified": True,
            })

        except Exception as e:
            _logger.error(f"Failed to generate credentials for user {u.id}: {e}")
            results.append({
                "user_id": str(u.id),
                "display_name": u.displayName or "-",
                "error": str(e),
            })

    return {
        "success": True,
        "count": len(results),
        "users": results,
    }


# ─── Reports Management ──────────────────────────────────


@router.get("/reports")
async def admin_list_reports(
    status: Optional[str] = None,
    admin: str = Depends(require_admin),
):
    """List all user reports, optionally filtered by status."""
    where = {}
    if status and status in ("open", "in_progress", "resolved", "closed"):
        where["status"] = status

    reports = await prisma.report.find_many(
        where=where,
        order={"createdAt": "desc"},
        include={"user": True},
        take=100,
    )

    items = []
    for r in reports:
        items.append({
            "id": r.id,
            "user_id": str(r.userId),
            "user_name": r.user.displayName if r.user else "-",
            "user_plan": r.user.plan if r.user else "free",
            "subject": r.subject,
            "message": r.message,
            "category": r.category,
            "status": r.status,
            "admin_reply": r.adminReply,
            "replied_at": r.repliedAt.isoformat() if r.repliedAt else None,
            "created_at": r.createdAt.isoformat() if r.createdAt else None,
        })

    # Count by status
    open_count = await prisma.report.count(where={"status": "open"})
    in_progress_count = await prisma.report.count(where={"status": "in_progress"})

    return {
        "reports": items,
        "counts": {
            "open": open_count,
            "in_progress": in_progress_count,
            "total": len(items),
        },
    }


class ReportReplyRequest(BaseModel):
    reply: str
    status: str = "resolved"  # resolved | closed | in_progress


@router.post("/reports/{report_id}/reply")
async def admin_reply_report(
    report_id: int,
    req: ReportReplyRequest,
    admin: str = Depends(require_admin),
):
    """Reply to a user report."""
    report = await prisma.report.find_unique(where={"id": report_id})
    if not report:
        return JSONResponse({"success": False, "error": "Report not found"}, status_code=404)

    if not req.reply.strip():
        return JSONResponse({"success": False, "error": "Reply cannot be empty"})

    valid_statuses = ("open", "in_progress", "resolved", "closed")
    new_status = req.status if req.status in valid_statuses else "resolved"

    await prisma.report.update(
        where={"id": report_id},
        data={
            "adminReply": req.reply.strip(),
            "status": new_status,
            "repliedAt": datetime.now(timezone.utc),
        },
    )

    # Optionally notify the user via Telegram
    try:
        from app.webhook.telegram import send_telegram_message
        if report.userId > 0:  # Only notify real Telegram users (positive ID)
            await send_telegram_message(
                int(report.userId),
                f"📬 <b>Balasan untuk laporan kamu:</b>\n\n"
                f"<b>{report.subject}</b>\n\n"
                f"{req.reply.strip()}\n\n"
                f"Status: <b>{new_status.replace('_', ' ').title()}</b>",
            )
    except Exception as e:
        _logger.warning(f"Failed to notify user about report reply: {e}")

    return {"success": True, "message": "Reply sent"}


@router.put("/reports/{report_id}/status")
async def admin_update_report_status(
    report_id: int,
    status: str,
    admin: str = Depends(require_admin),
):
    """Update report status without replying."""
    valid_statuses = ("open", "in_progress", "resolved", "closed")
    if status not in valid_statuses:
        return JSONResponse({"success": False, "error": "Invalid status"})

    report = await prisma.report.find_unique(where={"id": report_id})
    if not report:
        return JSONResponse({"success": False, "error": "Report not found"}, status_code=404)

    await prisma.report.update(
        where={"id": report_id},
        data={"status": status},
    )

    return {"success": True, "status": status}

