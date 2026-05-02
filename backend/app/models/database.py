import hashlib
import os
import secrets
from datetime import datetime

import certifi
from bson import ObjectId
from fastapi import HTTPException
from pymongo import ASCENDING, DESCENDING, MongoClient


MONGO_URI = (os.getenv("MONGODB_URI") or "").strip()
MONGO_DB_NAME = (os.getenv("MONGODB_DB_NAME") or "").strip()
_mongo_client = None


def is_valid_password(password: str) -> bool:
    if len(password) < 8:
        return False
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    special_chars = set("!@#$%^&*(),.?\":{}|<>")
    has_special = any(c in special_chars for c in password)
    return has_upper and has_lower and has_digit and has_special


def get_db_conn():
    global _mongo_client
    if not MONGO_URI:
        raise HTTPException(status_code=500, detail="Missing MONGODB_URI in environment")
    if not MONGO_DB_NAME:
        raise HTTPException(status_code=500, detail="Missing MONGODB_DB_NAME in environment")
    if _mongo_client is None:
        opts = {"tlsCAFile": certifi.where()}
        if not (
            MONGO_URI.startswith("mongodb+srv://")
            or "tls=true" in MONGO_URI.lower()
            or "ssl=true" in MONGO_URI.lower()
        ):
            opts = {}
        _mongo_client = MongoClient(MONGO_URI, **opts)
    return _mongo_client[MONGO_DB_NAME]


def init_auth_db():
    db = get_db_conn()
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.sessions.create_index([("token", ASCENDING)], unique=True)
    db.oauth_states.create_index([("state", ASCENDING)], unique=True)
    db.password_reset_tokens.create_index([("token", ASCENDING)], unique=True)
    db.otp_verification.create_index([("email", ASCENDING), ("created_at", DESCENDING)])
    db.quiz_attempts.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _normalize_user(user_doc: dict) -> dict:
    if not user_doc:
        return {}
    normalized = dict(user_doc)
    normalized["id"] = str(normalized.get("_id"))
    return normalized


def build_user_payload(user_doc):
    user_doc = _normalize_user(user_doc)
    return {
        "id": user_doc.get("id", ""),
        "full_name": user_doc.get("full_name", ""),
        "email": user_doc.get("email", ""),
        "profile_photo": user_doc.get("profile_photo"),
        "total_points": int(user_doc.get("total_points", 0) or 0),
        "quizzes_generated": int(user_doc.get("quizzes_generated", 0) or 0),
        "quizzes_submitted": int(user_doc.get("quizzes_submitted", 0) or 0),
        "quizzes_downloaded": int(user_doc.get("quizzes_downloaded", 0) or 0),
    }


def _parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid user id") from exc


def get_user_by_email(email: str):
    db = get_db_conn()
    return db.users.find_one({"email": (email or "").strip().lower()})


def create_session_for_user(user_id: str) -> str:
    db = get_db_conn()
    token = secrets.token_urlsafe(32)
    db.sessions.insert_one(
        {
            "user_id": _parse_object_id(user_id),
            "token": token,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    return token


def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)
    if not user or user.get("password_hash") != hash_password(password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_session_for_user(str(user["_id"]))
    return token, user


def upsert_oauth_user(email: str, full_name: str, profile_photo: str | None = None) -> str:
    db = get_db_conn()
    email = (email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="OAuth provider did not return an email address")
    full_name = (full_name or "User").strip() or "User"

    existing = db.users.find_one({"email": email})
    if existing:
        update_doc = {}
        if not str(existing.get("full_name", "")).strip():
            update_doc["full_name"] = full_name
        if profile_photo and not existing.get("profile_photo"):
            update_doc["profile_photo"] = profile_photo
        if update_doc:
            db.users.update_one({"_id": existing["_id"]}, {"$set": update_doc})
        return str(existing["_id"])

    random_pw = secrets.token_urlsafe(24)
    new_user = {
        "full_name": full_name,
        "email": email,
        "password_hash": hash_password(random_pw),
        "profile_photo": profile_photo,
        "total_points": 0,
        "quizzes_generated": 0,
        "quizzes_submitted": 0,
        "quizzes_downloaded": 0,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = db.users.insert_one(new_user)
    return str(result.inserted_id)


def create_password_reset_token(email: str, ttl_minutes: int = 10) -> str:
    db = get_db_conn()
    email = (email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")

    token = f"{secrets.randbelow(900000) + 100000:06d}"
    now = datetime.utcnow()
    expires_at = now.timestamp() + ttl_minutes * 60
    db.password_reset_tokens.insert_one(
        {
            "email": email,
            "token": token,
            "expires_at": str(expires_at),
            "used": 0,
            "created_at": now.isoformat(),
        }
    )
    return token


def reset_password_with_token(token: str, new_password: str):
    db = get_db_conn()
    token = (token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Reset code is required")
    if not new_password or not is_valid_password(new_password):
        raise HTTPException(status_code=400, detail="Please meet all password requirements")

    row = db.password_reset_tokens.find_one({"token": token}, sort=[("created_at", DESCENDING)])
    if not row:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    if int(row.get("used", 0)) == 1:
        raise HTTPException(status_code=400, detail="Reset code already used")

    try:
        expires_at = float(row.get("expires_at", "0"))
    except Exception:
        expires_at = 0.0
    if datetime.utcnow().timestamp() > expires_at:
        raise HTTPException(status_code=400, detail="Reset code expired")

    email = str(row.get("email", "")).strip().lower()
    db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(new_password)}})
    db.password_reset_tokens.update_many({"token": token}, {"$set": {"used": 1}})


def get_current_user_by_auth_header(authorization: str):
    db = get_db_conn()
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.replace("Bearer ", "", 1)
    session = db.sessions.find_one({"token": token}, sort=[("created_at", DESCENDING)])
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = db.users.find_one({"_id": session.get("user_id")})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def create_otp_verification(email: str, full_name: str, password: str, otp_code: str, ttl_minutes: int = 10) -> str:
    db = get_db_conn()
    email = (email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    db.otp_verification.delete_many({"email": email, "verified": 0})
    now = datetime.utcnow()
    expires_at = now.timestamp() + ttl_minutes * 60
    db.otp_verification.insert_one(
        {
            "email": email,
            "otp_code": otp_code,
            "full_name": full_name.strip(),
            "password_hash": password,
            "expires_at": str(expires_at),
            "verified": 0,
            "created_at": now.isoformat(),
        }
    )
    return otp_code


def get_latest_pending_otp(email: str):
    db = get_db_conn()
    return db.otp_verification.find_one(
        {"email": (email or "").strip().lower(), "verified": 0},
        sort=[("created_at", DESCENDING)],
    )


def verify_otp_and_create_user(email: str, otp_code: str) -> dict:
    db = get_db_conn()
    email = (email or "").strip().lower()
    if not email or not otp_code:
        raise HTTPException(status_code=400, detail="Email and OTP are required")

    row = get_latest_pending_otp(email)
    if not row:
        raise HTTPException(status_code=400, detail="No pending verification found. Please signup again.")
    if str(row.get("otp_code")) != str(otp_code):
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    try:
        expires_at = float(row.get("expires_at", "0"))
    except Exception:
        expires_at = 0.0
    if datetime.utcnow().timestamp() > expires_at:
        db.otp_verification.delete_many({"email": email, "verified": 0})
        raise HTTPException(status_code=400, detail="OTP expired. Please signup again.")

    full_name = row.get("full_name", "User")
    password = row.get("password_hash", "")
    password_hash = hash_password(password)

    existing = db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered. Please login.")

    user_doc = {
        "full_name": full_name,
        "email": email,
        "password_hash": password_hash,
        "profile_photo": None,
        "total_points": 0,
        "quizzes_generated": 0,
        "quizzes_submitted": 0,
        "quizzes_downloaded": 0,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    token = create_session_for_user(user_id)
    db.otp_verification.update_many({"email": email}, {"$set": {"verified": 1}})
    db.otp_verification.delete_many({"email": email, "verified": 1})

    user = db.users.find_one({"_id": _parse_object_id(user_id)})
    return {"token": token, "user": build_user_payload(user)}


def save_oauth_state(state: str, provider: str):
    db = get_db_conn()
    db.oauth_states.insert_one(
        {
            "state": state,
            "provider": provider,
            "created_at": datetime.utcnow().isoformat(),
        }
    )


def pop_oauth_state(state: str, provider: str) -> bool:
    db = get_db_conn()
    deleted = db.oauth_states.delete_one({"state": state, "provider": provider})
    return deleted.deleted_count > 0


def get_user_history(user_id: str, limit: int = 30):
    db = get_db_conn()
    cursor = db.quiz_attempts.find({"user_id": _parse_object_id(user_id)}).sort("created_at", DESCENDING).limit(limit)
    return list(cursor)


def update_profile_photo(user_id: str, photo_data: str):
    db = get_db_conn()
    _id = _parse_object_id(user_id)
    db.users.update_one({"_id": _id}, {"$set": {"profile_photo": photo_data}})
    return db.users.find_one({"_id": _id})


def get_user_full_name_by_email(email: str) -> str:
    user = get_user_by_email(email)
    return (user or {}).get("full_name", "User")


def record_quiz_submission(user_id: str, total_questions: int, correct_answers: int):
    db = get_db_conn()
    _id = _parse_object_id(user_id)
    points_earned = correct_answers * 2
    db.quiz_attempts.insert_one(
        {
            "user_id": _id,
            "total_questions": total_questions,
            "correct_answers": correct_answers,
            "points_earned": points_earned,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    db.users.update_one(
        {"_id": _id},
        {
            "$inc": {
                "quizzes_submitted": 1,
                "total_points": points_earned,
            }
        },
    )
    return points_earned


def increment_quiz_downloaded(user_id: str):
    db = get_db_conn()
    db.users.update_one({"_id": _parse_object_id(user_id)}, {"$inc": {"quizzes_downloaded": 1}})


def get_leaderboard(limit: int = 50):
    db = get_db_conn()
    return list(db.users.find().sort([("total_points", DESCENDING), ("_id", ASCENDING)]).limit(limit))


def increment_quiz_generated_by_session_token(token: str):
    db = get_db_conn()
    session = db.sessions.find_one({"token": token}, sort=[("created_at", DESCENDING)])
    if not session:
        return
    db.users.update_one({"_id": session.get("user_id")}, {"$inc": {"quizzes_generated": 1}})

