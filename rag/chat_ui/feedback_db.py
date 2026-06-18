"""
feedback_db.py — stores per-message reaction + comment feedback.

Table: response_feedback
  session_id   : chat session UUID
  message_idx  : index of the assistant message in the conversation list
  username     : who gave the feedback
  reaction     : 'up' | 'down' | 'love' | NULL
  comment      : free text, max 100 chars
"""
import os
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[2] / "config" / ".env", override=True)


def _conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ensure_feedback_table():
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS response_feedback (
                id          SERIAL PRIMARY KEY,
                session_id  TEXT NOT NULL,
                message_idx INTEGER NOT NULL,
                username    TEXT NOT NULL,
                reaction    TEXT CHECK (reaction IN ('up','down','love')),
                comment     TEXT CHECK (char_length(comment) <= 100),
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                updated_at  TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (session_id, message_idx)
            )
        """)


def save_feedback(session_id: str, message_idx: int, username: str,
                  reaction: str | None, comment: str):
    comment = (comment or "").strip()[:100] or None
    reaction = reaction or None
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("""
            INSERT INTO response_feedback
                (session_id, message_idx, username, reaction, comment, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (session_id, message_idx) DO UPDATE
                SET reaction   = EXCLUDED.reaction,
                    comment    = EXCLUDED.comment,
                    updated_at = NOW()
        """, (session_id, message_idx, username, reaction, comment))


def load_session_feedback(session_id: str) -> dict[int, dict]:
    """Returns {message_idx: {reaction, comment}} for a session."""
    with _conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT message_idx, reaction, comment
            FROM response_feedback
            WHERE session_id = %s
        """, (session_id,))
        return {
            row["message_idx"]: {
                "reaction": row["reaction"],
                "comment":  row["comment"] or "",
            }
            for row in cur.fetchall()
        }
