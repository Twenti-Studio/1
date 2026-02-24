from enum import Enum


class IntentType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class InputType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"


class MessageSource(str, Enum):
    TELEGRAM = "telegram"


class PlanType(str, Enum):
    FREE = "free"
    PRO = "pro"
    ELITE = "elite"
