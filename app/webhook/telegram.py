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

# In-memory store for pending analysis offers (user_id -> {tx_result, chat_id, timestamp, choices})
import time as _time
_pending_analysis: dict[int, dict] = {}
_PENDING_ANALYSIS_TTL = 300  # 5 minutes

# ── Post-transaction feature registry ──
# Each entry: (feature_key, label, credit_cost)
# "spending_alert" is free (no LLM), others cost credits.
_POST_TX_FEATURES = [
    ("daily_insight",          "Insight AI",              1),
    ("spending_alert",         "Pengingat & Alert",       0),
    ("balance_prediction",     "Prediksi Saldo",          1),
    ("burn_rate",              "Burn Rate",               1),
    ("health_score",           "Health Score",            1),
    ("saving_recommendation",  "Rekomendasi Tabungan",    2),
    ("budget_suggestion",      "Smart Budget",            2),
    ("overspending_alert",     "Overspending Alert",      2),
]


async def _build_post_tx_menu(user_id: int):
    """Build a numbered post-tx menu based on user's plan. Returns (menu_text, choices_dict) or (None, None) if no features."""
    plan = await get_user_plan(user_id)
    available = []
    for feature_key, label, credit_cost in _POST_TX_FEATURES:
        if check_feature_access(plan, feature_key):
            available.append((feature_key, label, credit_cost))

    if not available:
        return None, None

    num_emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"]
    lines = ["📋 <b>Mau analisis lebih lanjut?</b>", "Balas angka yang diinginkan:\n"]
    choices: dict[str, str] = {}
    for idx, (feature_key, label, credit_cost) in enumerate(available):
        num = str(idx + 1)
        emoji = num_emojis[idx] if idx < len(num_emojis) else f"{num}."
        cost_text = f"({credit_cost} kredit)" if credit_cost > 0 else "(gratis)"
        lines.append(f"{emoji} {label} {cost_text}")
        choices[num] = feature_key
        # Also accept the label as text shortcut
        choices[label.lower()] = feature_key

    lines.append("\n<i>Atau lanjut kirim transaksi baru.</i>")
    return "\n".join(lines), choices


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
    disable_web_page_preview: bool = False,
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
        if disable_web_page_preview:
            payload["disable_web_page_preview"] = True

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
        return f"{result.get('error', 'Terjadi kesalahan')}"

    transactions = result.get("transactions", [])
    source = result.get("source", "text")

    if not transactions:
        return "Tidak ada transaksi yang terdeteksi."

    lines = []

    # Header based on source
    source_emoji = {"text": "💬", "image": "📸", "audio": "🎙️"}.get(source, "💬")
    lines.append(f"{source_emoji} <b>Transaksi Tercatat!</b>")

    if result.get("transcription"):
        lines.append(f"🗣️ <i>Transkripsi: \"{result['transcription'][:100]}\"</i>")

    lines.append("")

    for i, tx in enumerate(transactions, 1):
        emoji = "+" if tx["intent"] == "income" else "-"
        tipo = "Pemasukan" if tx["intent"] == "income" else "Pengeluaran"
        amount = tx["amount"]

        if len(transactions) > 1:
            lines.append(f"<b>#{i}</b>")

        lines.append(f"{emoji} {tipo}: <b>Rp {amount:,}</b>")
        lines.append(f"Kategori: {tx['category']}")

        if tx.get("needs_review"):
            lines.append("<i>Perlu review</i>")

        lines.append("")

    return "\n".join(lines)


def format_subscription_status(status: dict) -> str:
    """Format subscription status message."""
    plan = status.get("plan", "free")
    plan_name = status.get("plan_name", "Free Plan")
    credits = status.get("credits", {})

    lines = [
        "📋 Status Akun FiNot",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        f"Plan: <b>{plan_name}</b>",
        f"Sisa AI Credit: <b>{credits.get('remaining', 0)}/{credits.get('total', 0)}</b> (minggu ini)",
    ]

    sub = status.get("subscription")
    if sub:
        lines.append(f"Berakhir: {sub.get('end_date', '-')[:10]}")
        lines.append(f"Sisa hari: {sub.get('days_left', 0)} hari")

    # Dashboard link for all users
    dashboard_url = os.getenv("WEBHOOK_URL", "").rstrip("/")
    if dashboard_url:
        lines.append("")
        lines.append(f"📊 Dashboard: {dashboard_url}")

    if plan == "free":
        lines.append("")
        lines.append("Upgrade untuk fitur lebih lengkap!")
        lines.append("Ketik /upgrade untuk lihat paket premium 🚀")

    return "\n".join(lines)


def format_upgrade_menu() -> str:
    """Format upgrade plan menu with details."""
    pro = PLAN_CONFIG['pro']
    elite = PLAN_CONFIG['elite']

    return (
        "<b>💎 Upgrade FiNot Premium</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        #
        "🆓 <b>FREE PLAN</b> (Saat Ini)\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "5 AI credit/minggu\n"
        "• Catat transaksi unlimited\n"
        "• Scan struk & voice note\n"
        "• 5 fitur AI dasar (1 credit/fitur)\n\n"
        #
        f"🥈 <b>PAKET PRO</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Harga: <b>Rp{pro['price']:,}/bulan</b> (~Rp{pro['price']//30:,}/hari)\n"
        f"50 AI credit/minggu\n"
        f"• Semua fitur Free +\n"
        f"• Weekly Summary otomatis (3 credit)\n"
        f"• Rekomendasi tabungan (2 credit)\n"
        f"• Smart Budget & Goal-based Saving\n"
        f"• Prediksi pengeluaran bulanan\n"
        f"• Subscription detector\n"
        f"• Overspending alert\n\n"
        #
        f"🥇 <b>PAKET ELITE</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Harga: <b>Rp{elite['price']:,}/bulan</b> (~Rp{elite['price']//30:,}/hari)\n"
        f"150 AI credit/minggu\n"
        f"• Semua fitur Pro +\n"
        f"• Monthly deep analysis (5 credit)\n"
        f"• Forecast 3 bulan (4 credit)\n"
        f"• Advanced habit tracking (4 credit)\n"
        f"• AI Finance Chat (3 credit)\n"
        f"• Weekly strategy & Payday planning\n"
        f"• Priority AI processing\n\n"
        #
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Pembayaran aman via QRIS (Trakteer)\n"
        "Aktivasi otomatis setelah konfirmasi"
    )


def format_help_message() -> str:
    """Format help/start message."""
    return """<b>FiNot - AI Financial Assistant</b>
━━━━━━━━━━━━━━━━━━━━━━━━

Halo! Saya FiNot, asisten keuangan pribadimu yang cerdas! 🧠

<b>📝 Catat Transaksi</b>
Kirim pesan seperti:
• "beli makan 25rb"
• "gajian 5jt"
📸 Kirim foto struk → auto input!
🎙️ Kirim voice note → auto transkrip!

<b>🆓 Fitur AI Gratis (1 credit):</b>
/insight - Insight harian
/predict - Prediksi umur saldo
/burnrate - Burn rate analysis
/health - Skor kesehatan keuangan
/alert - Spending alert

<b>🥈 Fitur Pro (2-3 credit):</b>
/analysis weekly - Ringkasan mingguan
/saving - Rekomendasi tabungan
/budget - Saran budget per kategori
/goal [target] - Target tabungan
/prediction - Prediksi pengeluaran bulanan
/detect - Deteksi langganan berulang
/overspend - Alert kategori boros

<b>🥇 Fitur Elite (3-5 credit):</b>
/analysis monthly - Analisis bulanan mendalam
/forecast - Forecast keuangan 3 bulan
/weekend - Advanced habit tracking
/chat [pertanyaan] - AI Finance Chat
/strategy - Strategi minggu depan
/payday - Perencanaan gaji

<b>📁 Data & Laporan:</b>
/history - Riwayat transaksi
/export - Download Excel
/status - Status akun & kredit

<b>💎 Premium:</b>
/upgrade - Lihat paket premium
/help - Tampilkan bantuan ini
"""


# ═══════════════════════════════════════════
# RBAC MIDDLEWARE
# ═══════════════════════════════════════════

async def check_credits_and_consume(user_id: int, feature: str = None, amount: int = None) -> dict:
    """
    Check and consume AI credit before processing.
    If amount is None, auto-lookup from FEATURE_CREDIT_COST.
    Returns {"allowed": True/False, "message": str}
    """
    from app.config import FEATURE_CREDIT_COST

    plan = await get_user_plan(user_id)

    # Check feature access if specified
    if feature and not check_feature_access(plan, feature):
        # Determine required plan
        required = "Pro"
        elite_features = ["monthly_analysis", "forecast_3month", "advanced_tracking",
                          "ai_chat", "weekly_strategy", "payday_planning"]
        if feature in elite_features:
            required = "Elite"

        return {
            "allowed": False,
            "message": (
                f"⚠️ Fitur ini memerlukan paket <b>{required}</b>.\n"
                f"Paket kamu: <b>{plan.upper()}</b>\n\n"
                f"Ketik /upgrade untuk lihat paket!"
            ),
        }

    # Auto-lookup credit cost from config
    if amount is None:
        amount = FEATURE_CREDIT_COST.get(feature, 1) if feature else 1

    # Check and consume credit
    credits = await check_ai_credits(user_id)
    if credits["remaining"] < amount:
        return {
            "allowed": False,
            "message": (
                f"⚠️ Kredit AI tidak cukup.\n"
                f"Butuh: <b>{amount}</b> | Sisa: <b>{credits['remaining']}/{credits['total']}</b>\n\n"
                f"Kredit di-reset setiap hari Senin.\n"
                f"Ketik /upgrade untuk tambah kuota!"
            ),
        }

    consumed = await consume_ai_credit(user_id, amount=amount)
    if not consumed:
        return {
            "allowed": False,
            "message": "Gagal menggunakan kredit AI. Coba lagi.",
        }

    return {"allowed": True, "credits_remaining": credits["remaining"] - amount, "cost": amount}


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
            "Maaf, saya belum bisa memproses jenis pesan ini.\n"
            "Coba kirim teks, foto struk, atau pesan suara!"
        )

    except Exception as e:
        logger.error(f"Error handling update: {e}", exc_info=True)
        await send_telegram_message(
            chat_id,
            "Terjadi kesalahan. Silakan coba lagi."
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

    # ── Free AI Features (1 credit) ──
    elif command == "/insight":
        await _handle_insight_command(chat_id, user_id)

    elif command == "/predict":
        await _handle_predict_command(chat_id, user_id, args)

    elif command == "/burnrate":
        await _handle_burnrate_command(chat_id, user_id)

    elif command == "/health":
        await _handle_health_command(chat_id, user_id)

    elif command in ("/alert", "/anomaly"):
        await _handle_anomaly_command(chat_id, user_id)

    # ── Pro AI Features (2-3 credit) ──
    elif command == "/analysis":
        await _handle_analysis_command(chat_id, user_id, args)

    elif command == "/saving":
        await _handle_saving_command(chat_id, user_id)

    elif command == "/budget":
        await _handle_budget_command(chat_id, user_id)

    elif command == "/goal":
        await _handle_goal_command(chat_id, user_id, args)

    elif command == "/prediction":
        await _handle_expense_prediction_command(chat_id, user_id)

    elif command == "/detect":
        await _handle_detect_command(chat_id, user_id)

    elif command == "/overspend":
        await _handle_overspend_command(chat_id, user_id)

    elif command == "/simulate":
        await _handle_simulate_command(chat_id, user_id, args)

    # ── Elite AI Features (3-5 credit) ──
    elif command == "/forecast":
        await _handle_forecast_command(chat_id, user_id)

    elif command == "/weekend":
        await _handle_weekend_command(chat_id, user_id)

    elif command == "/chat":
        await _handle_chat_command(chat_id, user_id, args)

    elif command == "/strategy":
        await _handle_strategy_command(chat_id, user_id)

    elif command == "/payday":
        await _handle_payday_command(chat_id, user_id)

    elif command in ("/report", "/lapor"):
        dashboard_url = os.getenv("WEBHOOK_URL", "https://finot.twenti.studio").rstrip("/webhook/telegram").rstrip("/")
        await send_telegram_message(
            chat_id,
            f"📝 <b>Fitur Report</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"Untuk mengirim laporan bug, saran fitur, atau keluhan, "
            f"silakan gunakan fitur Report di dashboard:\n\n"
            f"🔗 <b>{dashboard_url}/dashboard/report</b>\n\n"
            f"Di sana kamu bisa:\n"
            f"• Tulis laporan dengan subjek & detail\n"
            f"• Pilih kategori (Bug, Fitur, Keluhan)\n"
            f"• Lihat status & balasan dari tim kami\n\n"
            f"💡 Ketik /help untuk bantuan lainnya.",
        )

    else:
        await send_telegram_message(
            chat_id,
            "Perintah tidak dikenali. Ketik /help untuk bantuan."
        )


async def _handle_upgrade_command(chat_id: int, user_id: int):
    """Handle /upgrade or /buy — show plan list with inline buttons."""
    text = format_upgrade_menu()

    # Inline keyboard with plan buttons
    reply_markup = {
        "inline_keyboard": [
            [{"text": "1. Beli PAKET PRO - Rp19.000", "callback_data": "buy:pro"}],
            [{"text": "2. Beli PAKET ELITE - Rp49.000", "callback_data": "buy:elite"}],
            [{"text": "3. Rendeem Voucher", "callback_data": "redeem:voucher"}],
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

        elif action == "redeem":
            if value == "voucher":
                await _cb_start_redeem(chat_id, user_id, message_id)

        else:
            logger.warning(f"Unknown callback data: {cb_data}")

    except Exception as e:
        logger.error(f"Error handling callback query: {e}", exc_info=True)
        await send_telegram_message(
            chat_id, "Terjadi kesalahan. Silakan coba lagi."
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
        f"<b>Konfirmasi Pesanan</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"Paket: <b>{plan_config['name']}</b>\n"
        f"Harga: <b>Rp {price:,}</b>\n"
        f"Durasi: <b>{duration} Hari</b>\n"
        f"Kuota: <b>{plan_config['ai_credits_weekly']} AI credit/minggu</b>\n"
        f"Per Hari: ~Rp {price // duration:,}\n\n"
    )

    # Add features
    for feat in plan_config["features"]:
        text += f"  • {feat}\n"

    text += (
        f"\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Dengan melanjutkan pembayaran, kamu menyetujui:\n"
        f'• <a href="https://finot.twenti.studio/legal/terms-of-service">Terms of Service</a>\n'
        f'• <a href="https://finot.twenti.studio/legal/privacy-policy">Privacy Policy</a>\n\n'
        f"<i>Lanjutkan pembayaran?</i>"
    )

    reply_markup = {
        "inline_keyboard": [
            [{"text": "✅ Setuju & Bayar Sekarang", "callback_data": f"confirm_buy:{plan}"}],
            [{"text": "🔙 Kembali", "callback_data": "menu:upgrade"}],
        ]
    }

    await edit_telegram_message(
        chat_id, message_id, text, reply_markup=reply_markup,
        disable_web_page_preview=True,
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
            f"<b>PEMBAYARAN — {plan_config['name']}</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"Paket: <b>{plan_config['name']}</b>\n"
            f"Total: <b>Rp {plan_config['price']:,}</b>\n"
            f"Durasi: <b>{plan_config['duration_days']} hari</b>\n"
            f"ID: <code>{tx_id}</code>\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"CARA BAYAR:\n"
            f"1. Scan QR di atas dengan kamera HP\n"
            f"2. Buka halaman Trakteer yang muncul\n"
            f"3. Pilih pembayaran QRIS\n"
            f"4. Bayar dengan E-Wallet/M-Banking\n\n"
            f"Pastikan nominal <b>Rp {plan_config['price']:,}</b>\n"
            f"Berlaku <b>30 menit</b>\n"
            f"🕐 {now.strftime('%d/%m/%Y %H:%M')}"
        )

        reply_markup = {
            "inline_keyboard": [
                [{"text": "Buka Link Pembayaran", "url": trakteer_link}],
                [{"text": "Cek Status", "callback_data": f"check_status:{payment_id}"}],
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
            "Gagal membuat pesanan. Silakan coba lagi.\n"
            "Ketik /upgrade untuk mencoba kembali.",
        )


async def _cb_cancel_order(chat_id: int, user_id: int, message_id: int):
    """Cancel payment order."""
    # Delete original message (could be text or photo)
    await delete_telegram_message(chat_id, message_id)

    text = (
        "<b>Pesanan Dibatalkan</b>\n\n"
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
                chat_id, "Payment tidak ditemukan."
            )
            return

        status = result["status"]

        if status == "paid":
            dashboard_url = os.getenv("WEBHOOK_URL", "").rstrip("/")
            text = (
                "<b>Pembayaran Berhasil!</b>\n\n"
                f"🎉 Paket <b>{result.get('plan', '').upper()}</b> sudah aktif!\n"
                "Ketik /status untuk melihat detail langganan."
            )
            if dashboard_url:
                text += f"\n\n📊 Dashboard Web: {dashboard_url}"
            await send_telegram_message(chat_id, text)

        elif status == "expired":
            text = (
                "<b>Pembayaran Kedaluwarsa</b>\n\n"
                "Pesanan telah melewati batas waktu 30 menit.\n"
                "Ketik /upgrade untuk membuat pesanan baru."
            )
            await send_telegram_message(chat_id, text)

        elif status == "pending":
            text = (
                "<b>Menunggu Pembayaran</b>\n\n"
                f"Total: <b>Rp {result.get('amount', 0):,}</b>\n"
                f"Paket: <b>{result.get('plan', '').upper()}</b>\n\n"
                "Silakan selesaikan pembayaran via Trakteer.\n"
                "Klik tombol \"Bayar via Trakteer\" di pesan sebelumnya."
            )

            reply_markup = {
                "inline_keyboard": [
                    [{"text": "Cek Lagi", "callback_data": f"check_status:{payment_id}"}],
                ]
            }
            await send_telegram_message(chat_id, text, reply_markup=reply_markup)

        else:
            await send_telegram_message(
                chat_id,
                f"Status pembayaran: <b>{status}</b>\n"
                "Ketik /upgrade untuk membuat pesanan baru.",
            )

    except Exception as e:
        logger.error(f"Error checking payment status: {e}", exc_info=True)
        await send_telegram_message(
            chat_id, "Gagal mengecek status. Coba lagi nanti."
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
            [{"text": "1. Beli PAKET PRO - Rp19.000", "callback_data": "buy:pro"}],
            [{"text": "2.Beli PAKET ELITE - Rp49.000", "callback_data": "buy:elite"}],
            [{"text": "Rendeem Voucher", "callback_data": "redeem:voucher"}],
            [{"text": "🔙 Menu Utama", "callback_data": "menu:main"}],
        ]
    }

    await send_telegram_message(chat_id, text, reply_markup=reply_markup)


async def _cb_start_redeem(chat_id: int, user_id: int, message_id: int):
    """Start voucher redemption process."""
    await delete_telegram_message(chat_id, message_id)
    
    text = (
        "<b>Rendeem Voucher FiNot</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "Silakan kirimkan kode voucher Anda sekarang.\n"
        "Contoh: <code>FN-ABCD1234EF56</code>\n\n"
        "<i>Jika ingin membatalkan, ketik /upgrade</i>"
    )
    
    await send_telegram_message(chat_id, text)


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
            " Gagal mengambil riwayat. Coba: /history today|week|month|year"
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
            caption=f"Laporan transaksi FiNot ({period})"
        )

    except Exception as e:
        logger.error(f"Error exporting: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal membuat laporan.")


async def _handle_insight_command(chat_id: int, user_id: int):
    """Handle /insight - Daily AI Insight."""
    # Check premium access
    access = await check_credits_and_consume(user_id, feature="daily_insight")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_daily_insight

        await send_telegram_message(chat_id, "Menganalisis transaksi hari ini...")

        result = await get_daily_insight(user_id)

        if result.get("success"):
            data = result["data"]
            emoji = data.get("emoji_mood")
            insight = data.get("insight", "Tidak ada insight tersedia.")
            tip = data.get("tip", "")

            message = (
                f"{emoji} <b>Daily Insight</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"{insight}\n\n"
                f"💡 <b>Tips:</b> {tip}"
            )
        else:
            message = "Belum ada data cukup. Catat beberapa transaksi dulu ya!"

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in insight: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menganalisis.")


async def _handle_predict_command(chat_id: int, user_id: int, args: list):
    """Handle /predict - Balance Prediction (auto-calculates balance)."""
    access = await check_credits_and_consume(user_id, feature="balance_prediction")
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
                f"Saldo saat ini: <b>Rp {balance:,}</b>\n"
                f"Rata-rata pengeluaran/hari: <b>Rp {data.get('daily_avg_expense', 0):,}</b>\n"
                f"Estimasi bertahan: <b>±{days} hari</b>\n\n"
                f"{explanation}"
            )
        else:
            message = "Belum cukup data. Catat transaksi dulu minimal 3 hari."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in prediction: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal memprediksi.")


async def _handle_saving_command(chat_id: int, user_id: int):
    """Handle /saving - Saving Recommendation."""
    access = await check_credits_and_consume(user_id, feature="saving_recommendation")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_saving_recommendation

        await send_telegram_message(chat_id, "Menganalisis pola keuanganmu...")

        result = await get_saving_recommendation(user_id)

        if result.get("success"):
            data = result["data"]
            message = (
                f"<b>Rekomendasi Tabungan</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Net Income: <b>Rp {data.get('net_income', 0):,}</b>\n"
                f"Total Pengeluaran: <b>Rp {data.get('total_expense', 0):,}</b>\n"
                f"Rekomendasi Tabungan: <b>Rp {data.get('recommended_saving', 0):,}/bulan</b>\n"
                f"Persentase: {data.get('saving_percentage', 0)}%\n\n"
                f"<b>Strategi:</b>\n{data.get('strategy', '-')}\n\n"
                f"💡 <b>Tips:</b>"
            )
            tips = data.get("specific_tips", [])
            for tip in tips:
                message += f"\n• {tip}"
        else:
            message = "Belum cukup data untuk analisis."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in saving: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menganalisis.")


async def _handle_health_command(chat_id: int, user_id: int):
    """Handle /health - Financial Health Score."""
    access = await check_credits_and_consume(user_id, feature="health_score")
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
                f"Detail:\n"
                f"  Saving Ratio: {data.get('saving_ratio_score', 0)}/35\n"
                f"  Stabilitas: {data.get('stability_score', 0)}/30\n"
                f"  Cash Flow: {data.get('cashflow_score', 0)}/35\n\n"
                f"{data.get('summary', '-')}\n\n"
                f"<b>Saran:</b>"
            )
            recs = data.get("recommendations", [])
            for rec in recs:
                message += f"\n• {rec}"
        else:
            message = "Belum cukup data untuk menghitung skor."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in health score: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menghitung skor.")


async def _handle_simulate_command(chat_id: int, user_id: int, args: list):
    """Handle /simulate or natural language simulation."""
    # Join args as natural language scenario
    scenario = " ".join(args) if args else "hemat 10000 per hari"

    access = await check_credits_and_consume(user_id, amount=2)
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_saving_simulation

        await send_telegram_message(chat_id, f"Mensimulasikan: {scenario}...")

        result = await get_saving_simulation(user_id, user_scenario=scenario)

        if result.get("success"):
            data = result["data"]
            message = (
                f"<b>Simulasi Hemat</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Skenario: <b>{data.get('scenario', scenario)}</b>\n\n"
                f"Hemat per bulan: <b>Rp {data.get('monthly_saving', 0):,}</b>\n"
                f"Hemat per tahun: <b>Rp {data.get('yearly_saving', 0):,}</b>\n"
                f"Umur saldo bertambah: <b>+{data.get('extra_balance_days', 0)} hari</b>\n\n"
                f"✨ {data.get('message', '')}"
            )
        else:
            message = "Belum cukup data untuk simulasi."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in simulation: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menjalankan simulasi.")


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

            await send_telegram_message(chat_id, "Menganalisis data bulanan...")
            result = await get_monthly_analysis(user_id)

            if result.get("success"):
                data = result["data"]
                message = (
                    f"<b>Monthly Deep Analysis</b>\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"Pemasukan: <b>Rp {data.get('total_income', 0):,}</b>\n"
                    f"Pengeluaran: <b>Rp {data.get('total_expense', 0):,}</b>\n"
                    f"Net: <b>Rp {data.get('net_income', 0):,}</b>\n"
                    f"Tren: {data.get('spending_trend', '-')}\n\n"
                    f"{data.get('deep_insight', '-')}\n\n"
                    f"<b>Prioritas Aksi:</b>"
                )
                for action in data.get("priority_actions", []):
                    message += f"\n• {action}"
            else:
                message = "Belum cukup data untuk analisis bulanan."

            await send_telegram_message(chat_id, message)

        except Exception as e:
            logger.error(f"Error in monthly analysis: {e}", exc_info=True)
            await send_telegram_message(chat_id, "Gagal menganalisis.")

    else:
        # Weekly is Pro+
        access = await check_credits_and_consume(user_id, feature="weekly_summary")
        if not access["allowed"]:
            await send_telegram_message(chat_id, access["message"])
            return

        try:
            from worker.analysis_service import get_weekly_analysis

            await send_telegram_message(chat_id, "Menganalisis data mingguan...")
            result = await get_weekly_analysis(user_id)

            if result.get("success"):
                data = result["data"]
                message = (
                    f"<b>Weekly Analysis</b>\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"Pemasukan: <b>Rp {data.get('total_income', 0):,}</b>\n"
                    f"Pengeluaran: <b>Rp {data.get('total_expense', 0):,}</b>\n"
                    f"Net: <b>Rp {data.get('net', 0):,}</b>\n\n"
                    f"{data.get('insight', '-')}\n\n"
                    f"<b>Action Items:</b>"
                )
                for item in data.get("action_items", []):
                    message += f"\n• {item}"
            else:
                message = "Belum cukup data untuk analisis mingguan."

            await send_telegram_message(chat_id, message)

        except Exception as e:
            logger.error(f"Error in weekly analysis: {e}", exc_info=True)
            await send_telegram_message(chat_id, "Gagal menganalisis.")


# ═══════════════════════════════════════════
# AI FEATURE COMMAND HANDLERS
# ═══════════════════════════════════════════

async def _handle_forecast_command(chat_id: int, user_id: int):
    """#14 Forecast Keuangan 3 Bulan (Elite)."""
    access = await check_credits_and_consume(user_id, feature="forecast_3month")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_balance_prediction

        await send_telegram_message(chat_id, "🔮 Membuat forecast 3 bulan ke depan...")
        result = await get_balance_prediction(user_id, forecast_months=3)

        if result.get("success"):
            data = result["data"]

            message = (
                f"🔮 <b>Forecast Keuangan 3 Bulan</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            )

            if data.get("forecast"):
                message += f"{data['forecast']}\n\n"

            if data.get("insight"):
                message += f"💡 {data['insight']}"
        else:
            message = "Belum cukup data untuk forecast. Catat transaksi minimal 2 minggu."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in forecast: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal membuat forecast.")


async def _handle_anomaly_command(chat_id: int, user_id: int):
    """#5 Spending Alert / Anomaly Detection."""
    access = await check_credits_and_consume(user_id, feature="spending_alert")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_anomaly_detection

        await send_telegram_message(chat_id, "⚠️ Menganalisis pola pengeluaran...")
        result = await get_anomaly_detection(user_id)

        if result.get("success"):
            data = result["data"]
            is_anomaly = data.get("is_anomaly", False)
            emoji = "⚠️" if is_anomaly else "✅"

            message = (
                f"{emoji} <b>Deteksi Pengeluaran</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Pengeluaran hari ini: <b>Rp{data.get('today_total', 0):,}</b>\n"
                f"Rata-rata harian: <b>Rp{data.get('daily_avg', 0):,}</b>\n"
                f"Rasio: <b>{data.get('ratio', 0):.1f}×</b> rata-rata\n\n"
            )

            if is_anomaly:
                message += f"⚠️ {data.get('alert_message', 'Pengeluaran lebih tinggi dari biasanya.')}\n\n"

            # Top categories
            top_cats = data.get("top_categories", [])
            if top_cats:
                message += "Kategori terbesar:\n"
                for cat in top_cats[:3]:
                    message += f"• {cat.get('category', '?')} — Rp{cat.get('amount', 0):,}\n"
                message += "\n"

            if data.get("suggestion"):
                message += f"💡 {data['suggestion']}"
        else:
            message = "Belum cukup data. Catat transaksi dulu minimal beberapa hari."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in anomaly: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menganalisis.")


async def _handle_burnrate_command(chat_id: int, user_id: int):
    """#7 Burn Rate Analysis."""
    access = await check_credits_and_consume(user_id, feature="burn_rate")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_burn_rate

        await send_telegram_message(chat_id, "🔥 Menghitung burn rate...")
        result = await get_burn_rate(user_id)

        if result.get("success"):
            data = result["data"]
            balance = result.get("balance", 0)

            message = (
                f"🔥 <b>Burn Rate</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Saldo saat ini: <b>Rp{balance:,}</b>\n"
                f"Rata-rata pengeluaran/hari: <b>Rp{data.get('daily_burn_rate', 0):,}</b>\n"
                f"Estimasi saldo habis: <b>{data.get('days_until_zero', 0)} hari</b>\n\n"
            )

            if data.get("insight"):
                message += f"💡 {data['insight']}"
        else:
            message = "Belum cukup data untuk analisis burn rate."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in burn rate: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menganalisis.")


async def _handle_budget_command(chat_id: int, user_id: int):
    """#8 Smart Budget Suggestion."""
    access = await check_credits_and_consume(user_id, feature="budget_suggestion")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_budget_suggestion

        await send_telegram_message(chat_id, "📊 Merekomendasikan budget...")
        result = await get_budget_suggestion(user_id)

        if result.get("success"):
            data = result["data"]

            message = (
                f"📊 <b>Budget Rekomendasi</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Berdasarkan pola belanja:\n\n"
            )

            budgets = data.get("budgets", [])
            for b in budgets:
                message += f"• {b.get('category', '?')} → Rp{b.get('amount', 0):,}/bulan\n"

            if data.get("total_budget"):
                message += f"\nTotal Budget: <b>Rp{data['total_budget']:,}/bulan</b>\n"

            if data.get("suggestion"):
                message += f"\n💡 {data['suggestion']}"
        else:
            message = "Belum cukup data untuk rekomendasi budget."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in budget: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menganalisis.")


async def _handle_detect_command(chat_id: int, user_id: int):
    """#9 Subscription Detector with upcoming alerts & summary."""
    access = await check_credits_and_consume(user_id, feature="subscription_detector")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_subscription_detector

        await send_telegram_message(chat_id, "🔁 Mendeteksi langganan berulang...")
        result = await get_subscription_detector(user_id)

        if result.get("success"):
            data = result["data"]

            subscriptions = data.get("subscriptions", [])
            upcoming = data.get("upcoming_alerts", [])

            if not subscriptions:
                message = "🔁 Tidak ada langganan berulang yang terdeteksi dari transaksimu."
                await send_telegram_message(chat_id, message)
                return

            parts = []

            # Upcoming payment alerts (like the screenshot)
            if upcoming:
                parts.append("<b>Subscription Alert</b>")
                parts.append("━━━━━━━━━━━━━━━━━━━━━━━━")
                parts.append("")
                
                # Get current balance for context
                from worker.analysis_service import _get_balance
                balance = await _get_balance(user_id)
                
                for alert in upcoming:
                    alert_msg = alert.get("message", "")
                    if not alert_msg:
                        name = alert.get("name", "?")
                        amt = alert.get("amount", 0)
                        alert_msg = f"Pembayaran {name} Rp{amt:,}"
                    parts.append(f"⚠️ {alert_msg}")
                
                parts.append("")
                parts.append(f"Saldo saat ini: <b>Rp{balance:,}</b>")
                parts.append("")

            # Subscription summary
            total_monthly = data.get("total_monthly", 0)
            if total_monthly == 0:
                total_monthly = sum(s.get("amount", 0) for s in subscriptions)

            parts.append("<b>Subscription Summary</b>")
            parts.append("━━━━━━━━━━━━━━━━━━━━━━━━")
            parts.append("")

            for sub in subscriptions:
                amount = sub.get("amount", 0)
                freq = sub.get("frequency", "bulanan")
                parts.append(f"• {sub.get('name', '?')} — Rp{amount:,}/{freq}")

            parts.append("")
            parts.append(f"📊 Total subscription bulan ini: <b>Rp{total_monthly:,}</b>")

            if data.get("suggestion"):
                parts.append(f"\n💡 {data['suggestion']}")

            message = "\n".join(parts)
        else:
            message = "Belum cukup data. Catat transaksi minimal 2 bulan."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in detect: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal mendeteksi.")


async def _handle_goal_command(chat_id: int, user_id: int, args: list):
    """#11 Goal-based Saving."""
    goal_text = " ".join(args) if args else "Tabungan darurat 3 bulan"

    access = await check_credits_and_consume(user_id, feature="goal_saving")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_goal_saving

        await send_telegram_message(chat_id, f"🎯 Merencanakan target: {goal_text}...")
        result = await get_goal_saving(user_id, goal_text=goal_text)

        if result.get("success"):
            data = result["data"]

            message = (
                f"🎯 <b>Target Tabungan</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Target: <b>{data.get('goal_name', goal_text)}</b>\n"
                f"Nominal Target: <b>Rp{data.get('target_amount', 0):,}</b>\n"
                f"Tabungan saat ini: <b>Rp{data.get('current_savings', 0):,}</b>\n\n"
                f"Tabungan per bulan: <b>Rp{data.get('monthly_saving', 0):,}</b>\n"
                f"Estimasi tercapai: <b>{data.get('months_to_goal', 0)} bulan</b>\n\n"
            )

            if data.get("strategy"):
                message += f"💡 {data['strategy']}"
        else:
            message = "Belum cukup data untuk perencanaan."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in goal: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal merencanakan.")


async def _handle_payday_command(chat_id: int, user_id: int):
    """#12 Payday Planning."""
    access = await check_credits_and_consume(user_id, feature="payday_planning")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_payday_planning

        await send_telegram_message(chat_id, "💰 Merencanakan alokasi gaji...")
        result = await get_payday_planning(user_id)

        if result.get("success"):
            data = result["data"]

            message = (
                f"💰 <b>Perencanaan Gaji</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Pemasukan terakhir: <b>Rp{data.get('income_amount', 0):,}</b>\n\n"
                f"Saran pembagian:\n"
            )

            allocations = data.get("allocations", [])
            for alloc in allocations:
                message += f"• {alloc.get('category', '?')} — Rp{alloc.get('amount', 0):,} ({alloc.get('percentage', 0)}%)\n"

            if data.get("suggestion"):
                message += f"\n💡 {data['suggestion']}"
        else:
            message = "Belum ada data pemasukan. Catat pemasukan/gaji dulu ya!"

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in payday: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal merencanakan.")


async def _handle_overspend_command(chat_id: int, user_id: int):
    """#13 Category Overspending Alert."""
    access = await check_credits_and_consume(user_id, feature="overspending_alert")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_overspending_alert

        await send_telegram_message(chat_id, "⚠️ Mengecek kategori boros...")
        result = await get_overspending_alert(user_id)

        if result.get("success"):
            data = result["data"]

            overspent = data.get("overspent_categories", [])
            if overspent:
                message = (
                    f"⚠️ <b>Peringatan Pengeluaran</b>\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                )
                for cat in overspent:
                    message += (
                        f"• <b>{cat.get('category', '?')}</b>\n"
                        f"  Minggu ini: Rp{cat.get('this_week', 0):,}\n"
                        f"  Rata-rata: Rp{cat.get('avg_weekly', 0):,}\n"
                        f"  Selisih: +{cat.get('over_percentage', 0)}%\n\n"
                    )

                if data.get("suggestion"):
                    message += f"💡 {data['suggestion']}"
            else:
                message = "✅ Semua kategori pengeluaran masih dalam batas normal minggu ini!"
        else:
            message = "Belum cukup data untuk perbandingan."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in overspend: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menganalisis.")


async def _handle_weekend_command(chat_id: int, user_id: int):
    """#14 Weekend Spending Pattern."""
    access = await check_credits_and_consume(user_id, feature="advanced_tracking")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_weekend_pattern

        await send_telegram_message(chat_id, "📊 Menganalisis pola akhir pekan...")
        result = await get_weekend_pattern(user_id)

        if result.get("success"):
            data = result["data"]

            message = (
                f"📊 <b>Pola Belanja</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Rata-rata hari kerja: <b>Rp{data.get('weekday_avg', 0):,}</b>/hari\n"
                f"Rata-rata akhir pekan: <b>Rp{data.get('weekend_avg', 0):,}</b>/hari\n"
                f"Selisih: <b>{data.get('difference_pct', 0)}%</b> lebih tinggi di akhir pekan\n\n"
            )

            if data.get("insight"):
                message += f"💡 {data['insight']}"
        else:
            message = "Belum cukup data untuk analisis pola weekend."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in weekend: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menganalisis.")


async def _handle_limit_command(chat_id: int, user_id: int):
    """#15 Daily Expense Limit Reminder."""
    access = await check_credits_and_consume(user_id, feature="spending_alert")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_expense_limit

        await send_telegram_message(chat_id, "📌 Mengecek batas pengeluaran...")
        result = await get_expense_limit(user_id)

        if result.get("success"):
            data = result["data"]
            today_spent = data.get("today_spent", 0)
            suggested_limit = data.get("suggested_limit", 0)
            remaining = max(0, suggested_limit - today_spent)
            pct = int((today_spent / suggested_limit * 100)) if suggested_limit > 0 else 0

            # Status emoji
            if pct >= 100:
                status_emoji = "🔴"
            elif pct >= 80:
                status_emoji = "🟡"
            else:
                status_emoji = "🟢"

            message = (
                f"📌 <b>Pengingat Harian</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Batas pengeluaran: <b>Rp{suggested_limit:,}</b>\n"
                f"Sudah digunakan: <b>Rp{today_spent:,}</b>\n"
                f"Sisa: <b>Rp{remaining:,}</b>\n"
                f"Status: {status_emoji} {pct}% terpakai\n\n"
            )

            if data.get("suggestion"):
                message += f"💡 {data['suggestion']}"
        else:
            message = "Belum cukup data."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in limit: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menganalisis.")


async def _handle_expense_prediction_command(chat_id: int, user_id: int):
    """#16 Expense Prediction."""
    access = await check_credits_and_consume(user_id, feature="expense_prediction")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_expense_prediction

        await send_telegram_message(chat_id, "🔮 Memprediksi pengeluaran bulan ini...")
        result = await get_expense_prediction(user_id)

        if result.get("success"):
            data = result["data"]

            message = (
                f"🔮 <b>Prediksi Pengeluaran Bulanan</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Pengeluaran saat ini: <b>Rp{data.get('current_total', 0):,}</b>\n"
                f"Prediksi akhir bulan: <b>Rp{data.get('predicted_total', 0):,}</b>\n"
                f"Rata-rata harian: <b>Rp{data.get('daily_avg', 0):,}</b>\n\n"
            )

            if data.get("insight"):
                message += f"💡 {data['insight']}"
        else:
            message = "Belum cukup data untuk prediksi."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in expense prediction: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal memprediksi.")


async def _handle_opportunity_command(chat_id: int, user_id: int):
    """#17 Savings Opportunity Finder."""
    access = await check_credits_and_consume(user_id, feature="saving_recommendation")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_savings_opportunity

        await send_telegram_message(chat_id, "💡 Mencari peluang hemat...")
        result = await get_savings_opportunity(user_id)

        if result.get("success"):
            data = result["data"]

            message = (
                f"💡 <b>Peluang Hemat</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            )

            opportunities = data.get("opportunities", [])
            for opp in opportunities:
                message += (
                    f"• {opp.get('description', '-')}\n"
                    f"  Potensi hemat: <b>Rp{opp.get('savings_amount', 0):,}/bulan</b>\n\n"
                )

            if data.get("total_potential"):
                message += f"Total potensi hemat: <b>Rp{data['total_potential']:,}/bulan</b>\n\n"

            if data.get("summary"):
                message += f"💡 {data['summary']}"
        else:
            message = "Belum cukup data untuk analisis."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in opportunity: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal menganalisis.")


async def _handle_strategy_command(chat_id: int, user_id: int):
    """#20 Weekly Strategy Suggestion."""
    access = await check_credits_and_consume(user_id, feature="weekly_strategy")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_weekly_strategy

        await send_telegram_message(chat_id, "📊 Merumuskan strategi minggu depan...")
        result = await get_weekly_strategy(user_id)

        if result.get("success"):
            data = result["data"]

            message = (
                f"📊 <b>Strategi Minggu Depan</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            )

            if data.get("strategy"):
                message += f"{data['strategy']}\n\n"

            strategies = data.get("strategies", [])
            for s in strategies:
                message += f"• {s}\n"

            if data.get("expected_savings"):
                message += f"\n💰 Potensi tambahan tabungan: <b>Rp{data['expected_savings']:,}</b>"
        else:
            message = "Belum cukup data untuk strategi."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in strategy: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal merumuskan strategi.")


async def _handle_chat_command(chat_id: int, user_id: int, args: list):
    """#18 AI Financial Chat."""
    question = " ".join(args) if args else ""

    if not question:
        await send_telegram_message(
            chat_id,
            "💬 <b>AI Financial Chat</b>\n\n"
            "Tanyakan apa saja tentang keuanganmu!\n"
            "Contoh: /chat kenapa uangku cepat habis bulan ini?\n\n"
            "Atau langsung ketik pertanyaan kamu."
        )
        return

    access = await check_credits_and_consume(user_id, feature="ai_chat")
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_ai_chat

        await send_telegram_message(chat_id, "💬 Menganalisis pertanyaanmu...")
        result = await get_ai_chat(user_id, question)

        if result.get("success"):
            data = result["data"]
            answer = data.get("answer", data.get("response", "Maaf, saya tidak bisa menjawab."))

            message = (
                f"💬 <b>FiNot AI</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"{answer}"
            )
        else:
            message = "Belum cukup data untuk menjawab. Catat beberapa transaksi dulu."

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error in chat: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal memproses pertanyaan.")



# ═══════════════════════════════════════════
# MESSAGE HANDLERS
# ═══════════════════════════════════════════

async def _handle_text(chat_id: int, user_id: int, text: str):
    """Handle text messages - classify intent then route."""
    try:
        # Check if user is replying to a pending analysis offer
        if user_id in _pending_analysis:
            pending = _pending_analysis[user_id]
            age = _time.time() - pending["timestamp"]
            choices = pending.get("choices", {})
            feature_key = choices.get(text.strip().lower())
            if age <= _PENDING_ANALYSIS_TTL and feature_key:
                del _pending_analysis[user_id]
                tx_result = pending["tx_result"]
                asyncio.ensure_future(
                    _dispatch_post_tx_feature(chat_id, user_id, feature_key, tx_result)
                )
                return
            else:
                # Any other message = decline, clean up
                del _pending_analysis[user_id]

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
            await _handle_upgrade_command(chat_id, user_id)

        elif intent == UserIntent.STATUS:
            status = await get_subscription_status(user_id)
            await send_telegram_message(chat_id, format_subscription_status(status))

        # ── New AI feature intents ──
        elif intent == UserIntent.ANOMALY:
            await _handle_anomaly_command(chat_id, user_id)

        elif intent == UserIntent.BURN_RATE:
            await _handle_burnrate_command(chat_id, user_id)

        elif intent == UserIntent.BUDGET:
            await _handle_budget_command(chat_id, user_id)

        elif intent == UserIntent.SUBSCRIPTION_DETECT:
            await _handle_detect_command(chat_id, user_id)

        elif intent == UserIntent.GOAL_SAVING:
            await _handle_goal_command(chat_id, user_id, [text])

        elif intent == UserIntent.PAYDAY:
            await _handle_payday_command(chat_id, user_id)

        elif intent == UserIntent.OVERSPENDING:
            await _handle_overspend_command(chat_id, user_id)

        elif intent == UserIntent.WEEKEND_PATTERN:
            await _handle_weekend_command(chat_id, user_id)

        elif intent == UserIntent.EXPENSE_LIMIT:
            await _handle_limit_command(chat_id, user_id)

        elif intent == UserIntent.EXPENSE_PREDICTION:
            await _handle_expense_prediction_command(chat_id, user_id)

        elif intent == UserIntent.SAVINGS_OPPORTUNITY:
            await _handle_opportunity_command(chat_id, user_id)

        elif intent == UserIntent.AI_CHAT:
            await _handle_chat_command(chat_id, user_id, [text])

        elif intent == UserIntent.WEEKLY_STRATEGY:
            await _handle_strategy_command(chat_id, user_id)

        elif intent == UserIntent.SMALL_TALK:
            await send_telegram_message(
                chat_id,
                "Halo! Saya FiNot, asisten keuanganmu.\n\n"
                "Mau catat transaksi? Langsung kirim aja pesan seperti:\n"
                "\"beli makan 25rb\" atau \"gajian 5jt\"\n\n"
                "Ketik /help untuk bantuan lengkap 😊"
            )

        elif text.upper().startswith("FN-"):
            # Handle voucher redemption
            from app.services.voucher_service import redeem_voucher
            
            await send_telegram_message(chat_id, "Memproses voucher...")
            result = await redeem_voucher(user_id, text)
            
            if result.get("success"):
                dashboard_url = os.getenv("WEBHOOK_URL", "").rstrip("/")
                dash_msg = f"\n\n📊 Dashboard Web: {dashboard_url}" if dashboard_url else ""
                await send_telegram_message(
                    chat_id,
                    f"<b>Voucher Berhasil Diaktifkan!</b>\n\n"
                    f"Paket: <b>{result['plan'].upper()}</b>\n"
                    f"Durasi: <b>{result['duration']} hari</b>\n\n"
                    f"Selamat menggunakan fitur premium dari FiNot! 🚀"
                    f"{dash_msg}"
                )
            else:
                await send_telegram_message(
                    chat_id,
                    f"<b>Gagal Rendeem Voucher</b>\n\n"
                    f"{result.get('error', 'Kode tidak valid.')}"
                )

        elif text.lower().strip() in ("report", "lapor", "laporan", "komplain"):
            # Redirect to dashboard for reports
            dashboard_url = os.getenv("WEBHOOK_URL", "https://finot.twenti.studio").rstrip("/webhook/telegram").rstrip("/")
            await send_telegram_message(
                chat_id,
                f"📝 Untuk mengirim laporan, silakan gunakan fitur Report di dashboard:\n\n"
                f"🔗 {dashboard_url}/dashboard/report\n\n"
                f"Atau ketik /report untuk info lengkap.",
            )

        elif intent == UserIntent.TRANSACTION or confidence < 0.6:
            # Process as transaction
            await _process_text_transaction(chat_id, user_id, text)

        else:
            await _process_text_transaction(chat_id, user_id, text)

    except Exception as e:
        logger.error(f"Error handling text: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Terjadi kesalahan. Silakan coba lagi.")


async def _process_text_transaction(chat_id: int, user_id: int, text: str):
    """Process text as transaction, then offer AI insight."""
    try:
        from worker import process_text_message

        result = await process_text_message(user_id, text)
        response = format_transaction_response(result)
        await send_telegram_message(chat_id, response)

        # Offer analysis menu based on user's plan (saves tokens)
        if result.get("success") and result.get("transactions"):
            menu_text, choices = await _build_post_tx_menu(user_id)
            if menu_text and choices:
                _pending_analysis[user_id] = {
                    "tx_result": result,
                    "chat_id": chat_id,
                    "timestamp": _time.time(),
                    "choices": choices,
                }
                await send_telegram_message(chat_id, menu_text)

    except Exception as e:
        logger.error(f"Error processing text transaction: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal memproses transaksi.")


async def _send_insight_only(chat_id: int, user_id: int, tx_result: dict):
    """Send AI insight for the recorded transaction (costs 1 credit)."""
    try:
        credits = await check_ai_credits(user_id)
        if credits.get("remaining", 0) <= 0:
            await send_telegram_message(chat_id, "Kredit AI habis. Upgrade paket untuk kredit lebih banyak.")
            return

        txs = tx_result.get("transactions", [])
        tx_lines = []
        for tx in txs:
            tipo = "Pemasukan" if tx["intent"] == "income" else "Pengeluaran"
            tx_lines.append(f"{tipo} Rp{tx['amount']:,} [{tx['category']}]")
        tx_text = ", ".join(tx_lines)

        from worker.analysis_service import get_post_transaction_insight

        result = await get_post_transaction_insight(user_id, tx_text)

        if result.get("success") and result.get("data"):
            data = result["data"]
            insight = data.get("insight", "")
            emoji = data.get("emoji", "💡")
            if insight:
                msg = f"{emoji} <b>FiNot Insight</b>\n{insight}"
                await send_telegram_message(chat_id, msg)
                await consume_ai_credit(user_id)
        else:
            await send_telegram_message(chat_id, "Belum cukup data untuk insight saat ini.")

    except Exception as e:
        logger.debug(f"Post-transaction insight skipped: {e}")
        await send_telegram_message(chat_id, "Gagal memproses insight.")


async def _dispatch_post_tx_feature(chat_id: int, user_id: int, feature_key: str, tx_result: dict):
    """Route a post-tx menu choice to the appropriate handler."""
    try:
        if feature_key == "daily_insight":
            await _send_insight_only(chat_id, user_id, tx_result)
        elif feature_key == "spending_alert":
            await _send_smart_notification(chat_id, user_id)
        elif feature_key == "balance_prediction":
            await _handle_predict_command(chat_id, user_id, args=[])
        elif feature_key == "burn_rate":
            await _handle_burnrate_command(chat_id, user_id)
        elif feature_key == "health_score":
            await _handle_health_command(chat_id, user_id)
        elif feature_key == "saving_recommendation":
            await _handle_saving_command(chat_id, user_id)
        elif feature_key == "budget_suggestion":
            await _handle_budget_command(chat_id, user_id)
        elif feature_key == "overspending_alert":
            await _handle_anomaly_command(chat_id, user_id)
        else:
            await send_telegram_message(chat_id, "Fitur tidak tersedia.")
    except Exception as e:
        logger.error(f"Error dispatching post-tx feature {feature_key}: {e}", exc_info=True)
        await send_telegram_message(chat_id, "Gagal memproses fitur. Silakan coba lagi.")


async def _send_post_transaction_insight(chat_id: int, user_id: int, tx_result: dict):
    """Auto-generate and send a brief AI insight after transaction is recorded."""
    try:
        # Check if user has credits (don't consume for auto-insight, it's a bonus)
        credits = await check_ai_credits(user_id)
        if credits.get("remaining", 0) <= 0:
            return  # silently skip if no credits

        # Build text description of the recorded transaction
        txs = tx_result.get("transactions", [])
        tx_lines = []
        for tx in txs:
            tipo = "Pemasukan" if tx["intent"] == "income" else "Pengeluaran"
            tx_lines.append(f"{tipo} Rp{tx['amount']:,} [{tx['category']}]")
        tx_text = ", ".join(tx_lines)

        from worker.analysis_service import get_post_transaction_insight

        result = await get_post_transaction_insight(user_id, tx_text)

        if result.get("success") and result.get("data"):
            data = result["data"]
            insight = data.get("insight", "")
            emoji = data.get("emoji", "💡")
            if insight:
                msg = f"{emoji} <b>FiNot Insight</b>\n{insight}"
                await send_telegram_message(chat_id, msg)

                # Consume 1 credit for the auto-insight
                await consume_ai_credit(user_id)

        # #19 Smart Notification — auto-check thresholds after expense transactions
        has_expense = any(tx.get("intent") == "expense" for tx in txs)
        if has_expense:
            await _send_smart_notification(chat_id, user_id)

    except Exception as e:
        # Silently fail - don't disrupt the main flow
        logger.debug(f"Post-transaction insight skipped: {e}")


async def _send_smart_notification(chat_id: int, user_id: int):
    """#19 Smart Notification — send spending alerts if thresholds are crossed."""
    try:
        from worker.analysis_service import get_smart_notification

        result = await get_smart_notification(user_id)

        if not result.get("success") or not result.get("data", {}).get("has_alerts"):
            return  # no alerts to send

        alerts = result["data"]["alerts"]

        lines = [
            "📢 <b>Pengingat</b>",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            "",
        ]

        for alert in alerts:
            lines.append(f"{alert.get('emoji', '📢')} {alert['message']}")
            lines.append("")

        message = "\n".join(lines)
        await send_telegram_message(chat_id, message)

    except Exception as e:
        # Silently fail
        logger.debug(f"Smart notification skipped: {e}")


async def _handle_photo(
    chat_id: int, user_id: int, message: dict, is_document: bool = False
):
    """Handle photo messages - download + OCR."""
    plan = await get_user_plan(user_id)

    # Receipt scanning is free input for all plans — no credit consumed

    try:
        await send_telegram_message(chat_id, "Memproses struk... Mohon tunggu.")

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
            response += f"\OCR Confidence: {result['ocr_confidence']:.0f}%"

        await send_telegram_message(chat_id, response)

        # Offer analysis menu after receipt scan
        if result.get("success") and result.get("transactions"):
            menu_text, choices = await _build_post_tx_menu(user_id)
            if menu_text and choices:
                _pending_analysis[user_id] = {
                    "tx_result": result,
                    "chat_id": chat_id,
                    "timestamp": _time.time(),
                    "choices": choices,
                }
                await send_telegram_message(chat_id, menu_text)

    except Exception as e:
        logger.error(f"Error handling photo: {e}", exc_info=True)
        await send_telegram_message(
            chat_id,
            "Gagal memproses foto. Pastikan foto struk jelas dan coba lagi."
        )


async def _handle_audio(chat_id: int, user_id: int, message: dict):
    """Handle voice/audio messages."""
    # Voice input is free for all plans — no credit consumed

    try:
        await send_telegram_message(chat_id, "Memproses pesan suara... Mohon tunggu.")

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

        # Offer analysis menu after voice transaction
        if result.get("success") and result.get("transactions"):
            menu_text, choices = await _build_post_tx_menu(user_id)
            if menu_text and choices:
                _pending_analysis[user_id] = {
                    "tx_result": result,
                    "chat_id": chat_id,
                    "timestamp": _time.time(),
                    "choices": choices,
                }
                await send_telegram_message(chat_id, menu_text)

    except Exception as e:
        logger.error(f"Error handling audio: {e}", exc_info=True)
        await send_telegram_message(
            chat_id,
            "Gagal memproses pesan suara. Coba rekam ulang atau ketik manual."
        )
