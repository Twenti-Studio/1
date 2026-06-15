from typing import Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.routers.user_dashboard import require_user
from app.services.push_service import (
    delete_subscription,
    public_vapid_key,
    save_subscription,
)

router = APIRouter(prefix="/api/push", tags=["web-push"])


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionBody(BaseModel):
    endpoint: str
    keys: PushKeys
    prefs: Dict[str, bool] = Field(default_factory=dict)


class PushDeleteBody(BaseModel):
    endpoint: str


@router.get("/public-key")
async def get_public_key(user_id: int = Depends(require_user)):
    key = public_vapid_key()
    return {"enabled": bool(key), "public_key": key}


@router.post("/subscribe")
async def subscribe(body: PushSubscriptionBody, user_id: int = Depends(require_user)):
    await save_subscription(user_id, body.model_dump(exclude={"prefs"}), body.prefs)
    return {"success": True}


@router.post("/unsubscribe")
async def unsubscribe(body: PushDeleteBody, user_id: int = Depends(require_user)):
    await delete_subscription(user_id, body.endpoint)
    return {"success": True}
