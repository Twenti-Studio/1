"""
FiNot Telegram Webhook Handler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Handles all Telegram messages: text, photo, voice/audio.
Integrates LLM intent classification, RBAC, and AI analysis features.
"""

import os
import io
import httpx
import logging
import asyncio
import json
import qrcode
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from app.config import BOT_TOKEN, TELEGRAM_API_URL, PLAN_CONFIG, TRAKTEER_PAGE_URL
from app.db import prisma
from app.services.user_service import get_or_create_user
from app.services.media_service import download_telegram_media
from app.services.receipt_service import create_receipt
from app.services.subscription_service import (
    get_user_plan,
    check_ai_credits,
    consume_ai_credit,
    get_subscription_status,
    check_feature_access,
)
from app.services.payment_service import create_payment_order, check_payment_status

router = APIRouter(prefix="/webhook", tags=["telegram"])

logger = logging.getLogger(__name__)

TELEGRAM_SEND_URL = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/sendMessage"
TELEGRAM_SEND_DOC_URL = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/sendDocument"
TELEGRAM_SEND_PHOTO_URL = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/sendPhoto"
TELEGRAM_EDIT_MSG_URL = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/editMessageText"
TELEGRAM_ANSWER_CB_URL = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/answerCallbackQuery"
TELEGRAM_DELETE_MSG_URL = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/deleteMessage"


# ═══════════════════════════════════════════
# HELPER: Send Telegram Messages
# ═══════════════════════════════════════════

async def send_telegram_message(
    chat_id: int,
    text: str,
    parse_mode: str = "HTML",
    reply_markup: dict = None,
) -> bool:
    """Send text message via Telegram API."""
    try:
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(TELEGRAM_SEND_URL, json=payload)
            if not resp.is_success:
                logger.error(f"Telegram sendMessage failed: {resp.status_code} {resp.text}")
            resp.raise_for_status()
            return True

    except Exception as e:
        logger.error(f"Failed to send message: {e}")
        return False


async def send_telegram_document(
    chat_id: int,
    file_path: str,
    caption: str = "",
) -> bool:
    """Send document via Telegram API."""
    try:
        with open(file_path, "rb") as f:
            files = {"document": f}
            data = {"chat_id": chat_id, "caption": caption}

            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    TELEGRAM_SEND_DOC_URL, data=data, files=files
                )
                resp.raise_for_status()
                return True

    except Exception as e:
        logger.error(f"Failed to send document: {e}")
        return False


async def send_telegram_photo_bytes(
    chat_id: int,
    photo_bytes: bytes,
    filename: str = "qr_payment.png",
    caption: str = "",
    reply_markup: dict = None,
) -> bool:
    """Send a photo from bytes via Telegram API."""
    try:
        data = {
            "chat_id": str(chat_id),
            "parse_mode": "HTML",
        }
        if caption:
            data["caption"] = caption
        if reply_markup:
            data["reply_markup"] = json.dumps(reply_markup)

        files = {"photo": (filename, photo_bytes, "image/png")}

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                TELEGRAM_SEND_PHOTO_URL, data=data, files=files
            )
            resp.raise_for_status()
            return True

    except Exception as e:
        logger.error(f"Failed to send photo: {e}")
        return False


def generate_payment_qr(url: str) -> bytes:
    """Generate QR code image bytes from a URL."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()


async def answer_callback_query(
    callback_query_id: str,
    text: str = None,
    show_alert: bool = False,
) -> bool:
    """Answer an inline button callback query."""
    try:
        payload = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text
        payload["show_alert"] = show_alert

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(TELEGRAM_ANSWER_CB_URL, json=payload)
            resp.raise_for_status()
            return True

    except Exception as e:
        logger.error(f"Failed to answer callback query: {e}")
        return False


async def edit_telegram_message(
    chat_id: int,
    message_id: int,
    text: str,
    parse_mode: str = "HTML",
    reply_markup: dict = None,
) -> bool:
    """Edit an existing Telegram message."""
    try:
        payload = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "parse_mode": parse_mode,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(TELEGRAM_EDIT_MSG_URL, json=payload)
            if not resp.is_success:
                logger.error(f"Telegram editMessage failed: {resp.status_code} {resp.text}")
            resp.raise_for_status()
            return True

    except Exception as e:
        logger.error(f"Failed to edit message: {e}")
        return False


async def delete_telegram_message(chat_id: int, message_id: int) -> bool:
    """Delete a Telegram message."""
    try:
        payload = {"chat_id": chat_id, "message_id": message_id}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(TELEGRAM_DELETE_MSG_URL, json=payload)
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Failed to delete message: {e}")
        return False


# ═══════════════════════════════════════════
# FORMAT HELPERS
# ═══════════════════════════════════════════

def format_transaction_response(result: dict) -> str:
    """Format transaction processing result into user-friendly message."""
    if not result.get("success"):
        return f"❌ {result.get('error', 'Terjadi kesalahan')}"

    transactions = result.get("transactions", [])
    source = result.get("source", "text")

    if not transactions:
        return "⚠️ Tidak ada transaksi yang terdeteksi."

    lines = []

    # Header based on source
    source_emoji = {"text": "💬", "image": "📸", "audio": "🎙️"}.get(source, "💬")
    lines.append(f"{source_emoji} <b>Transaksi Tercatat!</b>")

    if result.get("transcription"):
        lines.append(f"🗣️ <i>Transkripsi: \"{result['transcription'][:100]}\"</i>")

    lines.append("")

    for i, tx in enumerate(transactions, 1):
        emoji = "💰" if tx["intent"] == "income" else "💸"
        tipo = "Pemasukan" if tx["intent"] == "income" else "Pengeluaran"
        amount = tx["amount"]

        if len(transactions) > 1:
            lines.append(f"<b>#{i}</b>")

        lines.append(f"{emoji} {tipo}: <b>Rp {amount:,}</b>")
        lines.append(f"📂 Kategori: {tx['category']}")

        if tx.get("needs_review"):
            lines.append("⚠️ <i>Perlu review</i>")

        lines.append("")

    return "\n".join(lines)


def format_subscription_status(status: dict) -> str:
    """Format subscription status message."""
    plan = status.get("plan", "free")
    plan_name = status.get("plan_name", "Free Plan")
    credits = status.get("credits", {})

    lines = [
        "👤 <b>Status Akun FiNot</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"📋 Plan: <b>{plan_name}</b>",
        f"🤖 Sisa AI Credit: <b>{credits.get('remaining', 0)}/{credits.get('total', 0)}</b>",
    ]

    sub = status.get("subscription")
    if sub:
        lines.append(f"📅 Berakhir: {sub.get('end_date', '-')[:10]}")
        lines.append(f"⏳ Sisa hari: {sub.get('days_left', 0)} hari")

    if plan == "free":
        lines.append("")
        lines.append("💡 Upgrade untuk fitur lebih lengkap!")
        lines.append("Ketik /upgrade untuk lihat paket premium 🚀")

    return "\n".join(lines)


def format_upgrade_menu() -> str:
    """Format upgrade plan menu with details."""
    lines = [
        "🚀 <b>Upgrade FiNot Premium</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
    ]

    # Free plan
    lines.append("🆓 <b>FREE PLAN</b> (Saat Ini)")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("💰 Harga: <b>Gratis</b>")
    lines.append("🎯 5 AI credit total (tanpa refill)")
    for feat in PLAN_CONFIG['free']['features']:
        lines.append(f"  • {feat}")
    lines.append("")

    # Pro plan
    lines.append("🥈 <b>PAKET PRO</b>")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
    pro = PLAN_CONFIG['pro']
    lines.append(f"💰 Harga: <b>Rp {pro['price']:,}</b>")
    lines.append(f"⏳ Durasi: <b>{pro['duration_days']} Hari</b>")
    lines.append(f"🤖 {pro['ai_credits_weekly']} AI credit/minggu")
    lines.append(f"📊 ~Rp {pro['price']//pro['duration_days']:,}/hari")
    for feat in pro['features']:
        lines.append(f"  • {feat}")
    lines.append("")

    # Elite plan
    lines.append("🥇 <b>PAKET ELITE</b>")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
    elite = PLAN_CONFIG['elite']
    lines.append(f"💰 Harga: <b>Rp {elite['price']:,}</b>")
    lines.append(f"⏳ Durasi: <b>{elite['duration_days']} Hari</b>")
    lines.append(f"🤖 {elite['ai_credits_weekly']} AI credit/minggu")
    lines.append(f"📊 ~Rp {elite['price']//elite['duration_days']:,}/hari")
    for feat in elite['features']:
        lines.append(f"  • {feat}")
    lines.append("")

    lines.append("━━━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("🔒 Pembayaran aman via QRIS (Trakteer)")
    lines.append("⚡ Aktivasi otomatis setelah konfirmasi")

    return "\n".join(lines)


def format_help_message() -> str:
    """Format help/start message."""
    return """🧠 <b>FiNot - AI Financial Assistant</b>
━━━━━━━━━━━━━━━━━━━━━━━━

Halo! Saya FiNot, asisten keuangan pribadimu yang cerdas! 🤖

<b>💬 Catat Transaksi</b>
Kirim pesan seperti:
• "beli makan 25rb"
• "gajian 5jt"
• "ongkos ojol 15rb dan makan siang 30rb"

<b>📸 Scan Struk</b>
Kirim foto struk/receipt → auto input!

<b>🎙️ Pesan Suara</b>
Kirim voice note → auto transkrip & catat!

<b>🤖 Fitur AI:</b>
/insight - Insight harian 💡
/predict [saldo] - Prediksi umur saldo 🔮
/saving - Rekomendasi tabungan 💰
/health - Skor kesehatan keuangan ❤️
/simulate [nominal] - Simulasi hemat 📊
/analysis - Analisis mingguan/bulanan 📈

<b>📋 Data & Laporan:</b>
/history - Riwayat transaksi
/export - Download Excel
/status - Status akun & kredit

<b>💎 Premium:</b>
/upgrade - Lihat paket premium
/buy [plan] - Beli paket (QRIS)

<b>ℹ️ Lainnya:</b>
/help - Tampilkan bantuan ini
"""


# ═══════════════════════════════════════════
# RBAC MIDDLEWARE
# ═══════════════════════════════════════════

async def check_credits_and_consume(user_id: int, feature: str = None) -> dict:
    """
    Check and consume AI credit before processing.
    Returns {"allowed": True/False, "message": str}
    """
    plan = await get_user_plan(user_id)

    # Check feature access if specified
    if feature and not check_feature_access(plan, feature):
        return {
            "allowed": False,
            "message": (
                f"⛔ Fitur ini hanya tersedia untuk paket premium.\n"
                f"Ketik /upgrade untuk lihat paket! 🚀"
            ),
        }

    # Check and consume credit
    credits = await check_ai_credits(user_id)
    if not credits["has_credits"]:
        if plan == "free":
            return {
                "allowed": False,
                "message": (
                    "⚠️ AI credit kamu sudah habis (5/5 digunakan).\n\n"
                    "Upgrade ke Pro untuk 50 credit/minggu! 🚀\n"
                    "Ketik /upgrade untuk info."
                ),
            }
        else:
            return {
                "allowed": False,
                "message": (
                    f"⚠️ Kredit AI minggu ini sudah habis.\n"
                    f"Sisa: {credits['remaining']}/{credits['total']}\n"
                    f"Kredit akan di-reset setiap hari Senin."
                ),
            }

    consumed = await consume_ai_credit(user_id)
    if not consumed:
        return {
            "allowed": False,
            "message": "⚠️ Gagal menggunakan kredit AI. Coba lagi.",
        }

    return {"allowed": True, "credits_remaining": credits["remaining"] - 1}


# ═══════════════════════════════════════════
# MAIN WEBHOOK HANDLER
# ═══════════════════════════════════════════

@router.post("/telegram")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle incoming Telegram webhook updates."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": True})

    # ── Handle callback queries (inline button presses) ──
    callback_query = body.get("callback_query")
    if callback_query:
        cb_id = callback_query["id"]
        cb_data = callback_query.get("data", "")
        cb_message = callback_query.get("message", {})
        chat_id = cb_message.get("chat", {}).get("id")
        message_id = cb_message.get("message_id")
        user_id = callback_query["from"]["id"]

        if chat_id and cb_data:
            background_tasks.add_task(
                _handle_callback_query,
                cb_id, chat_id, user_id, message_id, cb_data,
            )

        return JSONResponse({"ok": True})

    # ── Handle regular messages ──
    message = body.get("message")
    if not message:
        return JSONResponse({"ok": True})

    chat_id = message["chat"]["id"]
    user_id = message["from"]["id"]
    username = message["from"].get("username")
    display_name = (
        message["from"].get("first_name", "")
        + " "
        + message["from"].get("last_name", "")
    ).strip()

    # Ensure user exists
    try:
        await get_or_create_user(
            prisma, user_id, username=username, display_name=display_name
        )
    except Exception as e:
        logger.error(f"Failed to get/create user: {e}")

    # Route to handler based on message type
    background_tasks.add_task(
        _handle_update, chat_id, user_id, message
    )

    return JSONResponse({"ok": True})


async def _handle_update(chat_id: int, user_id: int, message: dict):
    """Route message to appropriate handler."""
    try:
        # Check for command
        text = message.get("text", "")

        if text.startswith("/"):
            await _handle_command(chat_id, user_id, text)
            return

        # Photo
        if "photo" in message:
            await _handle_photo(chat_id, user_id, message)
            return

        # Voice / Audio
        if "voice" in message or "audio" in message:
            await _handle_audio(chat_id, user_id, message)
            return

        # Text message
        if text:
            await _handle_text(chat_id, user_id, text)
            return

        # Document (check if it's an image)
        if "document" in message:
            doc = message["document"]
            mime = doc.get("mime_type", "")
            if mime.startswith("image/"):
                await _handle_photo(chat_id, user_id, message, is_document=True)
                return

        await send_telegram_message(
            chat_id,
            "❓ Maaf, saya belum bisa memproses jenis pesan ini.\n"
            "Coba kirim teks, foto struk, atau pesan suara!"
        )

    except Exception as e:
        logger.error(f"Error handling update: {e}", exc_info=True)
        await send_telegram_message(
            chat_id,
            "❌ Terjadi kesalahan. Silakan coba lagi."
        )


# ═══════════════════════════════════════════
# COMMAND HANDLERS
# ═══════════════════════════════════════════

async def _handle_command(chat_id: int, user_id: int, text: str):
    """Handle /commands."""
    parts = text.strip().split()
    command = parts[0].lower().replace("@finot_bot", "")
    args = parts[1:] if len(parts) > 1 else []

    if command in ("/start", "/help"):
        await send_telegram_message(chat_id, format_help_message())

    elif command == "/status":
        status = await get_subscription_status(user_id)
        await send_telegram_message(chat_id, format_subscription_status(status))

    elif command in ("/upgrade", "/buy"):
        await _handle_upgrade_command(chat_id, user_id)

    elif command == "/history":
        await _handle_history_command(chat_id, user_id, args)

    elif command == "/export":
        await _handle_export_command(chat_id, user_id, args)

    elif command == "/insight":
        await _handle_insight_command(chat_id, user_id)

    elif command == "/predict":
        await _handle_predict_command(chat_id, user_id, args)

    elif command == "/saving":
        await _handle_saving_command(chat_id, user_id)

    elif command == "/health":
        await _handle_health_command(chat_id, user_id)

    elif command == "/simulate":
        await _handle_simulate_command(chat_id, user_id, args)

    elif command == "/analysis":
        await _handle_analysis_command(chat_id, user_id, args)

    else:
        await send_telegram_message(
            chat_id,
            "❓ Perintah tidak dikenali. Ketik /help untuk bantuan."
        )


async def _handle_upgrade_command(chat_id: int, user_id: int):
    """Handle /upgrade or /buy — show plan list with inline buttons."""
    text = format_upgrade_menu()

    # Inline keyboard with plan buttons
    reply_markup = {
        "inline_keyboard": [
            [{"text": "💎 Beli PAKET PRO - Rp19.000", "callback_data": "buy:pro"}],
            [{"text": "💎 Beli PAKET ELITE - Rp49.000", "callback_data": "buy:elite"}],
            [{"text": "🔙 Menu Utama", "callback_data": "menu:main"}],
        ]
    }

    await send_telegram_message(chat_id, text, reply_markup=reply_markup)


# ═══════════════════════════════════════════
# CALLBACK QUERY HANDLER (Inline Button Clicks)
# ═══════════════════════════════════════════

async def _handle_callback_query(
    cb_id: str, chat_id: int, user_id: int, message_id: int, cb_data: str,
):
    """Handle inline button callback queries."""
    try:
        # Answer callback to remove loading state
        await answer_callback_query(cb_id)

        # Parse callback data (format: "action:value")
        parts = cb_data.split(":", 1)
        action = parts[0]
        value = parts[1] if len(parts) > 1 else ""

        if action == "buy":
            # Step 2: Show order summary / confirmation
            await _cb_show_order_summary(chat_id, user_id, message_id, value)

        elif action == "confirm_buy":
            # Step 3: Create payment + show Trakteer link
            await _cb_confirm_payment(chat_id, user_id, message_id, value)

        elif action == "cancel_buy":
            # Cancel order
            await _cb_cancel_order(chat_id, user_id, message_id)

        elif action == "check_status":
            # Check payment status
            await _cb_check_payment_status(chat_id, user_id, message_id, value)

        elif action == "menu":
            if value == "main":
                await _cb_back_to_main(chat_id, message_id)
            elif value == "upgrade":
                await _cb_back_to_upgrade(chat_id, user_id, message_id)

        else:
            logger.warning(f"Unknown callback data: {cb_data}")

    except Exception as e:
        logger.error(f"Error handling callback query: {e}", exc_info=True)
        await send_telegram_message(
            chat_id, "❌ Terjadi kesalahan. Silakan coba lagi."
        )


async def _cb_show_order_summary(
    chat_id: int, user_id: int, message_id: int, plan: str,
):
    """Step 2: Show order summary with confirmation buttons."""
    if plan not in ("pro", "elite"):
        return

    plan_config = PLAN_CONFIG[plan]
    price = plan_config["price"]
    duration = plan_config["duration_days"]

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    text = (
        f"✅ <b>Konfirmasi Pesanan</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📦 Paket: <b>{plan_config['name']}</b>\n"
        f"💰 Harga: <b>Rp {price:,}</b>\n"
        f"⏳ Durasi: <b>{duration} Hari</b>\n"
        f"🤖 Kuota: <b>{plan_config['ai_credits_weekly']} AI credit/minggu</b>\n"
        f"📊 Per Hari: ~Rp {price // duration:,}\n\n"
    )

    # Add features
    for feat in plan_config["features"]:
        text += f"  • {feat}\n"

    text += (
        f"\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"<i>Lanjutkan pembayaran?</i>"
    )

    reply_markup = {
        "inline_keyboard": [
            [{"text": "💳 Bayar Sekarang", "callback_data": f"confirm_buy:{plan}"}],
            [{"text": "🔙 Kembali", "callback_data": "menu:upgrade"}],
        ]
    }

    await edit_telegram_message(
        chat_id, message_id, text, reply_markup=reply_markup,
    )


async def _cb_confirm_payment(
    chat_id: int, user_id: int, message_id: int, plan: str,
):
    """Step 3: Create payment record, generate QR code, and send as photo."""
    if plan not in ("pro", "elite"):
        return

    plan_config = PLAN_CONFIG[plan]

    try:
        payment = await create_payment_order(user_id, plan)
        tx_id = payment["transaction_id"]
        payment_id = payment["payment_id"]

        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)

        # Generate Trakteer payment link with correct quantity
        # Unit price di Trakteer = Rp 1.000, jadi quantity = price / 1000
        trakteer_qty = plan_config["price"] // 1000
        trakteer_link = f"{TRAKTEER_PAGE_URL}?quantity={trakteer_qty}&message=FiNot-{plan.upper()}-{tx_id}"

        # Generate QR code from payment link
        qr_bytes = generate_payment_qr(trakteer_link)

        # Delete the old inline message (order summary)
        await delete_telegram_message(chat_id, message_id)

        # Caption for the QR photo
        caption = (
            f"💳 <b>PEMBAYARAN — {plan_config['name']}</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"📦 Paket: <b>{plan_config['name']}</b>\n"
            f"💰 Total: <b>Rp {plan_config['price']:,}</b>\n"
            f"⏳ Durasi: <b>{plan_config['duration_days']} hari</b>\n"
            f"🆔 ID: <code>{tx_id}</code>\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"📱 <b>CARA BAYAR:</b>\n"
            f"1️⃣ Scan QR di atas dengan kamera HP\n"
            f"2️⃣ Buka halaman Trakteer yang muncul\n"
            f"3️⃣ Pilih pembayaran QRIS\n"
            f"4️⃣ Bayar dengan E-Wallet/M-Banking\n\n"
            f"⚠️ Pastikan nominal <b>Rp {plan_config['price']:,}</b>\n"
            f"⏰ Berlaku <b>30 menit</b>\n"
            f"🕐 {now.strftime('%d/%m/%Y %H:%M')}"
        )

        reply_markup = {
            "inline_keyboard": [
                [{"text": "🔗 Buka Link Pembayaran", "url": trakteer_link}],
                [{"text": "🔍 Cek Status", "callback_data": f"check_status:{payment_id}"}],
                [{"text": "❌ Batalkan", "callback_data": "cancel_buy:0"}],
            ]
        }

        # Send QR code as photo with caption and buttons
        await send_telegram_photo_bytes(
            chat_id, qr_bytes,
            filename=f"qr_{tx_id}.png",
            caption=caption,
            reply_markup=reply_markup,
        )

    except Exception as e:
        logger.error(f"Error creating payment: {e}", exc_info=True)
        await send_telegram_message(
            chat_id,
            "❌ Gagal membuat pesanan. Silakan coba lagi.\n"
            "Ketik /upgrade untuk mencoba kembali.",
        )


async def _cb_cancel_order(chat_id: int, user_id: int, message_id: int):
    """Cancel payment order."""
    # Delete original message (could be text or photo)
    await delete_telegram_message(chat_id, message_id)

    text = (
        "❌ <b>Pesanan Dibatalkan</b>\n\n"
        "Pembayaran telah dibatalkan.\n"
        "Ketik /upgrade kapan saja untuk melihat paket lagi! 😊"
    )
    await send_telegram_message(chat_id, text)


async def _cb_check_payment_status(
    chat_id: int, user_id: int, message_id: int, payment_id_str: str,
):
    """Check payment status and notify user."""
    try:
        payment_id = int(payment_id_str)
        result = await check_payment_status(payment_id)

        if not result.get("found"):
            await send_telegram_message(
                chat_id, "❓ Payment tidak ditemukan."
            )
            return

        status = result["status"]

        if status == "paid":
            text = (
                "✅ <b>Pembayaran Berhasil!</b>\n\n"
                f"🎉 Paket <b>{result.get('plan', '').upper()}</b> sudah aktif!\n"
                "Ketik /status untuk melihat detail langganan."
            )
            await send_telegram_message(chat_id, text)

        elif status == "expired":
            text = (
                "⏰ <b>Pembayaran Kedaluwarsa</b>\n\n"
                "Pesanan telah melewati batas waktu 30 menit.\n"
                "Ketik /upgrade untuk membuat pesanan baru."
            )
            await send_telegram_message(chat_id, text)

        elif status == "pending":
            text = (
                "⏳ <b>Menunggu Pembayaran</b>\n\n"
                f"💰 Total: <b>Rp {result.get('amount', 0):,}</b>\n"
                f"📦 Paket: <b>{result.get('plan', '').upper()}</b>\n\n"
                "Silakan selesaikan pembayaran via Trakteer.\n"
                "Klik tombol \"Bayar via Trakteer\" di pesan sebelumnya."
            )

            reply_markup = {
                "inline_keyboard": [
                    [{"text": "🔄 Cek Lagi", "callback_data": f"check_status:{payment_id}"}],
                ]
            }
            await send_telegram_message(chat_id, text, reply_markup=reply_markup)

        else:
            await send_telegram_message(
                chat_id,
                f"📋 Status pembayaran: <b>{status}</b>\n"
                "Ketik /upgrade untuk membuat pesanan baru.",
            )

    except Exception as e:
        logger.error(f"Error checking payment status: {e}", exc_info=True)
        await send_telegram_message(
            chat_id, "❌ Gagal mengecek status. Coba lagi nanti."
        )


async def _cb_back_to_main(chat_id: int, message_id: int):
    """Go back to main help menu."""
    await delete_telegram_message(chat_id, message_id)
    text = format_help_message()
    await send_telegram_message(chat_id, text)


async def _cb_back_to_upgrade(chat_id: int, user_id: int, message_id: int):
    """Go back to upgrade menu with inline buttons."""
    await delete_telegram_message(chat_id, message_id)

    text = format_upgrade_menu()

    reply_markup = {
        "inline_keyboard": [
            [{"text": "💎 Beli PAKET PRO - Rp19.000", "callback_data": "buy:pro"}],
            [{"text": "💎 Beli PAKET ELITE - Rp49.000", "callback_data": "buy:elite"}],
            [{"text": "🔙 Menu Utama", "callback_data": "menu:main"}],
        ]
    }

    await send_telegram_message(chat_id, text, reply_markup=reply_markup)


async def _handle_history_command(chat_id: int, user_id: int, args: list):
    """Handle /history command."""
    period = args[0].lower() if args else "week"

    if period not in ("today", "week", "month", "year"):
        period = "week"

    try:
        from app.services.transaction_services import (
            get_transactions_for_period,
            build_history_summary,
        )

        txs, label = await get_transactions_for_period(prisma, user_id, period)
        summary = build_history_summary(label, txs)
        await send_telegram_message(chat_id, summary)

    except Exception as e:
        logger.error(f"Error getting history: {e}", exc_info=True)
        await send_telegram_message(
            chat_id,
            "❌ Gagal mengambil riwayat. Coba: /history today|week|month|year"
        )


async def _handle_export_command(chat_id: int, user_id: int, args: list):
    """Handle /export command."""
    period = args[0].lower() if args else "month"

    if period not in ("today", "week", "month", "year"):
        period = "month"

    try:
        from app.services.transaction_services import create_excel_report

        file_path, file_name = await create_excel_report(prisma, user_id, period)

        if not file_path:
            await send_telegram_message(
                chat_id,
                f"ℹ️ Tidak ada transaksi untuk di-export ({period})."
            )
            return

        await send_telegram_document(
            chat_id,
            file_path,
            caption=f"📊 Laporan transaksi FiNot ({period})"
        )

    except Exception as e:
        logger.error(f"Error exporting: {e}", exc_info=True)
        await send_telegram_message(chat_id, "❌ Gagal membuat laporan.")


async def _handle_insight_command(chat_id: int, user_id: int):
    """Handle /insight - Daily AI Insight."""
    # Check premium access
    access = await check_credits_and_consume(user_id, feature="daily_insight")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_daily_insight

        await send_telegram_message(chat_id, "🔍 Menganalisis transaksi hari ini...")

        result = await get_daily_insight(user_id)

        if result.get("success"):
            data = result["data"]
            emoji = data.get("emoji_mood", "📊")
            insight = data.get("insight", "Tidak ada insight tersedia.")
            tip = data.get("tip", "")

            message = (
                f"{emoji} <b>Daily Insight</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"{insight}\n\n"
                f"💡 <b>Tip:</b> {tip}"
            )
        else:
            message = "⚠️ Belum ada data cukup. Catat beberapa transaksi dulu ya!"

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in insight: {e}", exc_info=True)
        await send_telegram_message(chat_id, "❌ Gagal menganalisis.")


async def _handle_predict_command(chat_id: int, user_id: int, args: list):
    """Handle /predict - Balance Prediction (auto-calculates balance)."""
    access = await check_credits_and_consume(user_id)
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_balance_prediction

        await send_telegram_message(chat_id, "🔮 Menghitung saldo dan memprediksi...")

        result = await get_balance_prediction(user_id)

        if result.get("success"):
            data = result["data"]
            balance = result.get("balance", 0)
            days = data.get("predicted_days", 0)
            explanation = data.get("explanation", "")

            message = (
                f"🔮 <b>Prediksi Umur Saldo</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"💰 Saldo saat ini: <b>Rp {balance:,}</b>\n"
                f"📊 Rata-rata pengeluaran/hari: <b>Rp {data.get('daily_avg_expense', 0):,}</b>\n"
                f"📅 Estimasi bertahan: <b>±{days} hari</b>\n\n"
                f"📝 {explanation}"
            )
        else:
            message = "⚠️ Belum cukup data. Catat transaksi dulu minimal 3 hari."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in prediction: {e}", exc_info=True)
        await send_telegram_message(chat_id, "❌ Gagal memprediksi.")


async def _handle_saving_command(chat_id: int, user_id: int):
    """Handle /saving - Saving Recommendation."""
    access = await check_credits_and_consume(user_id, feature="daily_insight")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_saving_recommendation

        await send_telegram_message(chat_id, "💰 Menganalisis pola keuanganmu...")

        result = await get_saving_recommendation(user_id)

        if result.get("success"):
            data = result["data"]
            message = (
                f"💰 <b>Rekomendasi Tabungan</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"💵 Net Income: <b>Rp {data.get('net_income', 0):,}</b>\n"
                f"💸 Total Pengeluaran: <b>Rp {data.get('total_expense', 0):,}</b>\n"
                f"🎯 Rekomendasi Tabungan: <b>Rp {data.get('recommended_saving', 0):,}/bulan</b>\n"
                f"📊 Persentase: {data.get('saving_percentage', 0)}%\n\n"
                f"📝 <b>Strategi:</b>\n{data.get('strategy', '-')}\n\n"
                f"💡 <b>Tips:</b>"
            )
            tips = data.get("specific_tips", [])
            for tip in tips:
                message += f"\n• {tip}"
        else:
            message = "⚠️ Belum cukup data untuk analisis."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in saving: {e}", exc_info=True)
        await send_telegram_message(chat_id, "❌ Gagal menganalisis.")


async def _handle_health_command(chat_id: int, user_id: int):
    """Handle /health - Financial Health Score."""
    access = await check_credits_and_consume(user_id)
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_financial_health_score

        await send_telegram_message(chat_id, "❤️ Menghitung skor kesehatan keuangan...")

        result = await get_financial_health_score(user_id)

        if result.get("success"):
            data = result["data"]
            score = data.get("total_score", 0)
            grade = data.get("grade", "?")

            # Color-coded emoji based on score
            if score >= 80:
                emoji = "🟢"
            elif score >= 60:
                emoji = "🟡"
            elif score >= 40:
                emoji = "🟠"
            else:
                emoji = "🔴"

            message = (
                f"❤️ <b>Financial Health Score</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"{emoji} Skor: <b>{score}/100 (Grade {grade})</b>\n\n"
                f"📊 Detail:\n"
                f"  💰 Saving Ratio: {data.get('saving_ratio_score', 0)}/35\n"
                f"  📈 Stabilitas: {data.get('stability_score', 0)}/30\n"
                f"  💸 Cash Flow: {data.get('cashflow_score', 0)}/35\n\n"
                f"📝 {data.get('summary', '-')}\n\n"
                f"💡 <b>Saran:</b>"
            )
            recs = data.get("recommendations", [])
            for rec in recs:
                message += f"\n• {rec}"
        else:
            message = "⚠️ Belum cukup data untuk menghitung skor."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in health score: {e}", exc_info=True)
        await send_telegram_message(chat_id, "❌ Gagal menghitung skor.")


async def _handle_simulate_command(chat_id: int, user_id: int, args: list):
    """Handle /simulate or natural language simulation."""
    # Join args as natural language scenario
    scenario = " ".join(args) if args else "hemat 10000 per hari"

    access = await check_credits_and_consume(user_id)
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_saving_simulation

        await send_telegram_message(chat_id, f"📊 Mensimulasikan: {scenario}...")

        result = await get_saving_simulation(user_id, user_scenario=scenario)

        if result.get("success"):
            data = result["data"]
            message = (
                f"📊 <b>Simulasi Hemat</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"🎯 Skenario: <b>{data.get('scenario', scenario)}</b>\n\n"
                f"💰 Hemat per bulan: <b>Rp {data.get('monthly_saving', 0):,}</b>\n"
                f"💎 Hemat per tahun: <b>Rp {data.get('yearly_saving', 0):,}</b>\n"
                f"⏱️ Umur saldo bertambah: <b>+{data.get('extra_balance_days', 0)} hari</b>\n\n"
                f"✨ {data.get('message', '')}"
            )
        else:
            message = "⚠️ Belum cukup data untuk simulasi."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in simulation: {e}", exc_info=True)
        await send_telegram_message(chat_id, "❌ Gagal menjalankan simulasi.")


async def _handle_analysis_command(chat_id: int, user_id: int, args: list):
    """Handle /analysis [weekly|monthly]."""
    period = args[0].lower() if args else "weekly"

    if period == "monthly":
        # Monthly is Elite only
        access = await check_credits_and_consume(user_id, feature="monthly_analysis")
        if not access["allowed"]:
            await send_telegram_message(chat_id, access["message"])
            return

        try:
            from worker.analysis_service import get_monthly_analysis

            await send_telegram_message(chat_id, "📈 Menganalisis data bulanan...")
            result = await get_monthly_analysis(user_id)

            if result.get("success"):
                data = result["data"]
                message = (
                    f"📈 <b>Monthly Deep Analysis</b>\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"💰 Pemasukan: <b>Rp {data.get('total_income', 0):,}</b>\n"
                    f"💸 Pengeluaran: <b>Rp {data.get('total_expense', 0):,}</b>\n"
                    f"📊 Net: <b>Rp {data.get('net_income', 0):,}</b>\n"
                    f"📈 Tren: {data.get('spending_trend', '-')}\n\n"
                    f"🧠 {data.get('deep_insight', '-')}\n\n"
                    f"🎯 <b>Prioritas Aksi:</b>"
                )
                for action in data.get("priority_actions", []):
                    message += f"\n• {action}"
            else:
                message = "⚠️ Belum cukup data untuk analisis bulanan."

            await send_telegram_message(chat_id, message)

        except Exception as e:
            logger.error(f"Error in monthly analysis: {e}", exc_info=True)
            await send_telegram_message(chat_id, "❌ Gagal menganalisis.")

    else:
        # Weekly is Pro+
        access = await check_credits_and_consume(user_id, feature="weekly_summary")
        if not access["allowed"]:
            await send_telegram_message(chat_id, access["message"])
            return

        try:
            from worker.analysis_service import get_weekly_analysis

            await send_telegram_message(chat_id, "📊 Menganalisis data mingguan...")
            result = await get_weekly_analysis(user_id)

            if result.get("success"):
                data = result["data"]
                message = (
                    f"📊 <b>Weekly Analysis</b>\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"💰 Pemasukan: <b>Rp {data.get('total_income', 0):,}</b>\n"
                    f"💸 Pengeluaran: <b>Rp {data.get('total_expense', 0):,}</b>\n"
                    f"📊 Net: <b>Rp {data.get('net', 0):,}</b>\n\n"
                    f"📋 {data.get('insight', '-')}\n\n"
                    f"💡 <b>Action Items:</b>"
                )
                for item in data.get("action_items", []):
                    message += f"\n• {item}"
            else:
                message = "⚠️ Belum cukup data untuk analisis mingguan."

            await send_telegram_message(chat_id, message)

        except Exception as e:
            logger.error(f"Error in weekly analysis: {e}", exc_info=True)
            await send_telegram_message(chat_id, "❌ Gagal menganalisis.")


# ═══════════════════════════════════════════
# MESSAGE HANDLERS
# ═══════════════════════════════════════════

async def _handle_text(chat_id: int, user_id: int, text: str):
    """Handle text messages - classify intent then route."""
    try:
        from worker.llm.intent_classifier import classify_intent, UserIntent

        # Classify intent
        classification = await classify_intent(text)
        intent = classification["intent"]
        confidence = classification.get("confidence", 0)

        logger.info(f"Intent classified: {intent} (confidence={confidence:.2f})")

        # Route based on intent
        if intent == UserIntent.HELP:
            await send_telegram_message(chat_id, format_help_message())

        elif intent == UserIntent.HISTORY:
            period = classification.get("period", "week") or "week"
            await _handle_history_command(chat_id, user_id, [period])

        elif intent == UserIntent.EXPORT:
            period = classification.get("period", "month") or "month"
            await _handle_export_command(chat_id, user_id, [period])

        elif intent == UserIntent.INSIGHT:
            await _handle_insight_command(chat_id, user_id)

        elif intent == UserIntent.PREDICTION:
            await _handle_predict_command(chat_id, user_id, [])

        elif intent == UserIntent.SAVING_REC:
            await _handle_saving_command(chat_id, user_id)

        elif intent == UserIntent.HEALTH_SCORE:
            await _handle_health_command(chat_id, user_id)

        elif intent == UserIntent.SIMULATION:
            # Pass the user's original text as the simulation scenario
            await _handle_simulate_command(chat_id, user_id, [text])

        elif intent == UserIntent.ANALYSIS:
            period = classification.get("period", "week")
            if period == "month":
                await _handle_analysis_command(chat_id, user_id, ["monthly"])
            else:
                await _handle_analysis_command(chat_id, user_id, ["weekly"])

        elif intent == UserIntent.UPGRADE:
            await send_telegram_message(chat_id, format_upgrade_menu())

        elif intent == UserIntent.STATUS:
            status = await get_subscription_status(user_id)
            await send_telegram_message(chat_id, format_subscription_status(status))

        elif intent == UserIntent.SMALL_TALK:
            await send_telegram_message(
                chat_id,
                "Halo! 👋 Saya FiNot, asisten keuanganmu.\n\n"
                "Mau catat transaksi? Langsung kirim aja pesan seperti:\n"
                "\"beli makan 25rb\" atau \"gajian 5jt\"\n\n"
                "Ketik /help untuk bantuan lengkap 😊"
            )

        elif intent == UserIntent.TRANSACTION or confidence < 0.6:
            # Process as transaction
            await _process_text_transaction(chat_id, user_id, text)

        else:
            await _process_text_transaction(chat_id, user_id, text)

    except Exception as e:
        logger.error(f"Error handling text: {e}", exc_info=True)
        await send_telegram_message(chat_id, "❌ Terjadi kesalahan. Silakan coba lagi.")


async def _process_text_transaction(chat_id: int, user_id: int, text: str):
    """Process text as transaction."""
    # Check credits
    access = await check_credits_and_consume(user_id)
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker import process_text_message

        result = await process_text_message(user_id, text)
        response = format_transaction_response(result)
        await send_telegram_message(chat_id, response)

    except Exception as e:
        logger.error(f"Error processing text transaction: {e}", exc_info=True)
        await send_telegram_message(chat_id, "❌ Gagal memproses transaksi.")


async def _handle_photo(
    chat_id: int, user_id: int, message: dict, is_document: bool = False
):
    """Handle photo messages - download + OCR."""
    plan = await get_user_plan(user_id)

    # Check scan_receipt feature access
    if not check_feature_access(plan, "scan_receipt"):
        await send_telegram_message(
            chat_id,
            "📸 Fitur Scan Struk hanya tersedia untuk paket Pro & Elite.\n\n"
            "Ketik /upgrade untuk info upgrade! 🚀"
        )
        return

    # Check credits
    access = await check_credits_and_consume(user_id)
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        await send_telegram_message(chat_id, "📸 Memproses struk... Mohon tunggu.")

        # Get file_id
        if is_document:
            file_id = message["document"]["file_id"]
        else:
            photos = message["photo"]
            file_id = photos[-1]["file_id"]  # Highest resolution

        # Download
        media = await download_telegram_media(file_id, BOT_TOKEN, str(user_id))

        # Save receipt
        receipt = await create_receipt(
            prisma,
            user_id,
            file_path=media["file_path"],
            file_name=media["file_name"],
            mime_type=media["mime_type"],
            file_size=media["file_size"],
        )

        # Process
        from worker import process_image_message

        result = await process_image_message(
            user_id, media["file_path"], receipt_id=receipt.id
        )

        response = format_transaction_response(result)

        if result.get("ocr_confidence"):
            response += f"\n📊 OCR Confidence: {result['ocr_confidence']:.0f}%"

        await send_telegram_message(chat_id, response)

    except Exception as e:
        logger.error(f"Error handling photo: {e}", exc_info=True)
        await send_telegram_message(
            chat_id,
            "❌ Gagal memproses foto. Pastikan foto struk jelas dan coba lagi."
        )


async def _handle_audio(chat_id: int, user_id: int, message: dict):
    """Handle voice/audio messages."""
    # Check credits
    access = await check_credits_and_consume(user_id)
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        await send_telegram_message(chat_id, "🎙️ Memproses pesan suara... Mohon tunggu.")

        # Get file_id
        voice = message.get("voice") or message.get("audio")
        file_id = voice["file_id"]

        # Download
        media = await download_telegram_media(file_id, BOT_TOKEN, str(user_id))

        # Process
        from worker import process_audio_message

        result = await process_audio_message(user_id, media["file_path"])
        response = format_transaction_response(result)
        await send_telegram_message(chat_id, response)

    except Exception as e:
        logger.error(f"Error handling audio: {e}", exc_info=True)
        await send_telegram_message(
            chat_id,
            "❌ Gagal memproses pesan suara. Coba rekam ulang atau ketik manual."
        )
