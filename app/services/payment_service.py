"""
Payment Service (Trakteer QRIS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Handles payment order creation, QRIS generation, and webhook processing.
"""

import logging
import uuid
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import httpx

from app.db.connection import prisma
from app.config import TRAKTEER_API_KEY, TRAKTEER_WEBHOOK_SECRET, PLAN_CONFIG

_logger = logging.getLogger(__name__)


async def create_payment_order(
    user_id: int,
    plan: str,
) -> Dict:
    """
    Create a payment order for subscription upgrade.

    Returns:
        Dict with payment info and QRIS details.
    """
    try:
        if plan not in ("pro", "elite"):
            raise ValueError(f"Invalid plan for payment: {plan}")

        plan_config = PLAN_CONFIG[plan]
        amount = plan_config["price"]

        # Generate unique transaction ID
        tx_id = f"TRK-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:8]}"

        # Create payment record
        payment = await prisma.payment.create(
            data={
                "userId": user_id,
                "trakteerId": tx_id,
                "plan": plan,
                "amount": amount,
                "status": "pending",
                "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=30),
            }
        )

        _logger.info(
            f"Payment order created: id={payment.id}, "
            f"user={user_id}, plan={plan}, amount={amount}"
        )

        return {
            "payment_id": payment.id,
            "transaction_id": tx_id,
            "plan": plan,
            "plan_name": plan_config["name"],
            "amount": amount,
            "expires_at": payment.expiresAt.isoformat() if payment.expiresAt else None,
            "status": "pending",
        }

    except Exception as e:
        _logger.error(f"Error creating payment order: {e}", exc_info=True)
        raise


async def handle_trakteer_webhook(payload: Dict) -> Dict:
    """
    Handle incoming Trakteer webhook for payment confirmation.

    Expected payload from Trakteer:
        {
            "id": "trakteer_id",
            "status": "paid",
            "amount": 19000,
            ...
        }
    """
    try:
        trakteer_id = payload.get("id") or payload.get("transaction_id")
        status = payload.get("status", "").lower()

        if not trakteer_id:
            _logger.warning("Webhook received without transaction ID")
            return {"success": False, "error": "No transaction ID"}

        # Find payment by trakteer ID
        payment = await prisma.payment.find_first(
            where={"trakteerId": trakteer_id}
        )

        if not payment:
            _logger.warning(f"Payment not found for trakteer_id: {trakteer_id}")
            return {"success": False, "error": "Payment not found"}

        if payment.status == "paid":
            _logger.info(f"Payment {trakteer_id} already processed")
            return {"success": True, "message": "Already processed"}

        if status in ("paid", "success", "completed"):
            # Update payment status
            await prisma.payment.update(
                where={"id": payment.id},
                data={
                    "status": "paid",
                    "paidAt": datetime.now(timezone.utc),
                },
            )

            # Activate subscription
            from app.services.subscription_service import activate_subscription

            sub_result = await activate_subscription(
                user_id=payment.userId,
                plan=payment.plan,
                payment_id=payment.id,
                duration_days=30,
            )

            _logger.info(
                f"Payment confirmed and subscription activated: "
                f"user={payment.userId}, plan={payment.plan}"
            )

            return {
                "success": True,
                "user_id": payment.userId,
                "plan": payment.plan,
                "subscription": sub_result,
            }

        else:
            # Other status updates
            await prisma.payment.update(
                where={"id": payment.id},
                data={"status": status},
            )

            return {
                "success": True,
                "message": f"Payment status updated to {status}",
            }

    except Exception as e:
        _logger.error(f"Error handling Trakteer webhook: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def check_payment_status(payment_id: int) -> Dict:
    """Check status of a payment."""
    try:
        payment = await prisma.payment.find_unique(where={"id": payment_id})

        if not payment:
            return {"found": False}

        is_expired = (
            payment.expiresAt
            and payment.expiresAt < datetime.now(timezone.utc)
            and payment.status == "pending"
        )

        if is_expired:
            await prisma.payment.update(
                where={"id": payment.id},
                data={"status": "expired"},
            )
            return {
                "found": True,
                "status": "expired",
                "message": "Pembayaran telah kedaluwarsa",
            }

        return {
            "found": True,
            "payment_id": payment.id,
            "status": payment.status,
            "plan": payment.plan,
            "amount": payment.amount,
            "created_at": payment.createdAt.isoformat(),
        }

    except Exception as e:
        _logger.error(f"Error checking payment status: {e}", exc_info=True)
        return {"found": False, "error": str(e)}


def verify_trakteer_signature(payload: str, signature: str) -> bool:
    """Verify Trakteer webhook signature."""
    if not TRAKTEER_WEBHOOK_SECRET:
        _logger.warning("TRAKTEER_WEBHOOK_SECRET not configured")
        return True  # Skip verification if no secret

    expected = hmac.HMAC(
        TRAKTEER_WEBHOOK_SECRET.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)
