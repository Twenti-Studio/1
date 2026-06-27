"""Sanity checks untuk parsing output LLM."""

from datetime import datetime, timedelta
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

# Kategori TIDAK dipatok ke daftar tetap. User bebas memakai kata apapun
# (mis. "nongkrong", "kopi", "skincare"). Kategori di bawah hanya dipakai
# sebagai bahan contoh untuk LLM — BUKAN whitelist yang memaksa.

# Bucket khusus untuk transaksi yang benar-benar tidak jelas kategorinya.
UNCATEGORIZED = "tidak terkategori"

# Safety net ringan untuk typo/singkatan paling umum. Ini BUKAN NLP penuh —
# koreksi typo utama ditangani LLM. Map ini hanya jaring pengaman terakhir
# kalau LLM meloloskan singkatan yang sudah pasti maksudnya.
CATEGORY_TYPO_MAP = {
    "mkn": "makan",
    "mkan": "makan",
    "makn": "makan",
    "mknn": "makan",
    "mnm": "minuman",
    "minum": "minuman",
    "transport": "transportasi",
    "transpot": "transportasi",
    "trnsport": "transportasi",
    "ojol": "transportasi",
    "bensin": "bensin",
    "blnja": "belanja",
    "belanjaan": "belanja",
    "tagian": "tagihan",
    "tagiahan": "tagihan",
    "kesehatn": "kesehatan",
    "pndidikan": "pendidikan",
    "pendidkan": "pendidikan",
    "gajian": "gaji",
    "nabung": "tabungan",
    "tabung": "tabungan",
    "invest": "investasi",
    "investasii": "investasi",
}


def run_sanity_checks(parsed_output: Dict) -> Dict:
    """
    Jalankan sanity checks pada parsed output dari LLM.

    Returns:
        Dict: needs_review, flags, adjusted_confidence, warning
    """
    flags = []
    warnings = []
    needs_review = False

    # Check amount
    amount = parsed_output.get("amount", 0)
    if amount <= 0:
        flags.append("Invalid Amount")
        warnings.append("Amount tidak valid")
        needs_review = True

    # Confidence threshold
    confidence = parsed_output.get("confidence", 0.0)
    if confidence < 0.4:
        flags.append("Low Confidence")
        warnings.append("Confidence sangat rendah")
        needs_review = True
    elif confidence < 0.6:
        flags.append("Moderate Confidence")
        warnings.append("Confidence cukup rendah")
        needs_review = True

    # Category validation + normalization
    category_result = validate_and_normalize_category(
        parsed_output.get("category", "lainnya")
    )
    normalized_category = category_result["normalized"]

    if category_result["was_corrected"]:
        warnings.append(
            f"Kategori dikoreksi: '{parsed_output.get('category')}' → '{normalized_category}'"
        )

    # Adjust confidence based on flags
    penalty = len(flags) * 0.05
    adjusted_confidence = max(0.0, confidence - penalty)

    result = {
        "needs_review": needs_review,
        "flags": flags,
        "adjusted_confidence": adjusted_confidence,
        "warning": "; ".join(warnings),
        "normalized_category": normalized_category,
    }

    logger.info(
        f"Sanity checks: needs_review={needs_review}, "
        f"flags={len(flags)}, adjusted_confidence={adjusted_confidence:.2f}"
    )

    return result


def validate_and_normalize_category(category: str) -> Dict:
    """Normalisasi kategori TANPA memaksa ke daftar tetap.

    Aturan:
    - Kategori dibiarkan sesuai input user (free-form), hanya dirapikan
      (lowercase + trim spasi berlebih).
    - Typo/singkatan yang sudah pasti dikoreksi via safety net ringan
      (koreksi typo utama tetap tanggung jawab LLM, bukan NLP penuh di sini).
    - Kalau kosong atau jelas tidak bermakna → 'tidak terkategori'.
    """
    if not category or not str(category).strip():
        return {"normalized": UNCATEGORIZED, "was_corrected": True}

    normalized = " ".join(str(category).lower().split())

    # LLM sudah boleh mengembalikan 'tidak terkategori' secara eksplisit.
    if normalized in (UNCATEGORIZED, "uncategorized", "tidak jelas", "tidak diketahui", "unknown"):
        return {"normalized": UNCATEGORIZED, "was_corrected": False}

    # Safety net typo (jaring pengaman terakhir, bukan NLP penuh).
    if normalized in CATEGORY_TYPO_MAP:
        mapped = CATEGORY_TYPO_MAP[normalized]
        if mapped != normalized:
            logger.debug(f"Category typo corrected: '{category}' → '{mapped}'")
            return {"normalized": mapped, "was_corrected": True}
        return {"normalized": mapped, "was_corrected": False}

    # Selain itu: hormati kata user apa adanya.
    return {"normalized": normalized, "was_corrected": False}
