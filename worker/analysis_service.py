"""
FiNot AI Analysis Service
━━━━━━━━━━━━━━━━━━━━━━━━━
Premium features: Daily Insight, Balance Prediction, Saving Recommendation,
Financial Health Score, Saving Simulation, Weekly/Monthly Deep Analysis.
"""

import logging
import json
import asyncio
from datetime import datetime, timedelta, timezone
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
    build_anomaly_detection_prompt,
    build_burn_rate_prompt,
    build_budget_suggestion_prompt,
    build_subscription_detector_prompt,
    build_goal_saving_prompt,
    build_payday_planning_prompt,
    build_overspending_alert_prompt,
    build_weekend_pattern_prompt,
    build_expense_limit_prompt,
    build_expense_prediction_prompt,
    build_savings_opportunity_prompt,
    build_ai_chat_prompt,
    build_weekly_strategy_prompt,
    build_post_transaction_insight_prompt,
    build_forecast_3month_prompt,
)

logger = logging.getLogger(__name__)


async def _get_transaction_summary(
    user_id: int, days: int = 7
) -> str:
    """Build transaction summary text for AI analysis."""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

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


async def save_ai_conversation(
    user_id: int,
    feature: str,
    user_query: str = None,
    ai_response: str = None,
    ai_meta: Dict = None,
    credit_used: int = 1,
):
    """Save AI Q&A pair to database for future dataset."""
    try:
        await prisma.aiconversation.create(
            data={
                "userId": user_id,
                "feature": feature,
                "userQuery": user_query,
                "aiResponse": ai_response,
                "aiMeta": json.dumps(ai_meta) if ai_meta else None,
                "creditUsed": credit_used,
            }
        )
        logger.debug(f"AI conversation saved: user={user_id}, feature={feature}")
    except Exception as e:
        # Don't fail the request if logging fails
        logger.error(f"Failed to save AI conversation: {e}")


async def _call_analysis_llm(
    prompt: str,
    user_id: int = None,
    feature: str = None,
    user_query: str = None,
    credit_used: int = 1,
) -> Dict:
    """Call LLM with analysis system prompt and parse JSON result.
    Optionally saves the conversation to the database for dataset building.
    """
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
            parsed = json.loads(text[json_start:json_end])
        else:
            parsed = json.loads(text)

        # Save AI conversation to database (non-blocking)
        if user_id and feature:
            # Get a human-readable response text for storage
            ai_text = parsed.get("insight") or parsed.get("answer") or parsed.get("explanation") or parsed.get("forecast") or parsed.get("suggestion") or text[:500]
            await save_ai_conversation(
                user_id=user_id,
                feature=feature,
                user_query=user_query,
                ai_response=str(ai_text),
                ai_meta=parsed,
                credit_used=credit_used,
            )

        return parsed
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
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="daily_insight")

        logger.info(f"Daily insight generated for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error generating daily insight: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_balance_prediction(user_id: int, current_balance: int = None, forecast_months: int = 0) -> Dict:
    """Predict how long balance will last. If forecast_months > 0, generate multi-month forecast."""
    try:
        days = 90 if forecast_months >= 3 else 30
        summary = await _get_transaction_summary(user_id, days=days)

        # Auto-calculate balance from all transactions if not provided
        if current_balance is None or current_balance == 0:
            all_txs = await prisma.transaction.find_many(
                where={"userId": user_id},
            )
            total_income = sum(tx.amount for tx in all_txs if tx.intent == "income")
            total_expense = sum(tx.amount for tx in all_txs if tx.intent == "expense")
            current_balance = total_income - total_expense

        if current_balance <= 0 and forecast_months == 0:
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

        if forecast_months >= 3:
            # Use forecast-specific prompt
            prompt = build_forecast_3month_prompt(summary, current_balance)
        else:
            prompt = build_balance_prediction_prompt(summary, current_balance)

        feat = "forecast_3month" if forecast_months >= 3 else "balance_prediction"
        result = await _call_analysis_llm(prompt, user_id=user_id, feature=feat)

        logger.info(f"Balance prediction generated for user {user_id} (balance={current_balance}, forecast={forecast_months}m)")
        return {"success": True, "data": result, "balance": current_balance}

    except Exception as e:
        logger.error(f"Error predicting balance: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_saving_recommendation(user_id: int) -> Dict:
    """Generate saving recommendations."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_saving_recommendation_prompt(summary)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="saving_recommendation")

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
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="health_score")

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
                "createdAt": {"gte": datetime.now(timezone.utc) - timedelta(days=30)},
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
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="saving_simulation", user_query=user_scenario)

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
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="weekly_summary")

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
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="monthly_analysis")

        logger.info(f"Monthly analysis generated for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error generating monthly analysis: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# ═══════════════════════════════════════════
# NEW AI FEATURES (13 features)
# ═══════════════════════════════════════════

async def _get_balance(user_id: int) -> int:
    """Calculate current balance from all transactions."""
    all_txs = await prisma.transaction.find_many(where={"userId": user_id})
    income = sum(tx.amount for tx in all_txs if tx.intent == "income")
    expense = sum(tx.amount for tx in all_txs if tx.intent == "expense")
    return max(income - expense, 0)


async def get_anomaly_detection(user_id: int) -> Dict:
    """#6 Spending Anomaly Detection — deteksi pengeluaran tidak normal."""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Today's expenses
        today_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "intent": "expense", "createdAt": {"gte": today_start}},
        )
        today_total = sum(tx.amount for tx in today_txs)

        # 30-day average
        month_start = now - timedelta(days=30)
        month_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "intent": "expense", "createdAt": {"gte": month_start}},
        )
        total_30d = sum(tx.amount for tx in month_txs)
        daily_avg = total_30d // 30 if month_txs else 0

        summary = await _get_transaction_summary(user_id, days=7)
        prompt = build_anomaly_detection_prompt(summary, today_total, daily_avg)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="spending_alert")

        logger.info(f"Anomaly detection for user {user_id}: today={today_total}, avg={daily_avg}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in anomaly detection: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_burn_rate(user_id: int) -> Dict:
    """#7 Burn Rate Analysis — hitung kecepatan uang habis."""
    try:
        balance = await _get_balance(user_id)
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_burn_rate_prompt(summary, balance)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="burn_rate")

        logger.info(f"Burn rate for user {user_id}: balance={balance}")
        return {"success": True, "data": result, "balance": balance}

    except Exception as e:
        logger.error(f"Error in burn rate: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_budget_suggestion(user_id: int) -> Dict:
    """#8 Smart Budget Suggestion — rekomendasi budget per kategori."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_budget_suggestion_prompt(summary)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="budget_suggestion")

        logger.info(f"Budget suggestion for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in budget suggestion: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_subscription_detector(user_id: int) -> Dict:
    """#9 Subscription Detector — deteksi langganan berulang."""
    try:
        summary = await _get_transaction_summary(user_id, days=60)
        prompt = build_subscription_detector_prompt(summary)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="subscription_detector")

        logger.info(f"Subscription detection for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in subscription detector: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_goal_saving(user_id: int, goal_text: str = "Tabungan darurat 3 bulan") -> Dict:
    """#11 Goal-based Saving — rencana capai target tabungan."""
    try:
        balance = await _get_balance(user_id)
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_goal_saving_prompt(summary, goal_text, balance)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="goal_saving", user_query=goal_text)

        logger.info(f"Goal saving for user {user_id}: goal='{goal_text}'")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in goal saving: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_payday_planning(user_id: int) -> Dict:
    """#12 Payday Planning — alokasi gaji."""
    try:
        # Find latest income transaction
        latest_income = await prisma.transaction.find_first(
            where={"userId": user_id, "intent": "income"},
            order={"createdAt": "desc"},
        )
        income_amount = latest_income.amount if latest_income else 0

        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_payday_planning_prompt(summary, income_amount)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="payday_planning")

        logger.info(f"Payday planning for user {user_id}: income={income_amount}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in payday planning: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_overspending_alert(user_id: int) -> Dict:
    """#13 Category Overspending Alert — peringatan kategori boros."""
    try:
        now = datetime.now(timezone.utc)
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now - timedelta(days=30)

        # This week per-category
        week_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "intent": "expense", "createdAt": {"gte": week_start}},
        )
        # Monthly average per-category
        month_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "intent": "expense", "createdAt": {"gte": month_start}},
        )

        # Build category comparison text
        cat_week = {}
        for tx in week_txs:
            cat_week[tx.category] = cat_week.get(tx.category, 0) + tx.amount

        cat_month = {}
        for tx in month_txs:
            cat_month[tx.category] = cat_month.get(tx.category, 0) + tx.amount

        weeks_in_period = max(1, (now - month_start).days / 7)
        cat_data_lines = []
        for cat in set(list(cat_week.keys()) + list(cat_month.keys())):
            week_val = cat_week.get(cat, 0)
            avg_val = int(cat_month.get(cat, 0) / weeks_in_period)
            cat_data_lines.append(f"- {cat}: minggu ini Rp{week_val:,}, rata-rata mingguan Rp{avg_val:,}")

        category_data = "\n".join(cat_data_lines) or "Tidak ada data kategori."

        summary = await _get_transaction_summary(user_id, days=7)
        prompt = build_overspending_alert_prompt(summary, category_data)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="overspending_alert")

        logger.info(f"Overspending alert for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in overspending alert: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_weekend_pattern(user_id: int) -> Dict:
    """#14 Weekend Spending Pattern — analisis pola weekend vs weekday."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_weekend_pattern_prompt(summary)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="advanced_tracking")

        logger.info(f"Weekend pattern for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in weekend pattern: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_expense_limit(user_id: int) -> Dict:
    """#15 Daily Expense Limit Reminder — batas pengeluaran harian."""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Today's spending
        today_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "intent": "expense", "createdAt": {"gte": today_start}},
        )
        today_spent = sum(tx.amount for tx in today_txs)

        # Calculate suggested daily limit = monthly income / 30 * 0.8
        month_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "createdAt": {"gte": month_start}},
        )
        month_income = sum(tx.amount for tx in month_txs if tx.intent == "income")
        suggested_limit = int(month_income * 0.8 / 30) if month_income > 0 else 0

        # Fallback: use 30-day average expense
        if suggested_limit == 0:
            start_30 = now - timedelta(days=30)
            exp_txs = await prisma.transaction.find_many(
                where={"userId": user_id, "intent": "expense", "createdAt": {"gte": start_30}},
            )
            total_30 = sum(tx.amount for tx in exp_txs)
            suggested_limit = total_30 // 30 if exp_txs else 50000

        summary = await _get_transaction_summary(user_id, days=3)
        prompt = build_expense_limit_prompt(summary, today_spent, suggested_limit)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="spending_alert")

        logger.info(f"Expense limit for user {user_id}: today={today_spent}, limit={suggested_limit}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in expense limit: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_expense_prediction(user_id: int) -> Dict:
    """#16 Expense Prediction — prediksi pengeluaran bulan ini."""
    try:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        month_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "createdAt": {"gte": month_start}},
        )

        # Build summary with month context
        lines = []
        days_elapsed = max(1, (now - month_start).days)
        total_exp = sum(tx.amount for tx in month_txs if tx.intent == "expense")
        total_inc = sum(tx.amount for tx in month_txs if tx.intent == "income")
        lines.append(f"Hari dalam bulan: {days_elapsed}")
        lines.append(f"Total pemasukan: Rp{total_inc:,}")
        lines.append(f"Total pengeluaran: Rp{total_exp:,}")
        lines.append(f"Rata-rata harian: Rp{total_exp // days_elapsed:,}")

        for tx in month_txs:
            dt = tx.txDate or tx.createdAt
            tipe = "Pemasukan" if tx.intent == "income" else "Pengeluaran"
            lines.append(f"- {dt.strftime('%Y-%m-%d')}: {tipe} Rp{tx.amount:,} [{tx.category}]")

        summary = "\n".join(lines) or "Tidak ada transaksi."
        prompt = build_expense_prediction_prompt(summary)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="expense_prediction")

        logger.info(f"Expense prediction for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in expense prediction: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_savings_opportunity(user_id: int) -> Dict:
    """#17 Savings Opportunity Finder — cari peluang hemat."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_savings_opportunity_prompt(summary)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="saving_recommendation")

        logger.info(f"Savings opportunity for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in savings opportunity: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_ai_chat(user_id: int, question: str) -> Dict:
    """#18 AI Financial Chat — tanya jawab keuangan."""
    try:
        summary = await _get_transaction_summary(user_id, days=30)
        prompt = build_ai_chat_prompt(summary, question)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="ai_chat", user_query=question)

        logger.info(f"AI chat for user {user_id}: q='{question[:50]}'")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in AI chat: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_weekly_strategy(user_id: int) -> Dict:
    """#20 Weekly Strategy Suggestion — strategi mingguan."""
    try:
        summary = await _get_transaction_summary(user_id, days=7)
        prompt = build_weekly_strategy_prompt(summary)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="weekly_strategy")

        logger.info(f"Weekly strategy for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Error in weekly strategy: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_post_transaction_insight(user_id: int, tx_text: str) -> Dict:
    """Auto-generate brief insight after a transaction is recorded."""
    try:
        summary = await _get_transaction_summary(user_id, days=1)
        prompt = build_post_transaction_insight_prompt(summary, tx_text)
        result = await _call_analysis_llm(prompt, user_id=user_id, feature="post_tx_insight", user_query=tx_text)

        logger.info(f"Post-transaction insight for user {user_id}")
        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"Post-transaction insight error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def get_smart_notification(user_id: int) -> Dict:
    """#19 Smart Notification — check spending thresholds and generate alerts."""
    try:
        now = datetime.now(timezone.utc)

        # Current week spending
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

        week_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "intent": "expense", "createdAt": {"gte": week_start}},
        )
        week_total = sum(tx.amount for tx in week_txs)

        # Average weekly spending (last 4 weeks)
        month_start = now - timedelta(days=28)
        month_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "intent": "expense", "createdAt": {"gte": month_start}},
        )
        month_total = sum(tx.amount for tx in month_txs)
        avg_weekly = month_total // 4 if month_txs else 0

        # Today's spending
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_txs = await prisma.transaction.find_many(
            where={"userId": user_id, "intent": "expense", "createdAt": {"gte": today_start}},
        )
        today_total = sum(tx.amount for tx in today_txs)

        # Calculate thresholds
        weekly_pct = int((week_total / avg_weekly * 100)) if avg_weekly > 0 else 0
        daily_avg = month_total // 28 if month_txs else 0
        daily_pct = int((today_total / daily_avg * 100)) if daily_avg > 0 else 0

        alerts = []

        if weekly_pct >= 80:
            alerts.append({
                "type": "weekly_threshold",
                "emoji": "📢",
                "message": f"Pengeluaran minggu ini sudah mencapai {weekly_pct}% dari rata-rata mingguanmu.",
                "current": week_total,
                "average": avg_weekly,
                "percentage": weekly_pct,
            })

        if daily_pct >= 150:
            alerts.append({
                "type": "daily_spike",
                "emoji": "⚠️",
                "message": f"Pengeluaran hari ini {daily_pct}% dari rata-rata harianmu.",
                "current": today_total,
                "average": daily_avg,
                "percentage": daily_pct,
            })

        # Check balance status
        balance = await _get_balance(user_id)
        if daily_avg > 0 and balance > 0:
            days_left = balance // daily_avg
            if days_left <= 7:
                alerts.append({
                    "type": "balance_warning",
                    "emoji": "🔴",
                    "message": f"Saldo kamu diperkirakan hanya cukup untuk {days_left} hari lagi.",
                    "balance": balance,
                    "days_left": days_left,
                })

        logger.info(f"Smart notification for user {user_id}: {len(alerts)} alerts")
        return {
            "success": True,
            "data": {
                "alerts": alerts,
                "has_alerts": len(alerts) > 0,
                "week_total": week_total,
                "avg_weekly": avg_weekly,
                "weekly_pct": weekly_pct,
                "today_total": today_total,
                "daily_avg": daily_avg,
            },
        }

    except Exception as e:
        logger.error(f"Error in smart notification: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
