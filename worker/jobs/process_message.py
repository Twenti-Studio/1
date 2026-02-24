"""
Process Message Job
━━━━━━━━━━━━━━━━━━
Background job for processing incoming messages (text/image/audio).
"""

import logging
from typing import Optional, Dict, Any

from app.models.enums import InputType, IntentType

logger = logging.getLogger(__name__)


class ProcessMessageJob:
    """Job untuk proses pesan masuk (text/image/audio)."""

    def __init__(self, user_id: int, input_type: str, data: Dict[str, Any]):
        """
        Args:
            user_id: ID user (Telegram)
            input_type: "text", "image", atau "audio"
            data: Data tambahan (text content, file_path, receipt_id, dll)
        """
        self.user_id = user_id

        try:
            self.input_type: InputType = (
                input_type
                if isinstance(input_type, InputType)
                else InputType(input_type)
            )
        except ValueError:
            logger.error(f"Invalid input type: {input_type}")
            self.input_type = InputType.TEXT

        self.data = data

    async def execute(self) -> Optional[Dict]:
        """Pilah dan eksekusi berdasarkan tipe input."""
        try:
            from worker.worker_main import (
                process_text_message,
                process_image_message,
                process_audio_message,
            )

            if self.input_type is InputType.TEXT:
                text = self.data.get("text", "")
                if not text:
                    return None
                return await process_text_message(self.user_id, text)

            elif self.input_type is InputType.IMAGE:
                file_path = self.data.get("file_path")
                receipt_id = self.data.get("receipt_id")
                if not file_path:
                    return None
                return await process_image_message(
                    self.user_id, file_path, receipt_id
                )

            elif self.input_type is InputType.AUDIO:
                file_path = self.data.get("file_path")
                if not file_path:
                    return None
                return await process_audio_message(self.user_id, file_path)

            else:
                logger.error(f"Unknown input type: {self.input_type}")
                return None

        except Exception as e:
            logger.error(f"Job execution failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "user_id": self.user_id,
                "input_type": self.input_type.value,
            }
