"""Sanity checks untuk parsing output LLM."""

from datetime import datetime, timedelta
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

VALID_CATEGORIES = [
    "makan",
    "minuman",
    "belanja",
    "transportasi",
    "tagihan",
    "hiburan",
    "kesehatan",
    "pendidikan",
    "gaji",
    "transfer",
    "tabungan",
    "investasi",
    "lainnya",
]

CATEGORY_MAPPING = {
    # Typo / singkatan
    "mkn": "makan",
    "minum": "minuman",
    "transport": "transportasi",
    "bill": "tagihan",
    "health": "kesehatan",
    "salary": "gaji",
    # Bahasa Inggris
    "food": "makan",
    "drink": "minuman",
    "shopping": "belanja",
    "entertainment": "hiburan",
    "education": "pendidikan",
    "saving": "tabungan",
    "savings": "tabungan",
    "investment": "investasi",
    # Common variations
    "jajan": "makan",
    "bensin": "transportasi",
    "ojol": "transportasi",
    "parkir": "transportasi",
    "wifi": "tagihan",
    "listrik": "tagihan",
    "air": "tagihan",
    "pulsa": "tagihan",
    "game": "hiburan",
    "nonton": "hiburan",
    "obat": "kesehatan",
    "dokter": "kesehatan",
    "sekolah": "pendidikan",
    "kursus": "pendidikan",
    "gaji bulanan": "gaji",
    "transfer uang": "transfer",
    "nabung": "tabungan",
    "invest": "investasi",
    "saham": "investasi",
    "reksadana": "investasi",
    "crypto": "investasi",
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
    """Validate dan normalize category."""
    if not category:
        return {"normalized": "lainnya", "was_corrected": True}

    normalized = category.lower().strip()

    # Exact match
    if normalized in VALID_CATEGORIES:
        return {"normalized": normalized, "was_corrected": False}

    # Try mapping
    if normalized in CATEGORY_MAPPING:
        mapped = CATEGORY_MAPPING[normalized]
        logger.debug(f"Category mapped: '{category}' → '{mapped}'")
        return {"normalized": mapped, "was_corrected": True}

    # Fallback
    logger.warning(f"Unknown category: '{category}', fallback to 'lainnya'")
    return {"normalized": "lainnya", "was_corrected": True}
