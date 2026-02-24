"""Services untuk FiNot bot."""

from .media_service import (
    cleanup_old_files,
    download_telegram_media,
    get_mime_type,
)
from .receipt_service import (
    count_receipts_by_user,
    create_receipt,
    delete_receipt,
    get_latest_receipt,
    get_receipt_by_id,
    get_receipts_by_user,
)
from .user_service import (
    get_or_create_user,
    get_user_by_id,
    get_user_stats,
    update_user,
    user_exists,
)
from .transaction_services import (
    get_transactions_for_period,
    build_history_summary,
    create_excel_report,
)
from .subscription_service import (
    get_user_plan,
    check_ai_credits,
    consume_ai_credit,
    activate_subscription,
    get_subscription_status,
    check_feature_access,
)
from .payment_service import (
    create_payment_order,
    handle_trakteer_webhook,
    check_payment_status,
)

__all__ = [
    # Media
    "download_telegram_media",
    "get_mime_type",
    "cleanup_old_files",
    # Receipt
    "create_receipt",
    "get_receipt_by_id",
    "get_receipts_by_user",
    "delete_receipt",
    "count_receipts_by_user",
    "get_latest_receipt",
    # User
    "get_or_create_user",
    "update_user",
    "get_user_by_id",
    "user_exists",
    "get_user_stats",
    # Transaction
    "get_transactions_for_period",
    "build_history_summary",
    "create_excel_report",
    # Subscription & RBAC
    "get_user_plan",
    "check_ai_credits",
    "consume_ai_credit",
    "activate_subscription",
    "get_subscription_status",
    "check_feature_access",
    # Payment
    "create_payment_order",
    "handle_trakteer_webhook",
    "check_payment_status",
]
