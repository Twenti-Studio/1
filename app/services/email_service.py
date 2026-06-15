"""Email delivery for magic links (email verification & password reset).

Uses plain SMTP (Gmail by default). Configure via env:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, APP_BASE_URL

Sending runs in a thread so it never blocks the async event loop.
"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from app import config

_logger = logging.getLogger(__name__)

BRAND_NAVY = "#123a73"
BRAND_ORANGE = "#F5841F"


def _send_sync(to_email: str, subject: str, html: str, text: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = config.SMTP_FROM or config.SMTP_USER
    msg["To"] = to_email
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.login(config.SMTP_USER, config.SMTP_PASSWORD)
        server.send_message(msg)


async def send_email(to_email: str, subject: str, html: str, text: str) -> bool:
    """Send an email. Returns True on success, False otherwise (never raises)."""
    if not config.EMAIL_ENABLED:
        _logger.warning("Email not configured (SMTP_USER/SMTP_PASSWORD missing); skipping send to %s", to_email)
        return False
    try:
        await asyncio.to_thread(_send_sync, to_email, subject, html, text)
        _logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception as exc:  # noqa: BLE001
        _logger.error("Failed to send email to %s: %s", to_email, exc, exc_info=True)
        return False


def _button_email(title: str, intro: str, button_label: str, link: str, footer: str) -> tuple[str, str]:
    """Build (html, text) for a simple branded magic-link email."""
    html = f"""\
<!doctype html>
<html><body style="margin:0;background:#f0f2f5;padding:24px;font-family:Inter,Arial,sans-serif;color:#101a35;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid rgba(18,58,115,0.12);overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <div style="font-size:20px;font-weight:700;color:{BRAND_NAVY};">FiNot</div>
        </td></tr>
        <tr><td style="padding:8px 32px 0;">
          <h1 style="font-size:20px;margin:8px 0 4px;color:#101a35;">{title}</h1>
          <p style="font-size:14px;line-height:1.6;color:#5b667a;margin:0 0 20px;">{intro}</p>
          <a href="{link}" style="display:inline-block;background:{BRAND_ORANGE};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;">{button_label}</a>
          <p style="font-size:12px;line-height:1.6;color:#5b667a;margin:20px 0 0;">
            Atau salin tautan ini ke browser:<br>
            <a href="{link}" style="color:{BRAND_NAVY};word-break:break-all;">{link}</a>
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;">
          <hr style="border:none;border-top:1px solid rgba(18,58,115,0.12);margin:0 0 12px;">
          <p style="font-size:11px;line-height:1.6;color:#94a3b8;margin:0;">{footer}</p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#94a3b8;margin:16px 0 0;">© 2026 FiNot — Twenti Studio</p>
    </td></tr>
  </table>
</body></html>"""
    text = f"{title}\n\n{intro}\n\n{button_label}: {link}\n\n{footer}\n\n— FiNot"
    return html, text


async def send_verification_email(to_email: str, link: str) -> bool:
    html, text = _button_email(
        title="Verifikasi email kamu",
        intro="Satu langkah lagi untuk mengaktifkan akun FiNot. Klik tombol di bawah untuk memverifikasi email dan melengkapi data diri.",
        button_label="Verifikasi & lanjutkan",
        link=link,
        footer="Tautan ini berlaku 30 menit dan hanya bisa dipakai sekali. Kalau kamu tidak mendaftar di FiNot, abaikan email ini.",
    )
    return await send_email(to_email, "Verifikasi email FiNot kamu", html, text)


async def send_password_reset_email(to_email: str, link: str) -> bool:
    html, text = _button_email(
        title="Atur ulang password",
        intro="Kami menerima permintaan untuk mengatur ulang password FiNot kamu. Klik tombol di bawah untuk membuat password baru.",
        button_label="Buat password baru",
        link=link,
        footer="Tautan ini berlaku 30 menit dan hanya bisa dipakai sekali. Kalau kamu tidak meminta ini, abaikan email ini — password kamu tidak berubah.",
    )
    return await send_email(to_email, "Atur ulang password FiNot", html, text)
