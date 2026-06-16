"""
One-time setup: creates the raw_documents table and indexes.

Run once:
    python pipeline/ingestion/setup_raw_docs.py
"""
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[2] / "config" / ".env", override=True)


def setup():
    conn = psycopg2.connect(os.environ["DATABASE_ADMIN_URL"])
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS raw_documents (
                        id          BIGSERIAL    PRIMARY KEY,
                        source      VARCHAR(50)  NOT NULL,
                        app_name    VARCHAR(100) NOT NULL,
                        category    VARCHAR(50)  NOT NULL,
                        title       TEXT         NOT NULL DEFAULT '',
                        source_url  TEXT         NOT NULL DEFAULT '',
                        source_id   VARCHAR(500) NOT NULL UNIQUE,
                        content     TEXT         NOT NULL,
                        metadata    JSONB        NOT NULL DEFAULT '{}',
                        scraped_at  TIMESTAMPTZ,
                        ingested_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_raw_docs_source
                        ON raw_documents(source);
                    CREATE INDEX IF NOT EXISTS idx_raw_docs_app_name
                        ON raw_documents(app_name);
                    CREATE INDEX IF NOT EXISTS idx_raw_docs_category
                        ON raw_documents(category);
                    CREATE INDEX IF NOT EXISTS idx_raw_docs_source_app
                        ON raw_documents(source, app_name);
                """)
        print("raw_documents table and indexes ready.")
    finally:
        conn.close()


if __name__ == "__main__":
    setup()
