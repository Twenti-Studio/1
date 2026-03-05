"""
Landing Page API Endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━
Handles payment creation and status checking for the web landing page.
Uses the same Trakteer QRIS payment flow as the Telegram bot.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db.connection import prisma
from app.config import TRAKTEER_PAGE_URL, PLAN_CONFIG
from app.services.payment_service import create_payment_order, check_payment_status, get_cached_credentials

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/landing", tags=["landing"])


class PaymentCreateRequest(BaseModel):
    plan: str  # pro | elite
    contact_type: str  # telegram | whatsapp
    contact_value: str  # @username or phone number
    name: Optional[str] = None  # subscriber's name


class PaymentCreateResponse(BaseModel):
    success: bool
    payment_id: Optional[int] = None
    transaction_id: Optional[str] = None
    plan: Optional[str] = None
    amount: Optional[int] = None
    trakteer_url: Optional[str] = None
    qris_url: Optional[str] = None
    error: Optional[str] = None


@router.post("/payment/create")
async def create_landing_payment(req: PaymentCreateRequest):
    """
    Create a payment order from the landing page.
    Stores contact info and creates a payment via the same flow as Telegram.
    """
    try:
        # Validate plan
        if req.plan not in ("pro", "elite"):
            return JSONResponse({"success": False, "error": "Plan tidak valid"})

        if not req.contact_value.strip():
            return JSONResponse({"success": False, "error": "Harap isi kontak"})

        # Normalise contact
        contact_value = req.contact_value.strip()
        if req.contact_type == "telegram" and not contact_value.startswith("@"):
            contact_value = "@" + contact_value

        # Try to find existing user by username, or create a placeholder
        # For web payments, we create a temporary user entry with a negative ID
        # The user will be matched when they interact with the bot later
        user = None

        if req.contact_type == "telegram":
            # Try to find by telegram username
            user = await prisma.user.find_first(
                where={"username": contact_value.lstrip("@")}
            )

        if not user:
            # Create a placeholder record with the contact info stored
            import hashlib as _hl
            hash_val = int(_hl.sha256(contact_value.encode()).hexdigest()[:12], 16)
            placeholder_id = -(hash_val % (10**10))  # Negative ID to distinguish web users

            # Check if placeholder already exists
            user = await prisma.user.find_unique(where={"id": placeholder_id})
            if not user:
                user_display = req.name.strip() if req.name and req.name.strip() else contact_value
                user = await prisma.user.create(
                    data={
                        "id": placeholder_id,
                        "username": contact_value.lstrip("@"),
                        "displayName": user_display,
                        "plan": "free",
                    }
                )
            elif req.name and req.name.strip():
                # Update display name if provided
                await prisma.user.update(
                    where={"id": placeholder_id},
                    data={"displayName": req.name.strip()},
                )

        # Create payment order (same flow as Telegram)
        result = await create_payment_order(
            user_id=user.id,
            plan=req.plan,
        )

        plan_config = PLAN_CONFIG[req.plan]

        # Build Trakteer payment URL with message containing our TX ID
        trakteer_url = TRAKTEER_PAGE_URL
        if trakteer_url and result.get("transaction_id"):
            # Append message parameter so Trakteer includes it when sending webhook
            tx_id = result["transaction_id"]
            trakteer_url = f"{trakteer_url}?message=FiNot-{req.plan.upper()}-{tx_id}"

        return JSONResponse({
            "success": True,
            "payment_id": result["payment_id"],
            "transaction_id": result["transaction_id"],
            "plan": req.plan,
            "plan_name": plan_config["name"],
            "amount": plan_config["price"],
            "trakteer_url": trakteer_url,
            "qris_url": None,  # QRIS image comes from Trakteer page
        })

    except Exception as e:
        _logger.error(f"Error creating landing payment: {e}", exc_info=True)
        return JSONResponse({"success": False, "error": "Terjadi kesalahan, silakan coba lagi"})


@router.get("/payment/status/{payment_id}")
async def get_landing_payment_status(payment_id: int):
    """Check payment status — polled by the frontend."""
    try:
        result = await check_payment_status(payment_id)

        if not result.get("found"):
            return JSONResponse({"status": "not_found"})

        return JSONResponse({
            "status": result["status"],
            "plan": result.get("plan"),
            "amount": result.get("amount"),
        })

    except Exception as e:
        _logger.error(f"Error checking payment status: {e}", exc_info=True)
        return JSONResponse({"status": "error"})


@router.get("/plans")
async def get_plans():
    """Return available plans and pricing for the frontend."""
    plans = []
    for key in ("free", "pro", "elite"):
        cfg = PLAN_CONFIG[key]
        plans.append({
            "key": key,
            "name": cfg["name"],
            "price": cfg["price"],
            "features": cfg["features"],
        })
    return JSONResponse({"plans": plans})
