"""
FiNot Chat API Router
━━━━━━━━━━━━━━━━━━━━━
Endpoints powering the in-app chat UI (alternative to Telegram transport).
Reuses the same authentication as the user dashboard.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.routers.user_dashboard import require_user
from app.services.chat_service import (
    clear_chat_history,
    fetch_chat_history,
    handle_audio_message,
    handle_image_message,
    handle_text_message,
)

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


class TextMessageRequest(BaseModel):
    text: str


@router.get("/history")
async def get_history(
    user_id: int = Depends(require_user),
    limit: int = 50,
):
    """Return the persisted chat history for the logged-in user."""
    if limit <= 0 or limit > 200:
        limit = 50
    messages = await fetch_chat_history(user_id, limit=limit)
    return {"success": True, "messages": messages}


@router.delete("/history")
async def delete_history(user_id: int = Depends(require_user)):
    """Clear chat history for the logged-in user."""
    deleted = await clear_chat_history(user_id)
    return {"success": True, "deleted": deleted}


@router.post("/text")
async def post_text(
    body: TextMessageRequest,
    user_id: int = Depends(require_user),
):
    """Send a text message to FiNot."""
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text must not be empty")

    try:
        result = await handle_text_message(user_id, text)
    except Exception as e:
        _logger.error(f"/api/chat/text failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process message")

    return {
        "success": True,
        "messages": result["messages"],
    }


@router.post("/image")
async def post_image(
    file: UploadFile = File(...),
    user_id: int = Depends(require_user),
):
    """Upload a receipt image (multipart/form-data)."""
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    mime = file.content_type or ""
    if mime and not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    result = await handle_image_message(
        user_id, data, filename=file.filename or "receipt.jpg", mime=mime,
    )
    return {"success": True, "messages": result["messages"]}


@router.post("/audio")
async def post_audio(
    file: UploadFile = File(...),
    user_id: int = Depends(require_user),
):
    """Upload a voice note (multipart/form-data)."""
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    mime = file.content_type or ""
    if mime and not (mime.startswith("audio/") or mime.startswith("video/")):
        raise HTTPException(status_code=400, detail="File must be audio")

    result = await handle_audio_message(
        user_id, data, filename=file.filename or "voice.webm", mime=mime,
    )
    return {"success": True, "messages": result["messages"]}
