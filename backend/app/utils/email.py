"""
Email utility for sending OTP verification emails
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime


def _is_truthy(value: str) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def send_otp_email(recipient_email: str, otp_code: str, full_name: str) -> bool:
    """
    Send OTP verification email to the user
    
    Args:
        recipient_email: Email address of the recipient
        otp_code: 6-digit OTP code
        full_name: User's full name
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    # Get email configuration from environment variables
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = os.getenv("SMTP_PORT", "587")
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SENDER_EMAIL = os.getenv("SENDER_EMAIL") or os.getenv("SMTP_FROM") or SMTP_USER
    SENDER_NAME = os.getenv("SENDER_NAME", "Quizify")
    SMTP_SECURE = os.getenv("SMTP_SECURE", "")
    
    # Check if SMTP is configured
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        print(
            "⚠️ SMTP not configured. "
            f"host_set={bool(SMTP_HOST)} user_set={bool(SMTP_USER)} password_set={bool(SMTP_PASSWORD)}. "
            f"OTP for {recipient_email}: {otp_code}"
        )
        # For development: print OTP to console
        return False
    
    try:
        # Create email message
        message = MIMEMultipart("alternative")
        message["Subject"] = "Verify your email - Quizify OTP"
        message["From"] = f"{SENDER_NAME} <{SENDER_EMAIL}>"
        message["To"] = recipient_email
        
        # Plain text version
        text_content = f"""
Hi {full_name},

Your verification code is: {otp_code}

This code will expire in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
Quizify Team
"""
        
        # HTML version
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .otp-box {{ background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }}
        .otp-code {{ font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 8px; }}
        .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Quizify</h1>
        </div>
        <div class="content">
            <h2>Email Verification</h2>
            <p>Hi {full_name},</p>
            <p>Thank you for signing up! Please verify your email address by entering the code below:</p>
            
            <div class="otp-box">
                <div class="otp-code">{otp_code}</div>
            </div>
            
            <p><strong>This code will expire in 10 minutes.</strong></p>
            
            <p>If you didn't create an account, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>© {datetime.now().year} Quizify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
        
        # Attach both versions
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        message.attach(part1)
        message.attach(part2)
        
        # Send email
        port = int(SMTP_PORT)
        force_ssl = _is_truthy(SMTP_SECURE) or port == 465
        timeout = float(os.getenv("SMTP_TIMEOUT_SECONDS", "15"))

        if force_ssl:
            with smtplib.SMTP_SSL(SMTP_HOST, port, timeout=timeout) as server:
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SENDER_EMAIL, recipient_email, message.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, port, timeout=timeout) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SENDER_EMAIL, recipient_email, message.as_string())
        
        print(f"✅ OTP email sent to {recipient_email}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send OTP email to {recipient_email}: {str(e)}")
        # For development: still return False but log the error
        return False


def send_password_reset_email(recipient_email: str, otp_code: str, full_name: str) -> bool:
    """
    Send password reset OTP email to the user.
    """
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = os.getenv("SMTP_PORT", "587")
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SENDER_EMAIL = os.getenv("SENDER_EMAIL") or os.getenv("SMTP_FROM") or SMTP_USER
    SENDER_NAME = os.getenv("SENDER_NAME", "Quizify")
    SMTP_SECURE = os.getenv("SMTP_SECURE", "")

    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        print(
            "⚠️ SMTP not configured. "
            f"host_set={bool(SMTP_HOST)} user_set={bool(SMTP_USER)} password_set={bool(SMTP_PASSWORD)}. "
            f"Password reset OTP for {recipient_email}: {otp_code}"
        )
        return False

    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = "Reset your password - Quizify OTP"
        message["From"] = f"{SENDER_NAME} <{SENDER_EMAIL}>"
        message["To"] = recipient_email

        text_content = f"""
Hi {full_name},

Your password reset verification code is: {otp_code}

This code will expire in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
Quizify Team
"""

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .otp-box {{ background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }}
        .otp-code {{ font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 8px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>Quizify</h1></div>
        <div class="content">
            <h2>Password Reset</h2>
            <p>Hi {full_name},</p>
            <p>Use the verification code below to reset your password:</p>
            <div class="otp-box"><div class="otp-code">{otp_code}</div></div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
        </div>
    </div>
</body>
</html>
"""

        message.attach(MIMEText(text_content, "plain"))
        message.attach(MIMEText(html_content, "html"))

        port = int(SMTP_PORT)
        force_ssl = _is_truthy(SMTP_SECURE) or port == 465
        timeout = float(os.getenv("SMTP_TIMEOUT_SECONDS", "15"))

        if force_ssl:
            with smtplib.SMTP_SSL(SMTP_HOST, port, timeout=timeout) as server:
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SENDER_EMAIL, recipient_email, message.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, port, timeout=timeout) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SENDER_EMAIL, recipient_email, message.as_string())

        print(f"✅ Password reset OTP email sent to {recipient_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send password reset OTP email to {recipient_email}: {str(e)}")
        return False