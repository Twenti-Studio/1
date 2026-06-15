"""Browser Web Push delivery for the FiNot PWA."""

import asyncio
import json
import logging
import os
from typing import Any, Dict, Optional

from app.db.connection import prisma

logger = logging.getLogger(__name__)


def public_vapid_key() -> Optional[str]:
    return os.getenv("VAPID_PUBLIC_KEY")


async def save_subscription(user_id: int, subscription: Dict[str, Any], prefs: Dict[str, bool]):
    endpoint = subscription.get("endpoint")
    keys = subscription.get("keys") or {}
    if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
        raise ValueError("Push subscription tidak lengkap")

    from prisma import Json

    existing = await prisma.pushsubscription.find_unique(where={"endpoint": endpoint})
    data = {
        "userId": user_id,
        "endpoint": endpoint,
        "p256dh": keys["p256dh"],
        "auth": keys["auth"],
        "prefs": Json(prefs),
    }
    if existing:
        return await prisma.pushsubscription.update(where={"endpoint": endpoint}, data=data)
    return await prisma.pushsubscription.create(data=data)


async def delete_subscription(user_id: int, endpoint: str) -> None:
    await prisma.pushsubscription.delete_many(where={"userId": user_id, "endpoint": endpoint})


async def send_push_to_user(
    user_id: int,
    title: str,
    body: str,
    *,
    url: str = "/chat",
    category: str = "daily_insight",
) -> int:
    private_key = os.getenv("VAPID_PRIVATE_KEY")
    subject = os.getenv("VAPID_SUBJECT", "mailto:admin@finot.app")
    if not private_key or not public_vapid_key():
        logger.debug("Web push skipped: VAPID keys are not configured")
        return 0

    rows = await prisma.pushsubscription.find_many(where={"userId": user_id})
    sent = 0
    for row in rows:
        prefs = row.prefs or {}
        if prefs.get(category, True) is False:
            continue
        info = {
            "endpoint": row.endpoint,
            "keys": {"p256dh": row.p256dh, "auth": row.auth},
        }
        payload = json.dumps({"title": title, "body": body, "url": url, "tag": category})
        try:
            from pywebpush import webpush

            await asyncio.to_thread(
                webpush,
                subscription_info=info,
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": subject},
            )
            sent += 1
        except Exception as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                await prisma.pushsubscription.delete(where={"id": row.id})
            logger.warning("Web push failed for subscription %s: %s", row.id, exc)
    return sent
