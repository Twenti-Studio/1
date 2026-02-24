"""
OCR Preprocessor untuk FiNot
─────────────────────────────
Image preprocessing for better OCR results.
"""

import logging
import numpy as np

logger = logging.getLogger(__name__)

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("OpenCV not available - image preprocessing disabled")


class ImagePreprocessor:
    def __init__(
        self,
        target_height: int = 1600,
        auto_deskew: bool = True,
        denoise: bool = True,
        aggressive_mode: bool = False,
    ):
        self.target_height = target_height
        self.auto_deskew = auto_deskew
        self.denoise = denoise
        self.aggressive_mode = aggressive_mode

    def preprocess(self, img: np.ndarray) -> np.ndarray:
        """Full preprocessing pipeline."""
        if not CV2_AVAILABLE:
            return img

        try:
            # 1. Convert to grayscale
            if len(img.shape) == 3:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            else:
                gray = img.copy()

            # 2. Resize
            h, w = gray.shape[:2]
            if h > 0:
                scale = self.target_height / h
                new_w = int(w * scale)
                gray = cv2.resize(gray, (new_w, self.target_height))

            # 3. Denoise
            if self.denoise:
                gray = cv2.fastNlMeansDenoising(gray, h=10)

            # 4. Adaptive threshold
            if self.aggressive_mode:
                gray = cv2.adaptiveThreshold(
                    gray, 255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                    cv2.THRESH_BINARY,
                    15, 8
                )
            else:
                _, gray = cv2.threshold(
                    gray, 0, 255,
                    cv2.THRESH_BINARY + cv2.THRESH_OTSU
                )

            logger.info(f"Preprocessing done: {gray.shape}")
            return gray

        except Exception as e:
            logger.error(f"Preprocessing failed: {e}", exc_info=True)
            return img
