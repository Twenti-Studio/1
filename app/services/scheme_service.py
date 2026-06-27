"""
FiNot Budget Scheme Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lets a user define spending "schemes" (budgets) in natural language and warns
them once spending in the linked categories crosses a threshold (default 70%).

Used by both transports:
  • the web chat pipeline  (app/services/chat_service.py)
  • the Telegram webhook    (app/webhook/telegram.py)

A scheme is remembered in the `budget_schemes` table. After every recorded
transaction we re-check the active schemes and emit a warning the first time the
threshold is crossed within the current period (anti-spam via `lastAlertAt`).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.db.connection import prisma

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────
# Formatting helpers
# ──────────────────────────────────────────────────────────

def _fmt_amount(amount: int) -> str:
    return f"Rp{int(amount):,}".replace(",", ".")


# ──────────────────────────────────────────────────────────
# Natural-language parsing
# ──────────────────────────────────────────────────────────

# EXPLICIT command to create/set a budget scheme — a "set verb" + a budget noun,
# or the standalone verb "batasi". We deliberately do NOT match a bare "budget"
# or "skema", so advisory questions like "gimana cara atur budget makan?" are
# left to the AI instead of silently creating a scheme.
_COMMAND_RE = re.compile(
    r"\b(?:set|atur|buat|bikin|simpan|tetapkan|pasang|tambah(?:kan)?)\s+"
    r"(?:skema|budget|anggaran|limit|batas(?:an)?)\b"
    r"|\bbatasi\b",
    re.IGNORECASE,
)

# Strong question / advice markers. If present, the user wants guidance, not a
# scheme — let the AI answer flexibly.
_QUESTION_RE = re.compile(
    r"\?|\b(gimana|gmn|gmana|bagaimana|cara|caranya|tips|saran|sarankan|"
    r"rekomendasi|rekomendasiin|apakah|kenapa|mengapa|sebaiknya|enaknya|"
    r"baiknya|menurut|haruskah|bisakah|bantu\s+aku|tolong\s+jelas)\b",
    re.IGNORECASE,
)

# Amount token, e.g. "500rb", "1,5jt", "300 ribu", "500.000", "2juta", "750k".
_AMOUNT_RE = re.compile(
    r"(\d[\d.,]*)\s*(jt|juta|m|rb|ribu|k)?",
    re.IGNORECASE,
)

_FILLER_RE = re.compile(
    r"\b(untuk|buat|sebesar|maksimal|maks|max|adalah|per|setiap|sebulan|"
    r"sebulannya|perbulan|bulanan|seminggu|mingguan|pekan|dengan|yaitu|"
    r"yakni|kira|kira-kira|aja|saja|dong|ya)\b",
    re.IGNORECASE,
)


def _parse_amount_token(num: str, unit: Optional[str]) -> int:
    """Convert a number + Indonesian magnitude suffix into an integer rupiah value."""
    unit = (unit or "").lower()
    raw = num.strip()
    if unit in ("jt", "juta", "m"):
        # decimals are meaningful here: "1,5jt" -> 1_500_000
        val = float(raw.replace(".", "").replace(",", "."))
        return int(round(val * 1_000_000))
    if unit in ("rb", "ribu", "k"):
        val = float(raw.replace(".", "").replace(",", "."))
        return int(round(val * 1_000))
    # plain number: dots/commas are thousands separators
    digits = re.sub(r"[^\d]", "", raw)
    return int(digits) if digits else 0


def parse_scheme_from_text(text: str) -> Optional[Dict[str, Any]]:
    """
    Detect a "set budget scheme" instruction in free text.

    Returns a dict {name, categories, limit, period, threshold} ONLY when the
    message is an explicit command to save a scheme with a money amount.
    Advisory questions ("gimana cara atur budget makan 500rb?") return None so
    the AI can answer them flexibly.

    Examples that match:
      • "set skema nongkrong 500rb"
      • "atur budget makan, rokok, kopi, transport 500rb per bulan"
      • "batasi jajan 1jt sebulan, ingatkan di 80%"
    """
    if not text:
        return None

    # Advisory / question phrasing → not a command, let the AI handle it.
    if _QUESTION_RE.search(text):
        return None

    command = _COMMAND_RE.search(text)
    if not command:
        return None

    # Find the first money amount after the command keyword.
    amount = 0
    amount_span: Optional[tuple] = None
    for m in _AMOUNT_RE.finditer(text):
        if m.start() < command.end():
            continue
        # Skip a number that is actually a "70%" threshold.
        if text[m.end():m.end() + 1] == "%":
            continue
        candidate = _parse_amount_token(m.group(1), m.group(2))
        if candidate >= 1000:  # a real budget, not a stray digit
            amount = candidate
            amount_span = m.span()
            break

    if amount <= 0:
        return None

    # Threshold override: "ingatkan di 80%" / "peringatan 80%"
    threshold = 70
    th = re.search(r"(\d{1,3})\s*%", text)
    if th:
        try:
            val = int(th.group(1))
            if 1 <= val <= 100:
                threshold = val
        except ValueError:
            pass

    # Period
    period = "weekly" if re.search(r"\b(minggu|mingguan|pekan|per\s*minggu)\b", text, re.IGNORECASE) else "monthly"

    # Category phrase: prefer an explicit "untuk/buat <...>" clause (often lists
    # several categories), else the words between the command and the amount.
    m_for = re.search(r"\b(?:untuk|buat)\s+(.+)", text, re.IGNORECASE)
    if m_for:
        phrase = m_for.group(1)
    elif amount_span and amount_span[0] > command.end():
        phrase = text[command.end():amount_span[0]]
    else:
        phrase = text[command.end():]

    # Strip amounts, percentages and filler words from the phrase.
    phrase = re.sub(r"\d[\d.,]*\s*(jt|juta|m|rb|ribu|k)?", " ", phrase, flags=re.IGNORECASE)
    phrase = re.sub(r"\d+\s*%", " ", phrase)
    phrase = _FILLER_RE.sub(" ", phrase)
    phrase = re.sub(r"[^\wÀ-ÿ\s,&]", " ", phrase)

    categories = [
        c.strip()
        for c in re.split(r"[\s,&]+|\bdan\b", phrase.lower())
        if c.strip() and len(c.strip()) >= 2
    ]
    if not categories:
        return None

    # Human-friendly name from the categories (capped for display/storage).
    name = " & ".join(c.title() for c in categories)[:40].strip(" &")
    if not name:
        return None

    return {
        "name": name,
        "categories": categories,
        "limit": amount,
        "period": period,
        "threshold": threshold,
    }


# Words that mark a budget-planning context (used only for the soft hint, NOT to
# auto-create a scheme).
_BUDGET_CONTEXT_RE = re.compile(
    r"\b(budget|anggaran|skema|planning|plan|rencana|atur\s+keuangan|kelola|alokasi|jatah|hemat)\b",
    re.IGNORECASE,
)


def _amount_shorthand(amount: int) -> str:
    if amount % 1_000_000 == 0:
        return f"{amount // 1_000_000}jt"
    if amount % 1_000 == 0:
        return f"{amount // 1_000}rb"
    return str(amount)


def suggest_scheme_command(text: str) -> Optional[str]:
    """
    For an advisory budget question (where we deliberately did NOT create a
    scheme), build a ready-to-send "set skema <kategori> <jumlah>" command the
    user can copy/tap to turn the advice into an auto-reminding scheme.

    Returns None when the message isn't budget-planning with categories + amount.
    """
    if not text or not _BUDGET_CONTEXT_RE.search(text):
        return None

    amount = 0
    for m in _AMOUNT_RE.finditer(text):
        if text[m.end():m.end() + 1] == "%":
            continue
        candidate = _parse_amount_token(m.group(1), m.group(2))
        if candidate >= 1000:
            amount = candidate
            break
    if amount <= 0:
        return None

    m_for = re.search(r"\b(?:untuk|buat)\s+(.+)", text, re.IGNORECASE)
    if not m_for:
        return None
    phrase = m_for.group(1)
    phrase = re.sub(r"\d[\d.,]*\s*(jt|juta|m|rb|ribu|k)?", " ", phrase, flags=re.IGNORECASE)
    phrase = re.sub(r"\d+\s*%", " ", phrase)
    phrase = _FILLER_RE.sub(" ", phrase)
    phrase = re.sub(r"[^\wÀ-ÿ\s,&]", " ", phrase)
    categories = [
        c.strip()
        for c in re.split(r"[\s,&]+|\bdan\b", phrase.lower())
        if c.strip() and len(c.strip()) >= 2
    ]
    if not categories:
        return None

    return f"set skema {','.join(categories)} {_amount_shorthand(amount)}"


# ──────────────────────────────────────────────────────────
# CRUD
# ──────────────────────────────────────────────────────────

async def list_schemes(user_id: int) -> List[Any]:
    return await prisma.budgetscheme.find_many(
        where={"userId": user_id, "isActive": True},
        order={"createdAt": "desc"},
    )


async def create_scheme(
    user_id: int,
    name: str,
    categories: List[str],
    limit: int,
    period: str = "monthly",
    threshold: int = 70,
) -> Any:
    """Create or replace a scheme with the same name for this user."""
    existing = await prisma.budgetscheme.find_first(
        where={"userId": user_id, "name": name, "isActive": True}
    )
    data = {
        "categories": categories,
        "limit": int(limit),
        "period": period,
        "threshold": int(threshold),
        "lastAlertAt": None,
    }
    if existing:
        return await prisma.budgetscheme.update(where={"id": existing.id}, data=data)
    return await prisma.budgetscheme.create(
        data={"userId": user_id, "name": name, **data}
    )


async def delete_scheme(user_id: int, scheme_id: int) -> int:
    return await prisma.budgetscheme.delete_many(
        where={"id": scheme_id, "userId": user_id}
    )


def format_scheme_confirmation(scheme: Dict[str, Any]) -> str:
    period_label = "minggu" if scheme["period"] == "weekly" else "bulan"
    return (
        f"<b>Skema tersimpan: {scheme['name']}</b>\n"
        f"Budget: <b>{_fmt_amount(scheme['limit'])}/{period_label}</b>\n"
        f"Peringatan otomatis saat pemakaian mencapai <b>{scheme['threshold']}%</b>.\n\n"
        f"<i>Saya akan ingatkan kamu kalau pengeluaran "
        f"{', '.join(scheme['categories'])} mendekati batas ini.</i>"
    )


# ──────────────────────────────────────────────────────────
# Threshold checking
# ──────────────────────────────────────────────────────────

def _period_start(period: str, now: datetime) -> datetime:
    if period == "weekly":
        start = now - _td(days=now.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _td(**kw):
    from datetime import timedelta
    return timedelta(**kw)


def _matches(scheme_categories: List[str], tx_category: str, tx_note: str) -> bool:
    """Flexible match: any scheme keyword appears in the tx category or note."""
    hay = f"{(tx_category or '').lower()} {(tx_note or '').lower()}"
    for kw in scheme_categories:
        kw = (kw or "").lower().strip()
        if kw and kw in hay:
            return True
    return False


async def check_schemes_after_expense(user_id: int) -> List[Dict[str, Any]]:
    """
    Re-evaluate every active scheme for the user and return warnings for the ones
    that have just crossed their threshold (and weren't already alerted this period).

    Each returned alert: {scheme_id, name, spent, limit, pct, message}
    """
    schemes = await list_schemes(user_id)
    if not schemes:
        return []

    now = datetime.now(timezone.utc)
    alerts: List[Dict[str, Any]] = []

    for scheme in schemes:
        period = scheme.period or "monthly"
        start = _period_start(period, now)

        # Pull this period's expenses once per scheme period boundary.
        txs = await prisma.transaction.find_many(
            where={
                "userId": user_id,
                "intent": "expense",
                "createdAt": {"gte": start},
            },
        )
        cats = scheme.categories or []
        spent = sum(
            int(tx.amount or 0)
            for tx in txs
            if _matches(cats, getattr(tx, "category", ""), getattr(tx, "note", "") or "")
        )

        if scheme.limit <= 0:
            continue
        pct = int(spent / scheme.limit * 100)
        if pct < (scheme.threshold or 70):
            continue

        # Anti-spam: only warn once per period (re-arm when a new period starts).
        if scheme.lastAlertAt is not None:
            last = scheme.lastAlertAt
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if last >= start:
                continue

        remaining = max(scheme.limit - spent, 0)
        over = spent > scheme.limit
        period_label = "minggu ini" if period == "weekly" else "bulan ini"
        if over:
            message = (
                f"🔴 <b>Budget terlampaui: {scheme.name}</b>\n"
                f"Pengeluaran {period_label} <b>{_fmt_amount(spent)}</b> sudah "
                f"melewati batas <b>{_fmt_amount(scheme.limit)}</b> ({pct}%)."
            )
        else:
            message = (
                f"⚠️ <b>Peringatan Budget: {scheme.name}</b>\n"
                f"Kamu sudah pakai <b>{_fmt_amount(spent)}</b> dari "
                f"<b>{_fmt_amount(scheme.limit)}</b> ({pct}%) {period_label}.\n"
                f"Sisa <b>{_fmt_amount(remaining)}</b>."
            )

        # Mark as alerted for this period.
        try:
            await prisma.budgetscheme.update(
                where={"id": scheme.id}, data={"lastAlertAt": now}
            )
        except Exception as e:  # pragma: no cover - best effort
            logger.warning(f"Failed to stamp lastAlertAt for scheme {scheme.id}: {e}")

        alerts.append({
            "scheme_id": scheme.id,
            "name": scheme.name,
            "spent": spent,
            "limit": scheme.limit,
            "pct": pct,
            "message": message,
        })

    return alerts
