import os
import logging
from typing import Literal

# ═══════════════════════════════════════════
# FiNot Configuration
# ═══════════════════════════════════════════

# Load .env terlebih dahulu jika bukan Railway
if not os.getenv("RAILWAY_ENVIRONMENT"):
    from dotenv import load_dotenv
    load_dotenv()
    print("📄 Loaded .env file")

DEPLOYMENT_ENV: Literal["railway", "vps", "docker", "development"] = os.getenv(
    "DEPLOYMENT_ENV", "development"
)

# ── Telegram Config ────────────────────────
BOT_TOKEN = os.getenv("BOT_TOKEN")
TELEGRAM_API_URL = os.getenv("TELEGRAM_API_URL", "https://api.telegram.org")

# ── Database Config ────────────────────────
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
DATABASE_URL = os.getenv("DATABASE_URL")

# ── OpenAI Config ──────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ── Trakteer Config (QRIS Payment) ────────
TRAKTEER_API_KEY = os.getenv("TRAKTEER_API_KEY")
TRAKTEER_WEBHOOK_SECRET = os.getenv("TRAKTEER_WEBHOOK_SECRET")
TRAKTEER_PAGE_URL = os.getenv("TRAKTEER_PAGE_URL", "https://trakteer.id/twenti_studio")

# ── Plan Configuration ─────────────────────
PLAN_CONFIG = {
    "free": {
        "name": "Free Plan",
        "price": 0,
        "ai_credits_monthly": 5,      # 5 credits per month
        "features": [
            "Catat transaksi unlimited",
            "Prediksi sederhana",
            "Health score dasar",
        ],
        "scan_receipt": False,
        "daily_insight": False,
        "weekly_summary": False,
        "monthly_analysis": False,
        "forecast_3month": False,
        "advanced_tracking": False,
        "priority_ai": False,
    },
    "pro": {
        "name": "Pro – Rp19.000/bulan",
        "price": 19000,
        "duration_days": 30,
        "ai_credits_total": 0,        # not used, weekly refill instead
        "ai_credits_weekly": 50,       # 50 credits/week
        "features": [
            "50 AI credit / minggu",
            "Insight harian",
            "Rekomendasi tabungan",
            "Scan struk",
            "Weekly summary",
        ],
        "scan_receipt": True,
        "daily_insight": True,
        "weekly_summary": True,
        "monthly_analysis": False,
        "forecast_3month": False,
        "advanced_tracking": False,
        "priority_ai": False,
    },
    "elite": {
        "name": "Elite – Rp49.000/bulan",
        "price": 49000,
        "duration_days": 30,
        "ai_credits_total": 0,
        "ai_credits_weekly": 150,      # 150 credits/week
        "features": [
            "150 AI credit / minggu",
            "Monthly deep analysis",
            "Forecast 3 bulan",
            "Advanced habit tracking",
            "Priority AI processing",
        ],
        "scan_receipt": True,
        "daily_insight": True,
        "weekly_summary": True,
        "monthly_analysis": True,
        "forecast_3month": True,
        "advanced_tracking": True,
        "priority_ai": True,
    },
}

# ── Environment flags ──────────────────────
IS_RAILWAY = DEPLOYMENT_ENV == "railway" or bool(os.getenv("RAILWAY_ENVIRONMENT"))
IS_VPS = DEPLOYMENT_ENV == "vps"
IS_DOCKER = DEPLOYMENT_ENV == "docker"
IS_DEVELOPMENT = DEPLOYMENT_ENV == "development"

LOG_LEVEL = "INFO" if (IS_RAILWAY or IS_VPS) else "DEBUG"

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# ── Startup banner ─────────────────────────
print("=" * 60)
print("🧠 Starting FiNot - AI Financial Assistant")
print(f"   Environment: {DEPLOYMENT_ENV}")
print(f"   OpenAI Model: {OPENAI_MODEL}")
print(f"   Log Level: {LOG_LEVEL}")
print(f"   Railway Mode: {IS_RAILWAY}")
print("=" * 60)

if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN tidak ditemukan!")
if not OPENAI_API_KEY:
    raise ValueError("❌ OPENAI_API_KEY tidak ditemukan!")
if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL tidak ditemukan!")

print("✅ Configuration validated")
