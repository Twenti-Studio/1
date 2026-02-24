"""
FiNot Worker Main
━━━━━━━━━━━━━━━━━
Core message processing pipeline for text, image (OCR), and audio messages.
"""

import logging
import json
from typing import Optional, List, Dict
from datetime import datetime

from app.db.connection import prisma
from worker.llm.llm_client import call_llm, LLMAPIError
from worker.llm.parser import parse_llm_response, ParserError
from worker.services.transaction_service import (
    save_transaction,
    save_ocr_result,
    save_llm_response,
    TransactionServiceError,
)
from worker.services.sanity_checks import run_sanity_checks
from worker.llm.prompts import build_prompt

from worker.ocr.preprocessor import ImagePreprocessor
from worker.ocr.tesseract import TesseractOCR
from worker.utils.image_utils import load_image
from worker.utils.audio_utils import transcribe_audio

logger = logging.getLogger(__name__)


async def process_text_message(
    user_id: int,
    text: str,
    metadata: Optional[Dict] = None,
) -> Dict:
    """
    Process text message → LLM → parse → save.

    Returns:
        Dict with results or error
    """
    logger.info(f"Processing text message: user={user_id}, len={len(text)}")

    try:
        # 1. Build prompt
        prompt = build_prompt(text, input_source="text")

        # 2. Call LLM
        llm_result = call_llm(prompt=prompt)
        llm_text = llm_result["text"]

        # 3. Save LLM response
        llm_id = await save_llm_response(
            user_id=user_id,
            input_source="text",
            input_text=text,
            prompt_used=prompt,
            llm_output={"raw": llm_text},
            llm_meta=llm_result.get("usage"),
        )

        # 4. Parse LLM output
        parsed_transactions = parse_llm_response(llm_text)

        # 5. Process each transaction
        results = []
        for parsed in parsed_transactions:
            # Sanity checks
            sanity = run_sanity_checks(parsed)

            # Save transaction
            tx_result = await save_transaction(
                user_id=user_id,
                parsed_data=parsed,
                llm_response_id=llm_id,
                sanity_result=sanity,
            )

            results.append(tx_result)

        logger.info(f"Text processed: {len(results)} transactions saved")

        return {
            "success": True,
            "source": "text",
            "transactions": results,
            "count": len(results),
        }

    except ParserError as e:
        logger.warning(f"Parser error: {e}")
        return {
            "success": False,
            "source": "text",
            "error": f"Maaf, saya tidak bisa memahami pesan kamu. Coba ketik ulang seperti: 'beli makan 25rb'",
            "detail": str(e),
        }

    except LLMAPIError as e:
        logger.error(f"LLM API error: {e}", exc_info=True)
        return {
            "success": False,
            "source": "text",
            "error": "Maaf, AI sedang bermasalah. Coba lagi nanti ya.",
            "detail": str(e),
        }

    except Exception as e:
        logger.error(f"Unexpected error processing text: {e}", exc_info=True)
        return {
            "success": False,
            "source": "text",
            "error": "Terjadi kesalahan internal. Silakan coba lagi.",
            "detail": str(e),
        }


async def process_image_message(
    user_id: int,
    file_path: str,
    receipt_id: Optional[int] = None,
    metadata: Optional[Dict] = None,
) -> Dict:
    """
    Process image → OCR → LLM → parse → save.

    Returns:
        Dict with results or error
    """
    logger.info(f"Processing image: user={user_id}, file={file_path}")

    try:
        # 1. Load & preprocess image
        img = load_image(file_path)
        preprocessor = ImagePreprocessor(target_height=1600, denoise=True)
        processed = preprocessor.preprocess(img)

        # 2. OCR
        ocr = TesseractOCR(lang="ind+eng")
        ocr_text, ocr_meta = ocr.extract_text(processed)

        if not ocr_text or len(ocr_text.strip()) < 5:
            # Retry with aggressive mode
            logger.info("Low OCR result, retrying with aggressive mode")
            aggressive = ImagePreprocessor(
                target_height=1600, denoise=True, aggressive_mode=True
            )
            processed_agg = aggressive.preprocess(img)
            ocr_text, ocr_meta = ocr.extract_text(processed_agg)

        if not ocr_text or len(ocr_text.strip()) < 5:
            return {
                "success": False,
                "source": "image",
                "error": "Maaf, saya tidak bisa membaca struk ini. Pastikan foto jelas dan teks terlihat.",
                "ocr_confidence": ocr_meta.get("confidence", 0),
            }

        # 3. Save OCR result
        if receipt_id:
            await save_ocr_result(receipt_id, ocr_text, ocr_meta)

        # 4. Build prompt & call LLM
        prompt = build_prompt(ocr_text, input_source="ocr")
        llm_result = call_llm(prompt=prompt)
        llm_text = llm_result["text"]

        # 5. Save LLM response
        llm_id = await save_llm_response(
            user_id=user_id,
            input_source="ocr",
            input_text=ocr_text,
            prompt_used=prompt,
            llm_output={"raw": llm_text},
            llm_meta={
                **(llm_result.get("usage") or {}),
                "ocr_confidence": ocr_meta.get("confidence", 0),
            },
        )

        # 6. Parse LLM output
        parsed_transactions = parse_llm_response(llm_text)

        # 7. Process each transaction
        results = []
        for parsed in parsed_transactions:
            sanity = run_sanity_checks(parsed)
            tx_result = await save_transaction(
                user_id=user_id,
                parsed_data=parsed,
                llm_response_id=llm_id,
                receipt_id=receipt_id,
                sanity_result=sanity,
            )
            results.append(tx_result)

        logger.info(
            f"Image processed: {len(results)} transactions from receipt, "
            f"OCR confidence={ocr_meta.get('confidence', 0):.1f}%"
        )

        return {
            "success": True,
            "source": "image",
            "transactions": results,
            "count": len(results),
            "ocr_confidence": ocr_meta.get("confidence", 0),
        }

    except ParserError as e:
        logger.warning(f"Parser error for OCR: {e}")
        return {
            "success": False,
            "source": "image",
            "error": "Struk terbaca tapi saya tidak bisa mengekstrak transaksinya. Coba foto ulang dengan lebih jelas.",
            "detail": str(e),
        }

    except Exception as e:
        logger.error(f"Error processing image: {e}", exc_info=True)
        return {
            "success": False,
            "source": "image",
            "error": "Gagal memproses gambar. Silakan coba lagi.",
            "detail": str(e),
        }


async def process_audio_message(
    user_id: int,
    file_path: str,
    metadata: Optional[Dict] = None,
) -> Dict:
    """
    Process audio/voice message → Whisper transcription → LLM → parse → save.

    Returns:
        Dict with results or error
    """
    logger.info(f"Processing audio: user={user_id}, file={file_path}")

    try:
        # 1. Transcribe audio
        transcribed_text = await transcribe_audio(file_path)

        if not transcribed_text or len(transcribed_text.strip()) < 3:
            return {
                "success": False,
                "source": "audio",
                "error": "Maaf, saya tidak bisa mendengar pesan suaramu dengan jelas. Coba rekam ulang atau ketik saja.",
            }

        logger.info(f"Audio transcribed: '{transcribed_text[:100]}...'")

        # 2. Build prompt & call LLM
        prompt = build_prompt(transcribed_text, input_source="audio")
        llm_result = call_llm(prompt=prompt)
        llm_text = llm_result["text"]

        # 3. Save LLM response
        llm_id = await save_llm_response(
            user_id=user_id,
            input_source="audio",
            input_text=transcribed_text,
            prompt_used=prompt,
            llm_output={"raw": llm_text},
            llm_meta=llm_result.get("usage"),
        )

        # 4. Parse LLM output
        parsed_transactions = parse_llm_response(llm_text)

        # 5. Process each transaction
        results = []
        for parsed in parsed_transactions:
            sanity = run_sanity_checks(parsed)
            tx_result = await save_transaction(
                user_id=user_id,
                parsed_data=parsed,
                llm_response_id=llm_id,
                sanity_result=sanity,
            )
            results.append(tx_result)

        logger.info(f"Audio processed: {len(results)} transactions")

        return {
            "success": True,
            "source": "audio",
            "transcription": transcribed_text,
            "transactions": results,
            "count": len(results),
        }

    except ParserError as e:
        logger.warning(f"Parser error for audio: {e}")
        return {
            "success": False,
            "source": "audio",
            "error": "Pesan suara terbaca tapi saya tidak bisa memahami transaksinya. Coba sebutkan dengan lebih jelas.",
            "detail": str(e),
        }

    except Exception as e:
        logger.error(f"Error processing audio: {e}", exc_info=True)
        return {
            "success": False,
            "source": "audio",
            "error": "Gagal memproses pesan suara. Silakan coba lagi.",
            "detail": str(e),
        }


async def process_message_background(
    user_id: int,
    message_type: str,
    text: Optional[str] = None,
    file_path: Optional[str] = None,
    receipt_id: Optional[int] = None,
    metadata: Optional[Dict] = None,
) -> Dict:
    """
    Unified background processor for all message types.

    Args:
        user_id: Telegram user ID
        message_type: "text" | "image" | "audio"
        text: Text content (for text messages)
        file_path: File path (for image/audio)
        receipt_id: Receipt ID (for images)
        metadata: Additional metadata
    """
    logger.info(f"Background processing: type={message_type}, user={user_id}")

    if message_type == "text" and text:
        return await process_text_message(user_id, text, metadata)
    elif message_type == "image" and file_path:
        return await process_image_message(user_id, file_path, receipt_id, metadata)
    elif message_type == "audio" and file_path:
        return await process_audio_message(user_id, file_path, metadata)
    else:
        return {
            "success": False,
            "error": f"Unknown message type: {message_type}",
        }
