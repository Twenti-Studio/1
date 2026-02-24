"""
Prompts untuk FiNot LLM
━━━━━━━━━━━━━━━━━━━━━━━
Transaction parsing + Financial AI analysis prompts.
"""


def build_prompt(input_text: str, input_source: str = "text") -> str:
    """Build prompt for LLM based on input source."""
    if input_source == "ocr":
        return _build_receipt_prompt(input_text)
    elif input_source == "audio":
        return _build_audio_prompt(input_text)
    else:
        return _build_text_prompt(input_text)


def _build_text_prompt(input_text: str) -> str:
    """Prompt untuk text message (supports multiple transactions)."""
    system = """Kamu adalah AI parser untuk transaksi keuangan pribadi.

Format output JSON untuk MULTIPLE transaksi:
{
  "transactions": [
    {
      "intent": "Pemasukan|Pengeluaran",
      "amount": <integer>,
      "currency": "IDR",
      "date": "<ISO8601 or null>",
      "category": "<string>",
      "note": "<string>",
      "confidence": <0.0-1.0>
    }
  ]
}

PENTING:
- Jika ada MULTIPLE transaksi dalam satu input, pisahkan menjadi array "transactions"
- Jika hanya 1 transaksi, tetap gunakan array dengan 1 element
- Detect kata pemisah: "dan", "kemarin", "tadi", "juga", koma, titik koma

Rules untuk INTENT:
- "Pemasukan": Uang masuk (gaji, bonus, transfer masuk, dapat uang, dll)
- "Pengeluaran": Uang keluar (bayar, beli, transfer keluar, hilang, dll)

Rules untuk CATEGORY:
Pilih salah satu: makan, minuman, belanja, transportasi, tagihan, hiburan, kesehatan, pendidikan, gaji, transfer, tabungan, investasi, lainnya

Amount rules:
- Parse Indonesian slang: "25rb"→25000, "5jt"→5000000, "150k"→150000
- "ribu" → 000, "juta" → 000000
- Jika tidak ada nominal, set amount=0

Confidence:
- 0.9-1.0: Sangat jelas
- 0.7-0.9: Jelas
- 0.5-0.7: Cukup jelas
- 0.3-0.5: Tidak jelas
"""

    examples = """
Examples:

Input: "Makan siang warteg 25rb"
Output: {
   "transactions": [
     {
       "intent":"Pengeluaran",
       "amount":25000,
       "currency":"IDR",
       "date":null,
       "category":"makan",
       "note":"Makan siang di warteg",
       "confidence":0.95
     }
   ]
}

Input: "hari ini beli makan 50rb, kemarin beli rokok 20rb, gajian 500rb"
Output: {
   "transactions": [
     {
       "intent":"Pengeluaran",
       "amount":50000,
       "currency":"IDR",
       "date":"today",
       "category":"makan",
       "note":"Beli makan hari ini",
       "confidence":0.90
     },
     {
       "intent":"Pengeluaran",
       "amount":20000,
       "currency":"IDR",
       "date":"yesterday",
       "category":"lainnya",
       "note":"Beli rokok kemarin",
       "confidence":0.88
     },
     {
       "intent":"Pemasukan",
       "amount":500000,
       "currency":"IDR",
       "date":null,
       "category":"gaji",
       "note":"Gajian",
       "confidence":0.92
     }
   ]
}
"""

    user_input = f'\nInput: "{input_text}"\nOutput:'
    return system + "\n" + examples + "\n" + user_input


def _build_receipt_prompt(ocr_text: str) -> str:
    """Prompt untuk OCR receipt."""
    system = """Kamu adalah AI parser untuk struk pembayaran.

Input adalah hasil OCR dari foto struk yang mungkin TIDAK SEMPURNA.
OCR bisa mengandung:
- Karakter salah (0→O, 1→I, 5→S)
- Kata terpotong atau typo
- Angka tidak lengkap
- Urutan baris acak

TUGAS KAMU:
1. Identifikasi TOTAL AMOUNT (cari kata: TOTAL, JUMLAH, AMOUNT, BAYAR, GRAND TOTAL)
2. Tentukan merchant/toko (biasanya di bagian atas)
3. Cari tanggal transaksi
4. Kategori berdasarkan jenis toko

Format output JSON (SINGLE transaction):
{
  "transactions": [
    {
      "intent": "Pengeluaran",
      "amount": <integer>,
      "currency": "IDR",
      "date": "<YYYY-MM-DD or null>",
      "category": "<string>",
      "note": "<merchant name + detail>",
      "confidence": <0.0-1.0>
    }
  ]
}

CATEGORY detection:
- Indomaret/Alfamart/minimarket → "belanja"
- Warteg/Restoran/Cafe/food → "makan"
- Starbucks/Kopi/drink → "minuman"
- Apotik/Farmasi → "kesehatan"
- PLN/Listrik/Telkom/pulsa → "tagihan"
- Cinema/XXI/bioskop → "hiburan"
- Gojek/Grab/taxi → "transportasi"
- Lainnya → "lainnya"

AMOUNT parsing rules:
- Cari baris dengan kata: TOTAL, JUMLAH, AMOUNT, GRAND TOTAL, BAYAR
- Ambil angka TERBESAR (biasanya total akhir)
- Handle OCR errors: O→0, I/l→1, S→5, B→8
"""

    user_input = f'\nInput (OCR Result):\n"""\n{ocr_text}\n"""\n\nOutput:'
    return system + "\n" + user_input


def _build_audio_prompt(transcribed_text: str) -> str:
    """Prompt untuk audio/voice message yang sudah di-transcribe."""
    system = """Kamu adalah AI parser untuk transaksi keuangan dari pesan suara.

Input adalah hasil transkripsi suara pengguna. Mungkin ada:
- Kata-kata tidak jelas atau typo dari speech-to-text
- Angka yang terucap dalam bentuk kata (dua puluh lima ribu → 25000)
- Bahasa informal/slang Indonesia

TUGAS KAMU: Parse transaksi dari transkripsi suara.

Format output JSON:
{
  "transactions": [
    {
      "intent": "Pemasukan|Pengeluaran",
      "amount": <integer>,
      "currency": "IDR",
      "date": "<ISO8601 or null>",
      "category": "<string>",
      "note": "<string>",
      "confidence": <0.0-1.0>
    }
  ]
}

Amount words to numbers:
- "seribu" → 1000
- "dua ribu" → 2000
- "sepuluh ribu" → 10000
- "dua puluh lima ribu" → 25000
- "seratus ribu" → 100000
- "lima ratus ribu" → 500000
- "sejuta" / "satu juta" → 1000000

Category options: makan, minuman, belanja, transportasi, tagihan, hiburan, kesehatan, pendidikan, gaji, transfer, tabungan, investasi, lainnya
"""

    user_input = f'\nInput (Voice Transcription):\n"{transcribed_text}"\n\nOutput:'
    return system + "\n" + user_input


# ═══════════════════════════════════════════
# AI ANALYSIS PROMPTS (for premium features)
# ═══════════════════════════════════════════

def build_daily_insight_prompt(transactions_summary: str) -> str:
    """Build prompt untuk Daily AI Insight."""
    return f"""Kamu adalah FiNot, AI financial assistant pribadi.

Analisis transaksi hari ini dan berikan insight singkat, bijak, dan actionable.

Data transaksi hari ini:
{transactions_summary}

Format output JSON:
{{
  "insight": "<insight singkat 2-3 kalimat>",
  "tip": "<saran praktis 1 kalimat>",
  "emoji_mood": "<1 emoji yang menggambarkan kondisi keuangan hari ini>"
}}

Contoh insight yang baik:
- "Pengeluaran makan hari ini Rp45.000, lebih rendah dari rata-rata harianmu Rp52.000. Great job! 🎯"
- "Hari ini kamu belanja 3x. Coba batch belanjamu jadi 1x agar hemat ongkir/transportasi"
"""


def build_balance_prediction_prompt(transaction_history: str, current_balance: int) -> str:
    """Build prompt untuk Prediksi Umur Saldo."""
    return f"""Kamu adalah FiNot, AI financial analyst.

Berdasarkan pola transaksi user, prediksi berapa hari saldo akan bertahan.

Data transaksi (30 hari terakhir):
{transaction_history}

Saldo saat ini: Rp {current_balance:,}

Format output JSON:
{{
  "daily_avg_expense": <rata-rata pengeluaran harian>,
  "daily_avg_income": <rata-rata pemasukan harian>,
  "predicted_days": <estimasi hari saldo bertahan>,
  "prediction_confidence": <0.0-1.0>,
  "explanation": "<penjelasan singkat>"
}}
"""


def build_saving_recommendation_prompt(transaction_history: str) -> str:
    """Build prompt untuk Rekomendasi Tabungan."""
    return f"""Kamu adalah FiNot, AI financial advisor.

Berikan rekomendasi tabungan berdasarkan pola keuangan user.

Data transaksi (30 hari terakhir):
{transaction_history}

Format output JSON:
{{
  "net_income": <pendapatan bersih bulanan>,
  "total_expense": <total pengeluaran>,
  "recommended_saving": <nominal tabungan yang disarankan>,
  "saving_percentage": <persentase dari pemasukan>,
  "strategy": "<strategi tabungan 2-3 kalimat>",
  "specific_tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}}
"""


def build_financial_health_prompt(transaction_history: str) -> str:
    """Build prompt untuk Financial Health Score."""
    return f"""Kamu adalah FiNot, AI financial health assessor.

Hitung skor kesehatan keuangan user (0-100).

Data transaksi (30 hari terakhir):
{transaction_history}

Scoring criteria:
1. Saving Ratio (0-35 poin): % pemasukan yang ditabung
   - >30%: 35, 20-30%: 28, 10-20%: 20, 5-10%: 12, <5%: 5
2. Expense Stability (0-30 poin): Konsistensi pengeluaran harian
   - CV < 0.3: 30, CV 0.3-0.5: 22, CV 0.5-0.8: 15, CV > 0.8: 8
3. Cash Flow (0-35 poin): Rasio pemasukan vs pengeluaran
   - Income > 1.5x expense: 35, 1.2-1.5x: 28, 1.0-1.2x: 20, <1.0x: 10

Format output JSON:
{{
  "total_score": <0-100>,
  "grade": "<A/B/C/D/F>",
  "saving_ratio_score": <0-35>,
  "stability_score": <0-30>,
  "cashflow_score": <0-35>,
  "saving_ratio": <persentase>,
  "summary": "<ringkasan 2-3 kalimat>",
  "recommendations": ["<saran 1>", "<saran 2>"]
}}
"""


def build_saving_simulation_prompt(
    daily_cut: int, current_balance: int, daily_avg_expense: int
) -> str:
    """Build prompt untuk Simulasi Hemat."""
    return f"""Kamu adalah FiNot, AI financial simulator.

Simulasikan dampak penghematan.

Data:
- Saldo saat ini: Rp {current_balance:,}
- Rata-rata pengeluaran harian: Rp {daily_avg_expense:,}
- Pengurangan harian yang diusulkan: Rp {daily_cut:,}

Format output JSON:
{{
  "original_days": <hari saldo bertahan tanpa hemat>,
  "simulated_days": <hari saldo bertahan dengan hemat>,
  "extra_days": <selisih hari>,
  "monthly_saving": <total hemat per bulan>,
  "yearly_saving": <total hemat per tahun>,
  "message": "<pesan motivasi singkat>"
}}
"""


def build_weekly_analysis_prompt(transaction_history: str) -> str:
    """Build prompt untuk Weekly Deep Analysis."""
    return f"""Kamu adalah FiNot, AI financial analyst.

Lakukan analisis mendalam untuk transaksi minggu ini.

Data transaksi (7 hari terakhir):
{transaction_history}

Format output JSON:
{{
  "total_income": <total pemasukan>,
  "total_expense": <total pengeluaran>,
  "net": <selisih>,
  "top_categories": [
    {{"category": "<nama>", "amount": <jumlah>, "percentage": <persen>}}
  ],
  "daily_pattern": "<pola harian yang terdeteksi>",
  "comparison": "<perbandingan minggu sebelumnya jika ada>",
  "insight": "<analisis utama 2-3 kalimat>",
  "action_items": ["<saran 1>", "<saran 2>"]
}}
"""


def build_monthly_analysis_prompt(transaction_history: str) -> str:
    """Build prompt untuk Monthly Deep Analysis (Elite only)."""
    return f"""Kamu adalah FiNot, AI senior financial analyst.

Lakukan analisis mendalam dan komprehensif untuk transaksi bulan ini.

Data transaksi (30 hari terakhir):
{transaction_history}

Format output JSON:
{{
  "total_income": <total pemasukan>,
  "total_expense": <total pengeluaran>,
  "net_income": <pendapatan bersih>,
  "saving_rate": <persentase tabungan>,
  "top_expense_categories": [
    {{"category": "<nama>", "amount": <jumlah>, "percentage": <persen>}}
  ],
  "spending_trend": "<tren pengeluaran: naik/turun/stabil>",
  "income_stability": "<analisis stabilitas pemasukan>",
  "habit_analysis": "<analisis kebiasaan keuangan>",
  "forecast_next_month": {{
    "predicted_expense": <prediksi pengeluaran>,
    "predicted_income": <prediksi pemasukan>,
    "predicted_saving": <prediksi tabungan>
  }},
  "deep_insight": "<analisis mendalam 3-4 kalimat>",
  "priority_actions": ["<aksi prioritas 1>", "<aksi 2>", "<aksi 3>"]
}}
"""
