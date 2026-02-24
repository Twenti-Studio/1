"""Transaction Service untuk FiNot worker."""

import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional

from app.db.connection import prisma

logger = logging.getLogger(__name__)


class TransactionServiceError(Exception):
    pass


async def save_transaction(
    user_id: int,
    parsed_data: Dict,
    llm_response_id: Optional[int] = None,
    receipt_id: Optional[int] = None,
    sanity_result: Optional[Dict] = None,
) -> Dict:
    """Save parsed transaction to database."""
    try:
        # Build transaction data
        tx_data = {
            "userId": user_id,
            "intent": parsed_data["intent"],
            "amount": int(parsed_data["amount"]),
            "currency": parsed_data.get("currency", "IDR"),
            "category": sanity_result.get("normalized_category", parsed_data.get("category", "lainnya"))
            if sanity_result else parsed_data.get("category", "lainnya"),
            "note": parsed_data.get("note", ""),
            "needsReview": sanity_result.get("needs_review", False) if sanity_result else False,
        }

        # Parse date
        date_str = parsed_data.get("date")
        if date_str:
            try:
                if date_str.lower() in ("today", "hari ini"):
                    tx_data["txDate"] = datetime.utcnow()
                elif date_str.lower() in ("yesterday", "kemarin"):
                    from datetime import timedelta
                    tx_data["txDate"] = datetime.utcnow() - timedelta(days=1)
                else:
                    tx_data["txDate"] = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                tx_data["txDate"] = datetime.utcnow()
        else:
            tx_data["txDate"] = datetime.utcnow()

        # Link to LLM response and receipt
        if llm_response_id:
            tx_data["llmResponseId"] = llm_response_id
        if receipt_id:
            tx_data["receiptId"] = receipt_id

        # Save extra data
        extra = {}
        if sanity_result:
            extra["sanity"] = {
                "flags": sanity_result.get("flags", []),
                "adjusted_confidence": sanity_result.get("adjusted_confidence"),
                "warning": sanity_result.get("warning", ""),
            }
        extra["original_confidence"] = parsed_data.get("confidence")

        if extra:
            tx_data["extra"] = json.dumps(extra)

        # Create transaction
        tx = await prisma.transaction.create(data=tx_data)

        logger.info(
            f"Transaction saved: id={tx.id}, user={user_id}, "
            f"intent={tx.intent}, amount={tx.amount}, category={tx.category}"
        )

        return {
            "transaction_id": int(tx.id),
            "intent": tx.intent,
            "amount": tx.amount,
            "category": tx.category,
            "needs_review": tx.needsReview,
        }

    except Exception as e:
        logger.error(f"Error saving transaction: {e}", exc_info=True)
        raise TransactionServiceError(f"Gagal menyimpan transaksi: {e}")


async def save_ocr_result(
    receipt_id: int,
    ocr_text: str,
    metadata: Optional[Dict] = None,
) -> int:
    """Save OCR text result to database."""
    try:
        ocr_record = await prisma.ocrtext.create(
            data={
                "receiptId": receipt_id,
                "ocrRaw": ocr_text,
                "ocrMeta": json.dumps(metadata) if metadata else None,
            }
        )

        logger.info(f"OCR result saved: id={ocr_record.id}, receipt={receipt_id}")
        return ocr_record.id

    except Exception as e:
        logger.error(f"Error saving OCR result: {e}", exc_info=True)
        raise TransactionServiceError(f"Gagal menyimpan OCR result: {e}")


async def save_llm_response(
    user_id: int,
    input_source: str,
    input_text: str,
    prompt_used: str,
    llm_output: Dict,
    model_name: str = "gpt-4o-mini",
    llm_meta: Optional[Dict] = None,
) -> int:
    """Save LLM response to database."""
    try:
        record = await prisma.llmresponse.create(
            data={
                "userId": user_id,
                "inputSource": input_source,
                "inputText": input_text,
                "promptUsed": prompt_used,
                "modelName": model_name,
                "llmOutput": json.dumps(llm_output),
                "llmMeta": json.dumps(llm_meta) if llm_meta else None,
            }
        )

        logger.info(f"LLM response saved: id={record.id}")
        return record.id

    except Exception as e:
        logger.error(f"Error saving LLM response: {e}", exc_info=True)
        raise TransactionServiceError(f"Gagal menyimpan LLM response: {e}")
