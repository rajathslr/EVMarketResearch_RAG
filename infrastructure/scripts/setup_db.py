"""
Run once to enable pgvector and create the document_chunks table.
Usage: python infrastructure/scripts/setup_db.py
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

load_dotenv(Path(__file__).parents[2] / "config" / ".env")

admin_url = os.environ.get("DATABASE_ADMIN_URL")
pipeline_url = os.environ["DATABASE_URL"]

if not admin_url:
    print("ERROR: DATABASE_ADMIN_URL not set in config/.env")
    sys.exit(1)

print("Connecting as admin...")
conn = psycopg2.connect(admin_url)
conn.autocommit = True
cur = conn.cursor()

print("Enabling pgvector extension...")
cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

print("Granting schema privileges to pipeline user...")
cur.execute("GRANT ALL ON SCHEMA public TO pipeline;")
cur.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pipeline;")
cur.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pipeline;")

print("Creating document_chunks table...")
cur.execute("""
    CREATE TABLE IF NOT EXISTS document_chunks (
        id          BIGSERIAL PRIMARY KEY,
        source      TEXT NOT NULL,
        app_name    TEXT NOT NULL,
        content     TEXT NOT NULL,
        metadata    JSONB DEFAULT '{}',
        embedding   vector(1536),
        created_at  TIMESTAMPTZ DEFAULT NOW()
    );
""")

print("Creating vector index...")
cur.execute("""
    CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
        ON document_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
""")

print("Creating supporting indexes...")
cur.execute("CREATE INDEX IF NOT EXISTS idx_chunks_app ON document_chunks (app_name);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_chunks_source ON document_chunks (source);")

print("Granting table privileges to pipeline user...")
cur.execute("GRANT ALL ON document_chunks TO pipeline;")
cur.execute("GRANT USAGE, SELECT ON SEQUENCE document_chunks_id_seq TO pipeline;")

cur.close()
conn.close()
print("\nDone -- schema is ready.")
