"""Service untuk operasi User."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from prisma import Prisma
from prisma.models import User

_logger = logging.getLogger(__name__)


async def get_or_create_user(
    prisma: Prisma,
    user_id: int,
    username: Optional[str] = None,
    display_name: Optional[str] = None,
    source: str = "telegram",
) -> User:
    """Get or create user. New users start with 7-day trial (35 AI credits)."""
    _logger.debug(f"Getting or creating user: {user_id} from {source}")

    try:
        display_name_final = display_name or username or f"User-{user_id}"

        # Check if user exists
        existing = await prisma.user.find_unique(where={"id": user_id})

        if existing:
            _logger.info(f"User ready: {user_id} ({display_name_final}) plan={existing.plan}")
            return existing

        # New user → start with trial plan
        trial_end = datetime.now(timezone.utc) + timedelta(days=7)

        user = await prisma.user.create(
            data={
                "id": user_id,
                "username": username,
                "displayName": display_name_final,
                "plan": "trial",
                "trialEndsAt": trial_end,
            },
        )

        # Create initial trial AI credits (35 total, non-refilling)
        await prisma.aicredit.create(
            data={
                "userId": user_id,
                "totalCredits": 35,
                "usedCredits": 0,
                "weekStartAt": datetime.now(timezone.utc),
            }
        )

        _logger.info(f"New trial user created: {user_id} ({display_name_final}), trial ends {trial_end.date()}")
        return user

    except Exception as e:
        _logger.error(f"Error getting/creating user: {str(e)}", exc_info=True)
        raise


async def update_user(
    prisma: Prisma,
    user_id: int,
    data: dict,
) -> Optional[User]:
    """Update informasi user."""
    _logger.info(f"Updating user {user_id} with data: {data}")

    try:
        existing_user = await prisma.user.find_unique(where={"id": user_id})

        if not existing_user:
            _logger.warning(f"User not found: {user_id}")
            return None

        user = await prisma.user.update(
            where={"id": user_id},
            data=data,
        )

        _logger.info(f"User updated: {user_id}")
        return user

    except Exception as e:
        _logger.error(f"Error updating user: {str(e)}", exc_info=True)
        raise


def get_missing_onboarding_field(user: User) -> Optional[str]:
    """Return the first required onboarding field that is still empty."""
    required_fields = (
        "fullName",
        "occupation",
        "fixedIncome",
        "monthlyDependents",
    )

    for field in required_fields:
        value = getattr(user, field, None)
        if value is None or value == "":
            return field

    return None


def is_onboarding_complete(user: User) -> bool:
    """Check whether the user's required onboarding profile is complete."""
    return get_missing_onboarding_field(user) is None


async def update_onboarding_profile(
    prisma: Prisma,
    user_id: int,
    data: dict,
) -> Optional[User]:
    """Update required onboarding data and mark completed when all fields exist."""
    user = await update_user(prisma, user_id, data)
    if not user:
        return None

    if is_onboarding_complete(user) and not getattr(user, "onboardingCompletedAt", None):
        user = await update_user(
            prisma,
            user_id,
            {"onboardingCompletedAt": datetime.now(timezone.utc)},
        )

    return user


async def get_user_by_id(
    prisma: Prisma,
    user_id: int,
    include_receipts: bool = False,
    include_transactions: bool = False,
) -> Optional[User]:
    """Fetch user by ID."""
    try:
        user = await prisma.user.find_unique(
            where={"id": user_id},
            include={
                "receipts": include_receipts,
                "transactions": include_transactions,
            },
        )
        return user

    except Exception as e:
        _logger.error(f"Error fetching user: {str(e)}", exc_info=True)
        raise


async def user_exists(prisma: Prisma, user_id: int) -> bool:
    """Check if user exists."""
    user = await get_user_by_id(prisma, user_id)
    return user is not None


async def ensure_web_credentials(
    prisma: Prisma, user_id: int
) -> Optional[Tuple[str, str]]:
    """
    Ensure the user has webLogin/webPassword for the chat-app dashboard.

    - If already set: returns None (no new credentials to surface).
    - If missing: generate readable login + 10-char password, store hashed,
      and return (login, plain_password) so the caller can show it ONCE.
    """
    from app.services.payment_service import (
        _generate_password,
        _generate_readable_login,
        _hash_pw,
    )

    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        return None
    if user.webLogin:
        return None

    base = _generate_readable_login(user.displayName or user.username or f"user{user_id}")
    login = base
    counter = 1
    while await prisma.user.find_first(where={"webLogin": login}):
        login = f"{base}{counter}"
        counter += 1

    plain = _generate_password()
    await prisma.user.update(
        where={"id": user_id},
        data={"webLogin": login, "webPassword": _hash_pw(plain)},
    )
    _logger.info(f"Web credentials auto-generated for user {user_id}: {login}")
    return login, plain


async def get_user_stats(prisma: Prisma, user_id: int) -> dict:
    """Ambil statistik user."""
    try:
        receipt_count = await prisma.receipt.count(where={"userId": user_id})
        transaction_count = await prisma.transaction.count(where={"userId": user_id})

        return {
            "user_id": user_id,
            "receipt_count": receipt_count,
            "transaction_count": transaction_count,
        }

    except Exception as e:
        _logger.error(f"Error getting user stats: {str(e)}", exc_info=True)
        return {
            "user_id": user_id,
            "receipt_count": 0,
            "transaction_count": 0,
        }
