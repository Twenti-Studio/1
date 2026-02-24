"""Audio utilities for voice message processing."""

import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


async def convert_ogg_to_wav(ogg_path: str) -> Optional[str]:
    """
    Convert OGG voice message to WAV format for speech-to-text.

    Args:
        ogg_path: Path to OGG file

    Returns:
        Path to WAV file or None if conversion failed
    """
    try:
        from pydub import AudioSegment

        path = Path(ogg_path)
        if not path.exists():
            logger.error(f"OGG file not found: {ogg_path}")
            return None

        # Load OGG
        audio = AudioSegment.from_ogg(str(path))

        # Export as WAV
        wav_path = str(path.with_suffix(".wav"))
        audio.export(wav_path, format="wav")

        logger.info(f"Converted OGG to WAV: {wav_path}")
        return wav_path

    except Exception as e:
        logger.error(f"Error converting OGG to WAV: {e}", exc_info=True)
        return None


async def transcribe_audio(audio_path: str) -> Optional[str]:
    """
    Transcribe audio file using OpenAI Whisper API.

    Args:
        audio_path: Path to audio file (WAV or OGG)

    Returns:
        Transcribed text or None
    """
    try:
        from openai import OpenAI

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Convert to WAV if OGG
        path = Path(audio_path)
        if path.suffix.lower() in (".ogg", ".oga"):
            wav_path = await convert_ogg_to_wav(audio_path)
            if wav_path:
                audio_path = wav_path

        with open(audio_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="id",
                response_format="text",
            )

        transcribed_text = transcript.strip() if isinstance(transcript, str) else str(transcript).strip()

        logger.info(f"Audio transcribed: '{transcribed_text[:100]}...'")
        return transcribed_text

    except Exception as e:
        logger.error(f"Error transcribing audio: {e}", exc_info=True)
        return None
