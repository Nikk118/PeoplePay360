import logging
from typing import Optional, Tuple
import resend
from app.config import settings

logger = logging.getLogger("peoplepay360.email")

ROLE_DISPLAY_NAMES = {
    "admin": "Administrator",
    "hr_payroll_manager": "HR Payroll Manager",
    "hr_payroll_user": "HR Payroll User",
    "hr_manager": "HR Manager",
    "employee": "Employee",
}

def send_invitation_email(
    to_email: str,
    invite_url: str,
    role: str,
    employee_name: Optional[str] = None,
    expires_in_hours: int = 24
) -> Tuple[bool, str]:
    """
    Sends an account activation invitation email to a newly invited user with a secure password setup link
    using the official Resend Python SDK.

    Returns (True, success_message) on success.
    Returns (False, safe_error_message) on failure or missing configuration.
    """
    if not settings.RESEND_API_KEY or not settings.RESEND_API_KEY.strip():
        err_msg = "Resend is not configured: RESEND_API_KEY is missing from environment."
        logger.error("Failed to send invitation to %s: %s", to_email, err_msg)
        return False, err_msg

    display_role = ROLE_DISPLAY_NAMES.get(role, role.replace("_", " ").title())
    greeting_name = employee_name if employee_name else to_email.split("@")[0].title()
    subject = "PeoplePay360 Account Activation"

    # Simplified, friendly plain-text version without spam/phishing trigger phrases
    text_content = f"""Hello {greeting_name},

You have been invited to join PeoplePay360 as {display_role}.

Please use the link below to activate your account and choose your password:
{invite_url}

This link is valid for {expires_in_hours} hours.

Best regards,
PeoplePay360 Team
"""

    # Simplified, Gmail-friendly HTML version with clean inline CSS and simple Activate Account button
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{subject}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e2e8f0;">
    <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 700;">PeoplePay360</h2>
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello <strong>{greeting_name}</strong>,</p>
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
      You have been invited to join PeoplePay360 as <strong>{display_role}</strong>. Please click the button below to activate your account and choose your password:
    </p>
    
    <div style="margin: 28px 0;">
      <a href="{invite_url}" style="background-color: #0284c7; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 6px; display: inline-block;">
        Activate Account
      </a>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
      This link is valid for {expires_in_hours} hours. If the button above does not work, copy and paste this link into your browser:
      <br>
      <a href="{invite_url}" style="color: #0284c7; word-break: break-all;">{invite_url}</a>
    </p>

    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">

    <p style="font-size: 12px; color: #94a3b8; margin: 0;">
      PeoplePay360 Operations
    </p>
  </div>
</body>
</html>
"""

    try:
        resend.api_key = settings.RESEND_API_KEY
        from_email = settings.RESEND_FROM_EMAIL or "PeoplePay360 <onboarding@resend.dev>"

        logger.info(
            "Dispatching invitation email via Resend: recipient=%s, from=%s, subject=%s",
            to_email, from_email, subject
        )

        params = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "text": text_content,
        }

        response = resend.Emails.send(params)
        email_id = response.get("id") if isinstance(response, dict) else getattr(response, "id", None)
        logger.info(
            "Resend accepted email: recipient=%s, from=%s, resend_id=%s",
            to_email, from_email, email_id
        )
        return True, f"Invitation email sent successfully via Resend (ID: {email_id})"
    except Exception as e:
        safe_error = str(e)
        logger.error(
            "Resend delivery failed: recipient=%s, from=%s, subject=%s, error=%s",
            to_email, from_email, subject, safe_error
        )
        return False, f"Resend email delivery failed: {safe_error}"
