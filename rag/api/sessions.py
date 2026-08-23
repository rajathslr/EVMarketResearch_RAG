"""Chat session + feedback persistence API — thin wrappers around
session_db.py and feedback_db.py so Chat's Recent list and reactions survive
a page reload, same as the Streamlit app."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from rag.api.auth import get_current_user
from rag.chat_ui.feedback_db import load_session_feedback, save_feedback
from rag.chat_ui.session_db import (
    append_messages,
    create_session,
    delete_session,
    list_sessions,
    load_messages,
    save_messages,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _iso(rows: list[dict], *keys: str) -> list[dict]:
    for r in rows:
        for k in keys:
            if r.get(k) is not None:
                r[k] = r[k].isoformat()
    return rows


@router.get("")
def get_sessions(user: dict = Depends(get_current_user)):
    return _iso(list_sessions(user["sub"]), "created_at", "updated_at")


@router.post("")
def new_session(user: dict = Depends(get_current_user)):
    session_id = create_session(user["sub"])
    return {"session_id": session_id}


@router.get("/{session_id}/messages")
def get_messages(session_id: str, user: dict = Depends(get_current_user)):
    return {"messages": load_messages(session_id)}


class SaveMessagesRequest(BaseModel):
    messages: list[dict]
    title: Optional[str] = None


@router.put("/{session_id}/messages")
def put_messages(session_id: str, req: SaveMessagesRequest, user: dict = Depends(get_current_user)):
    save_messages(session_id, req.messages, req.title)
    return {"status": "saved"}


@router.post("/{session_id}/messages/append")
def append_session_messages(session_id: str, req: SaveMessagesRequest, user: dict = Depends(get_current_user)):
    # Additive save: only ever appends the few messages from one exchange,
    # never replaces the whole array — safe under concurrent saves from
    # multiple tabs/devices on the same account, unlike PUT above.
    append_messages(session_id, req.messages, req.title)
    return {"status": "saved"}


@router.delete("/{session_id}")
def remove_session(session_id: str, user: dict = Depends(get_current_user)):
    delete_session(session_id)
    return {"status": "deleted"}


@router.get("/{session_id}/feedback")
def get_feedback(session_id: str, user: dict = Depends(get_current_user)):
    return load_session_feedback(session_id)


class FeedbackRequest(BaseModel):
    message_idx: int
    reaction: Optional[str] = None
    comment: str = ""


@router.post("/{session_id}/feedback")
def post_feedback(session_id: str, req: FeedbackRequest, user: dict = Depends(get_current_user)):
    if req.reaction not in (None, "up", "down", "love"):
        raise HTTPException(status_code=400, detail="Invalid reaction")
    save_feedback(session_id, req.message_idx, user["sub"], req.reaction, req.comment)
    return {"status": "saved"}
