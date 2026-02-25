import secrets
import string
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, List
from app.main import prisma

_logger = logging.getLogger(__name__)

def generate_voucher_code(length: int = 12) -> str:
    """Generate a random alphanumeric voucher code."""
    # Prefix to identify FiNot vouchers
    prefix = "FN-"
    alphabet = string.ascii_uppercase + string.digits
    code = "".join(secrets.choice(alphabet) for _ in range(length))
    return f"{prefix}{code}"

async def create_voucher(plan: str, duration_days: int, target_user: Optional[str] = None) -> Dict:
    """Create a new voucher code."""
    try:
        code = generate_voucher_code()
        
        voucher = await prisma.voucher.create(
            data={
                "code": code,
                "plan": plan.lower(),
                "durationDays": duration_days,
                "targetUser": target_user
            }
        )
        
        return {
            "success": True,
            "code": voucher.code,
            "plan": voucher.plan,
            "duration": voucher.durationDays
        }
    except Exception as e:
        _logger.error(f"Error creating voucher: {e}", exc_info=True)
        return {"success": False, "error": str(e)}

async def redeem_voucher(user_id: int, code: str) -> Dict:
    """Redeem a voucher for a user."""
    try:
        # Normalize code
        code = code.strip().upper()
        if not code.startswith("FN-") and "-" not in code:
             # Try appending FN- if it's just the random part
             code = f"FN-{code}"

        voucher = await prisma.voucher.find_unique(
            where={"code": code}
        )

        if not voucher:
            return {"success": False, "error": "Kode voucher tidak valid."}

        if voucher.isUsed:
            return {"success": False, "error": f"Voucher ini sudah digunakan pada {voucher.usedAt.strftime('%Y-%m-%d %H:%M') if voucher.usedAt else 'waktu lampau'}."}

        # Activate subscription
        from app.services.subscription_service import activate_subscription
        
        # Determine plan
        plan = voucher.plan.lower()
        if plan not in ("pro", "elite"):
            plan = "pro" # Default fallback
            
        sub_result = await activate_subscription(
            user_id=user_id,
            plan=plan,
            duration_days=voucher.durationDays
        )

        # Mark voucher as used
        await prisma.voucher.update(
            where={"id": voucher.id},
            data={
                "isUsed": True,
                "usedByUserId": user_id,
                "usedAt": datetime.now(timezone.utc)
            }
        )

        _logger.info(f"User {user_id} redeemed voucher {code} for {plan} ({voucher.durationDays} days)")

        return {
            "success": True,
            "plan": plan,
            "duration": voucher.durationDays,
            "subscription": sub_result
        }

    except Exception as e:
        _logger.error(f"Error redeeming voucher: {e}", exc_info=True)
        return {"success": False, "error": str(e)}

async def get_all_vouchers() -> List[Dict]:
    """Get list of all vouchers."""
    return await prisma.voucher.find_many(
        order={"createdAt": "desc"}
    )
