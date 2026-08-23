"""
Upserts raw (pre-chunking) documents into the raw_documents table.

Each doc dict must have: source, app_name, category, content, metadata.
Called by run_pipeline.py before chunking so the full original text is
visible in the DB (e.g. via DBeaver) for inspection and auditing.
"""
import hashlib
import json
import logging
import os
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[2] / "config" / ".env", override=True)

log = logging.getLogger(__name__)


def _source_id(doc: dict) -> str:
    """Derive a stable unique key for a raw document.

    Preference order:
      news / web_pages  -> article/page URL (stable across re-scrapes)
      youtube           -> video_id
      google_play /     -> review_id
      app_store
      fallback          -> sha256 of source + app_name + first 200 chars of content
    """
    meta = doc.get("metadata") or {}
    for key in ("link", "url", "review_id", "video_id"):
        val = meta.get(key)
        if val and str(val).strip():
            return str(val).strip()[:500]
    sig = f"{doc['source']}::{doc['app_name']}::{doc['content'][:200]}"
    return hashlib.sha256(sig.encode()).hexdigest()


def upsert_raw_docs(docs: list[dict]) -> int:
    """Upsert raw documents to raw_documents table before chunking.

    ON CONFLICT (source_id): updates content, metadata, scraped_at so
    re-scrapes (e.g. news with full body) automatically refresh the record.

    Returns number of rows processed.
    """
    if not docs:
        return 0

    rows = []
    for doc in docs:
        meta = doc.get("metadata") or {}
        rows.append({
            "source":     doc["source"],
            "app_name":   doc["app_name"],
            "category":   doc.get("category", "ev_charging"),
            "title":      meta.get("title") or "",
            "source_url": meta.get("link") or meta.get("url") or "",
            "source_id":  _source_id(doc),
            "content":    doc["content"],
            "metadata":   json.dumps(meta),
            "scraped_at": (
                meta.get("published") or meta.get("date") or meta.get("scraped_at")
            ),
        })

    sql = """
        INSERT INTO raw_documents
            (source, app_name, category, title, source_url, source_id,
             content, metadata, scraped_at)
        VALUES
            (%(source)s, %(app_name)s, %(category)s, %(title)s, %(source_url)s,
             %(source_id)s, %(content)s, %(metadata)s::jsonb, %(scraped_at)s)
        ON CONFLICT (source_id) DO UPDATE SET
            content     = EXCLUDED.content,
            metadata    = EXCLUDED.metadata,
            scraped_at  = EXCLUDED.scraped_at,
            ingested_at = NOW()
    """

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn:
            with conn.cursor() as cur:
                psycopg2.extras.execute_batch(cur, sql, rows, page_size=200)
        log.info("raw_documents: upserted %d rows", len(rows))
        return len(rows)
    finally:
        conn.close()
