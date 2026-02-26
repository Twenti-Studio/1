"""Transaction query service untuk history dan export."""

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Tuple, Optional

import pandas as pd
from prisma import Prisma
from prisma.models import Transaction

_logger = logging.getLogger(__name__)

EXPORTS_DIR = Path("exports")


def _get_period_range(period: str) -> Tuple[datetime, datetime, str]:
    """Hitung rentang waktu untuk periode tertentu."""
    now = datetime.now(timezone.utc)
    if period == "today":
        start = datetime(now.year, now.month, now.day)
        label = "harian (hari ini)"
    elif period == "week":
        start = now - timedelta(days=7)
        label = "mingguan (7 hari terakhir)"
    elif period == "month":
        start = now - timedelta(days=30)
        label = "bulanan (30 hari terakhir)"
    elif period == "year":
        start = now - timedelta(days=365)
        label = "tahunan (365 hari terakhir)"
    else:
        raise ValueError(f"Unknown period: {period}")
    return start, now, label


async def get_transactions_for_period(
    prisma: Prisma,
    user_id: int,
    period: str,
    direction: Optional[str] = None,
) -> Tuple[List[Transaction], str]:
    """Ambil transaksi user untuk periode yang diminta."""
    start, end, label = _get_period_range(period)

    where = {
        "userId": user_id,
        "createdAt": {"gte": start, "lte": end},
    }
    if direction in ("income", "expense"):
        where["intent"] = direction

    txs = await prisma.transaction.find_many(
        where=where,
        order={"createdAt": "asc"},
    )
    return txs, label


def build_history_summary(label: str, txs: List[Transaction]) -> str:
    """Buat ringkasan teks untuk history."""
    if not txs:
        return f"Tidak ada transaksi untuk periode {label}."

    income = sum(t.amount for t in txs if t.intent == "income")
    expense = sum(t.amount for t in txs if t.intent == "expense")
    count = len(txs)

    lines = [
        f"Ringkasan transaksi {label}:",
        f"━━━━━━━━━━━━━━━━━━━━━━━━",
        f"Jumlah transaksi: {count}",
        f"Total Pemasukan: Rp {income:,.0f}",
        f"Total Pengeluaran: Rp {expense:,.0f}",
        f"Net: Rp {income - expense:,.0f}",
        "",
    ]

    lines.append("Transaksi terakhir:")
    for tx in txs[-5:]:
        dt = tx.txDate or tx.createdAt
        date_str = dt.strftime("%Y-%m-%d")
        emoji = "+" if tx.intent == "income" else "-"
        lines.append(
            f"  {emoji} {date_str}: Rp {tx.amount:,.0f} [{tx.category}]"
        )

    return "\n".join(lines)


async def create_excel_report(
    prisma: Prisma,
    user_id: int,
    period: str,
) -> Tuple[Optional[str], Optional[str]]:
    """Generate file Excel untuk transaksi user."""
    txs, label = await get_transactions_for_period(prisma, user_id, period)
    if not txs:
        return None, None

    rows = []
    for tx in txs:
        dt = tx.txDate or tx.createdAt
        rows.append(
            {
                "Tanggal": dt.strftime("%Y-%m-%d %H:%M"),
                "Tipe": "Pemasukan" if tx.intent == "income" else "Pengeluaran",
                "Jumlah": tx.amount,
                "Kategori": tx.category,
                "Catatan": tx.note or "",
            }
        )

    df = pd.DataFrame(rows)

    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    file_name = f"finot_{user_id}_{period}_{timestamp}.xlsx"
    file_path = EXPORTS_DIR / file_name

    df.to_excel(file_path, index=False)
    _logger.info(f"Excel report generated: {file_path}")

    return str(file_path), file_name
