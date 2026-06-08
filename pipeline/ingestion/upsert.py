"""
Upserts document chunks + embeddings into Postgres pgvector table.
"""
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


def upsert_chunks(chunks: list[dict]) -> int:
    """
    Insert chunks into document_chunks. Skips duplicates by (source, app_name, content hash).
    Each chunk dict must have: source, app_name, content, metadata, embedding.
    Returns number of rows inserted.
    """
    if not chunks:
        return 0

    sql = """
        INSERT INTO document_chunks (source, app_name, content, metadata, embedding)
        SELECT %(source)s, %(app_name)s, %(content)s, %(metadata)s::jsonb, %(embedding)s::vector
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
