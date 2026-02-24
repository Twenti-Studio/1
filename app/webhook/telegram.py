"""
FiNot Telegram Webhook Handler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Handles all Telegram messages: text, photo, voice/audio.
Integrates LLM intent classification, RBAC, and AI analysis features.
"""

import os
import httpx
import logging
import asyncio
import json
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from app.config import BOT_TOKEN, TELEGRAM_API_URL, PLAN_CONFIG
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
from app.services.payment_service import create_payment_order

router = APIRouter(prefix="/webhook", tags=["telegram"])

logger = logging.getLogger(__name__)

TELEGRAM_SEND_URL = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/sendMessage"
TELEGRAM_SEND_DOC_URL = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/sendDocument"
TELEGRAM_SEND_PHOTO_URL = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/sendPhoto"


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
            payload["reply_markup"] = json.dumps(reply_markup)

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(TELEGRAM_SEND_URL, json=payload)
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
    """Format upgrade plan menu."""
    lines = [
        "🚀 <b>Upgrade FiNot Premium</b>",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "🆓 <b>Free Plan</b> (Saat ini)",
        "• Catat transaksi unlimited",
        "• Prediksi sederhana",
        "• Health score dasar",
        "• 5 AI credit total (tanpa refill)",
        "",
        "🥈 <b>Pro – Rp19.000/bulan</b>",
        "• 50 AI credit / minggu",
        "• Insight harian 📊",
        "• Rekomendasi tabungan 💰",
        "• Scan struk otomatis 📸",
        "• Weekly summary 📋",
        "",
        "🥇 <b>Elite – Rp49.000/bulan</b>",
        "• 150 AI credit / minggu",
        "• Monthly deep analysis 📈",
        "• Forecast 3 bulan 🔮",
        "• Advanced habit tracking 🧠",
        "• Priority AI processing ⚡",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━",
        "Ketik <b>/buy pro</b> atau <b>/buy elite</b> untuk upgrade!",
        "Pembayaran via QRIS (Trakteer) 📱",
    ]
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

    elif command == "/upgrade":
        await send_telegram_message(chat_id, format_upgrade_menu())

    elif command == "/buy":
        await _handle_buy_command(chat_id, user_id, args)

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


async def _handle_buy_command(chat_id: int, user_id: int, args: list):
    """Handle /buy pro or /buy elite."""
    if not args or args[0].lower() not in ("pro", "elite"):
        await send_telegram_message(
            chat_id,
            "Cara pakai: /buy pro atau /buy elite\n"
            "Ketik /upgrade untuk lihat detail paket."
        )
        return

    plan = args[0].lower()
    plan_config = PLAN_CONFIG[plan]

    try:
        payment = await create_payment_order(user_id, plan)

        message = (
            f"💳 <b>Pembayaran {plan_config['name']}</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"💰 Total: <b>Rp {plan_config['price']:,}</b>\n"
            f"📋 ID Transaksi: <code>{payment['transaction_id']}</code>\n\n"
            f"📱 <b>Cara Bayar:</b>\n"
            f"1. Buka link Trakteer di bawah\n"
            f"2. Pilih nominal sesuai paket\n"
            f"3. Scan QRIS yang muncul\n"
            f"4. Pembayaran otomatis terverifikasi! ✅\n\n"
            f"⏳ Batas waktu: 30 menit\n\n"
            f"Setelah bayar, ketik /status untuk cek."
        )

        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"Error creating payment: {e}", exc_info=True)
        await send_telegram_message(
            chat_id,
            "❌ Gagal membuat pesanan. Silakan coba lagi."
        )


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
    """Handle /predict [saldo] - Balance Prediction."""
    if not args:
        await send_telegram_message(
            chat_id,
            "Cara pakai: /predict [saldo saat ini]\n"
            "Contoh: /predict 500000"
        )
        return

    try:
        balance = int(args[0].replace(".", "").replace(",", "").replace("rb", "000").replace("jt", "000000"))
    except ValueError:
        await send_telegram_message(chat_id, "⚠️ Format saldo tidak valid. Contoh: /predict 500000")
        return

    access = await check_credits_and_consume(user_id)
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_balance_prediction

        await send_telegram_message(chat_id, "🔮 Memprediksi umur saldo...")

        result = await get_balance_prediction(user_id, balance)

        if result.get("success"):
            data = result["data"]
            days = data.get("predicted_days", 0)
            explanation = data.get("explanation", "")

            message = (
                f"🔮 <b>Prediksi Umur Saldo</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"💰 Saldo saat ini: <b>Rp {balance:,}</b>\n"
                f"📊 Rata-rata pengeluaran/hari: <b>Rp {data.get('daily_avg_expense', 0):,}</b>\n"
                f"📅 Estimasi bertahan: <b>{days} hari</b>\n\n"
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
    """Handle /simulate [nominal] - Saving Simulation."""
    try:
        daily_cut = int(args[0].replace(".", "").replace(",", "").replace("rb", "000")) if args else 10000
    except ValueError:
        daily_cut = 10000

    access = await check_credits_and_consume(user_id)
    if not access["allowed"]:
        await send_telegram_message(chat_id, access["message"])
        return

    try:
        from worker.analysis_service import get_saving_simulation

        await send_telegram_message(chat_id, f"📊 Mensimulasikan penghematan Rp {daily_cut:,}/hari...")

        result = await get_saving_simulation(user_id, daily_cut=daily_cut)

        if result.get("success"):
            data = result["data"]
            message = (
                f"📊 <b>Simulasi Hemat</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"✂️ Kurangi: <b>Rp {daily_cut:,}/hari</b>\n\n"
                f"📅 Saldo bertahan: {data.get('original_days', 0)} → <b>{data.get('simulated_days', 0)} hari</b>\n"
                f"⏱️ Extra: <b>+{data.get('extra_days', 0)} hari</b>\n\n"
                f"💰 Hemat per bulan: <b>Rp {data.get('monthly_saving', 0):,}</b>\n"
                f"💎 Hemat per tahun: <b>Rp {data.get('yearly_saving', 0):,}</b>\n\n"
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
            await send_telegram_message(
                chat_id,
                "🔮 Untuk prediksi saldo, gunakan:\n/predict [saldo saat ini]\n\nContoh: /predict 500000"
            )

        elif intent == UserIntent.SAVING_REC:
            await _handle_saving_command(chat_id, user_id)

        elif intent == UserIntent.HEALTH_SCORE:
            await _handle_health_command(chat_id, user_id)

        elif intent == UserIntent.SIMULATION:
            await send_telegram_message(
                chat_id,
                "📊 Untuk simulasi hemat, gunakan:\n/simulate [nominal per hari]\n\nContoh: /simulate 10000"
            )

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
