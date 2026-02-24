"""Helper utilities for FiNot."""

import uuid
import time
import re
from datetime import datetime
from typing import Optional


def generate_unique_filename(extension: str) -> str:
    """Generate a unique filename with timestamp and UUID."""
    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:8]
    return f"{timestamp}_{unique_id}.{extension}"


def format_currency(amount: int, currency: str = "IDR") -> str:
    """Format amount as currency string."""
    if currency == "IDR":
        return f"Rp {amount:,}".replace(",", ".")
    return f"{currency} {amount:,.2f}"


def parse_date_string(date_str: str) -> Optional[datetime]:
    """Parse date from various formats."""
    if not date_str:
        return None

    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d %b %Y",
        "%d %B %Y",
        "%Y-%m-%dT%H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def sanitize_text(text: str) -> str:
    """Clean text from control characters and excessive whitespace."""
    if not text:
        return ""
    text = re.sub(r"[\x00-\x1F\x7F]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def truncate_text(text: str, max_length: int = 4096) -> str:
    """Truncate text to max length (Telegram message limit)."""
    if not text:
        return ""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."


def parse_amount_text(text: str) -> int:
    """Parse Indonesian amount text to integer."""
    if not text:
        return 0

    text = text.lower().strip()
    text = text.replace(".", "").replace(",", "").replace(" ", "")

    # Handle Indonesian shortcuts
    text = text.replace("jt", "000000")
    text = text.replace("juta", "000000")
    text = text.replace("rb", "000")
    text = text.replace("ribu", "000")
    text = text.replace("k", "000")

    # Remove non-digit characters
    digits = re.sub(r"[^\d]", "", text)

    try:
        return int(digits) if digits else 0
    except ValueError:
        return 0
