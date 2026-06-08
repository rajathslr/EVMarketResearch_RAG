"""
obs_db.py — Query observability: logging every RAG inference call and
providing aggregated stats for the Observability dashboard.

Table: query_logs
"""
import os
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[2] / "config" / ".env", override=True)


def _get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


# ── Schema ─────────────────────────────────────────────────────────────────────

def ensure_obs_tables():
    """Create query_logs table idempotently."""
    conn = _get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS query_logs (
                        id              SERIAL PRIMARY KEY,
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                        username        TEXT,
                        session_id      TEXT,
                        app_filter      TEXT,
                        comparison_mode BOOLEAN     NOT NULL DEFAULT false,
                        source_filter   TEXT,
                        question        TEXT        NOT NULL,
                        chunks_returned INT         NOT NULL DEFAULT 0,
                        top_score       FLOAT,
                        avg_score       FLOAT,
                        retrieve_ms     INT         NOT NULL DEFAULT 0,
                        generate_ms     INT         NOT NULL DEFAULT 0,
                        total_ms        INT         NOT NULL DEFAULT 0,
                        input_tokens    INT         NOT NULL DEFAULT 0,
                        output_tokens   INT         NOT NULL DEFAULT 0,
                        error           TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_ql_created
                        ON query_logs(created_at DESC);
                    CREATE INDEX IF NOT EXISTS idx_ql_username
                        ON query_logs(username);
                    CREATE INDEX IF NOT EXISTS idx_ql_error
                        ON query_logs(error) WHERE error IS NOT NULL;
                """)
    finally:
        conn.close()


# ── Write ──────────────────────────────────────────────────────────────────────

def log_query(
    username: str,
    session_id: str,
    question: str,
    app_filter,
    comparison_mode: bool,
    source_filter,
    chunks_returned: int,
    top_score,
    avg_score,
    retrieve_ms: int,
    generate_ms: int,
    input_tokens: int,
    output_tokens: int,
    error=None,
):
    """Insert one row into query_logs. Errors are swallowed — never break UX."""
    try:
        conn = _get_conn()
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO query_logs (
                            username, session_id, question,
                            app_filter, comparison_mode, source_filter,
                            chunks_returned, top_score, avg_score,
                            retrieve_ms, generate_ms, total_ms,
                            input_tokens, output_tokens, error
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        username, session_id, question[:500],
                        app_filter, comparison_mode, source_filter,
                        chunks_returned, top_score, avg_score,
                        retrieve_ms, generate_ms, retrieve_ms + generate_ms,
                        input_tokens, output_tokens,
                        error[:500] if error else None,
                    ))
        finally:
            conn.close()
    except Exception:
        pass   # never let observability logging crash the app


# ── Read — aggregated stats ────────────────────────────────────────────────────

def get_kpi_stats() -> dict:
    """Return summary KPIs: today/7d/total counts, latency, errors, tokens."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*)                                                         AS total_queries,
                    COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '7 days') AS queries_7d,
                    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)              AS queries_today,
                    ROUND(AVG(total_ms) FILTER (
                        WHERE error IS NULL
                          AND created_at >= now() - INTERVAL '7 days'
                    ))::INT                                                          AS avg_latency_ms,
                    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_ms)
                        FILTER (
                            WHERE error IS NULL
                              AND created_at >= now() - INTERVAL '7 days'
                        ))::INT                                                      AS p95_latency_ms,
                    COUNT(*) FILTER (
                        WHERE error IS NOT NULL
                          AND created_at >= now() - INTERVAL '7 days'
                    )                                                                AS errors_7d,
                    COALESCE(SUM(input_tokens + output_tokens)
                        FILTER (WHERE created_at >= CURRENT_DATE), 0)               AS tokens_today,
                    COALESCE(SUM(input_tokens + output_tokens)
                        FILTER (WHERE created_at >= now() - INTERVAL '7 days'), 0)  AS tokens_7d
                FROM query_logs
            """)
            row = cur.fetchone()
            keys = [
                "total_queries", "queries_7d", "queries_today",
                "avg_latency_ms", "p95_latency_ms", "errors_7d",
                "tokens_today", "tokens_7d",
            ]
            return dict(zip(keys, row)) if row else {k: 0 for k in keys}
    finally:
        conn.close()


def get_daily_volume(days: int = 14) -> list[dict]:
    """Return per-day query counts (success + error) for the last N days."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    DATE(created_at AT TIME ZONE 'UTC')              AS day,
                    COUNT(*)                                         AS queries,
                    COUNT(*) FILTER (WHERE error IS NOT NULL)        AS errors
                FROM query_logs
                WHERE created_at >= now() - (%(d)s || ' days')::INTERVAL
                GROUP BY 1
                ORDER BY 1
            """, {"d": str(days)})
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_latency_trend(days: int = 7) -> list[dict]:
    """Return per-day avg latency breakdown (retrieve vs generate)."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    DATE(created_at AT TIME ZONE 'UTC') AS day,
                    ROUND(AVG(retrieve_ms))::INT        AS avg_retrieve_ms,
                    ROUND(AVG(generate_ms))::INT        AS avg_generate_ms,
                    ROUND(AVG(total_ms))::INT           AS avg_total_ms
                FROM query_logs
                WHERE error IS NULL
                  AND created_at >= now() - (%(d)s || ' days')::INTERVAL
                GROUP BY 1
                ORDER BY 1
            """, {"d": str(days)})
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_app_distribution() -> list[dict]:
    """Return query counts grouped by effective app target."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    CASE
                        WHEN comparison_mode      THEN 'Comparison'
                        WHEN app_filter IS NULL   THEN 'All Apps'
                        ELSE app_filter
                    END  AS app_label,
                    COUNT(*) AS queries
                FROM query_logs
                GROUP BY 1
                ORDER BY 2 DESC
            """)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_token_trend(days: int = 7) -> list[dict]:
    """Return per-day token totals (input + output)."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    DATE(created_at AT TIME ZONE 'UTC') AS day,
                    COALESCE(SUM(input_tokens),  0)     AS input_tokens,
                    COALESCE(SUM(output_tokens), 0)     AS output_tokens
                FROM query_logs
                WHERE created_at >= now() - (%(d)s || ' days')::INTERVAL
                GROUP BY 1
                ORDER BY 1
            """, {"d": str(days)})
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_recent_queries(limit: int = 50) -> list[dict]:
    """Return the most recent query log rows for the query table."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    id, created_at, username,
                    app_filter, comparison_mode, source_filter,
                    LEFT(question, 120)            AS question,
                    chunks_returned,
                    ROUND(top_score::numeric, 3)   AS top_score,
                    total_ms, retrieve_ms, generate_ms,
                    input_tokens, output_tokens,
                    error
                FROM query_logs
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_recent_errors(limit: int = 20) -> list[dict]:
    """Return the most recent failed queries."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, created_at, username,
                       LEFT(question, 120) AS question, error
                FROM query_logs
                WHERE error IS NOT NULL
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
