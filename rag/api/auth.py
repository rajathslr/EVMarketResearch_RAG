"""JWT auth for the FastAPI backend, backed by the same config/users.yaml
bcrypt credentials used by the Streamlit app's streamlit-authenticator setup.
"""
import os
import threading
import time
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
import yaml
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

USERS_FILE = Path(__file__).resolve().parents[2] / "config" / "users.yaml"
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_EXPIRE_SECONDS = int(os.environ.get("JWT_EXPIRE_HOURS", "720")) * 3600

bearer = HTTPBearer(auto_error=False)

# ── Login rate limiting (in-memory; fine for a single uvicorn worker) ─────────
# Per-IP throttle bounds attempts regardless of username (so it can't be
# starved by an attacker cycling through made-up usernames), and a tighter
# per-known-username lockout stops targeted brute force on a single account.
# Only real usernames (post find_user) get a tracking entry, so the dict can't
# grow unbounded from garbage input.
IP_MAX_ATTEMPTS, IP_WINDOW_SECONDS = 20, 60
USER_MAX_FAILURES, USER_LOCKOUT_SECONDS = 5, 900

_ip_attempts: dict[str, list[float]] = {}
_user_failures: dict[str, list[float]] = {}
_rl_lock = threading.Lock()


def _prune(timestamps: list[float], window: float, now: float) -> list[float]:
    return [t for t in timestamps if now - t < window]


def _check_ip_throttle(ip: str):
    now = time.time()
    with _rl_lock:
        attempts = _prune(_ip_attempts.get(ip, []), IP_WINDOW_SECONDS, now)
        if len(attempts) >= IP_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many login attempts. Try again in a minute.")
        attempts.append(now)
        _ip_attempts[ip] = attempts


def _check_user_lockout(username: str):
    now = time.time()
    with _rl_lock:
        failures = _prune(_user_failures.get(username, []), USER_LOCKOUT_SECONDS, now)
        if len(failures) >= USER_MAX_FAILURES:
            raise HTTPException(status_code=429, detail="Too many failed attempts for this account. Try again later.")


def _record_user_failure(username: str):
    now = time.time()
    with _rl_lock:
        failures = _prune(_user_failures.get(username, []), USER_LOCKOUT_SECONDS, now)
        failures.append(now)
        _user_failures[username] = failures


def _clear_user_failures(username: str):
    with _rl_lock:
        _user_failures.pop(username, None)


def _client_ip(request: Optional[Request]) -> str:
    if request is None:
        return "unknown"
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class LoginRequest(BaseModel):
    username: str
    password: str


def load_users() -> dict:
    data = yaml.safe_load(USERS_FILE.read_text(encoding="utf-8")) or {}
    return (data.get("credentials") or {}).get("usernames") or {}


def find_user(users: dict, username: str) -> Optional[tuple]:
    """Case-insensitive username lookup. The Streamlit app's
    streamlit-authenticator lowercases usernames internally, so config/users.yaml
    has accumulated mixed-case keys (e.g. 'MadhusudanBIT@gmail.com') while every
    historical chat_sessions/query_logs row was written under the lowercased form.
    Returns (matched_key, user_dict) or None."""
    target = username.strip().lower()
    for key, data in users.items():
        if key.lower() == target:
            return key, data
    return None


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, AttributeError):
        return False


def create_token(username: str, name: str, role: str) -> str:
    now = int(time.time())
    payload = {"sub": username, "name": name, "role": role, "iat": now, "exp": now + JWT_EXPIRE_SECONDS}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])


def login(req: LoginRequest, request: Optional[Request] = None) -> dict:
    _check_ip_throttle(_client_ip(request))

    users = load_users()
    found = find_user(users, req.username)
    if found:
        canonical = found[0].lower()
        _check_user_lockout(canonical)

    if not found or not verify_password(req.password, found[1].get("password", "")):
        if found:
            _record_user_failure(found[0].lower())
        raise HTTPException(status_code=401, detail="Invalid username or password")

    matched_key, u = found
    role = u.get("role", "user")
    name = u.get("name", matched_key)
    # sub is the lowercased canonical identity — matches the username every
    # historical chat_sessions/query_logs/response_feedback row was written
    # under (see find_user's docstring).
    canonical = matched_key.lower()
    _clear_user_failures(canonical)
    token = create_token(canonical, name, role)
    return {"access_token": token, "user": {"username": matched_key, "name": name, "role": role}}


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_role(*roles: str):
    """Dependency factory: 403s unless the current user's role is in `roles`.
    Mirrors the Streamlit Admin Portal's superadmin/superuser gating."""
    def _check(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _check
