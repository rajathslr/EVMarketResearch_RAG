"""Admin Portal API — thin FastAPI wrappers around pipeline_db.py and the
user-management logic that previously lived only in
rag/chat_ui/pages/1_Admin_Portal.py. Same superadmin/superuser gating.
"""
import string
import subprocess
import secrets
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import yaml
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel

from rag.api.auth import USERS_FILE, find_user, require_role
from rag.chat_ui.obs_db import cleanup_old_logs
from rag.chat_ui.pipeline_db import (
    SOURCES,
    cleanup_old_runs,
    get_chunks_by_app_source,
    get_last_run,
    get_overdue_sources,
    get_run_history,
    get_running_sources,
    get_schedules,
    get_source_chunk_count,
    get_source_chunk_counts,
    log_run_finish,
    log_run_start,
    mark_schedule_ran,
    update_schedule,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
YOUTUBE_SUMMARIES_DIR = PROJECT_ROOT / "data" / "raw" / "text" / "youtube_summaries"

# Same closed list the Streamlit Admin Portal used as a <select> dropdown
# (rag/chat_ui/pages/1_Admin_Portal.py APPS). The FastAPI port took `app` as a
# free-form query param instead of a constrained choice — validate it the
# same way here, since an unvalidated path segment + an unvalidated filename
# together are a path-traversal / arbitrary file write.
UPLOAD_APPS = {
    "chargepoint", "evgo", "blink", "plugshare", "electrify_america",
    "flo", "evcs", "shell_recharge", "tesla",
    "tesla_powerwall", "enphase", "solaredge", "emporia",
    "sense", "sunpower", "generac", "span",
    "general",
}
MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2MB — generous for a text transcript

router = APIRouter(prefix="/api/admin", tags=["admin"])

staff_only = require_role("superadmin", "superuser")
admin_only = require_role("superadmin")


# ── Background pipeline runner (same shape as the Streamlit version) ──────────
def _run_pipeline_bg(source: str):
    def _execute():
        chunks_before = get_source_chunk_count(source)
        run_id = log_run_start(source, chunks_before)
        try:
            proc = subprocess.run(
                [sys.executable, "pipeline/run_pipeline.py", "--source", source],
                capture_output=True, text=True,
                cwd=str(PROJECT_ROOT), timeout=1800,
            )
            chunks_after = get_source_chunk_count(source)
            status = "done" if proc.returncode == 0 else "error"
            log_output = (proc.stdout + "\n" + proc.stderr).strip()
            log_run_finish(run_id, status, chunks_after, log_output)
            if status == "done":
                mark_schedule_ran(source)
        except subprocess.TimeoutExpired:
            log_run_finish(run_id, "error", get_source_chunk_count(source), "Timed out after 30 minutes.")
        except Exception as e:
            log_run_finish(run_id, "error", get_source_chunk_count(source), str(e))

    threading.Thread(target=_execute, daemon=True).start()


# ── Weekly background scheduler (module-level singleton, same as Streamlit) ───
_SCHED_STARTED = False
_SCHED_LOCK = threading.Lock()


def _scheduler_loop():
    while True:
        time.sleep(1800)
        try:
            running = set(get_running_sources())
            for src in get_overdue_sources():
                if src not in running:
                    _run_pipeline_bg(src)
        except Exception:
            pass


def start_pipeline_scheduler():
    global _SCHED_STARTED
    with _SCHED_LOCK:
        if not _SCHED_STARTED:
            _SCHED_STARTED = True
            threading.Thread(target=_scheduler_loop, daemon=True, name="ev-pipeline-scheduler").start()


# ── Daily log retention (1 week — pipeline_runs, query_logs, ragas_scores) ────
_RETENTION_STARTED = False
_RETENTION_LOCK = threading.Lock()
RETENTION_DAYS = 7


def _retention_loop():
    while True:
        try:
            runs_deleted = cleanup_old_runs(RETENTION_DAYS)
            log_cleanup = cleanup_old_logs(RETENTION_DAYS)
            if runs_deleted or log_cleanup["query_logs_deleted"]:
                print(f"[retention] pipeline_runs={runs_deleted} "
                      f"query_logs={log_cleanup['query_logs_deleted']} "
                      f"ragas_scores={log_cleanup['ragas_scores_deleted']}")
        except Exception as e:
            print(f"[retention] cleanup failed: {e}")
        time.sleep(86400)  # once a day


def start_retention_scheduler():
    global _RETENTION_STARTED
    with _RETENTION_LOCK:
        if not _RETENTION_STARTED:
            _RETENTION_STARTED = True
            threading.Thread(target=_retention_loop, daemon=True, name="ev-retention-scheduler").start()


# ── Overview ────────────────────────────────────────────────────────────────────
@router.get("/overview")
def overview(user: dict = Depends(staff_only)):
    counts = get_source_chunk_counts()
    total = sum(counts.values())
    schedules = get_schedules()
    enabled = sum(1 for s in schedules if s["enabled"])
    history = get_run_history(limit=1)
    last_run = history[0]["started_at"].isoformat() if history else None
    by_app = get_chunks_by_app_source()
    return {
        "total_chunks": total, "counts_by_source": counts,
        "enabled_count": enabled, "total_sources": len(SOURCES),
        "last_run_at": last_run, "by_app_source": by_app,
    }


# ── Data sources ────────────────────────────────────────────────────────────────
@router.get("/sources")
def sources(user: dict = Depends(staff_only)):
    counts = get_source_chunk_counts()
    running = set(get_running_sources())
    out = []
    for source in SOURCES:
        last_run = get_last_run(source)
        out.append({
            "source": source,
            "chunks": counts.get(source, 0),
            "running": source in running,
            "last_run": {
                "status": last_run["status"],
                "started_at": last_run["started_at"].isoformat(),
            } if last_run else None,
        })
    return out


@router.post("/sources/{source}/run")
def run_source(source: str, user: dict = Depends(admin_only)):
    if source not in SOURCES:
        raise HTTPException(status_code=404, detail="Unknown source")
    if source in get_running_sources():
        raise HTTPException(status_code=409, detail="Already running")
    _run_pipeline_bg(source)
    return {"status": "started", "source": source}


@router.post("/youtube/upload")
async def youtube_upload(app: str, file: UploadFile, user: dict = Depends(admin_only)):
    if app not in UPLOAD_APPS:
        raise HTTPException(status_code=400, detail=f"Unknown app: {app}")

    # file.filename is attacker-controlled (the browser sets it from the
    # local file picker) — take only the basename so "../../etc/x" can't
    # escape YOUTUBE_SUMMARIES_DIR/<app>, same reasoning as `app` above.
    safe_name = Path(file.filename or "").name
    if not safe_name or not safe_name.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt files are accepted")

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 2MB)")
    content = raw.decode("utf-8")

    dest = YOUTUBE_SUMMARIES_DIR / app
    dest.mkdir(parents=True, exist_ok=True)
    (dest / safe_name).write_text(content, encoding="utf-8")
    _run_pipeline_bg("youtube")
    return {"status": "saved", "path": f"youtube_summaries/{app}/{safe_name}"}


# ── Schedules ────────────────────────────────────────────────────────────────────
@router.get("/schedules")
def schedules(user: dict = Depends(staff_only)):
    return get_schedules()


class ScheduleUpdate(BaseModel):
    source: str
    enabled: bool


@router.put("/schedules")
def save_schedules(updates: list[ScheduleUpdate], user: dict = Depends(admin_only)):
    for u in updates:
        if u.source not in SOURCES:
            raise HTTPException(status_code=400, detail=f"Unknown source: {u.source}")
        update_schedule(u.source, u.enabled)
    return get_schedules()


# ── Run logs ─────────────────────────────────────────────────────────────────────
@router.get("/logs")
def logs(source: Optional[str] = None, limit: int = 50, user: dict = Depends(staff_only)):
    history = get_run_history(limit=limit)
    if source and source != "all":
        history = [h for h in history if h["source"] == source]
    for h in history:
        h["started_at"] = h["started_at"].isoformat()
        h["finished_at"] = h["finished_at"].isoformat() if h["finished_at"] else None
    return history


# ── Users ────────────────────────────────────────────────────────────────────────
def _load_cfg() -> dict:
    return yaml.safe_load(USERS_FILE.read_text(encoding="utf-8")) or {}


def _save_cfg(cfg: dict):
    USERS_FILE.write_text(yaml.dump(cfg, default_flow_style=False, allow_unicode=True), encoding="utf-8")


def _hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(12)).decode()


def _gen_pw(length: int = 12) -> str:
    pool = string.ascii_letters + string.digits + "!#$%"
    pw = [
        secrets.choice(string.ascii_uppercase), secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits), secrets.choice("!#$%"),
    ]
    pw += [secrets.choice(pool) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(pw)
    return "".join(pw)


def _count_superadmins(cfg: dict) -> int:
    return sum(1 for u in cfg["credentials"]["usernames"].values() if u.get("role") == "superadmin")


@router.get("/users")
def list_users(user: dict = Depends(staff_only)):
    cfg = _load_cfg()
    return [
        {"username": uname, "name": u.get("name", uname), "role": u.get("role", "user")}
        for uname, u in cfg["credentials"]["usernames"].items()
    ]


class NewUserRequest(BaseModel):
    username: str
    name: str
    role: str = "user"


@router.post("/users")
def create_user(req: NewUserRequest, user: dict = Depends(admin_only)):
    cfg = _load_cfg()
    users = cfg["credentials"]["usernames"]
    uname = req.username.strip().lower()
    if not uname or not req.name.strip():
        raise HTTPException(status_code=400, detail="Username and name are required")
    if uname in {k.lower() for k in users}:
        raise HTTPException(status_code=409, detail=f"Username '{uname}' already exists")
    if req.role not in ("superadmin", "superuser", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")

    pw = _gen_pw()
    users[uname] = {"name": req.name.strip(), "password": _hash_pw(pw), "role": req.role}
    _save_cfg(cfg)
    return {"username": uname, "name": req.name.strip(), "role": req.role, "password": pw}


class RoleUpdate(BaseModel):
    role: str


@router.put("/users/{username}/role")
def change_role(username: str, body: RoleUpdate, user: dict = Depends(admin_only)):
    if body.role not in ("superadmin", "superuser", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")
    cfg = _load_cfg()
    users = cfg["credentials"]["usernames"]
    found = find_user(users, username)
    if not found:
        raise HTTPException(status_code=404, detail="User not found")
    matched_key, u = found
    if matched_key.lower() == user["sub"].lower():
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    if u.get("role") == "superadmin" and body.role != "superadmin" and _count_superadmins(cfg) <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove the last Superadmin")
    users[matched_key]["role"] = body.role
    _save_cfg(cfg)
    return {"username": matched_key, "role": body.role}


@router.post("/users/{username}/reset-password")
def reset_password(username: str, user: dict = Depends(admin_only)):
    cfg = _load_cfg()
    users = cfg["credentials"]["usernames"]
    found = find_user(users, username)
    if not found:
        raise HTTPException(status_code=404, detail="User not found")
    matched_key, _ = found
    pw = _gen_pw()
    users[matched_key]["password"] = _hash_pw(pw)
    _save_cfg(cfg)
    return {"username": matched_key, "password": pw}


@router.delete("/users/{username}")
def delete_user(username: str, user: dict = Depends(admin_only)):
    cfg = _load_cfg()
    users = cfg["credentials"]["usernames"]
    found = find_user(users, username)
    if not found:
        raise HTTPException(status_code=404, detail="User not found")
    matched_key, u = found
    if matched_key.lower() == user["sub"].lower():
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    if u.get("role") == "superadmin" and _count_superadmins(cfg) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last Superadmin")
    del users[matched_key]
    _save_cfg(cfg)
    return {"status": "deleted", "username": username}
