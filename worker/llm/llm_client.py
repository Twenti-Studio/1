"""
LLM Client untuk FiNot
─────────────────────
Supports both sync and async calls to OpenAI API.
"""

import os
import time
import logging
import asyncio
from typing import Dict, Any

from openai import OpenAI

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-4o-mini"


class LLMAPIError(Exception):
    pass


_client: OpenAI | None = None


def _get_client() -> OpenAI:
    """Singleton OpenAI client"""
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise LLMAPIError("OPENAI_API_KEY tidak ditemukan di environment")
        _client = OpenAI(api_key=api_key)
        logger.info("OpenAI client initialized")
    return _client


def call_llm(
    prompt: str,
    model_name: str = DEFAULT_MODEL,
    max_retries: int = 3,
    backoff_base: float = 0.8,
    system_prompt: str = None,
) -> Dict[str, Any]:
    """
    Call OpenAI API (synchronous).

    Args:
        prompt: User prompt
        model_name: Model name
        max_retries: Number of retries
        backoff_base: Backoff base delay
        system_prompt: Optional custom system prompt

    Returns:
        Dict with text, model, usage
    """
    if not isinstance(prompt, str) or not prompt.strip():
        raise LLMAPIError("Prompt harus berupa string non-kosong")

    last_err = None
    client = _get_client()

    default_system = (
        "You are a transaction parser for a finance application.\n"
        "Output MUST be a single valid JSON object.\n"
        "Do NOT include explanations, markdown, or extra text.\n\n"
        "JSON schema:\n"
        "{\n"
        '  "intent": "income | expense",\n'
        '  "amount": number,\n'
        '  "currency": "IDR",\n'
        '  "date": string | null,\n'
        '  "category": string,\n'
        '  "note": string,\n'
        '  "confidence": number\n'
        "}"
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt or default_system,
        },
        {
            "role": "user",
            "content": prompt,
        },
    ]

    for attempt in range(max_retries):
        try:
            logger.debug(f"Calling OpenAI API (attempt {attempt + 1}/{max_retries})")

            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0,
                max_completion_tokens=1024,
                response_format={"type": "json_object"},
            )

            text = response.choices[0].message.content

            if not isinstance(text, str) or not text.strip():
                raise LLMAPIError("LLM mengembalikan teks kosong atau invalid")

            logger.debug(f"RAW LLM OUTPUT:\n{text}")

            usage_dict = None
            if response.usage:
                usage_dict = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }

            return {
                "text": text,
                "model": model_name,
                "usage": usage_dict,
            }

        except Exception as e:
            last_err = e
            logger.warning(
                f"LLM error (attempt {attempt + 1}/{max_retries}): {e}",
                exc_info=True,
            )
            if attempt < max_retries - 1:
                sleep_time = backoff_base * (2**attempt)
                time.sleep(sleep_time)

    raise LLMAPIError(
        f"Gagal memanggil LLM setelah {max_retries} percobaan"
    ) from last_err


async def call_llm_async(
    prompt: str,
    model_name: str = DEFAULT_MODEL,
    system_prompt: str = None,
) -> Dict[str, Any]:
    """Async wrapper for call_llm."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: call_llm(prompt, model_name, system_prompt=system_prompt),
    )
