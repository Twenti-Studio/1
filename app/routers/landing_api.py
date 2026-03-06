"""
Landing Page API Endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━
Handles payment creation and status checking for the web landing page.
Uses the same Trakteer QRIS payment flow as the Telegram bot.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db.connection import prisma
from app.config import TRAKTEER_PAGE_URL, PLAN_CONFIG
from app.services.payment_service import create_payment_order, check_payment_status, get_cached_credentials

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/landing", tags=["landing"])


class PaymentCreateRequest(BaseModel):
    plan: str  # pro | elite
    contact_type: str  # telegram | whatsapp
    contact_value: str  # @username or phone number
    name: Optional[str] = None  # subscriber's name


class PaymentCreateResponse(BaseModel):
    success: bool
    payment_id: Optional[int] = None
    transaction_id: Optional[str] = None
    plan: Optional[str] = None
    amount: Optional[int] = None
    trakteer_url: Optional[str] = None
    qris_url: Optional[str] = None
    error: Optional[str] = None


@router.post("/payment/create")
async def create_landing_payment(req: PaymentCreateRequest):
    """
    Create a payment order from the landing page.
    Stores contact info and creates a payment via the same flow as Telegram.
    """
    try:
        # Validate plan
        if req.plan not in ("pro", "elite"):
            return JSONResponse({"success": False, "error": "Plan tidak valid"})

        if not req.contact_value.strip():
            return JSONResponse({"success": False, "error": "Harap isi kontak"})

        # Normalise contact
        contact_value = req.contact_value.strip()
        if req.contact_type == "telegram" and not contact_value.startswith("@"):
            contact_value = "@" + contact_value

        # Try to find existing user by username, or create a placeholder
        # For web payments, we create a temporary user entry with a negative ID
        # The user will be matched when they interact with the bot later
        user = None

        if req.contact_type == "telegram":
            # Try to find by telegram username
            user = await prisma.user.find_first(
                where={"username": contact_value.lstrip("@")}
            )

        if not user:
            # Create a placeholder record with the contact info stored
            import hashlib as _hl
            hash_val = int(_hl.sha256(contact_value.encode()).hexdigest()[:12], 16)
            placeholder_id = -(hash_val % (10**10))  # Negative ID to distinguish web users

            # Check if placeholder already exists
            user = await prisma.user.find_unique(where={"id": placeholder_id})
            if not user:
                user_display = req.name.strip() if req.name and req.name.strip() else contact_value
                user = await prisma.user.create(
                    data={
                        "id": placeholder_id,
                        "username": contact_value.lstrip("@"),
                        "displayName": user_display,
                        "plan": "free",
                    }
                )
            elif req.name and req.name.strip():
                # Update display name if provided
                await prisma.user.update(
                    where={"id": placeholder_id},
                    data={"displayName": req.name.strip()},
                )

        # Create payment order (same flow as Telegram)
        result = await create_payment_order(
            user_id=user.id,
            plan=req.plan,
        )

        plan_config = PLAN_CONFIG[req.plan]

        # Build Trakteer payment URL with correct quantity and message
        trakteer_url = TRAKTEER_PAGE_URL
        if trakteer_url and result.get("transaction_id"):
            tx_id = result["transaction_id"]
            trakteer_qty = plan_config["price"] // 1000  # Pro=19, Elite=49
            trakteer_url = (
                f"{trakteer_url}"
                f"?quantity={trakteer_qty}"
                f"&message=FiNot-{req.plan.upper()}-{tx_id}"
            )

        return JSONResponse({
            "success": True,
            "payment_id": result["payment_id"],
            "transaction_id": result["transaction_id"],
            "plan": req.plan,
            "plan_name": plan_config["name"],
            "amount": plan_config["price"],
            "trakteer_url": trakteer_url,
        })

    except Exception as e:
        _logger.error(f"Error creating landing payment: {e}", exc_info=True)
        return JSONResponse({"success": False, "error": "Terjadi kesalahan, silakan coba lagi"})


@router.get("/payment/status/{payment_id}")
async def get_landing_payment_status(payment_id: int):
    """Check payment status — polled by the frontend."""
    try:
        result = await check_payment_status(payment_id)

        if not result.get("found"):
            return JSONResponse({"status": "not_found"})

        resp = {
            "status": result["status"],
            "plan": result.get("plan"),
            "amount": result.get("amount"),
        }
        if result.get("credentials"):
            resp["credentials"] = result["credentials"]

        return JSONResponse(resp)

    except Exception as e:
        _logger.error(f"Error checking payment status: {e}", exc_info=True)
        return JSONResponse({"status": "error"})


@router.get("/plans")
async def get_plans():
    """Return available plans and pricing for the frontend."""
    plans = []
    for key in ("free", "pro", "elite"):
        cfg = PLAN_CONFIG[key]
        plans.append({
            "key": key,
            "name": cfg["name"],
            "price": cfg["price"],
            "features": cfg["features"],
        })
    return JSONResponse({"plans": plans})


# ─── Legal Documents (public read) ─────────────────────────

# Default content seeded on first access
_DEFAULT_LEGAL = {
    "terms-of-service": {
        "title": "Terms of Service",
        "content": """\
# Terms of Service

Last updated: March 2026

Welcome to FiNot.

These Terms of Service ("Terms") govern your use of FiNot services, including our web application, messaging integrations (such as Telegram, WhatsApp, and LINE bots), and related features (collectively referred to as the "Service").

By accessing or using FiNot, you agree to be bound by these Terms.

If you do not agree with these Terms, you may not use the Service.

---

## 1. Description of the Service

FiNot is a digital financial tracking platform that allows users to record, organize, and analyze financial transactions through various interfaces, including:

* Web applications
* Messaging bots (Telegram, WhatsApp, LINE)
* Other supported integrations

FiNot may also provide AI-powered features such as financial summaries, categorization, and insights.

FiNot is a **personal finance management tool** and does not provide financial, legal, or investment advice.

---

## 2. User Accounts

To use certain features of the Service, you may be required to create or connect an account.

You agree to:

* Provide accurate information when registering
* Maintain the security of your account credentials
* Be responsible for all activities under your account

FiNot is not responsible for unauthorized access resulting from your failure to protect account information.

---

## 3. User Responsibilities

You agree not to use FiNot for:

* Illegal financial activities
* Fraudulent transactions
* Money laundering or deceptive practices
* Uploading harmful, abusive, or malicious content
* Attempting to disrupt or exploit the platform

FiNot reserves the right to suspend or terminate accounts that violate these terms.

---

## 4. User Content

Users may submit content to the Service including:

* Transaction data
* Text inputs
* Audio messages
* Uploaded files

You retain ownership of the content you submit.

However, by submitting content to FiNot, you grant FiNot a limited license to process, store, and analyze that content solely for the purpose of providing the Service.

---

## 5. Messaging Platform Integrations

FiNot may operate through third-party messaging platforms including:

* Telegram
* WhatsApp
* LINE

By interacting with FiNot through these platforms, you acknowledge that your messages will be processed by FiNot systems to provide financial tracking functionality.

FiNot only processes messages that are directly sent to its bots or services.

---

## 6. AI Features

FiNot may use artificial intelligence to process user inputs and generate financial summaries, insights, or suggestions.

AI-generated outputs are intended for informational purposes only and should not be considered professional financial advice.

Users are responsible for verifying financial decisions independently.

---

## 7. Service Availability

FiNot strives to maintain reliable service but does not guarantee uninterrupted availability.

We may:

* Update the platform
* Modify features
* Temporarily suspend services for maintenance

without prior notice.

---

## 8. Data and Privacy

Your use of FiNot is also governed by our Privacy Policy, which explains how we collect and use your information.

By using the Service, you agree to the practices described in the Privacy Policy.

---

## 9. Limitation of Liability

FiNot is provided "as is" without warranties of any kind.

To the fullest extent permitted by law, FiNot shall not be liable for:

* Financial losses resulting from the use of the Service
* Inaccurate AI-generated insights
* Data loss caused by external services or infrastructure failures

Users are responsible for reviewing and verifying financial records.

---

## 10. Account Termination

We may suspend or terminate your access to the Service if:

* You violate these Terms
* Your usage threatens system security
* Required by law

Users may request account deletion at any time.

---

## 11. Changes to the Terms

We may update these Terms periodically.

Updated versions will be posted on the FiNot website with a revised date.

Continued use of the Service after changes indicates acceptance of the updated Terms.

---

## 12. Governing Law

These Terms shall be governed by and interpreted in accordance with the laws applicable in the jurisdiction where FiNot operates.

---

## 13. Contact

If you have any questions regarding these Terms, please contact:

Email: twentistudio@gmail.com
Website: https://finot.twenti.studio
""",
    },
    "privacy-policy": {
        "title": "Privacy Policy",
        "content": """\
# Privacy Policy

Last updated: March 2026

FiNot ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use FiNot services, including our web application, Telegram bot, WhatsApp integration, LINE bot, and other related services.

By using FiNot, you agree to the collection and use of information in accordance with this policy.

---

## 1. Information We Collect

We collect several types of information in order to provide and improve our services.

### 1.1 Account Information

When you create or connect an account, we may collect:

* Name or username
* Email address
* Platform identifier (Telegram ID, WhatsApp number, LINE ID, or other messaging platform identifiers)

### 1.2 Financial Records Provided by Users

FiNot stores financial data that you voluntarily provide, such as:

* Transaction descriptions
* Transaction amounts
* Categories of expenses or income
* Notes or financial details submitted through chat or web forms

### 1.3 User Content

You may submit content in the form of:

* Text messages
* Voice recordings
* Uploaded images or files

These inputs may be processed by AI models to generate financial insights, summaries, or recommendations.

### 1.4 Technical Information

We may automatically collect technical information such as:

* IP address
* Device type
* Browser type
* Operating system
* Usage activity within the platform

---

## 2. How We Use Your Information

We use your information to:

* Provide and operate FiNot services
* Record and manage financial transactions submitted by users
* Generate summaries, analytics, and financial insights
* Improve AI-powered features and automation
* Maintain service security and prevent abuse
* Provide customer support

Your financial data is used **only to deliver the service requested by you**.

---

## 3. Data from Messaging Platforms

FiNot may receive messages and inputs from external platforms such as:

* Telegram
* WhatsApp
* LINE

Data received through these platforms is **only processed when users actively send information to FiNot bots or services**.

FiNot **does not access private messages outside interactions with FiNot services**.

---

## 4. AI Processing

Some user inputs may be processed using artificial intelligence technologies to provide:

* Financial summaries
* Expense categorization
* Insights and recommendations

AI processing is performed only for the purpose of improving user experience and delivering requested features.

---

## 5. Data Storage and Security

We implement reasonable security measures to protect your data, including:

* Encrypted connections (HTTPS)
* Secure server infrastructure
* Restricted access to internal systems

However, no method of transmission over the internet is completely secure.

---

## 6. Data Sharing

We do not sell your personal data.

We may share limited information only with:

* Infrastructure providers (such as hosting or cloud services)
* Messaging platform APIs required for bot functionality
* Legal authorities if required by law

---

## 7. Data Retention

We retain user data for as long as necessary to provide our services.

Users may request deletion of their account and associated data at any time.

---

## 8. Your Rights

Depending on your jurisdiction, you may have rights to:

* Access your data
* Request correction of inaccurate data
* Request deletion of your data
* Withdraw consent for data processing

Requests can be submitted through our support contact.

---

## 9. Third-Party Services

FiNot may rely on third-party services such as:

* Cloud hosting providers
* Messaging platform APIs
* AI processing services

These providers may process data according to their own privacy policies.

---

## 10. Children's Privacy

FiNot services are not intended for users under the age of 13. We do not knowingly collect personal information from children.

---

## 11. Updates to This Policy

We may update this Privacy Policy from time to time. Updates will be posted on this page with the revised date.

---

## 12. Contact

If you have any questions about this Privacy Policy, please contact us:

Email: twentistudio@gmail.com
Website: https://finot.twenti.studio
""",
    },
}


async def _get_or_seed_legal(slug: str):
    """Return legal document from DB, seeding default content if missing."""
    doc = await prisma.legaldocument.find_unique(where={"slug": slug})
    if doc:
        return doc

    defaults = _DEFAULT_LEGAL.get(slug)
    if not defaults:
        return None

    doc = await prisma.legaldocument.create(
        data={"slug": slug, "title": defaults["title"], "content": defaults["content"]}
    )
    return doc


@router.get("/legal/{slug}")
async def get_legal_document(slug: str):
    """Public endpoint — returns ToS or Privacy Policy content."""
    if slug not in ("terms-of-service", "privacy-policy"):
        raise HTTPException(status_code=404, detail="Document not found")

    doc = await _get_or_seed_legal(slug)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "slug": doc.slug,
        "title": doc.title,
        "content": doc.content,
        "updated_at": doc.updatedAt.isoformat(),
    }


# ─── Public Site Settings ──────────────────────────────────

@router.get("/settings")
async def get_public_settings():
    """Return public-facing site settings so the frontend knows what's enabled."""
    import json as _json

    rows = await prisma.sitesettings.find_many()
    settings = {r.key: _json.loads(r.value) for r in rows}

    # Only expose safe public keys
    public_keys = {
        "payment_enabled", "registration_enabled", "trial_enabled",
        "legal_tos_enabled", "legal_privacy_enabled",
        "web_dashboard_enabled", "maintenance_mode",
    }
    return {k: settings.get(k, True) for k in public_keys}
