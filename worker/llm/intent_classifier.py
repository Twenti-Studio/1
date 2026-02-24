"""
Intent Classifier untuk FiNot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LLM-powered intent classification with expanded intents for premium features.
"""

import logging
import json
import asyncio
from typing import Dict, Optional
from enum import Enum

from worker.llm.llm_client import call_llm, LLMAPIError

logger = logging.getLogger(__name__)


class UserIntent(str, Enum):
    TRANSACTION = "transaction"
    HELP = "help"
    HISTORY = "history"
    EXPORT = "export"
    SMALL_TALK = "small_talk"
    # ── New FiNot intents ──
    INSIGHT = "insight"           # Daily AI Insight
    PREDICTION = "prediction"     # Prediksi Umur Saldo
    SAVING_REC = "saving_rec"     # Rekomendasi Tabungan
    HEALTH_SCORE = "health_score" # Financial Health Score
    SIMULATION = "simulation"     # Simulasi Hemat
    ANALYSIS = "analysis"         # Weekly/Monthly Analysis
    UPGRADE = "upgrade"           # Subscription upgrade
    STATUS = "status"             # Check subscription status
    UNKNOWN = "unknown"


class IntentClassifier:
    def __init__(self):
        self.model = "gpt-4o-mini"

    async def classify(self, text: str) -> Dict:
        try:
            prompt = self._build_classification_prompt(text)

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: call_llm(
                    prompt=prompt,
                    model_name=self.model,
                    max_retries=2,
                ),
            )

            llm_text = response.get("text", "")
            result = self._parse_llm_response(llm_text)
            logger.info(
                "Intent classified: %s (confidence: %.2f)",
                result["intent"],
                result["confidence"],
            )
            return result

        except Exception as e:
            logger.error("Intent classification failed: %s", str(e), exc_info=True)
            return {
                "intent": UserIntent.TRANSACTION,
                "confidence": 0.3,
                "period": None,
                "direction": None,
                "reason": "Fallback due to error",
            }

    def _build_classification_prompt(self, text: str) -> str:
        system = """Kamu adalah AI classifier untuk FiNot, aplikasi keuangan pribadi.

Klasifikasikan user message ke salah satu intent:

1. transaction: User ingin mencatat transaksi.
   contoh: "beli makan 25rb", "gajian 5jt", "transfer 100rb"
2. help: User minta bantuan.
   contoh: "cara pakai", "bantuan", "help", "/help", "/start"
3. history: User mau lihat riwayat transaksi.
   contoh: "lihat transaksi hari ini", "rekap minggu ini"
4. export: User mau download/export data.
   contoh: "export excel", "download laporan", "kirim file"
5. small_talk: Obrolan ringan.
   contoh: "hai", "terima kasih", "mantap"
6. insight: User minta insight/analisis harian.
   contoh: "insight hari ini", "analisis keuangan", "gimana keuanganku"
7. prediction: User minta prediksi umur saldo.
   contoh: "prediksi saldo", "saldo tahan berapa hari", "umur saldo"
8. saving_rec: User minta rekomendasi tabungan.
   contoh: "rekomendasi nabung", "harus nabung berapa", "saran tabungan"
9. health_score: User minta skor kesehatan keuangan.
   contoh: "health score", "skor keuangan", "sehat gak keuanganku"
10. simulation: User minta simulasi hemat.
    contoh: "kalau hemat 10rb", "simulasi hemat", "bagaimana kalau kurangi"
11. analysis: User minta analisis mingguan/bulanan.
    contoh: "analisis minggu ini", "laporan bulanan", "deep analysis"
12. upgrade: User ingin upgrade plan.
    contoh: "upgrade", "beli pro", "langganan", "premium", "harga"
13. status: User cek status langganan.
    contoh: "status saya", "plan saya", "sisa kredit", "cek langganan"
14. unknown: Intent tidak jelas.

PERIOD DETECTION (untuk history/export/analysis):
- "hari ini", "today" → "today"
- "minggu ini", "mingguan" → "week"
- "bulan ini", "bulanan" → "month"
- "tahun ini", "tahunan" → "year"

DIRECTION DETECTION:
- "pemasukan", "income" → "income"
- "pengeluaran", "expense" → "expense"

Output JSON:
{
    "intent": "<intent>",
    "confidence": 0.0-1.0,
    "period": "today|week|month|year" (null if not relevant),
    "direction": "income|expense" (null if not relevant),
    "reasoning": "Brief explanation"
}

IMPORTANT:
- Jika ada nominal uang/angka → kemungkinan besar transaction
- Prioritas: transaction > analysis features > navigation commands
"""

        user_input = f'\nUser message: "{text}"\n'
        return system + "\n" + user_input

    def _parse_llm_response(self, llm_text: str) -> Dict:
        try:
            json_start = llm_text.find("{")
            json_end = llm_text.rfind("}") + 1

            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found")

            json_str = llm_text[json_start:json_end]
            data = json.loads(json_str)

            intent_str = data.get("intent", "unknown").lower()

            try:
                intent = UserIntent(intent_str)
            except ValueError:
                logger.warning("Unknown intent from LLM: %s", intent_str)
                intent = UserIntent.UNKNOWN

            return {
                "intent": intent,
                "confidence": float(data.get("confidence", 0.5)),
                "period": data.get("period"),
                "direction": data.get("direction"),
                "reason": data.get("reasoning", ""),
            }

        except Exception as e:
            logger.error("Failed to parse LLM response: %s", str(e))
            return {
                "intent": UserIntent.UNKNOWN,
                "confidence": 0.0,
                "period": None,
                "direction": None,
                "reason": "Failed to parse",
            }


_classifier: Optional[IntentClassifier] = None


async def classify_intent(text: str) -> Dict:
    """Main function to classify user intent."""
    global _classifier
    if _classifier is None:
        _classifier = IntentClassifier()
    return await _classifier.classify(text)
