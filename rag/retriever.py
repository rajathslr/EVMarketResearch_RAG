"""
Shared retrieval + generation logic used by both the FastAPI and Streamlit apps.
"""
import os
import sys
from pathlib import Path
from typing import Optional

import anthropic
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[1] / "config" / ".env", override=True)

sys.path.insert(0, str(Path(__file__).parents[1] / "pipeline"))
from processing.embedder import embed_texts

_anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL  = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
TOP_K  = int(os.environ.get("TOP_K", 12))

SYSTEM_PROMPT = """\
You are a competitive intelligence analyst for an EV charging app research team.
Your knowledge base contains content from FIVE source types for North American EV charging apps
(ChargePoint, EVgo, Blink, PlugShare, Electrify America, FLO, EVCS, Shell Recharge, Tesla):

- google_play   : Google Play Store user reviews
- app_store     : Apple App Store user reviews
- news          : news articles and press coverage
- web_pages     : official company website content
- youtube       : YouTube video summaries and transcripts (tutorials, demos, reviews)

Answer questions using ONLY the provided context chunks.
Each chunk is tagged with its source type and app name — distinguish between
what users say in reviews versus what the company claims on its website versus
what video creators demonstrate in tutorials.
Be specific, cite apps by name, highlight comparisons when relevant.
If the context is insufficient, say so rather than guessing."""


def _get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


ALL_APPS = [
    "chargepoint", "evgo", "blink", "plugshare",
    "electrify_america", "flo", "evcs", "shell_recharge", "tesla",
]


_YT_KEYWORDS = {"youtube", "transcript", "video", "tutorial", "demo", "watch"}


def retrieve(question: str, app_filter: Optional[str] = None, top_k: int = TOP_K, min_youtube: int = 2) -> list[dict]:
    """Embed question, run cosine similarity search, return top_k chunk dicts.

    YouTube guarantee logic:
    - Queries that explicitly mention youtube/video/transcript/tutorial bump
      min_youtube to 6 so the intent is always honoured.
    - Fallback YouTube chunks are included if their score >= YT_MIN_SCORE (0.50).
      Threshold is intentionally low because the embedding model often scores
      rich video summaries below short reviews even when they are highly relevant.
    - No YouTube boost is applied when the user has already filtered to a specific app.
    """
    # Auto-detect YouTube-focused queries and guarantee more chunks
    q_words = set(question.lower().split())
    if q_words & _YT_KEYWORDS and not app_filter:
        min_youtube = max(min_youtube, 6)

    YT_MIN_SCORE = 0.50

    vec = embed_texts([question])[0]
    vec_str = "[" + ",".join(str(v) for v in vec) + "]"

    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # --- Main similarity search ---
            if app_filter:
                cur.execute("""
                    SELECT source, app_name, content, metadata,
                           1 - (embedding <=> %s::vector) AS score
                    FROM document_chunks
                    WHERE app_name = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """, (vec_str, app_filter, vec_str, top_k))
            else:
                cur.execute("""
                    SELECT source, app_name, content, metadata,
                           1 - (embedding <=> %s::vector) AS score
                    FROM document_chunks
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """, (vec_str, vec_str, top_k))

            results = [dict(r) for r in cur.fetchall()]

            # --- Guarantee YouTube representation (no app filter only) ---
            if not app_filter and min_youtube > 0:
                yt_count = sum(1 for r in results if r["source"] == "youtube")
                shortfall = min_youtube - yt_count
                if shortfall > 0:
                    existing_contents = {r["content"] for r in results}
                    cur.execute("""
                        SELECT source, app_name, content, metadata,
                               1 - (embedding <=> %s::vector) AS score
                        FROM document_chunks
                        WHERE source = 'youtube'
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s
                    """, (vec_str, vec_str, shortfall + 6))
                    yt_extras = [
                        dict(r) for r in cur.fetchall()
                        if r["content"] not in existing_contents
                        and float(r["score"]) >= YT_MIN_SCORE
                    ][:shortfall]
                    results = results + yt_extras

            # Sort final set by score descending
            results.sort(key=lambda r: r["score"], reverse=True)
            return results

    finally:
        conn.close()


def retrieve_by_source(question: str, source: str, top_k: int = TOP_K) -> list[dict]:
    """Retrieve top_k chunks filtered to a specific source type (e.g. 'youtube').
    Used when the user explicitly wants content from one source."""
    vec = embed_texts([question])[0]
    vec_str = "[" + ",".join(str(v) for v in vec) + "]"
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT source, app_name, content, metadata,
                       1 - (embedding <=> %s::vector) AS score
                FROM document_chunks
                WHERE source = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (vec_str, source, vec_str, top_k))
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def retrieve_per_app(question: str, n_per_app: int = 3) -> list[dict]:
    """Fetch the top n_per_app chunks from EACH app — guarantees all-app coverage.
    Used for comparison queries where global top-K would miss some apps entirely."""
    vec = embed_texts([question])[0]
    vec_str = "[" + ",".join(str(v) for v in vec) + "]"

    sql = """
        SELECT source, app_name, content, metadata,
               1 - (embedding <=> %s::vector) AS score
        FROM document_chunks
        WHERE app_name = %s
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """

    all_chunks: list[dict] = []
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for app in ALL_APPS:
                cur.execute(sql, (vec_str, app, vec_str, n_per_app))
                all_chunks.extend(dict(r) for r in cur.fetchall())
    finally:
        conn.close()

    # Sort combined results by score descending so the best evidence leads
    all_chunks.sort(key=lambda c: c["score"], reverse=True)
    return all_chunks


def generate_answer(question: str, chunks: list[dict]) -> tuple[str, dict]:
    """Send retrieved chunks + question to Claude.

    Returns:
        (answer_text, usage) where usage is a dict with keys:
          input_tokens, output_tokens, total_tokens,
          cache_read_input_tokens, cache_creation_input_tokens
    """
    context = "\n\n---\n\n".join(
        f"[{c['source']} | {c['app_name']} | score: {c['score']:.3f}]\n{c['content']}"
        for c in chunks
    )
    msg = _anthropic.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion: {question}",
        }],
    )
    u = msg.usage
    usage = {
        "input_tokens":                  u.input_tokens,
        "output_tokens":                 u.output_tokens,
        "total_tokens":                  u.input_tokens + u.output_tokens,
        "cache_read_input_tokens":       getattr(u, "cache_read_input_tokens", 0) or 0,
        "cache_creation_input_tokens":   getattr(u, "cache_creation_input_tokens", 0) or 0,
    }
    return msg.content[0].text, usage
