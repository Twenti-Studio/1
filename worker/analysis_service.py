"""
FiNot AI Analysis Service
━━━━━━━━━━━━━━━━━━━━━━━━━
Premium features: Daily Insight, Balance Prediction, Saving Recommendation,
Financial Health Score, Saving Simulation, Weekly/Monthly Deep Analysis.
"""

import logging
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional

from app.db.connection import prisma
from worker.llm.llm_client import call_llm
from worker.llm.prompts import (
    build_daily_insight_prompt,
    build_balance_prediction_prompt,
    build_saving_recommendation_prompt,
    build_financial_health_prompt,
    build_saving_simulation_prompt,
    build_weekly_analysis_prompt,
    build_monthly_analysis_prompt,
)

logger = logging.getLogger(__name__)


async def _get_transaction_summary(
    user_id: int, days: int = 7
) -> str:
    """Build transaction summary text for AI analysis."""
    start_date = datetime.utcnow() - timedelta(days=days)

    txs = await prisma.transaction.find_many(
        where={
            "userId": user_id,
            "createdAt": {"gte": start_date},
        },
        order={"createdAt": "asc"},
    )

    if not txs:
        return "Tidak ada transaksi dalam periode ini."

    lines = []
    total_income = 0
    total_expense = 0

    for tx in txs:
        dt = tx.txDate or tx.createdAt
        date_str = dt.strftime("%Y-%m-%d")
        tipe = "Pemasukan" if tx.intent == "income" else "Pengeluaran"
        lines.append(f"- {date_str}: {tipe} Rp{tx.amount:,} [{tx.category}] {tx.note or ''}")

        if tx.intent == "income":
            total_income += tx.amount
        else:
            total_expense += tx.amount

    summary = (
        f"Total transaksi: {len(txs)}\n"
        f"Total pemasukan: Rp{total_income:,}\n"
        f"Total pengeluaran: Rp{total_expense:,}\n"
        f"Net: Rp{total_income - total_expense:,}\n\n"
        f"Detail transaksi:\n" + "\n".join(lines)
    )

    return summary


async def _call_analysis_llm(prompt: str) -> Dict:
    """Call LLM with analysis system prompt and parse JSON result."""
    system_prompt = (
        "You are FiNot, an AI financial advisor. "
        "Always respond in valid JSON format. "
        "Use Indonesian language for text fields."
    )

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: call_llm(prompt=prompt, system_prompt=system_prompt),
    )

    try:
        text = result["text"]
        json_start = text.find("{")
        json_end = text.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(text[json_start:json_end])
        return json.loads(text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse analysis result: {e}")
        return {"error": "Gagal menganalisis data", "raw": result["text"]}


# ═══════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════

async def get_daily_insight(user_id: int) -> Dict:
    """Generate daily AI insight dari transaksi hari ini."""
    try:
        summary = await _get_transaction_summary(user_id, days=1)
        prompt = build_daily_insight_prompt(summary)
        result = await _call_analysis_llm(prompt)

        logger.info(f"Daily insight generated for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error generating daily insight: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_balance_prediction(user_id: int, current_balance: int = None) -> Dict:
    """Predict how long balance will last. Auto-calculates balance if not provided."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)

        # Auto-calculate balance from all transactions if not provided
        if current_balance is None or current_balance == 0:
            all_txs = await prisma.transaction.find_many(
                where={"userId": user_id},
            )
            total_income = sum(tx.amount for tx in all_txs if tx.intent == "income")
            total_expense = sum(tx.amount for tx in all_txs if tx.intent == "expense")
            current_balance = total_income - total_expense

        if current_balance <= 0:
            return {
                "success": True,
                "data": {
                    "daily_avg_expense": 0,
                    "daily_avg_income": 0,
                    "predicted_days": 0,
                    "prediction_confidence": 0.5,
                    "explanation": "Saldo kamu saat ini minus atau nol. Catat pemasukan terlebih dahulu agar prediksi bisa akurat.",
                },
            }

        prompt = build_balance_prediction_prompt(summary, current_balance)
        result = await _call_analysis_llm(prompt)

        logger.info(f"Balance prediction generated for user {user_id} (balance={current_balance})")
        return {"success": True, "data": result, "balance": current_balance}

    except Exception as e:
        logger.error(f"Error predicting balance: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_saving_recommendation(user_id: int) -> Dict:
    """Generate saving recommendations."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_saving_recommendation_prompt(summary)
        result = await _call_analysis_llm(prompt)

        logger.info(f"Saving recommendation generated for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error generating saving recommendation: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_financial_health_score(user_id: int) -> Dict:
    """Calculate financial health score (0-100)."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_financial_health_prompt(summary)
        result = await _call_analysis_llm(prompt)

        logger.info(f"Health score generated for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error calculating health score: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_saving_simulation(
    user_id: int,
    user_scenario: str = "hemat 10000 per hari",
) -> Dict:
    """Simulate saving impact from natural language scenario."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)

        # Get average daily expense
        txs = await prisma.transaction.find_many(
            where={
                "userId": user_id,
                "intent": "expense",
                "createdAt": {"gte": datetime.utcnow() - timedelta(days=30)},
            },
        )
        total_expense = sum(tx.amount for tx in txs)
        daily_avg = total_expense // 30 if txs else 0

        # Auto-calculate current balance
        all_txs = await prisma.transaction.find_many(
            where={"userId": user_id},
        )
        total_income = sum(tx.amount for tx in all_txs if tx.intent == "income")
        total_all_expense = sum(tx.amount for tx in all_txs if tx.intent == "expense")
        current_balance = max(total_income - total_all_expense, 0)

        prompt = build_saving_simulation_prompt(
            user_scenario, current_balance, daily_avg, summary
        )
        result = await _call_analysis_llm(prompt)

        logger.info(f"Saving simulation generated for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error running simulation: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_weekly_analysis(user_id: int) -> Dict:
    """Generate weekly deep analysis."""
    try:
        summary = await _get_transaction_summary(user_id, days=7)
        prompt = build_weekly_analysis_prompt(summary)
        result = await _call_analysis_llm(prompt)

        logger.info(f"Weekly analysis generated for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error generating weekly analysis: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_monthly_analysis(user_id: int) -> Dict:
    """Generate monthly deep analysis (Elite only)."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_monthly_analysis_prompt(summary)
        result = await _call_analysis_llm(prompt)

        logger.info(f"Monthly analysis generated for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error generating monthly analysis: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
