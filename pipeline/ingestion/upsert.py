"""
Upserts document chunks + embeddings into Postgres pgvector table.
"""
import hashlib
import logging
import os
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[2] / "config" / ".env")

log = logging.getLogger(__name__)


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _md5(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def filter_new_chunks(chunks: list[dict]) -> list[dict]:
    """Drop chunks already stored (same source, app_name, content).

    Lets the pipeline skip embedding for content it has already ingested,
    instead of paying for the embedding and then discarding the row at insert
    time. Compares md5(content) so we transfer 32-char hashes, not full text.
    """
    if not chunks:
        return []

    pairs = {(c["source"], c["app_name"]) for c in chunks}
    existing: dict[tuple[str, str], set[str]] = {}
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            for source, app_name in pairs:
                cur.execute(
                    "SELECT md5(content) FROM document_chunks "
                    "WHERE source = %s AND app_name = %s",
                    (source, app_name),
                )
                existing[(source, app_name)] = {r[0] for r in cur.fetchall()}
    finally:
        conn.close()

    new, seen = [], set()
    for c in chunks:
        key = (c["source"], c["app_name"], _md5(c["content"]))
        if key[2] in existing[(c["source"], c["app_name"])] or key in seen:
            continue
        seen.add(key)
        new.append(c)
    return new


def upsert_chunks(chunks: list[dict]) -> int:
    """
    Insert chunks into document_chunks. Skips duplicates by (source, app_name, content hash).
    Each chunk dict must have: source, app_name, content, metadata, embedding.
    Returns number of rows inserted.
    """
    if not chunks:
        return 0

    sql = """
        INSERT INTO document_chunks (source, app_name, category, content, metadata, embedding)
        SELECT %(source)s, %(app_name)s, %(category)s, %(content)s, %(metadata)s::jsonb, %(embedding)s::vector
        WHERE NOT EXISTS (
            SELECT 1 FROM document_chunks
            WHERE source = %(source)s
              AND app_name = %(app_name)s
              AND content = %(content)s
        )
    """

    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                psycopg2.extras.execute_batch(cur, sql, chunks, page_size=100)
                cur.execute("SELECT changes()") if False else None
        inserted = len(chunks)
    finally:
        conn.close()

    return inserted
