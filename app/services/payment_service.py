"""
Payment Service (Trakteer QRIS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Handles payment order creation, webhook processing, and status checking.
"""

import hashlib
import hmac
import logging
import re
import secrets
import string
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import httpx

from app.db.connection import prisma
from app.config import TRAKTEER_API_KEY, TRAKTEER_WEBHOOK_SECRET, PLAN_CONFIG

_logger = logging.getLogger(__name__)

# ── Temporary credential store (payment_id → creds, auto-cleared after 30min) ──
WEB_CREDENTIALS_CACHE: Dict[int, Dict] = {}


def _generate_readable_login(name: str) -> str:
    """Generate a readable web login from a name, e.g. 'Andi Pratama' → 'andi.pratama'."""
    clean = re.sub(r"[^a-z0-9\s]", "", name.lower().strip())
    parts = clean.split()
    if len(parts) >= 2:
        login = f"{parts[0]}.{parts[1]}"
    elif parts:
        login = parts[0]
    else:
        login = "user"
    if len(login) < 3:
        login = "user." + login
    return login


def _generate_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _cache_credentials(payment_id: int, web_login: str, password: str):
    """Cache credentials for retrieval by frontend poll."""
    WEB_CREDENTIALS_CACHE[payment_id] = {
        "web_login": web_login,
        "password": password,
        "ts": time.time(),
    }
    # Cleanup entries older than 30 min
    now = time.time()
    for pid in list(WEB_CREDENTIALS_CACHE.keys()):
        if now - WEB_CREDENTIALS_CACHE[pid]["ts"] > 1800:
            del WEB_CREDENTIALS_CACHE[pid]


def get_cached_credentials(payment_id: int) -> Optional[Dict]:
    cred = WEB_CREDENTIALS_CACHE.get(payment_id)
    if cred:
        return {"web_login": cred["web_login"], "password": cred["password"]}
    return None

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
            f"user={user_id}, plan={plan}, amount={amount}, tx_id={tx_id}"
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

    Matching strategy:
    1. Try matching by supporter_message (contains our tx_id like "FiNot-PRO-TRK-xxx")
    2. Try matching by trakteer's transaction_id
    3. Fallback: match by amount + pending status + recent time window
    """
    try:
        # Extract fields from Trakteer webhook payload
        trakteer_tx_id = payload.get("transaction_id") or payload.get("id") or ""
        supporter_message = payload.get("supporter_message") or payload.get("message") or ""
        status = (payload.get("status") or "paid").lower()
        amount = payload.get("price") or payload.get("amount") or 0
        quantity = payload.get("quantity") or 1

        # Calculate actual amount (unit_price * quantity)
        if isinstance(amount, str):
            amount = int(amount.replace(".", "").replace(",", ""))
        total_amount = amount if amount > 5000 else (quantity * 1000)

        _logger.info(
            f"Trakteer webhook: trakteer_id={trakteer_tx_id}, "
            f"message={supporter_message}, amount={total_amount}, status={status}"
        )

        payment = None

        # ── Strategy 1: Match by supporter_message containing our tx_id ──
        if supporter_message:
            # Look for pattern like "FiNot-PRO-TRK-xxxxxxxx-xxxxxxxx"
            match = re.search(r"(TRK-\d+-[a-f0-9]+)", supporter_message)
            if match:
                our_tx_id = match.group(1)
                _logger.info(f"Found our tx_id in message: {our_tx_id}")
                payment = await prisma.payment.find_first(
                    where={"trakteerId": our_tx_id, "status": "pending"}
                )

        # ── Strategy 2: Match by Trakteer's own transaction_id ──
        if not payment and trakteer_tx_id:
            payment = await prisma.payment.find_first(
                where={"trakteerId": trakteer_tx_id, "status": "pending"}
            )

        # ── Strategy 3: Match by amount + pending + recent (last 30 min) ──
        if not payment and total_amount > 0:
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=45)
            pending_payments = await prisma.payment.find_many(
                where={
                    "status": "pending",
                    "amount": total_amount,
                    "createdAt": {"gte": cutoff},
                },
                order={"createdAt": "desc"},
                take=1,
            )
            if pending_payments:
                payment = pending_payments[0]
                _logger.info(
                    f"Matched by amount+time: payment_id={payment.id}, "
                    f"user={payment.userId}, plan={payment.plan}"
                )

        if not payment:
            _logger.warning(
                f"No matching payment found for webhook: "
                f"trakteer_id={trakteer_tx_id}, amount={total_amount}, msg={supporter_message}"
            )
            return {"success": False, "error": "No matching payment found"}

        if payment.status == "paid":
            _logger.info(f"Payment {payment.id} already processed")
            return {"success": True, "message": "Already processed"}

        # ── Mark as paid ──
        await prisma.payment.update(
            where={"id": payment.id},
            data={
                "status": "paid",
                "paidAt": datetime.now(timezone.utc),
                "trakteerId": trakteer_tx_id or payment.trakteerId,
            },
        )

        # ── Activate subscription ──
        from app.services.subscription_service import activate_subscription

        sub_result = await activate_subscription(
            user_id=payment.userId,
            plan=payment.plan,
            payment_id=payment.id,
            duration_days=30,
        )

        # ── Auto-create web credentials ──
        user = await prisma.user.find_unique(where={"id": payment.userId})
        web_login = None
        plain_pw = None
        if user and not user.webLogin:
            base_login = _generate_readable_login(user.displayName or "user")
            web_login = base_login
            counter = 1
            while await prisma.user.find_first(where={"webLogin": web_login}):
                web_login = f"{base_login}{counter}"
                counter += 1
            plain_pw = _generate_password()
            await prisma.user.update(
                where={"id": payment.userId},
                data={"webLogin": web_login, "webPassword": _hash_pw(plain_pw)},
            )
            _cache_credentials(payment.id, web_login, plain_pw)
            _logger.info(f"Web account created for user {payment.userId}: {web_login}")
        elif user and user.webLogin:
            web_login = user.webLogin

        _logger.info(
            f"Payment confirmed and subscription activated: "
            f"user={payment.userId}, plan={payment.plan}, payment_id={payment.id}"
        )

        return {
            "success": True,
            "user_id": payment.userId,
            "plan": payment.plan,
            "subscription": sub_result,
            "web_login": web_login,
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

        result = {
            "found": True,
            "payment_id": payment.id,
            "status": payment.status,
            "plan": payment.plan,
            "amount": payment.amount,
            "created_at": payment.createdAt.isoformat(),
        }

        # Attach cached credentials if payment is paid
        if payment.status == "paid":
            creds = get_cached_credentials(payment.id)
            if creds:
                result["credentials"] = creds

        return result

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
