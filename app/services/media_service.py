"""Service untuk download dan manage media files dari Telegram."""

import asyncio
import logging
import mimetypes
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import aiofiles
import httpx

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_logger = logging.getLogger(__name__)


async def _get_with_retries(
    client: httpx.AsyncClient, url: str, **kwargs
) -> httpx.Response:
    """Helper untuk retry HTTP request."""
    retries = 3
    for attempt in range(1, retries + 1):
        try:
            response = await client.get(url, **kwargs)
            response.raise_for_status()
            return response
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            _logger.warning(
                "Attempt %s failed for %s: %s", attempt, url, exc, exc_info=exc
            )
            if attempt == retries:
                raise
            await asyncio.sleep(attempt)
    raise RuntimeError("Unreachable")


def _determine_mime_type(file_path: Path) -> str:
    """Helper untuk deteksi MIME type dari file."""
    mime_type, _ = mimetypes.guess_type(file_path.name)
    return mime_type or "application/octet-stream"


async def download_telegram_media(
    file_id: str, bot_token: str, user_id: Optional[str] = None
) -> dict:
    """Download file dari Telegram."""
    user_id_value = str(user_id or "anon")
    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y%m%d%H%M%S")
    metadata_url = f"https://api.telegram.org/bot{bot_token}/getFile"
    params = {"file_id": file_id}

    timeout = httpx.Timeout(10.0, read=30.0)

    _logger.info(f"Downloading Telegram media: {file_id}")

    async with httpx.AsyncClient(timeout=timeout) as client:
        metadata_resp = await _get_with_retries(client, metadata_url, params=params)
        payload = metadata_resp.json()

        if not payload.get("ok"):
            error_msg = payload.get("description", "Unknown error")
            _logger.error(f"Telegram API error: {error_msg}")
            raise httpx.HTTPStatusError(
                f"Telegram getFile error: {error_msg}",
                request=metadata_resp.request,
                response=metadata_resp,
            )

        file_path = payload["result"]["file_path"]

        download_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
        unique_id = uuid.uuid4().hex[:8]
        original_name = Path(file_path).name
        ext = Path(file_path).suffix
        generated_name = f"{timestamp}_{user_id_value}_{unique_id}{ext}"
        destination = UPLOAD_DIR / generated_name

        _logger.debug(f"Downloading from {download_url} to {destination}")

        async with client.stream("GET", download_url) as download_resp:
            download_resp.raise_for_status()
            async with aiofiles.open(destination, "wb") as out_file:
                async for chunk in download_resp.aiter_bytes(1024 * 64):
                    await out_file.write(chunk)

    mime_type = _determine_mime_type(destination)
    file_size = destination.stat().st_size

    result = {
        "file_path": str(destination.as_posix()),
        "file_name": original_name,
        "mime_type": mime_type,
        "file_size": file_size,
    }

    _logger.info(f"Downloaded: {result}")
    return result


def get_mime_type(file_path: str) -> str:
    """Detect MIME type dari file."""
    path = Path(file_path)

    if not path.exists():
        _logger.warning(f"File not found: {file_path}")
        return "application/octet-stream"

    mime_type, _ = mimetypes.guess_type(path.name)

    if mime_type:
        return mime_type

    ext_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".ogg": "audio/ogg",
        ".oga": "audio/ogg",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
    }

    ext = path.suffix.lower()
    return ext_map.get(ext, "application/octet-stream")


async def cleanup_old_files(days: int = 30) -> dict:
    """Hapus file yang lebih tua dari X hari."""
    _logger.info(f"Starting cleanup for files older than {days} days")

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_timestamp = cutoff_date.timestamp()

    deleted_count = 0
    freed_bytes = 0
    errors = []

    try:
        for file_path in UPLOAD_DIR.iterdir():
            if not file_path.is_file():
                continue
            try:
                file_mtime = file_path.stat().st_mtime
                if file_mtime < cutoff_timestamp:
                    file_size = file_path.stat().st_size
                    file_path.unlink()
                    deleted_count += 1
                    freed_bytes += file_size
            except Exception as e:
                errors.append(f"Error deleting {file_path.name}: {str(e)}")

    except Exception as e:
        errors.append(f"Error during cleanup: {str(e)}")

    result = {
        "deleted_count": deleted_count,
        "freed_bytes": freed_bytes,
        "errors": errors,
    }

    _logger.info(
        f"Cleanup completed: {deleted_count} files deleted, "
        f"{freed_bytes / 1024 / 1024:.2f} MB freed"
    )
    return result
