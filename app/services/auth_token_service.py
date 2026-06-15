"""One-time auth tokens for magic links (email verification & password reset).

Only the SHA-256 hash of the token is stored; the raw token travels in the link.
Tokens are single-use and time-limited.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from prisma import Prisma

_logger = logging.getLogger(__name__)

PURPOSE_VERIFY_EMAIL = "verify_email"
PURPOSE_RESET_PASSWORD = "reset_password"
DEFAULT_TTL_MINUTES = 30


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def create_auth_token(
    prisma: Prisma,
    user_id: int,
    purpose: str,
    ttl_minutes: int = DEFAULT_TTL_MINUTES,
) -> str:
    """Create a single-use token, invalidating prior unused tokens of same purpose.

    Returns the RAW token (only stored hashed) to embed in the magic link.
    """
    # Invalidate previous unused tokens of the same purpose for this user.
    await prisma.authtoken.update_many(
        where={"userId": user_id, "purpose": purpose, "usedAt": None},
        data={"usedAt": _utcnow()},
    )

    raw = secrets.token_urlsafe(32)
    await prisma.authtoken.create(
        data={
            "userId": user_id,
            "tokenHash": _hash(raw),
            "purpose": purpose,
            "expiresAt": _utcnow() + timedelta(minutes=ttl_minutes),
        }
    )
    return raw


async def consume_auth_token(
    prisma: Prisma,
    raw_token: str,
    purpose: str,
) -> Optional[int]:
    """Validate & burn a token. Returns the user_id on success, else None."""
    raw_token = (raw_token or "").strip()
    if not raw_token:
        return None

    token = await prisma.authtoken.find_unique(where={"tokenHash": _hash(raw_token)})
    if not token or token.purpose != purpose:
        return None
    if token.usedAt is not None:
        return None
    if _as_utc(token.expiresAt) and _as_utc(token.expiresAt) <= _utcnow():
        return None

    await prisma.authtoken.update(where={"id": token.id}, data={"usedAt": _utcnow()})
    return int(token.userId)
