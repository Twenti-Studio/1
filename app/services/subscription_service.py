"""
Subscription & RBAC Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Role-Based Access Control untuk FiNot.
Handles plan verification, AI credit management, and feature gating.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Optional

from app.db.connection import prisma
from app.config import PLAN_CONFIG

_logger = logging.getLogger(__name__)


async def get_user_plan(user_id: int) -> str:
    """
    Get current active plan for user.
    Checks subscription validity and downgrades if expired.
    """
    try:
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user:
            return "free"

        if user.plan in ("pro", "elite"):
            # Check if subscription is still active
            active_sub = await prisma.subscription.find_first(
                where={
                    "userId": user_id,
                    "isActive": True,
                    "endDate": {"gte": datetime.utcnow()},
                },
                order={"endDate": "desc"},
            )

            if not active_sub:
                # Subscription expired → downgrade to free
                _logger.info(f"User {user_id} subscription expired, downgrading to free")
                await prisma.user.update(
                    where={"id": user_id},
                    data={"plan": "free"},
                )
                # Mark subscription as inactive
                await prisma.subscription.update_many(
                    where={"userId": user_id, "isActive": True},
                    data={"isActive": False},
                )
                return "free"

        return user.plan

    except Exception as e:
        _logger.error(f"Error getting user plan: {e}", exc_info=True)
        return "free"


async def check_ai_credits(user_id: int) -> Dict:
    """
    Check remaining AI credits for user.

    Returns:
        {
            "has_credits": bool,
            "remaining": int,
            "total": int,
            "plan": str,
        }
    """
    try:
        plan = await get_user_plan(user_id)
        plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])

        if plan == "free":
            # Free: 5 total credits, no refill
            credit = await prisma.aicredit.find_first(
                where={"userId": user_id},
                order={"createdAt": "desc"},
            )

            if not credit:
                # Create initial credits
                credit = await prisma.aicredit.create(
                    data={
                        "userId": user_id,
                        "totalCredits": 5,
                        "usedCredits": 0,
                        "weekStartAt": datetime.utcnow(),
                    }
                )

            remaining = credit.totalCredits - credit.usedCredits
            return {
                "has_credits": remaining > 0,
                "remaining": max(0, remaining),
                "total": credit.totalCredits,
                "plan": plan,
            }

        else:
            # Pro/Elite: weekly credits with refill
            weekly_limit = plan_config["ai_credits_weekly"]
            now = datetime.utcnow()
            week_start = now - timedelta(days=now.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

            credit = await prisma.aicredit.find_first(
                where={
                    "userId": user_id,
                    "weekStartAt": {"gte": week_start},
                },
                order={"createdAt": "desc"},
            )

            if not credit:
                # Create new weekly credit record
                credit = await prisma.aicredit.create(
                    data={
                        "userId": user_id,
                        "totalCredits": weekly_limit,
                        "usedCredits": 0,
                        "weekStartAt": week_start,
                    }
                )

            remaining = credit.totalCredits - credit.usedCredits
            return {
                "has_credits": remaining > 0,
                "remaining": max(0, remaining),
                "total": credit.totalCredits,
                "plan": plan,
            }

    except Exception as e:
        _logger.error(f"Error checking AI credits: {e}", exc_info=True)
        return {
            "has_credits": False,
            "remaining": 0,
            "total": 0,
            "plan": "free",
        }


async def consume_ai_credit(user_id: int, amount: int = 1) -> bool:
    """
    Consume AI credit for a user.
    Returns True if successful, False if no credits remaining.
    """
    try:
        credit_info = await check_ai_credits(user_id)

        if not credit_info["has_credits"]:
            _logger.warning(f"User {user_id} has no AI credits remaining")
            return False

        plan = credit_info["plan"]

        if plan == "free":
            credit = await prisma.aicredit.find_first(
                where={"userId": user_id},
                order={"createdAt": "desc"},
            )
        else:
            now = datetime.utcnow()
            week_start = now - timedelta(days=now.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

            credit = await prisma.aicredit.find_first(
                where={
                    "userId": user_id,
                    "weekStartAt": {"gte": week_start},
                },
                order={"createdAt": "desc"},
            )

        if credit:
            await prisma.aicredit.update(
                where={"id": credit.id},
                data={"usedCredits": credit.usedCredits + amount},
            )
            _logger.info(
                f"AI credit consumed for user {user_id}: "
                f"{credit.usedCredits + amount}/{credit.totalCredits}"
            )
            return True

        return False

    except Exception as e:
        _logger.error(f"Error consuming AI credit: {e}", exc_info=True)
        return False


async def activate_subscription(
    user_id: int,
    plan: str,
    payment_id: Optional[int] = None,
    duration_days: int = 30,
) -> Dict:
    """
    Activate a subscription for a user.
    """
    try:
        now = datetime.utcnow()
        end_date = now + timedelta(days=duration_days)

        # Deactivate existing subscriptions
        await prisma.subscription.update_many(
            where={"userId": user_id, "isActive": True},
            data={"isActive": False},
        )

        # Create new subscription
        subscription = await prisma.subscription.create(
            data={
                "userId": user_id,
                "plan": plan,
                "startDate": now,
                "endDate": end_date,
                "isActive": True,
                "paymentId": payment_id,
            }
        )

        # Update user plan
        await prisma.user.update(
            where={"id": user_id},
            data={"plan": plan},
        )

        # Create weekly AI credit record
        plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])
        weekly_credits = plan_config.get("ai_credits_weekly", 0)

        if weekly_credits > 0:
            week_start = now - timedelta(days=now.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

            await prisma.aicredit.create(
                data={
                    "userId": user_id,
                    "totalCredits": weekly_credits,
                    "usedCredits": 0,
                    "weekStartAt": week_start,
                }
            )

        _logger.info(
            f"Subscription activated for user {user_id}: "
            f"plan={plan}, end={end_date.isoformat()}"
        )

        return {
            "subscription_id": subscription.id,
            "plan": plan,
            "start_date": now.isoformat(),
            "end_date": end_date.isoformat(),
            "weekly_credits": weekly_credits,
        }

    except Exception as e:
        _logger.error(f"Error activating subscription: {e}", exc_info=True)
        raise


async def get_subscription_status(user_id: int) -> Dict:
    """Get detailed subscription status for a user."""
    try:
        plan = await get_user_plan(user_id)
        credits = await check_ai_credits(user_id)

        result = {
            "plan": plan,
            "plan_name": PLAN_CONFIG.get(plan, {}).get("name", "Unknown"),
            "credits": credits,
        }

        if plan in ("pro", "elite"):
            sub = await prisma.subscription.find_first(
                where={
                    "userId": user_id,
                    "isActive": True,
                },
                order={"endDate": "desc"},
            )

            if sub:
                days_left = (sub.endDate - datetime.utcnow()).days
                result["subscription"] = {
                    "end_date": sub.endDate.isoformat(),
                    "days_left": max(0, days_left),
                    "is_active": sub.isActive,
                }

        return result

    except Exception as e:
        _logger.error(f"Error getting subscription status: {e}", exc_info=True)
        return {
            "plan": "free",
            "plan_name": "Free Plan",
            "credits": {"has_credits": False, "remaining": 0, "total": 0},
        }


def check_feature_access(plan: str, feature: str) -> bool:
    """
    Check if a feature is accessible for a given plan.

    Features:
        - scan_receipt
        - daily_insight
        - weekly_summary
        - monthly_analysis
        - forecast_3month
        - advanced_tracking
        - priority_ai
    """
    plan_config = PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])
    return plan_config.get(feature, False)
