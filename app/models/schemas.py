"""Pydantic schemas for FiNot."""

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, field_validator, Field
from .enums import IntentType, InputType


class LLMOutputSchema(BaseModel):
    intent: IntentType
    amount: int = Field(..., gt=0)
    currency: str = "IDR"
    date: Optional[str] = None
    category: str
    note: str
    confidence: float = Field(..., ge=0.0, le=1.0)

    @field_validator("date")
    def validate_date(cls, v):
        if v is None:
            return v
        # Allow flexible date formats
        if v.lower() in ("today", "yesterday", "hari ini", "kemarin"):
            return v
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            pass  # Allow ISO format too
        return v


class TransactionCreateSchema(BaseModel):
    user_id: int
    intent: IntentType
    amount: int = Field(..., gt=0)
    currency: str = "IDR"
    tx_date: Optional[datetime] = None
    category: str
    note: Optional[str] = None
    needs_review: bool = False
    llm_response_id: Optional[int] = None
    receipt_id: Optional[int] = None
    extra: Optional[Dict[str, Any]] = None


class TransactionResponseSchema(TransactionCreateSchema):
    id: int
    created_at: datetime


class SubscriptionSchema(BaseModel):
    plan: str
    plan_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days_left: Optional[int] = None
    is_active: bool = False


class CreditStatusSchema(BaseModel):
    has_credits: bool
    remaining: int
    total: int
    plan: str
