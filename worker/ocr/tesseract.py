"""
Tesseract OCR wrapper untuk FiNot
──────────────────────────────────
Multi-PSM OCR with confidence scoring.
"""

import logging
from typing import Tuple, Dict

import numpy as np

logger = logging.getLogger(__name__)

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not available")


class TesseractOCR:
    def __init__(self, lang: str = "ind+eng"):
        self.lang = lang
        self.psm_modes = [6, 4, 3, 11]  # Try different page segmentation modes

    def extract_text(self, img: np.ndarray) -> Tuple[str, Dict]:
        """
        Extract text from preprocessed image.
        Tries multiple PSM modes for best result.

        Returns:
            Tuple[str, Dict]: (ocr_text, metadata)
        """
        if not TESSERACT_AVAILABLE:
            return "", {"confidence": 0, "error": "Tesseract not available"}

        best_text = ""
        best_confidence = 0
        best_psm = None
        attempts = []

        for psm in self.psm_modes:
            try:
                config = f"--oem 3 --psm {psm}"
                text = pytesseract.image_to_string(
                    img, lang=self.lang, config=config
                )

                # Get confidence
                data = pytesseract.image_to_data(
                    img, lang=self.lang, config=config,
                    output_type=pytesseract.Output.DICT
                )

                confidences = [
                    int(c) for c in data.get("conf", [])
                    if str(c).isdigit() and int(c) > 0
                ]
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0

                attempts.append({
                    "psm": psm,
                    "text_length": len(text.strip()),
                    "confidence": avg_confidence,
                })

                if avg_confidence > best_confidence and len(text.strip()) > 10:
                    best_text = text.strip()
                    best_confidence = avg_confidence
                    best_psm = psm

            except Exception as e:
                logger.warning(f"PSM {psm} failed: {e}")
                attempts.append({"psm": psm, "error": str(e)})
                continue

        word_count = len(best_text.split()) if best_text else 0

        metadata = {
            "confidence": best_confidence,
            "psm_used": best_psm,
            "word_count": word_count,
            "char_count": len(best_text),
            "attempts": attempts,
        }

        logger.info(
            f"OCR result: {len(best_text)} chars, "
            f"confidence={best_confidence:.1f}%, PSM={best_psm}"
        )

        return best_text, metadata
