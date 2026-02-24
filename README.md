# 🧠 FiNot - AI Financial Assistant Bot

> Personal AI financial assistant yang cerdas untuk Telegram.

## ✨ Features

### 💬 Multi-Input Transaction Recording
- **Text Message**: Kirim pesan seperti "beli makan 25rb" → auto catat
- **Photo/Receipt**: Kirim foto struk → OCR + auto input
- **Voice Message**: Kirim pesan suara → transkripsi + auto catat

### 🤖 AI-Powered Analysis
1. **Daily AI Insight** - Analisis singkat berbasis transaksi harian
2. **Balance Age Prediction** - Estimasi berapa hari saldo bertahan
3. **Savings Recommendation** - Saran tabungan berdasarkan pola belanja
4. **Auto Receipt Scanning** - OCR + parsing nominal → auto input
5. **Financial Health Score** - Skor 0-100 (saving ratio, stabilitas, cash flow)
6. **Savings Simulation** - "Kalau kurangi Rp10.000/hari, saldo bertahan X hari lebih lama"
7. **Weekly & Monthly Deep Analysis** - Analisis mendalam

### 💎 Subscription Plans (RBAC)

| Feature | Free | Pro (Rp19K/bln) | Elite (Rp49K/bln) |
|---------|------|------------------|--------------------|
| Catat transaksi | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| AI Credits | 5 total | 50/minggu | 150/minggu |
| Prediksi sederhana | ✅ | ✅ | ✅ |
| Health score dasar | ✅ | ✅ | ✅ |
| Insight harian | ❌ | ✅ | ✅ |
| Rekomendasi tabungan | ❌ | ✅ | ✅ |
| Scan struk | ❌ | ✅ | ✅ |
| Weekly summary | ❌ | ✅ | ✅ |
| Monthly deep analysis | ❌ | ❌ | ✅ |
| Forecast 3 bulan | ❌ | ❌ | ✅ |
| Advanced habit tracking | ❌ | ❌ | ✅ |
| Priority AI processing | ❌ | ❌ | ✅ |

### 💳 Payment via QRIS (Trakteer)
- Pembayaran melalui QRIS Trakteer
- Auto-aktivasi subscription setelah pembayaran
- Webhook integration untuk konfirmasi real-time

## 🏗️ Tech Stack
- **Python 3.11+** + FastAPI
- **PostgreSQL** + Prisma ORM
- **OpenAI GPT-4o-mini** (Transaction parsing & AI analysis)
- **OpenAI Whisper** (Voice transcription)
- **Tesseract OCR** (Receipt scanning)
- **Trakteer API** (QRIS payment)

## 📁 Project Structure
```
FiNot_bot/
├── app/
│   ├── config.py           # Configuration & plan definitions
│   ├── main.py             # FastAPI app entry point
│   ├── db/                 # Database connection
│   ├── services/           # Business logic
│   │   ├── user_service.py
│   │   ├── receipt_service.py
│   │   ├── media_service.py
│   │   ├── transaction_services.py
│   │   ├── subscription_service.py   # RBAC & credits
│   │   └── payment_service.py        # Trakteer QRIS
│   └── webhook/
│       ├── telegram.py     # Telegram message handler
│       └── trakteer.py     # Payment webhook
├── worker/
│   ├── worker_main.py      # Core processing (text/image/audio)
│   ├── analysis_service.py # AI analysis features
│   ├── llm/
│   │   ├── llm_client.py   # OpenAI API client
│   │   ├── parser.py       # LLM response parser
│   │   ├── prompts.py      # All prompts (transaction + analysis)
│   │   └── intent_classifier.py
│   ├── ocr/
│   │   ├── preprocessor.py # Image preprocessing
│   │   └── tesseract.py    # OCR engine
│   ├── services/
│   │   ├── transaction_service.py
│   │   ├── sanity_checks.py
│   │   └── ocr_service.py
│   └── utils/
│       ├── image_utils.py
│       └── audio_utils.py  # Voice message processing
├── prisma/
│   └── schema.prisma       # Database schema
├── main.py                 # Entry point
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
└── requirements.txt
```

## 🚀 Quick Start

### 1. Setup Environment
```bash
# Copy env
cp .env.example .env
# Edit .env with your credentials
```

### 2. Run with Docker
```bash
docker-compose up -d
```

### 3. Run Locally
```bash
# Install dependencies
pip install -r requirements.txt
npm install

# Setup database
python -m prisma db push
python -m prisma generate

# Run
python main.py
```

## 📱 Bot Commands
```
/start, /help   - Bantuan
/history         - Riwayat transaksi
/export          - Download Excel
/insight         - Daily AI insight (Pro+)
/predict [saldo] - Prediksi umur saldo
/saving          - Rekomendasi tabungan (Pro+)
/health          - Health score
/simulate [nom]  - Simulasi hemat
/analysis        - Analisis mingguan/bulanan
/status          - Cek status akun
/upgrade         - Lihat paket premium
/buy [plan]      - Beli paket (QRIS)
```
