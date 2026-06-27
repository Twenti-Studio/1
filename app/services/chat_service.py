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
        category = tx.get("category") or "tidak terkategori"

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
    from prisma import Json

    data: Dict[str, Any] = {
        "user": {"connect": {"id": user_id}},
        "role": role,
        "kind": kind,
        "content": content,
    }
    if meta:
        data["meta"] = Json(meta)

    try:
        return await prisma.chatmessage.create(data=data)
    except Exception as e:
        logger.warning(f"Failed to save chat message: {e}")
        return None


def _serialize_message(r) -> Dict[str, Any]:
    return {
        "id": str(r.id),
        "role": r.role,
        "kind": r.kind,
        "content": r.content,
        "meta": r.meta or {},
        "created_at": r.createdAt.isoformat() if r.createdAt else None,
    }


async def fetch_chat_history(
    user_id: int,
    limit: int = 50,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """Return chat messages in chronological order.

    If `start`/`end` are given, restrict to messages in [start, end) — used for
    per-date "rooms". Otherwise return the last `limit` messages.
    """
    where: Dict[str, Any] = {"userId": user_id}
    if start is not None or end is not None:
        created: Dict[str, Any] = {}
        if start is not None:
            created["gte"] = start
        if end is not None:
            created["lt"] = end
        where["createdAt"] = created
        rows = await prisma.chatmessage.find_many(
            where=where,
            order={"createdAt": "asc"},
            take=limit,
        )
        return [_serialize_message(r) for r in rows]

    rows = await prisma.chatmessage.find_many(
        where=where,
        order={"createdAt": "desc"},
        take=limit,
    )
    rows.reverse()
    return [_serialize_message(r) for r in rows]


async def list_chat_sessions(user_id: int, tz_offset_minutes: int = 0) -> List[Dict[str, Any]]:
    """Group chat messages into per-date "rooms" using the caller's timezone.

    `tz_offset_minutes` is the user's offset from UTC in minutes
    (i.e. `-new Date().getTimezoneOffset()` on the client). Returns newest first.
    """
    rows = await prisma.query_raw(
        """
        SELECT to_char(date_trunc('day', created_at + make_interval(mins => $1::int)),
                       'YYYY-MM-DD') AS date,
               COUNT(*)::int AS count,
               MAX(created_at) AS last_at
        FROM chat_messages
        WHERE user_id = $2
        GROUP BY 1
        ORDER BY 1 DESC
        """,
        int(tz_offset_minutes),
        int(user_id),
    )

    sessions: List[Dict[str, Any]] = []
    for r in rows or []:
        last_at = r.get("last_at")
        if isinstance(last_at, datetime):
            last_at = last_at.isoformat()
        sessions.append({
            "date": r.get("date"),
            "count": int(r.get("count") or 0),
            "last_at": last_at,
        })
    return sessions


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

async def handle_text_message(
    user_id: int,
    text: str,
    reply_to: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Process a text message coming from the FiNot web chat UI.

    `reply_to` is the optional swipe-to-reply context the user attached:
        {"id": ..., "role": "assistant"|"user", "content": "<quoted text>"}
    It is stored on the user bubble and prepended to the AI prompt so the
    assistant knows which message is being replied to.

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

    reply_ctx = _clean_reply_to(reply_to)

    # Persist user message (carry the reply context in meta so the UI can render the quote)
    await save_chat_message(
        user_id, "user", text, kind="text",
        meta={"reply_to": reply_ctx} if reply_ctx else None,
    )

    # ── Budget scheme fast-path (set/atur skema) ──
    scheme_reply = await _try_handle_scheme(user_id, text, reply_ctx)
    if scheme_reply is not None:
        return scheme_reply

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

    # ── Classify intent first (transaction vs chat vs small-talk etc) ──
    try:
        from worker.llm.intent_classifier import classify_intent, UserIntent

        classification = await classify_intent(text)
        intent = classification.get("intent", "transaction")
        confidence = classification.get("confidence", 0)
        logger.info(f"chat-app intent: {intent} (conf={confidence:.2f}) text={text[:40]!r}")
    except Exception as e:
        logger.warning(f"intent classifier failed, defaulting to transaction: {e}")
        intent = "transaction"
        confidence = 1.0

    # ── Small talk / greetings → friendly canned response (no LLM call, no credit) ──
    if intent == "small_talk":
        reply = (
            "Halo! Saya FiNot, asisten keuanganmu.\n\n"
            "Mau catat transaksi? Langsung kirim pesan seperti:\n"
            "• <i>beli makan 25rb</i>\n"
            "• <i>gajian 5jt</i>\n\n"
            "Atau tanya apa saja seputar keuanganmu — saya akan jawab."
        )
        await save_chat_message(user_id, "assistant", reply, kind="text")
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}

    # ── AI Chat — open-ended finance question ──
    if intent == "ai_chat":
        reply = await _run_ai_chat(user_id, _with_reply_context(text, reply_ctx))
        out_meta = {"reply_to": reply_ctx} if reply_ctx else None
        await save_chat_message(user_id, "assistant", reply, kind="text", meta=out_meta)
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply, "meta": out_meta or {}}], "tx_result": None}

    # ── Help intent ──
    if intent == "help":
        reply = (
            "<b>Cara pakai FiNot</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Catat transaksi</b>\n"
            "Kirim seperti: <i>beli kopi 15rb</i> atau <i>gajian 5jt</i>\n\n"
            "📸 <b>Scan struk</b> — klik ikon klip → pilih foto\n"
            "🎙️ <b>Voice note</b> — klik ikon mic → ceritakan transaksimu\n\n"
            "💬 <b>Tanya keuangan</b>\n"
            "Contoh: <i>kenapa uangku cepat habis?</i> atau <i>tips hemat dong</i>"
        )
        await save_chat_message(user_id, "assistant", reply, kind="text")
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}

    # ── Otherwise: try as transaction. But only if confidence is high enough
    # OR the text contains digits (heuristic for monetary mention). ──
    has_digits = any(ch.isdigit() for ch in text)
    if intent != "transaction" and not has_digits and confidence < 0.5:
        # Likely not a transaction, but no specific intent matched — fall back to AI chat
        reply = await _run_ai_chat(user_id, _with_reply_context(text, reply_ctx))
        out_meta = {"reply_to": reply_ctx} if reply_ctx else None
        await save_chat_message(user_id, "assistant", reply, kind="text", meta=out_meta)
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply, "meta": out_meta or {}}], "tx_result": None}

    from worker import process_text_message

    try:
        result = await process_text_message(user_id, text)
    except Exception as e:
        logger.error(f"chat_service text pipeline failed: {e}", exc_info=True)
        reply = "Maaf, terjadi kesalahan saat memproses pesanmu. Coba lagi sebentar."
        await save_chat_message(user_id, "assistant", reply, kind="text")
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}

    # If parser returned no real transactions OR all zero, treat as chat fallback
    txs = result.get("transactions") or []
    has_valid_tx = any((t.get("amount") or 0) > 0 for t in txs)
    if not has_valid_tx:
        reply = await _run_ai_chat(user_id, _with_reply_context(text, reply_ctx))
        out_meta = {"reply_to": reply_ctx} if reply_ctx else None
        await save_chat_message(user_id, "assistant", reply, kind="text", meta=out_meta)
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply, "meta": out_meta or {}}], "tx_result": None}

    reply = format_transaction_response(result)
    out_meta = {"tx_ids": [t.get("transaction_id") for t in result.get("transactions", []) if t.get("transaction_id")]}
    await save_chat_message(user_id, "assistant", reply, kind="text", meta=out_meta)

    messages = [{"role": "assistant", "kind": "text", "content": reply, "meta": out_meta}]

    if result.get("success") and result.get("transactions"):
        # Agent: offer to set a budget scheme right after new income.
        offer = await _maybe_offer_scheme(user_id, result["transactions"])
        if offer:
            messages.append(offer)

        # Budget warnings: re-check every active scheme after this expense.
        messages.extend(await _emit_scheme_alerts(user_id))

        # Offer post-tx analysis menu (same as Telegram, but returned inline)
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


async def _run_ai_chat(user_id: int, question: str) -> str:
    """Run the AI Chat feature (if plan allows + credits available)."""
    try:
        plan = await get_user_plan(user_id)
        if not check_feature_access(plan, "ai_chat"):
            return (
                "💬 Untuk tanya-jawab AI keuangan, kamu perlu paket <b>Pro</b> atau <b>Elite</b>.\n"
                "Sementara itu, kamu tetap bisa catat transaksi dengan mengirim pesan seperti "
                "<i>beli makan 25rb</i> atau <i>gajian 5jt</i>."
            )

        credits = await check_ai_credits(user_id)
        if credits.get("remaining", 0) < 1:
            return (
                "Kredit AI kamu habis untuk periode ini. "
                "Tunggu refill mingguan atau upgrade paket untuk kredit lebih banyak."
            )

        from worker.analysis_service import get_ai_chat
        result = await get_ai_chat(user_id, question)
        if not result.get("success"):
            return "Maaf, saya belum bisa menjawab itu sekarang. Coba lagi sebentar."

        data = result.get("data") or {}
        answer = data.get("answer") or data.get("response") or data.get("message") or ""
        if not answer:
            return "Hmm, saya belum punya jawaban yang pas. Coba tanyakan lagi dengan cara lain."

        await consume_ai_credit(user_id)

        # Soft nudge: if this was a budget-planning question, offer to turn the
        # advice into an auto-reminding scheme (without forcing one on the user).
        try:
            from app.services.scheme_service import suggest_scheme_command

            hint_cmd = suggest_scheme_command(question)
            if hint_cmd and "skema" not in answer.lower():
                answer += (
                    f"\n\n<i>Kalau mau aku ingatkan otomatis saat mendekati batas, "
                    f"simpan jadi skema — ketik:</i> <b>{hint_cmd}</b>"
                )
        except Exception:
            pass

        return f"💬 {answer}"
    except Exception as e:
        logger.error(f"_run_ai_chat failed: {e}", exc_info=True)
        return "Maaf, terjadi kesalahan saat menjawab. Coba lagi sebentar."


# ──────────────────────────────────────────────────────────
# Reply-context helpers (swipe-to-reply)
# ──────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


def _clean_reply_to(reply_to: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Normalize the swipe-reply payload coming from the client."""
    if not reply_to or not isinstance(reply_to, dict):
        return None
    content = _strip_html(str(reply_to.get("content") or ""))
    if not content:
        return None
    return {
        "id": str(reply_to.get("id") or ""),
        "role": reply_to.get("role") or "assistant",
        "content": content[:280],
    }


def _with_reply_context(text: str, reply_ctx: Optional[Dict[str, Any]]) -> str:
    """Prepend the quoted message so the AI knows what is being replied to."""
    if not reply_ctx:
        return text
    who = "FiNot" if reply_ctx.get("role") == "assistant" else "pengguna"
    return (
        f"[Konteks balasan] Pengguna membalas pesan {who} sebelumnya: "
        f"\"{reply_ctx['content']}\".\n"
        f"Balasan/pertanyaan pengguna: {text}\n"
        f"Jawab dengan mengacu pada pesan yang dibalas itu."
    )


# ──────────────────────────────────────────────────────────
# Budget scheme agent
# ──────────────────────────────────────────────────────────

async def _try_handle_scheme(
    user_id: int,
    text: str,
    reply_ctx: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    If the message defines a budget scheme, create it and return a chat response.
    Returns None when the message is not a scheme instruction.

    When the user is replying to FiNot's "atur skema?" offer we parse leniently
    (a name + amount is enough, the trigger word is optional).
    """
    from app.services.scheme_service import (
        parse_scheme_from_text,
        create_scheme,
        format_scheme_confirmation,
    )

    parsed = parse_scheme_from_text(text)

    # Lenient mode: replying to the scheme offer bubble.
    replying_to_offer = bool(
        reply_ctx and "skema" in (reply_ctx.get("content") or "").lower()
    )
    if not parsed and replying_to_offer:
        parsed = parse_scheme_from_text(f"set skema {text}")

    if not parsed:
        return None

    try:
        scheme = await create_scheme(
            user_id,
            name=parsed["name"],
            categories=parsed["categories"],
            limit=parsed["limit"],
            period=parsed["period"],
            threshold=parsed["threshold"],
        )
    except Exception as e:
        logger.error(f"create_scheme failed: {e}", exc_info=True)
        reply = "Maaf, gagal menyimpan skema. Coba lagi sebentar."
        await save_chat_message(user_id, "assistant", reply, kind="text")
        return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}

    reply = format_scheme_confirmation(parsed)
    meta = {"scheme_id": getattr(scheme, "id", None)}
    await save_chat_message(user_id, "assistant", reply, kind="text", meta=meta)
    return {
        "messages": [{"role": "assistant", "kind": "text", "content": reply, "meta": meta}],
        "tx_result": None,
    }


async def _maybe_offer_scheme(
    user_id: int, transactions: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """After recording new income, invite the user to set a budget scheme."""
    has_income = any(t.get("intent") == "income" for t in transactions)
    if not has_income:
        return None

    text = (
        "<b>Mau atur skema keuangan dari pemasukan ini?</b>\n"
        "Misalnya batasi <i>nongkrong</i> Rp500rb/bulan — saya akan ingatkan otomatis "
        "saat pemakaian mendekati batas.\n\n"
        "Balas pesan ini (geser ke kanan) dengan contoh: "
        "<i>nongkrong 500rb</i> atau ketik <i>set skema nongkrong 500rb</i>."
    )
    choices = [
        {"key": "scheme_set", "label": "Atur Skema"},
        {"key": "scheme_skip", "label": "Nanti"},
    ]
    meta = {"choices": choices, "scheme_offer": True}
    await save_chat_message(user_id, "assistant", text, kind="system", meta=meta)
    return {"role": "assistant", "kind": "system", "content": text, "meta": meta}


async def _emit_scheme_alerts(user_id: int) -> List[Dict[str, Any]]:
    """Check budget schemes after an expense; persist + push any new warnings."""
    out: List[Dict[str, Any]] = []
    try:
        from app.services.scheme_service import check_schemes_after_expense

        alerts = await check_schemes_after_expense(user_id)
    except Exception as e:
        logger.error(f"check_schemes_after_expense failed: {e}", exc_info=True)
        return out

    for alert in alerts:
        msg = alert["message"]
        meta = {"scheme_id": alert["scheme_id"], "scheme_alert": True}
        await save_chat_message(user_id, "assistant", msg, kind="system", meta=meta)
        out.append({"role": "assistant", "kind": "system", "content": msg, "meta": meta})
        # Push immediately so the warning reaches the user even outside the app.
        try:
            from app.services.push_service import send_push_to_user

            await send_push_to_user(
                user_id,
                f"Peringatan Budget: {alert['name']}",
                _strip_html(msg),
                url="/chat",
                category="spending_alert",
            )
        except Exception as e:
            logger.warning(f"push for scheme alert failed: {e}")
    return out


async def handle_image_message(
    user_id: int,
    data: bytes,
    filename: str,
    mime: Optional[str] = None,
) -> Dict[str, Any]:
    """Process an uploaded receipt image."""
    try:
        media = _save_upload_bytes(user_id, data, filename, mime=mime)
        if not media["mime_type"].startswith("image/"):
            await save_chat_message(user_id, "user", "[file dikirim]", kind="image",
                                    meta={"filename": filename, "mime": mime})
            reply = "File ini bukan gambar. Kirim foto struk (JPG/PNG)."
            await save_chat_message(user_id, "assistant", reply, kind="text")
            return {"messages": [{"role": "assistant", "kind": "text", "content": reply}], "tx_result": None}

        # Save user bubble with the real file URL so it can be re-opened later
        file_basename = Path(media["file_path"]).name
        file_url = f"/api/chat/file/{file_basename}"
        await save_chat_message(
            user_id, "user", "[foto struk]", kind="image",
            meta={"file_url": file_url, "filename": filename, "mime": media["mime_type"]},
        )

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
        # Confidence OCR sengaja TIDAK ditampilkan ke user (hanya untuk log internal).

        await save_chat_message(user_id, "assistant", reply, kind="text",
                                meta={"receipt_id": receipt.id})

        messages = [{"role": "assistant", "kind": "text", "content": reply}]
        if result.get("success") and result.get("transactions"):
            offer = await _maybe_offer_scheme(user_id, result["transactions"])
            if offer:
                messages.append(offer)
            messages.extend(await _emit_scheme_alerts(user_id))
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
    try:
        media = _save_upload_bytes(user_id, data, filename, mime=mime)

        file_basename = Path(media["file_path"]).name
        file_url = f"/api/chat/file/{file_basename}"
        await save_chat_message(
            user_id, "user", "[pesan suara]", kind="audio",
            meta={"file_url": file_url, "filename": filename, "mime": media["mime_type"]},
        )

        from worker import process_audio_message

        result = await process_audio_message(user_id, media["file_path"])
        reply = format_transaction_response(result)
        await save_chat_message(user_id, "assistant", reply, kind="text",
                                meta={"transcription": result.get("transcription")})

        messages = [{"role": "assistant", "kind": "text", "content": reply}]
        if result.get("success") and result.get("transactions"):
            offer = await _maybe_offer_scheme(user_id, result["transactions"])
            if offer:
                messages.append(offer)
            messages.extend(await _emit_scheme_alerts(user_id))
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
