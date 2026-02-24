"""Image utilities."""

import logging
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False


def load_image(file_path: str) -> np.ndarray:
    """Load image dari file path."""
    if not CV2_AVAILABLE:
        raise ImportError("OpenCV is required for image loading")

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {file_path}")

    img = cv2.imread(str(path))
    if img is None:
        raise ValueError(f"Failed to load image: {file_path}")

    logger.info(f"Image loaded: {img.shape} from {file_path}")
    return img
