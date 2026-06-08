"""
Updates document_chunks table to use vector(384) for local bge-small embeddings.
Run once: python infrastructure/scripts/update_schema.py
"""
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

load_dotenv(Path(__file__).parents[2] / "config" / ".env")

conn = psycopg2.connect(os.environ["DATABASE_ADMIN_URL"])
conn.autocommit = True
cur = conn.cursor()

print("Dropping old vector index...")
cur.execute("DROP INDEX IF EXISTS document_chunks_embedding_idx;")

print("Changing embedding column to vector(384)...")
cur.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;")
cur.execute("ALTER TABLE document_chunks ADD COLUMN embedding vector(384);")

print("Recreating IVFFlat index for vector(384)...")
cur.execute("""
    CREATE INDEX document_chunks_embedding_idx
        ON document_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
""")

cur.close()
conn.close()
print("Done -- schema updated to vector(384).")
