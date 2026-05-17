"""
FiNot Chat Service
━━━━━━━━━━━━━━━━━━
Transport-agnostic chat pipeline used by the FiNot web chat UI.
Reuses the same worker (LLM/OCR/STT) and transaction pipeline that
the Telegram webhook uses, but returns plain Python dicts instead of
sending Telegram API calls. Also persists the user/assistant message
log in the `chat_messages` table.
"""

from __future__ import annotations

import logging
import mimetypes
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.db.connection import prisma
from app.services.receipt_service import create_receipt
from app.services.subscription_service import (
    check_ai_credits,
    consume_ai_credit,
    get_user_plan,
    check_feature_access,
)

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ──────────────────────────────────────────────────────────
# Response formatting (HTML-flavoured, mirrors Telegram look)
# ──────────────────────────────────────────────────────────

def _fmt_amount(amount: int) -> str:
    return f"Rp{int(amount):,}".replace(",", ".")


def format_transaction_response(result: dict) -> str:
    """Build a friendly assistant message describing the recorded transactions."""
    if not result.get("success"):
        return result.get("error") or "Maaf, terjadi kesalahan saat memproses pesan."

    transactions = result.get("transactions", []) or []
    source = result.get("source", "text")
    source_label = {
        "text": "Transaksi tercatat",
        "image": "Struk terbaca",
        "audio": "Pesan suara tercatat",
    }.get(source, "Transaksi tercatat")

    if not transactions:
        return "Saya tidak menemukan transaksi yang bisa dicatat dari pesan ini."

    lines: List[str] = [f"<b>{source_label}!</b>"]

    if result.get("transcription"):
        snippet = result["transcription"][:120]
        lines.append(f"<i>Transkripsi: \"{snippet}\"</i>")

    lines.append("")

    for idx, tx in enumerate(transactions, 1):
        tipo = "Pemasukan" if tx.get("intent") == "income" else "Pengeluaran"
        sign = "+" if tx.get("intent") == "income" else "−"
        amount = tx.get("amount", 0)
        category = tx.get("category", "Lainnya")

        if len(transactions) > 1:
            lines.append(f"<b>#{idx}</b>")
        lines.append(f"{sign} {tipo}: <b>{_fmt_amount(amount)}</b>")
        lines.append(f"Kategori: {category}")
        if tx.get("needs_review"):
            lines.append("<i>Perlu review</i>")
        lines.append("")

    return "\n".join(lines).strip()


# ──────────────────────────────────────────────────────────
# Persistence helpers
# ──────────────────────────────────────────────────────────

async def save_chat_message(
    user_id: int,
    role: str,
    content: str,
    kind: str = "text",
    meta: Optional[Dict[str, Any]] = None,
):
    """Append a message to the chat log."""
    try:
        return await prisma.chatmessage.create(
            data={
                "userId": user_id,
                "role": role,
                "kind": kind,
                "content": content,
                "meta": meta or {},
            }
        )
    except Exception as e:
        logger.warning(f"Failed to save chat message: {e}")
        return None


async def fetch_chat_history(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Return last N chat messages in chronological order."""
    rows = await prisma.chatmessage.find_many(
        where={"userId": user_id},
        order={"createdAt": "desc"},
        take=limit,
    )
    rows.reverse()
    return [
        {
            "id": str(r.id),
            "role": r.role,
            "kind": r.kind,
            "content": r.content,
            "meta": r.meta or {},
            "created_at": r.createdAt.isoformat() if r.createdAt else None,
        }
        for r in rows
    ]


async def clear_chat_history(user_id: int) -> int:
    """Delete all chat messages for the user. Returns deleted count."""
    return await prisma.chatmessage.delete_many(where={"userId": user_id})


# ──────────────────────────────────────────────────────────
# File ingestion
# ──────────────────────────────────────────────────────────

def _save_upload_bytes(
    user_id: int, data: bytes, filename: str, mime: Optional[str] = None
) -> Dict[str, Any]:
    """Persist an uploaded file to the uploads/ directory and return metadata."""
    safe_name = Path(filename).name or "upload"
    ext = Path(safe_name).suffix or mimetypes.guess_extension(mime or "") or ""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    unique = uuid.uuid4().hex[:8]
    out_name = f"{ts}_{user_id}_{unique}{ext}"
    out_path = UPLOAD_DIR / out_name
    out_path.write_bytes(data)

    detected = mime or mimetypes.guess_type(safe_name)[0] or "application/octet-stream"
    return {
        "file_path": str(out_path.as_posix()),
        "file_name": safe_name,
        "mime_type": detected,
        "file_size": out_path.stat().st_size,
    }


# ──────────────────────────────────────────────────────────
# Intent helpers (very small subset — full intents stay in Telegram for now)
# ──────────────────────────────────────────────────────────

_VOUCHER_RE = re.compile(r"^FN-[A-Z0-9-]+$", re.IGNORECASE)


# ──────────────────────────────────────────────────────────
# Public entry points
# ──────────────────────────────────────────────────────────

async def handle_text_message(user_id: int, text: str) -> Dict[str, Any]:
    """
    Process a text message coming from the FiNot web chat UI.

    Returns a dict:
        {
            "messages": [ {role, kind, content, meta}, ... ],  # assistant messages
            "tx_result": {...} | None,
        }
    """
    text = (text or "").strip()
    if not text:
        return {
            "messages": [_sys("Pesan kosong. Coba ketik transaksi atau pertanyaanmu.")],
            "tx_result": None,
        }

    # Persist user message
    await save_chat_message(user_id, "user", text, kind="text")

    # ── Voucher fast-path ──
    if _VOUCHER_RE.match(text):
        from app.services.voucher_service import redeem_voucher

        result = await redeem_voucher(user_id, text.upper())
        if result.get("success"):
            reply = (
                f"<b>Voucher berhasil diaktifkan!</b>\n\n"
                f"Paket: <b>{result['plan'].upper()}</b>\n"
                f"Durasi: <b>{result['duration']} hari</b>\n\n"
                f"Selamat menggunakan fitur premium FiNot!"
            )
        else:
            reply = (
                f"<b>Gagal redeem voucher</b>\n\n"
                f"{result.get('error', 'Kode tidak valid.')}"
            )
        await save_chat_message(user_id, "assistant", reply, kind="text")
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}

    # ── Default: process as transaction ──
    from worker import process_text_message

    try:
        result = await process_text_message(user_id, text)
    except Exception as e:
        logger.error(f"chat_service text pipeline failed: {e}", exc_info=True)
        reply = "Maaf, terjadi kesalahan saat memproses pesanmu. Coba lagi sebentar."
        await save_chat_message(user_id, "assistant", reply, kind="text")
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}

    reply = format_transaction_response(result)
    out_meta = {"tx_ids": [t.get("transaction_id") for t in result.get("transactions", []) if t.get("transaction_id")]}
    await save_chat_message(user_id, "assistant", reply, kind="text", meta=out_meta)

    messages = [{"role": "assistant", "kind": "text", "content": reply, "meta": out_meta}]

    # Offer post-tx analysis menu (same as Telegram, but returned inline)
    if result.get("success") and result.get("transactions"):
        menu = await _build_post_tx_menu(user_id)
        if menu:
            await save_chat_message(user_id, "assistant", menu["text"], kind="system", meta={"choices": menu["choices"]})
            messages.append({
                "role": "assistant",
                "kind": "system",
                "content": menu["text"],
                "meta": {"choices": menu["choices"]},
            })

    return {"messages": messages, "tx_result": result}


async def handle_image_message(
    user_id: int,
    data: bytes,
    filename: str,
    mime: Optional[str] = None,
) -> Dict[str, Any]:
    """Process an uploaded receipt image."""
    # Persist user side as a placeholder bubble
    await save_chat_message(
        user_id, "user", "[foto struk]", kind="image",
        meta={"filename": filename, "mime": mime},
    )

    try:
        media = _save_upload_bytes(user_id, data, filename, mime=mime)
        if not media["mime_type"].startswith("image/"):
            reply = "File ini bukan gambar. Kirim foto struk (JPG/PNG)."
            await save_chat_message(user_id, "assistant", reply, kind="text")
            return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}

        receipt = await create_receipt(
            prisma,
            user_id,
            file_path=media["file_path"],
            file_name=media["file_name"],
            mime_type=media["mime_type"],
            file_size=media["file_size"],
        )

        from worker import process_image_message

        result = await process_image_message(
            user_id, media["file_path"], receipt_id=receipt.id
        )

        reply = format_transaction_response(result)
        if result.get("ocr_confidence"):
            reply += f"\n\n<i>OCR confidence: {result['ocr_confidence']:.0f}%</i>"

        await save_chat_message(user_id, "assistant", reply, kind="text",
                                meta={"receipt_id": receipt.id})

        messages = [{"role": "assistant", "kind": "text", "content": reply}]
        if result.get("success") and result.get("transactions"):
            menu = await _build_post_tx_menu(user_id)
            if menu:
                await save_chat_message(user_id, "assistant", menu["text"], kind="system",
                                        meta={"choices": menu["choices"]})
                messages.append({
                    "role": "assistant", "kind": "system",
                    "content": menu["text"], "meta": {"choices": menu["choices"]},
                })
        return {"messages": messages, "tx_result": result}

    except Exception as e:
        logger.error(f"chat_service image pipeline failed: {e}", exc_info=True)
        reply = "Gagal memproses foto struk. Pastikan foto jelas dan coba lagi."
        await save_chat_message(user_id, "assistant", reply, kind="text")
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}


async def handle_audio_message(
    user_id: int,
    data: bytes,
    filename: str,
    mime: Optional[str] = None,
) -> Dict[str, Any]:
    """Process an uploaded voice note."""
    await save_chat_message(
        user_id, "user", "[pesan suara]", kind="audio",
        meta={"filename": filename, "mime": mime},
    )

    try:
        media = _save_upload_bytes(user_id, data, filename, mime=mime)

        from worker import process_audio_message

        result = await process_audio_message(user_id, media["file_path"])
        reply = format_transaction_response(result)
        await save_chat_message(user_id, "assistant", reply, kind="text",
                                meta={"transcription": result.get("transcription")})

        messages = [{"role": "assistant", "kind": "text", "content": reply}]
        if result.get("success") and result.get("transactions"):
            menu = await _build_post_tx_menu(user_id)
            if menu:
                await save_chat_message(user_id, "assistant", menu["text"], kind="system",
                                        meta={"choices": menu["choices"]})
                messages.append({
                    "role": "assistant", "kind": "system",
                    "content": menu["text"], "meta": {"choices": menu["choices"]},
                })
        return {"messages": messages, "tx_result": result}

    except Exception as e:
        logger.error(f"chat_service audio pipeline failed: {e}", exc_info=True)
        reply = "Gagal memproses pesan suara. Coba rekam ulang atau ketik manual."
        await save_chat_message(user_id, "assistant", reply, kind="text")
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}


# ──────────────────────────────────────────────────────────
# Post-transaction menu (mirrors Telegram registry)
# ──────────────────────────────────────────────────────────

_POST_TX_FEATURES = [
    ("daily_insight",         "Insight AI",            1),
    ("spending_alert",        "Pengingat & Alert",     0),
    ("balance_prediction",    "Prediksi Saldo",        1),
    ("burn_rate",             "Burn Rate",             1),
    ("health_score",          "Health Score",          1),
    ("saving_recommendation", "Rekomendasi Tabungan",  2),
    ("budget_suggestion",     "Smart Budget",          2),
    ("overspending_alert",    "Overspending Alert",    2),
]


async def _build_post_tx_menu(user_id: int):
    plan = await get_user_plan(user_id)
    items = []
    for key, label, cost in _POST_TX_FEATURES:
        if check_feature_access(plan, key):
            items.append({"key": key, "label": label, "cost": cost})
    if not items:
        return None
    lines = ["<b>Mau analisis lebih lanjut?</b>", "Pilih salah satu di bawah ini:"]
    return {"text": "\n".join(lines), "choices": items}


def _sys(text: str) -> Dict[str, Any]:
    return {"role": "assistant", "kind": "text", "content": text}
