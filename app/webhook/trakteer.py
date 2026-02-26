"""
Trakteer Payment Webhook Handler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Receives payment confirmations from Trakteer and activates subscriptions.
"""

import logging
import json

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse

from app.services.payment_service import handle_trakteer_webhook, verify_trakteer_signature
from app.config import BOT_TOKEN, TELEGRAM_API_URL

import httpx

router = APIRouter(prefix="/webhook", tags=["payment"])
logger = logging.getLogger(__name__)


@router.post("/trakteer")
async def trakteer_webhook(request: Request):
    """Handle Trakteer payment webhook."""
    try:
        body = await request.body()
        body_str = body.decode("utf-8")

        # Verify signature if configured
        signature = request.headers.get("X-Trakteer-Signature", "")
        if signature and not verify_trakteer_signature(body_str, signature):
            logger.warning("Invalid Trakteer webhook signature")
            raise HTTPException(status_code=403, detail="Invalid signature")

        payload = json.loads(body_str)
        logger.info(f"Trakteer webhook received: {json.dumps(payload, indent=2)}")

        result = await handle_trakteer_webhook(payload)

        # Notify user via Telegram if payment successful
        if result.get("success") and result.get("user_id"):
            user_id = result["user_id"]
            plan = result.get("plan", "pro")

            message = (
                f"<b>Pembayaran Berhasil!</b>\n\n"
                f"🎉 Selamat! Kamu sekarang pengguna <b>{plan.upper()}</b>!\n\n"
                f"Fitur premium sudah aktif. Ketik /status untuk cek detail.\n\n"
                f"Terima kasih sudah mendukung FiNot! 🙏"
            )

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/sendMessage",
                        json={
                            "chat_id": user_id,
                            "text": message,
                            "parse_mode": "HTML",
                        }
                    )
            except Exception as e:
                logger.error(f"Failed to notify user: {e}")

        return JSONResponse({"ok": True, **result})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling Trakteer webhook: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": str(e)}
        )
