"""OCR Service - full pipeline for receipt processing."""

import logging
from typing import Dict, Optional

from worker.ocr.preprocessor import ImagePreprocessor
from worker.ocr.tesseract import TesseractOCR
from worker.utils.image_utils import load_image

logger = logging.getLogger(__name__)


async def process_receipt_image(file_path: str) -> Dict:
    """
    Full OCR pipeline: load → preprocess → OCR.

    Args:
        file_path: Path to receipt image

    Returns:
        Dict with ocr_text, metadata, success
    """
    try:
        # 1. Load image
        img = load_image(file_path)

        # 2. Preprocess
        preprocessor = ImagePreprocessor(
            target_height=1600,
            denoise=True,
            aggressive_mode=False,
        )
        processed = preprocessor.preprocess(img)

        # 3. OCR
        ocr = TesseractOCR(lang="ind+eng")
        text, metadata = ocr.extract_text(processed)

        if not text or len(text.strip()) < 5:
            # Retry with aggressive mode
            logger.info("Low OCR result, retrying with aggressive mode")
            processed_aggressive = preprocessor.__class__(
                target_height=1600,
                denoise=True,
                aggressive_mode=True,
            ).preprocess(img)
            text, metadata = ocr.extract_text(processed_aggressive)

        return {
            "success": bool(text and len(text.strip()) > 5),
            "ocr_text": text or "",
            "metadata": metadata,
        }

    except Exception as e:
        logger.error(f"OCR pipeline failed: {e}", exc_info=True)
        return {
            "success": False,
            "ocr_text": "",
            "metadata": {"error": str(e)},
        }
