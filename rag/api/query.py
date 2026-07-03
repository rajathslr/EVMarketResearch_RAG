"""
RAG query API — FastAPI backend for the Next.js frontend (apps/web).

Run with:
    uvicorn rag.api.query:app --reload --port 8000
"""
# Loading this module via uvicorn's import_from_string (rather than a plain
# top-level `python -c`/script import) hits a Windows access-violation crash
# deep in transformers -> datasets -> pyarrow.dataset, triggered indirectly by
# sentence_transformers' own package init. Importing pyarrow/pandas directly
# here first avoids it — same effect as how Streamlit's own startup already
# imports them safely before our code ever touches sentence_transformers.
# This also protects the lazy `datasets`/`ragas` imports inside ragas_eval.py,
# since it's a process-wide ordering fix, not a per-module one.
import pandas  # noqa: F401
import pyarrow  # noqa: F401

import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2]))

from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag.api.auth import LoginRequest, get_current_user, login as auth_login
# rag.retriever imports the embedder (sentence-transformers) eagerly, which must
# happen before psycopg2 is ever imported in this process — see CLAUDE.md gotcha #7
# (Windows DLL conflict between PyTorch and psycopg2 causes a hard segfault otherwise).
from rag.retriever import TOP_K, SCORE_THRESHOLD, generate_answer, retrieve
import psycopg2

from rag.chat_ui.obs_db import ensure_obs_tables, log_query
from rag.chat_ui.pipeline_db import ensure_pipeline_tables
from rag.chat_ui.feedback_db import ensure_feedback_table
from rag.chat_ui.session_db import ensure_table as ensure_session_table
from rag.chat_ui.ragas_eval import start_ragas_scheduler
from rag.api.admin import start_pipeline_scheduler, start_retention_scheduler, router as admin_router
from rag.api.observability import router as obs_router
from rag.api.sessions import router as sessions_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_obs_tables()
    ensure_pipeline_tables()
    ensure_feedback_table()
    ensure_session_table()
    start_pipeline_scheduler()
    start_ragas_scheduler()
    start_retention_scheduler()
    yield


app = FastAPI(title="EV Research RAG API", version="2.0", lifespan=lifespan)

CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(obs_router)
app.include_router(sessions_router)


class QueryRequest(BaseModel):
    question: str
    app_filter: Optional[str] = None
    category_filter: Optional[str] = None
    source_filter: Optional[str] = None
    comparison_mode: bool = False
    session_id: Optional[str] = None
    top_k: int = TOP_K
    score_threshold: float = SCORE_THRESHOLD


class Source(BaseModel):
    app_name: str
    source: str
    content: str
    score: float
    metadata: dict


class Usage(BaseModel):
    input_tokens: int
    output_tokens: int
    total_tokens: int
    model: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[Source]
    usage: Optional[Usage] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(req: LoginRequest, request: Request):
    return auth_login(req, request)


@app.get("/api/stats")
def stats():
    """Public knowledge-base counts for the login hero + chat sidebar."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM document_chunks")
            total = cur.fetchone()[0]
            cur.execute("SELECT COUNT(DISTINCT app_name) FROM document_chunks")
            apps = cur.fetchone()[0]
            cur.execute("SELECT COUNT(DISTINCT source) FROM document_chunks")
            sources = cur.fetchone()[0]
            cur.execute("""
                SELECT category, source, COUNT(*) FROM document_chunks
                GROUP BY category, source ORDER BY category, source
            """)
            by_source = [{"category": c, "source": s, "chunks": n} for c, s, n in cur.fetchall()]
        return {"total_chunks": total, "apps_tracked": apps, "sources": sources, "by_source": by_source}
    finally:
        conn.close()


@app.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest, user: dict = Depends(get_current_user)):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    t0 = time.perf_counter()
    try:
        chunks = retrieve(
            req.question,
            app_filter=req.app_filter,
            top_k=req.top_k,
            category_filter=req.category_filter,
            score_threshold=req.score_threshold,
        )
    except Exception as exc:
        log_query(
            username=user.get("sub", ""), session_id=req.session_id, question=req.question,
            app_filter=req.app_filter, comparison_mode=req.comparison_mode,
            source_filter=req.source_filter, chunks_returned=0, top_score=None, avg_score=None,
            retrieve_ms=int((time.perf_counter() - t0) * 1000), generate_ms=0,
            input_tokens=0, output_tokens=0, error=f"retrieve failed: {exc}",
        )
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {exc}")
    t1 = time.perf_counter()

    if not chunks:
        log_query(
            username=user.get("sub", ""), session_id=req.session_id, question=req.question,
            app_filter=req.app_filter, comparison_mode=req.comparison_mode,
            source_filter=req.source_filter, chunks_returned=0, top_score=None, avg_score=None,
            retrieve_ms=int((t1 - t0) * 1000), generate_ms=0,
            input_tokens=0, output_tokens=0,
        )
        return QueryResponse(answer="No relevant documents found.", sources=[])

    try:
        answer, usage = generate_answer(req.question, chunks)
    except Exception as exc:
        scores = [float(c["score"]) for c in chunks if c.get("score") is not None]
        log_query(
            username=user.get("sub", ""), session_id=req.session_id, question=req.question,
            app_filter=req.app_filter, comparison_mode=req.comparison_mode,
            source_filter=req.source_filter, chunks_returned=len(chunks),
            top_score=max(scores) if scores else None,
            avg_score=(sum(scores) / len(scores)) if scores else None,
            retrieve_ms=int((t1 - t0) * 1000), generate_ms=int((time.perf_counter() - t1) * 1000),
            input_tokens=0, output_tokens=0, error=f"generate failed: {exc}",
        )
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")
    t2 = time.perf_counter()

    scores = [float(c["score"]) for c in chunks if c.get("score") is not None]
    context_chunks = [
        {"source": c["source"], "app_name": c["app_name"], "content": c["content"][:1000], "score": float(c["score"])}
        for c in chunks
    ]
    log_query(
        username=user.get("sub", ""), session_id=req.session_id, question=req.question,
        app_filter=req.app_filter, comparison_mode=req.comparison_mode,
        source_filter=req.source_filter, chunks_returned=len(chunks),
        top_score=max(scores) if scores else None,
        avg_score=(sum(scores) / len(scores)) if scores else None,
        retrieve_ms=int((t1 - t0) * 1000), generate_ms=int((t2 - t1) * 1000),
        input_tokens=usage["input_tokens"], output_tokens=usage["output_tokens"],
        answer_text=answer, context_chunks=context_chunks,
    )

    sources = [
        Source(
            app_name=c["app_name"],
            source=c["source"],
            content=c["content"][:400] + "…" if len(c["content"]) > 400 else c["content"],
            score=float(c["score"]),
            metadata=c["metadata"] if isinstance(c["metadata"], dict) else {},
        )
        for c in chunks
    ]
    return QueryResponse(
        answer=answer,
        sources=sources,
        usage=Usage(
            input_tokens=usage["input_tokens"],
            output_tokens=usage["output_tokens"],
            total_tokens=usage["total_tokens"],
            model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        ),
    )
