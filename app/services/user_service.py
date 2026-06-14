"""Service untuk operasi User."""

import logging
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from prisma import Prisma
from prisma.models import User

_logger = logging.getLogger(__name__)


async def _next_web_user_id(prisma: Prisma) -> int:
    """Allocate a fresh, collision-free id for a web-first account.

    Pulls from `web_user_id_seq` (starts at 1e12) so generated ids never
    clash with Telegram ids, which are resolved via the `telegramId` column.
    """
    row = await prisma.query_first("SELECT nextval('web_user_id_seq') AS id")
    if not row or row.get("id") is None:
        raise RuntimeError("Failed to allocate web user id from sequence")
    return int(row["id"])


async def _create_trial_credits(prisma: Prisma, user_id: int) -> None:
    """Create the initial trial AI credit bucket (35 total, non-refilling)."""
    await prisma.aicredit.create(
        data={
            "userId": user_id,
            "totalCredits": 35,
            "usedCredits": 0,
            "weekStartAt": datetime.now(timezone.utc),
        }
    )


async def get_or_create_user(
    prisma: Prisma,
    telegram_id: int,
    username: Optional[str] = None,
    display_name: Optional[str] = None,
    source: str = "telegram",
) -> User:
    """Get or create a user keyed by Telegram id.

    Web accounts are primary now: a Telegram user maps to an account via the
    `telegramId` column. A brand-new Telegram user (no linked web account) still
    gets an auto-created account so the bot remains usable standalone. New users
    start with a 7-day trial (35 AI credits).
    """
    _logger.debug(f"Getting or creating user by telegram_id={telegram_id} from {source}")

    try:
        display_name_final = display_name or username or f"User-{telegram_id}"

        # Resolve by linked Telegram id
        existing = await prisma.user.find_first(where={"telegramId": telegram_id})

        if existing:
            _logger.info(f"User ready: id={existing.id} tg={telegram_id} plan={existing.plan}")
            return existing

        # New Telegram-origin account → web-first id + linked telegramId
        new_id = await _next_web_user_id(prisma)
        trial_end = datetime.now(timezone.utc) + timedelta(days=7)

        user = await prisma.user.create(
            data={
                "id": new_id,
                "telegramId": telegram_id,
                "username": username,
                "displayName": display_name_final,
                "plan": "trial",
                "trialEndsAt": trial_end,
            },
        )

        await _create_trial_credits(prisma, new_id)

        _logger.info(
            f"New trial user created: id={new_id} tg={telegram_id} "
            f"({display_name_final}), trial ends {trial_end.date()}"
        )
        return user

    except Exception as e:
        _logger.error(f"Error getting/creating user: {str(e)}", exc_info=True)
        raise


async def create_web_user(
    prisma: Prisma,
    username: str,
    password: str,
    name: Optional[str] = None,
) -> User:
    """Create a standalone web account (no Telegram required).

    `username` is stored as the unique `webLogin`; `password` is hashed.
    Starts on a 7-day trial with 35 AI credits.
    """
    from app.services.payment_service import _hash_pw

    new_id = await _next_web_user_id(prisma)
    trial_end = datetime.now(timezone.utc) + timedelta(days=7)
    display_name_final = (name or "").strip() or username

    user = await prisma.user.create(
        data={
            "id": new_id,
            "displayName": display_name_final,
            "webLogin": username,
            "webPassword": _hash_pw(password),
            "plan": "trial",
            "trialEndsAt": trial_end,
        },
    )
    await _create_trial_credits(prisma, new_id)
    _logger.info(f"New web user created: id={new_id} login={username}")
    return user


def _generate_link_code(length: int = 8) -> str:
    """Generate a short, unambiguous link code (uppercase letters + digits)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no I/O/0/1
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def generate_telegram_link_code(
    prisma: Prisma, user_id: int, ttl_minutes: int = 15
) -> Optional[str]:
    """Generate & store a short-lived code used to link a Telegram account.

    Returns the code, or None if the user does not exist.
    """
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        return None

    code = _generate_link_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    await prisma.user.update(
        where={"id": user_id},
        data={"telegramLinkCode": code, "telegramLinkExpiresAt": expires},
    )
    return code


async def link_telegram_by_code(
    prisma: Prisma, code: str, telegram_id: int
) -> dict:
    """Attach a Telegram id to the web account that generated `code`.

    Returns {"success": bool, "error"?: str, "user_id"?: int}.
    """
    code = (code or "").strip().upper()
    if not code:
        return {"success": False, "error": "Kode tautan kosong."}

    user = await prisma.user.find_first(where={"telegramLinkCode": code})
    if not user:
        return {"success": False, "error": "Kode tautan tidak valid."}

    expires = getattr(user, "telegramLinkExpiresAt", None)
    if not expires or expires <= datetime.now(timezone.utc):
        return {"success": False, "error": "Kode tautan sudah kedaluwarsa. Buat kode baru di app."}

    # If this Telegram id is already linked elsewhere, refuse (no auto-merge).
    other = await prisma.user.find_first(where={"telegramId": telegram_id})
    if other and other.id != user.id:
        return {
            "success": False,
            "error": "Telegram ini sudah tertaut ke akun lain. Putuskan dulu dari akun tersebut.",
        }

    await prisma.user.update(
        where={"id": user.id},
        data={
            "telegramId": telegram_id,
            "telegramLinkCode": None,
            "telegramLinkExpiresAt": None,
        },
    )
    _logger.info(f"Telegram {telegram_id} linked to web user {user.id}")
    return {"success": True, "user_id": int(user.id)}


async def unlink_telegram(prisma: Prisma, user_id: int) -> bool:
    """Remove the Telegram link from a web account."""
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        return False
    await prisma.user.update(
        where={"id": user_id},
        data={"telegramId": None, "telegramLinkCode": None, "telegramLinkExpiresAt": None},
    )
    return True


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


async def reset_web_credentials(
    prisma: Prisma, user_id: int
) -> Optional[Tuple[str, str]]:
    """
    Force-regenerate the user's web password (and login slug if missing).
    Always returns (login, plain_password) so the caller can show it once.
    """
    from app.services.payment_service import (
        _generate_password,
        _generate_readable_login,
        _hash_pw,
    )

    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        return None

    login = user.webLogin
    if not login:
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
    _logger.info(f"Web credentials RESET for user {user_id}: {login}")
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
