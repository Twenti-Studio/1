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
    "trial": {
        "name": "Trial – 7 Hari Gratis",
        "price": 0,
        "duration_days": 7,
        "ai_credits_total": 35,        # 35 credits total (not weekly)
        "features": [
            "35 AI credit (7 hari)",
            "Semua 20 fitur AI",
            "Catat transaksi unlimited",
            "Upload struk & voice note",
            "Dashboard lengkap",
        ],
        # ALL features enabled during trial
        "daily_insight": True,
        "balance_prediction": True,
        "burn_rate": True,
        "health_score": True,
        "spending_alert": True,
        "scan_receipt": True,
        "weekly_summary": True,
        "saving_recommendation": True,
        "budget_suggestion": True,
        "goal_saving": True,
        "expense_prediction": True,
        "subscription_detector": True,
        "overspending_alert": True,
        "monthly_analysis": True,
        "forecast_3month": True,
        "advanced_tracking": True,
        "ai_chat": True,
        "weekly_strategy": True,
        "payday_planning": True,
        "priority_ai": True,
    },
    "free": {
        "name": "Free Plan",
        "price": 0,
        "ai_credits_weekly": 5,        # 5 credits per week
        "features": [
            "5 AI credit / minggu",
            "Catat transaksi unlimited",
            "Upload struk & voice note",
            "Dashboard saldo & pengeluaran",
            "5 fitur AI dasar",
        ],
        # Feature gates — Free gets 5 basic AI features
        "daily_insight": True,          # 1 credit
        "balance_prediction": True,     # 1 credit
        "burn_rate": True,              # 1 credit
        "health_score": True,           # 1 credit
        "spending_alert": True,         # 1 credit
        "scan_receipt": True,           # free input
        # Pro features
        "weekly_summary": False,
        "saving_recommendation": False,
        "budget_suggestion": False,
        "goal_saving": False,
        "expense_prediction": False,
        "subscription_detector": False,
        "overspending_alert": False,
        # Elite features
        "monthly_analysis": False,
        "forecast_3month": False,
        "advanced_tracking": False,
        "ai_chat": False,
        "weekly_strategy": False,
        "payday_planning": False,
        "priority_ai": False,
    },
    "pro": {
        "name": "Pro – Rp19.000/bulan",
        "price": 19000,
        "duration_days": 30,
        "ai_credits_weekly": 50,       # 50 credits/week
        "features": [
            "50 AI credit / minggu",
            "Semua fitur Free +",
            "Weekly Summary otomatis",
            "Rekomendasi tabungan",
            "Smart budget suggestion",
            "Goal-based saving",
            "Prediksi pengeluaran bulanan",
            "Subscription detector",
            "Overspending alert",
        ],
        # All Free features
        "daily_insight": True,
        "balance_prediction": True,
        "burn_rate": True,
        "health_score": True,
        "spending_alert": True,
        "scan_receipt": True,
        # Pro features
        "weekly_summary": True,         # 3 credit
        "saving_recommendation": True,  # 2 credit
        "budget_suggestion": True,      # 2 credit
        "goal_saving": True,            # 2 credit
        "expense_prediction": True,     # 2 credit
        "subscription_detector": True,  # 2 credit
        "overspending_alert": True,     # 2 credit
        # Elite features
        "monthly_analysis": False,
        "forecast_3month": False,
        "advanced_tracking": False,
        "ai_chat": False,
        "weekly_strategy": False,
        "payday_planning": False,
        "priority_ai": False,
    },
    "elite": {
        "name": "Elite – Rp49.000/bulan",
        "price": 49000,
        "duration_days": 30,
        "ai_credits_weekly": 150,      # 150 credits/week
        "features": [
            "150 AI credit / minggu",
            "Semua fitur Pro +",
            "Monthly deep analysis",
            "Forecast keuangan 3 bulan",
            "Advanced habit tracking",
            "AI Finance Chat",
            "Weekly strategy suggestion",
            "Payday planning",
            "Priority AI processing",
        ],
        # Everything enabled
        "daily_insight": True,
        "balance_prediction": True,
        "burn_rate": True,
        "health_score": True,
        "spending_alert": True,
        "scan_receipt": True,
        "weekly_summary": True,
        "saving_recommendation": True,
        "budget_suggestion": True,
        "goal_saving": True,
        "expense_prediction": True,
        "subscription_detector": True,
        "overspending_alert": True,
        "monthly_analysis": True,       # 5 credit
        "forecast_3month": True,        # 4 credit
        "advanced_tracking": True,      # 4 credit
        "ai_chat": True,               # 3 credit
        "weekly_strategy": True,        # 3 credit
        "payday_planning": True,        # 3 credit
        "priority_ai": True,
    },
}

# ── Feature Credit Costs ───────────────────
# How many AI credits each feature consumes per use
FEATURE_CREDIT_COST = {
    # Free features (1 credit each)
    "daily_insight": 1,
    "balance_prediction": 1,
    "burn_rate": 1,
    "health_score": 1,
    "spending_alert": 1,
    # Pro features (2-3 credits)
    "weekly_summary": 3,
    "saving_recommendation": 2,
    "budget_suggestion": 2,
    "goal_saving": 2,
    "expense_prediction": 2,
    "subscription_detector": 2,
    "overspending_alert": 2,
    # Elite features (3-5 credits)
    "monthly_analysis": 5,
    "forecast_3month": 4,
    "advanced_tracking": 4,
    "ai_chat": 3,
    "weekly_strategy": 3,
    "payday_planning": 3,
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
