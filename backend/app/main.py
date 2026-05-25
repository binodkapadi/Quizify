from fastapi import FastAPI, Request, UploadFile, File, HTTPException, Header
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from app.utils.llm import generate_quiz_from_notes
from typing import List
from app.utils.file_extractor import extract_text_from_files
import random  #  added to generate random seed
from pydantic import BaseModel
import secrets
import os
from dotenv import load_dotenv
import requests

from app.models.database import (
    authenticate_user,
    build_user_payload,
    create_password_reset_token,
    get_latest_pending_otp,
    create_session_for_user,
    get_current_user_by_auth_header,
    get_leaderboard,
    get_user_by_email,
    get_user_full_name_by_email,
    get_user_history,
    increment_quiz_downloaded,
    increment_quiz_generated_by_session_token,
    init_auth_db,
    pop_oauth_state,
    record_quiz_submission,
    reset_password_with_token,
    save_oauth_state,
    update_profile_photo,
    upsert_oauth_user,
    create_otp_verification,
    verify_otp_and_create_user,
    is_valid_password,
)

from app.utils.email import send_otp_email, send_password_reset_email

load_dotenv()

app = FastAPI(
    title="Notes to Quiz Generator API",
    description="FastAPI backend powered by Google Gemini models",
    version="1.0.0"
)

def is_debug_otp_enabled() -> bool:
    """
    Allow debug OTP fallback only in explicit local/dev environments.
    In production this must remain disabled for security.
    """
    if os.getenv("ENABLE_DEBUG_OTP", "").strip().lower() in {"1", "true", "yes", "on"}:
        return True
    if os.getenv("AUTO_ENABLE_DEBUG_OTP", "").strip().lower() not in {"1", "true", "yes", "on"}:
        return False

    env_candidates = [
        os.getenv("APP_ENV", ""),
        os.getenv("ENVIRONMENT", ""),
        os.getenv("PYTHON_ENV", ""),
        os.getenv("NODE_ENV", ""),
    ]
    normalized = {value.strip().lower() for value in env_candidates if value}
    return bool(normalized.intersection({"dev", "development", "local", "test"}))


def get_frontend_url() -> str:
    return (os.getenv("FRONTEND_URL") or "http://localhost:3000").rstrip("/")

init_auth_db()

def get_current_user(authorization: str = Header(default="")):
    return get_current_user_by_auth_header(authorization)

origins = [
  "https://binodkapadiquizify.vercel.app",
  "http://localhost:3000",
]

#  Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Replace with your frontend URL in production
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Notes to Quiz Generator API is running 🚀"}


class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    confirm_password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfilePhotoRequest(BaseModel):
    photo_data: str


class QuizSubmitRequest(BaseModel):
    total_questions: int
    correct_answers: int


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str


# OTP Verification Models
class SignupSendOtpRequest(BaseModel):
    full_name: str
    email: str
    password: str
    confirm_password: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp_code: str


class ResendOtpRequest(BaseModel):
    email: str


@app.post("/auth/signup/send-otp")
def signup_send_otp(payload: SignupSendOtpRequest):
    """
    Step 1: Validate signup data and send OTP to email
    """
    email = payload.email.strip().lower()
    
    # Validate email domain
    allowed_domains = {
        "gmail.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "yahoo.com",
        "icloud.com",
        "proton.me",
        "protonmail.com",
        "aol.com",
        "zoho.com",
    }
    email_domain = email.split("@")[-1] if "@" in email else ""
    if email_domain not in allowed_domains:
        raise HTTPException(
            status_code=400,
            detail="Registration is only allowed for trusted email providers (e.g., Gmail, Outlook, Yahoo, iCloud, ProtonMail)."
        )
    
    # Validate passwords match
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if not is_valid_password(payload.password):
        raise HTTPException(status_code=400, detail="Please meet all password requirements")
    
    # Check if email already registered
    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered. Please login.")
    
    # Generate 6-digit OTP
    import random
    otp_code = str(random.randint(100000, 999999))
    
    # Store OTP in database (temporary, pending verification)
    create_otp_verification(
        email=email,
        full_name=payload.full_name.strip(),
        password=payload.password,
        otp_code=otp_code
    )
    
    # Send OTP via email
    try:
        email_sent = send_otp_email(email, otp_code, payload.full_name.strip())
        if not email_sent:
            raise RuntimeError("SMTP or Resend configuration failed to send.")
    except Exception as e:
        if is_debug_otp_enabled():
            return {
                "message": "OTP sent to your email",
                "email": email,
                "debug_otp": otp_code,
                "expires_in": "10 minutes"
            }
        raise HTTPException(
            status_code=400,
            detail=f"Unable to send OTP email: {str(e)}"
        )
    
    return {
        "message": "OTP sent to your email",
        "email": email,
        "expires_in": "10 minutes"
    }


@app.post("/auth/signup/verify-otp")
def signup_verify_otp(payload: VerifyOtpRequest):
    """
    Step 2: Verify OTP and create user account
    """
    email = payload.email.strip().lower()
    
    # Verify OTP and create user
    result = verify_otp_and_create_user(email, payload.otp_code)
    
    return {
        "message": "Signup successful! Your account has been created.",
        "token": result["token"],
        "user": result["user"]
    }


@app.post("/auth/signup/resend-otp")
def signup_resend_otp(payload: ResendOtpRequest):
    """
    Resend OTP if previous one expired or didn't receive
    """
    email = payload.email.strip().lower()
    
    # Get existing pending OTP data from database
    row = get_latest_pending_otp(email)
    if not row:
        raise HTTPException(status_code=400, detail="No pending verification found. Please signup again.")
    
    full_name = row["full_name"]
    password = row["password_hash"]  # This is the plain password
    
    # Generate new OTP and update in database
    import random
    new_otp = str(random.randint(100000, 999999))

    # Create new OTP verification
    create_otp_verification(email, full_name, password, new_otp)
    
    # Send new OTP via email
    try:
        email_sent = send_otp_email(email, new_otp, full_name)
        if not email_sent:
            raise RuntimeError("SMTP or Resend configuration failed to send.")
    except Exception as e:
        if is_debug_otp_enabled():
            return {
                "message": "OTP resent to your email",
                "email": email,
                "debug_otp": new_otp,
                "expires_in": "10 minutes"
            }
        raise HTTPException(
            status_code=400,
            detail=f"Unable to send OTP email: {str(e)}"
        )
    
    return {
        "message": "OTP resent to your email",
        "email": email,
        "expires_in": "10 minutes"
    }


# Keep old signup endpoint for backward compatibility (optional)
# Or redirect to new flow


@app.post("/auth/login")
def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    token, user = authenticate_user(email, payload.password)

    return {
        "token": token,
        "user": build_user_payload(user),
    }


@app.get("/auth/oauth/google/start")
def oauth_google_start(request: Request):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured (missing GOOGLE_CLIENT_ID)")

    state = secrets.token_urlsafe(24)
    save_oauth_state(state=state, provider="google")

    redirect_uri = str(request.url_for("oauth_google_callback"))
    scope = "openid email profile"
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&state={state}"
        f"&access_type=offline"
        f"&prompt=select_account"
    )
    return RedirectResponse(url=url)


@app.get("/auth/oauth/google/callback", name="oauth_google_callback")
def oauth_google_callback(request: Request, code: str = "", state: str = ""):
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code/state")

    is_valid = pop_oauth_state(state=state, provider="google")
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_secret:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured (missing GOOGLE_CLIENT_SECRET)")

    redirect_uri = str(request.url_for("oauth_google_callback"))
    token_res = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=12,
    )
    if token_res.status_code >= 400:
        raise HTTPException(status_code=401, detail="Failed to exchange code with Google")
    token_data = token_res.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Google did not return an access token")

    userinfo_res = requests.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=12,
    )
    if userinfo_res.status_code >= 400:
        raise HTTPException(status_code=401, detail="Failed to fetch Google user info")
    info = userinfo_res.json()

    email = info.get("email") or ""
    full_name = info.get("name") or info.get("given_name") or "User"
    picture = info.get("picture") or None
    user_id = upsert_oauth_user(email=email, full_name=full_name, profile_photo=picture)
    session_token = create_session_for_user(user_id)

    frontend = get_frontend_url()
    return RedirectResponse(url=f"{frontend}/?auth_token={session_token}")


@app.get("/auth/oauth/github/start")
def oauth_github_start(request: Request):
    client_id = os.getenv("GITHUB_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=501, detail="GitHub OAuth is not configured (missing GITHUB_CLIENT_ID)")

    state = secrets.token_urlsafe(24)
    save_oauth_state(state=state, provider="github")

    redirect_uri = str(request.url_for("oauth_github_callback"))
    url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=user:email"
        f"&state={state}"
    )
    return RedirectResponse(url=url)


@app.get("/auth/oauth/github/callback", name="oauth_github_callback")
def oauth_github_callback(request: Request, code: str = "", state: str = ""):
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code/state")

    is_valid = pop_oauth_state(state=state, provider="github")
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")
    if not client_secret:
        raise HTTPException(status_code=501, detail="GitHub OAuth is not configured (missing GITHUB_CLIENT_SECRET)")

    redirect_uri = str(request.url_for("oauth_github_callback"))
    token_res = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        },
        timeout=12,
    )
    if token_res.status_code >= 400:
        raise HTTPException(status_code=401, detail="Failed to exchange code with GitHub")
    token_data = token_res.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="GitHub did not return an access token")

    user_res = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"},
        timeout=12,
    )
    if user_res.status_code >= 400:
        raise HTTPException(status_code=401, detail="Failed to fetch GitHub user profile")
    user = user_res.json()

    email = user.get("email") or ""
    full_name = user.get("name") or user.get("login") or "User"
    avatar_url = user.get("avatar_url") or None

    if not email:
        emails_res = requests.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"},
            timeout=12,
        )
        if emails_res.status_code < 400:
            emails = emails_res.json() or []
            primary = next((e for e in emails if e.get("primary") and e.get("verified") and e.get("email")), None)
            fallback = next((e for e in emails if e.get("verified") and e.get("email")), None)
            email = (primary or fallback or {}).get("email") or ""

    user_id = upsert_oauth_user(email=email, full_name=full_name, profile_photo=avatar_url)
    session_token = create_session_for_user(user_id)

    frontend = get_frontend_url()
    return RedirectResponse(url=f"{frontend}/?auth_token={session_token}")


# LinkedIn OAuth
@app.get("/auth/oauth/linkedin/start")
def oauth_linkedin_start(request: Request):
    client_id = os.getenv("LINKEDIN_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=501, detail="LinkedIn OAuth is not configured (missing LINKEDIN_CLIENT_ID)")

    state = secrets.token_urlsafe(24)
    save_oauth_state(state=state, provider="linkedin")

    redirect_uri = str(request.url_for("oauth_linkedin_callback"))
    scope = "openid profile email"
    url = (
        "https://www.linkedin.com/oauth/v2/authorization"
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&state={state}"
    )
    return RedirectResponse(url=url)


@app.get("/auth/oauth/linkedin/callback", name="oauth_linkedin_callback")
def oauth_linkedin_callback(request: Request, code: str = "", state: str = ""):
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code/state")

    is_valid = pop_oauth_state(state=state, provider="linkedin")
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    client_id = os.getenv("LINKEDIN_CLIENT_ID")
    client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
    if not client_secret:
        raise HTTPException(status_code=501, detail="LinkedIn OAuth is not configured (missing LINKEDIN_CLIENT_SECRET)")

    redirect_uri = str(request.url_for("oauth_linkedin_callback"))
    token_res = requests.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=12,
    )
    if token_res.status_code >= 400:
        raise HTTPException(status_code=401, detail="Failed to exchange code with LinkedIn")
    token_data = token_res.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="LinkedIn did not return an access token")

    # Get user info from LinkedIn
    user_res = requests.get(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=12,
    )
    if user_res.status_code >= 400:
        raise HTTPException(status_code=401, detail="Failed to fetch LinkedIn user profile")
    user = user_res.json()

    email = user.get("email") or ""
    full_name = user.get("name") or user.get("given_name", "") + " " + user.get("family_name", "")
    avatar_url = user.get("picture") or None

    user_id = upsert_oauth_user(email=email, full_name=full_name, profile_photo=avatar_url)
    session_token = create_session_for_user(user_id)

    frontend = get_frontend_url()
    return RedirectResponse(url=f"{frontend}/?auth_token={session_token}")


@app.get("/auth/me")
def me(authorization: str = Header(default="")):
    user = get_current_user(authorization)
    attempts = get_user_history(str(user["_id"]), limit=30)
    return {
        "user": build_user_payload(user),
        "history": [
            {
                "total_questions": int(row["total_questions"]),
                "correct_answers": int(row["correct_answers"]),
                "points_earned": int(row["points_earned"]),
                "created_at": row["created_at"],
            }
            for row in attempts
        ],
    }


@app.post("/auth/profile-photo")
def upload_profile_photo(payload: ProfilePhotoRequest, authorization: str = Header(default="")):
    user = get_current_user(authorization)
    updated = update_profile_photo(str(user["_id"]), payload.photo_data)
    return {"user": build_user_payload(updated)}


@app.post("/auth/password-reset/request")
def request_password_reset(payload: PasswordResetRequest):
    email = payload.email.strip().lower()
    token = create_password_reset_token(email)
    full_name = get_user_full_name_by_email(email)

    try:
        email_sent = send_password_reset_email(email, token, full_name)
        if not email_sent:
            raise RuntimeError("SMTP or Resend configuration failed to send.")
    except Exception as e:
        if is_debug_otp_enabled():
            return {"message": "Verification code sent to your email.", "debug_otp": token}
        raise HTTPException(
            status_code=400,
            detail=f"Unable to send verification code email: {str(e)}"
        )
    return {"message": "Verification code sent to your email."}


@app.post("/auth/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirmRequest):
    if not is_valid_password(payload.new_password):
        raise HTTPException(status_code=400, detail="Please meet all password requirements")
    reset_password_with_token(payload.token, payload.new_password)
    return {"message": "Password reset successful."}


@app.post("/stats/quiz-submitted")
def quiz_submitted(payload: QuizSubmitRequest, authorization: str = Header(default="")):
    user = get_current_user(authorization)
    total_questions = max(0, int(payload.total_questions))
    correct_answers = max(0, min(int(payload.correct_answers), total_questions))
    points_earned = record_quiz_submission(str(user["_id"]), total_questions, correct_answers)
    return {"points_earned": points_earned}


@app.post("/stats/quiz-downloaded")
def quiz_downloaded(authorization: str = Header(default="")):
    user = get_current_user(authorization)
    increment_quiz_downloaded(str(user["_id"]))
    return {"message": "Download count updated"}


@app.get("/stats/leaderboard")
def leaderboard():
    rows = get_leaderboard(limit=50)
    leaders = []
    for idx, row in enumerate(rows):
        leaders.append(
            {
                "rank": idx + 1,
                "username": row["full_name"],
                "score": int(row["total_points"] or 0),
                "profile_photo": row["profile_photo"],
            }
        )
    return {"leaders": leaders}


@app.post("/generate-quiz")
async def generate_quiz(request: Request, authorization: str = Header(default="")):
    data = await request.json()
    notes = data.get("notes")
    difficulty = data.get("difficulty", "medium")
    model = data.get("model", "gemini-flash-latest")
    num_questions = int(data.get("numQuestions", 5))
    language = data.get("language", "English")

    # Add random seed to make every generation unique
    random_seed = random.randint(1000, 99999)

    try:
        quiz = generate_quiz_from_notes(notes, difficulty, model, num_questions, random_seed, language)  
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "", 1)
            increment_quiz_generated_by_session_token(token)
        if not quiz:
            # Check if it's a quota error by examining the error logs
            # The llm.py function will print the error, but we need to return a user-friendly message
            return {"error": f"API limit for model '{model}' exceeds. Please try a different model or wait and try again later."}
        return {"quiz": quiz}
    except Exception as e:
        error_str = str(e).lower()
        if "429" in str(e) or "quota" in error_str or "rate limit" in error_str:
            return {"error": f"API limit for model '{model}' exceeds. Please try a different model or wait and try again later."}
        print("❌ Error generating quiz:", e)
        return {"error": str(e)}


@app.post("/extract-notes")
async def extract_notes(files: List[UploadFile] = File(...)):
    """
    Accepts one or more uploaded files (PDF, Word, PPT, TXT, images(JPG, JPEG, PNG)).
    Extracts text content and returns it so the frontend can populate the notes box.
    """
    try:
        if not files:
            return {"text": ""}
        text = await extract_text_from_files(files)
        if not text.strip():
            return {"text": "", "warning": "Could not extract text from uploaded files."}
        return {"text": text}
    except Exception as e:
        print("❌ Error extracting notes:", e)
        return {"text": "", "warning": str(e)}
