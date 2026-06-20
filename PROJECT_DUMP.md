# Project Dump — Home Energy & EV Research RAG System

Full technical snapshot of this project, written so a fresh session (likely rebuilding the frontend in Node.js) has complete context without re-deriving it from the codebase.

**Generated:** 2026-06-20. Reflects repo state at commit `06ab897` on branch `dev`.

---

## 1. What this is

Competitive-intelligence RAG chatbot for two app categories in the North American market:

- **EV charging:** ChargePoint, EVgo, Blink, PlugShare, Electrify America, FLO, EVCS, Shell Recharge, Tesla
- **Prosumer / home energy:** Tesla Powerwall, Enphase Enlighten, SolarEdge mySolarEdge, Emporia Energy, Sense, SunPower, Generac PWRview, Span

Data (app store reviews, news, web pages, YouTube transcripts) is scraped, chunked, embedded, and stored in pgvector. A chat UI retrieves relevant chunks and asks Claude to answer using only that context.

**Current frontend:** Streamlit (Python), being considered for replacement with a Node.js frontend.
**Backend logic that should NOT need to change:** the retrieval/generation pipeline in `rag/retriever.py`, already wrapped in a FastAPI app at `rag/api/query.py` — a Node.js frontend can likely just call this API rather than reimplementing RAG in JS.

---

## 2. Architecture / data flow

```
Scrapers (pipeline/scrapers/*.py)
   → data/raw/text/{source}/{app}/*.json
   → chunker.py (512 tok / 64 overlap, tiktoken cl100k_base)
   → embedder.py (BAAI/bge-small-en-v1.5, local CPU, 384-dim vectors)
   → upsert.py → document_chunks table (Postgres + pgvector, DigitalOcean)

Query time:
   user question → embed_texts() → cosine similarity search (pgvector <=> operator)
   → top-K chunks (+ source-diversity guarantees, see retriever.py) → Claude (claude-sonnet-4-6)
   → answer + token usage
```

Two parallel surfaces consume `rag/retriever.py`:
1. **Streamlit app** (`rag/chat_ui/app.py`) — current production frontend
2. **FastAPI** (`rag/api/query.py`) — `POST /query`, `GET /health`. Not currently deployed/run anywhere, but exists and works against the same retriever module. **This is the natural integration point for a Node.js frontend.**

---

## 3. Tech stack & key versions

| Layer | Choice |
|---|---|
| Cloud | DigitalOcean (droplet `s-1vcpu-2gb`, Ubuntu 22.04, region `blr1`) |
| Vector DB | pgvector on DO Managed Postgres, cluster `ev-research-db` |
| Embedding | `BAAI/bge-small-en-v1.5`, local CPU inference, 384 dims |
| LLM | `claude-sonnet-4-6` via Anthropic API (`anthropic` Python SDK) |
| Current frontend | Streamlit 1.58.0 + `streamlit-authenticator` 0.4.2 |
| Backend API (unused but ready) | FastAPI + Pydantic, `rag/api/query.py` |
| Local Python venv | **Python 3.14.0** — ⚠️ see §9, this is currently broken for local dev |
| Production Python | `python3.10` (per systemd ExecStart) |

---

## 4. Database schema (DigitalOcean Postgres)

### `document_chunks` — the knowledge base
```sql
CREATE TABLE document_chunks (
    id          BIGSERIAL PRIMARY KEY,
    source      TEXT NOT NULL,        -- google_play | app_store | news | web_pages | youtube
    app_name    TEXT NOT NULL,        -- e.g. 'chargepoint', 'tesla_powerwall'
    category    TEXT,                 -- 'ev_charging' | 'prosumer' (added in v2.0)
    content     TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    embedding   vector(384),          -- bge-small-en-v1.5; originally 1536 (OpenAI), migrated
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- ivfflat index on embedding (cosine ops), btree on app_name and source
```
17,642 chunks live as of last count (see CLAUDE.md for the per-source breakdown).

### `chat_sessions` — per-user chat history
```sql
CREATE TABLE chat_sessions (
    id          SERIAL PRIMARY KEY,
    username    TEXT NOT NULL,
    session_id  TEXT NOT NULL UNIQUE,   -- UUID, used as the app-level key
    title       TEXT NOT NULL DEFAULT 'New Chat',
    messages    JSONB NOT NULL DEFAULT '[]',  -- [{role, content, sources?, usage?}]
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `response_feedback` — per-message reactions
```sql
CREATE TABLE response_feedback (
    id          SERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL,
    message_idx INTEGER NOT NULL,      -- index into chat_sessions.messages
    username    TEXT NOT NULL,
    reaction    TEXT CHECK (reaction IN ('up','down','love')),
    comment     TEXT CHECK (char_length(comment) <= 100),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (session_id, message_idx)
);
```

### `query_logs` + `ragas_scores` — observability
```sql
CREATE TABLE query_logs (
    id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now(),
    username TEXT, session_id TEXT, app_filter TEXT,
    comparison_mode BOOLEAN DEFAULT false, source_filter TEXT,
    question TEXT NOT NULL, answer_text TEXT, context_chunks JSONB,
    chunks_returned INT DEFAULT 0, top_score FLOAT, avg_score FLOAT,
    retrieve_ms INT, generate_ms INT, total_ms INT,
    input_tokens INT, output_tokens INT, error TEXT
);
CREATE TABLE ragas_scores (
    id SERIAL PRIMARY KEY, query_log_id INT REFERENCES query_logs(id),
    evaluated_at TIMESTAMPTZ DEFAULT now(),
    faithfulness FLOAT, answer_relevancy FLOAT, context_precision FLOAT,
    eval_model TEXT DEFAULT 'claude-haiku-4-5', error TEXT
);
```
RAGAs scores are computed asynchronously by a background scheduler in the Admin Portal (`rag/chat_ui/ragas_eval.py`) using Claude Haiku as judge.

### `pipeline_runs` + `pipeline_schedules` — scraper run tracking
```sql
CREATE TABLE pipeline_runs (
    id SERIAL PRIMARY KEY, source TEXT NOT NULL, status TEXT DEFAULT 'running',
    started_at TIMESTAMPTZ DEFAULT now(), finished_at TIMESTAMPTZ,
    chunks_before INT, chunks_after INT, chunks_added INT, log_output TEXT
);
CREATE TABLE pipeline_schedules (
    source TEXT PRIMARY KEY, enabled BOOLEAN DEFAULT false,
    interval_days INT DEFAULT 7, last_run_at TIMESTAMPTZ, next_run_at TIMESTAMPTZ
);
```
`SOURCES = ["google_play", "app_store", "news", "web_pages", "youtube"]`

### Auth — NOT in Postgres
Users live in **`config/users.yaml`** (gitignored, bcrypt-hashed passwords), read/written directly by Python. No `users` table exists. See §6.

---

## 5. RAG retrieval API surface (`rag/retriever.py`)

These are the functions a Node.js backend-for-frontend would call (via the FastAPI wrapper, or by porting the logic):

```python
retrieve(question, app_filter=None, top_k=12, category_filter=None,
         min_youtube=2, min_news=2, min_web=2) -> list[chunk_dict]
retrieve_by_source(question, source, top_k=12) -> list[chunk_dict]
retrieve_per_app(question, n_per_app=3, app_list=None, category_filter=None) -> list[chunk_dict]
generate_answer(question, chunks) -> (answer_text: str, usage: dict)
```
`chunk_dict` = `{source, app_name, category, content, metadata, score}`.
`usage` = `{input_tokens, output_tokens, total_tokens, cache_read_input_tokens, cache_creation_input_tokens}`.

Notable behavior baked into `retrieve()`: it force-includes a minimum number of `youtube`/`news`/`web_pages` chunks even when they don't score well in pure cosine similarity, because reviews dominate by volume. Any reimplementation must preserve this or answer quality will visibly regress (less news/web citations).

**Existing FastAPI app** (`rag/api/query.py`) already exposes:
- `GET /health`
- `POST /query` — body `{question, app_filter?, top_k?}` → `{answer, sources: [{app_name, source, content, score, metadata}]}`

It does NOT currently expose `category_filter`, comparison mode, or source-specific retrieval — those exist only in the Streamlit app's direct calls to `retriever.py`. A Node.js migration should extend this FastAPI surface (or add equivalent endpoints) before cutting the Streamlit UI over, rather than re-deriving retrieval logic in JS.

`generate_answer` calls Claude directly with a hardcoded `SYSTEM_PROMPT` (full text in `retriever.py`) — describes both app categories and source types, instructs Claude to answer only from provided context.

---

## 6. Auth model — will need most rework for Node.js

- **Storage:** `config/users.yaml`, structure:
  ```yaml
  cookie:
    expiry_days: 30
    key: <secret>
    name: ev_research_auth
  credentials:
    usernames:
      <username>:
        name: <display name>
        password: <bcrypt hash>
        role: superadmin | superuser | user
  ```
- **Library:** `streamlit-authenticator==0.4.2`. Handles login form, bcrypt verification, a re-auth cookie, and logout — all tightly coupled to Streamlit's session_state and widget model. **None of this is portable to Node.js as-is.**
- **⚠️ Known quirk (already worked around in Python, must be replicated):** `streamlit-authenticator` lowercases ALL usernames on load and at login time. Any reimplementation must normalize usernames to lowercase consistently (we now do this on user creation too — see `1_Admin_Portal.py` `uname_val = ....strip().lower()`).
- **Roles:** `superadmin` (full access incl. user management), `superuser` (read-only admin views), `user` (chat only, no admin/observability access).
- **For Node.js:** plan to reimplement as JWT or session-cookie auth backed by a real `users` table (recommend migrating `users.yaml` → Postgres table with the same `name/password_hash/role` shape), or stand up a small auth microservice. Bcrypt hashes in the current yaml are NOT portable to a different hashing scheme without forcing a password reset.

---

## 7. Current Streamlit frontend — feature inventory to replicate

### Main chat page (`rag/chat_ui/app.py`, ~1250 lines)
- Login gate (streamlit-authenticator)
- Sidebar: brand, "New Chat" button, recent chats list (per-user, from `chat_sessions`), collapsible **Knowledge Base** stats panel, collapsible **Search Settings** (category/app/source filters, comparison mode toggle, top-K slider), **Tools** nav links (Admin Portal / Observability, role-gated), user identity block with role badge, sign-out
- Topbar: title + live KB stats + user menu popover
- Chat: empty-state example question pills, message history replay, `st.chat_input`, streaming-style status updates during retrieval/generation, expandable source-chunk citations with relevance score, **per-response feedback row** (👍👎❤️💬 + token/cost info) — see §8 for the bug just fixed here
- Comparison mode: fetches N chunks per app across up to 17 apps for cross-app questions
- Category filter: All / EV Charging / Prosumer (maps to `category` column)

### Admin Portal (`rag/chat_ui/pages/1_Admin_Portal.py`, role-gated: superadmin full, superuser read-only, user blocked)
5 tabs: **Overview** · **Data Sources** · **Automation** · **Run Logs** · **Users**
- Overview: KB chunk counts, pipeline health
- Data Sources: per-source/per-app chunk breakdown
- Automation: weekly schedule toggle per source, background thread fires overdue jobs every 30 min
- Run Logs: history of pipeline executions
- Users: add/delete/change-role/reset-password, generates random passwords, shareable credentials text block, bcrypt hashing on save

### Observability (`rag/chat_ui/pages/2_Observability.py`, role-gated same as Admin Portal)
5 tabs: **Inference** · **RAGAs Quality** · **Pipeline** · **Query Log** · **Errors**
- KPI cards (latency p50/p95, error rate, token usage), daily volume/latency/token trend charts, app distribution, RAGAs faithfulness/relevancy/context-precision trends, recent query table, recent errors table

### Shared sidebar nav (`rag/chat_ui/_sidebar_nav.py`)
Used by Admin Portal + Observability for consistent nav back to chat. Uses `st.page_link()` (not HTML anchors) specifically because anchors caused full-page reloads that destroyed the Streamlit session — **same root-cause class of bug as the feedback-bar fix in §8: anything that needs an in-app action must avoid triggering a real browser navigation/reload.** A Node.js SPA won't have this constraint (client-side routing solves it natively), which is actually one of the stronger arguments for the migration.

---

## 8. Volt design system (`NewDesign/`) — directly reusable for Node.js

A full design system was generated (via Claude Design) and partially wired into the Streamlit app. **This is the most directly portable asset for a Node.js/React rebuild** — it's framework-agnostic CSS + React component source already.

- **`NewDesign/styles.css`** — all design tokens as CSS custom properties + component classes (`.card`, `.badge`, `.pill`, `.chunk`, `.avatar`, `.btn`, `.input`, `.toggle`, `.feedback`, etc.)
- **`NewDesign/components/*.jsx` + `.d.ts`** — 18 React components already written: Avatar, Badge, Button, Card, ChatBubble, DataTable, ExamplePill, Expander, FeedbackBar, NavItem, Pill, Select, Slider, SourceChunk, StatCard, Tabs, TextField, Toggle
- **`NewDesign/templates/`** — full-page HTML mockups for **Admin**, **Chat**, **Login** (`.dc.html` + supporting JS)
- **Token themes available via `data-*` attributes:** accent color (violet/teal/blue/emerald/amber — default indigo `#4f46e5`), font (`plex`/`source`/default system), density (`compact`), chat width (`wide`)
- **Key tokens:** `--bg: #fff`, `--sidebar-bg: #0f172a`, `--sidebar-text: #e2e8f0`, `--accent: #4f46e5`, `--text-muted: #94a3b8`, role colors (`--role-superadmin: #4f46e5`, `--role-superuser: #16a34a`, `--role-user: #64748b`)

A Node.js frontend (React/Next.js especially) could import `NewDesign/components/*.jsx` close to as-is and `styles.css` directly, skipping most design-translation work.

---

## 9. ⚠️ Known issues / gotchas (read before touching the Python side again)

1. **Local `.venv` is on Python 3.14.0 and currently broken.** `pyarrow` (pulled in via `sentence-transformers` → `datasets`) segfaults (access violation) when first imported from a non-main thread — which is exactly how Streamlit executes scripts (`_run_script_thread`). Confirmed via `PYTHONFAULTHANDLER=1` traceback. Standalone `python -c "..."` imports work fine (main thread); only breaks inside Streamlit's threaded script runner. Production uses `python3.10` and doesn't hit this. **Not yet fixed** — user chose to defer (only Python 3.13/3.14 available locally; need 3.10/3.11 installed to match prod safely). This blocks ALL local Streamlit testing right now.
2. **`sentence-transformers` must import before `psycopg2`** on Windows generally (separate, older, already-mitigated DLL-order issue — see import order in `retriever.py` and `app.py`).
3. **`streamlit-authenticator` lowercases usernames** (load-time and login-time) — role lookups elsewhere in the app must do case-insensitive matching against `users.yaml` keys, or users with mixed-case usernames (e.g. email addresses) silently get downgraded to role `user`. Fixed in commit `17004bf` for `app.py`, Admin Portal, and Observability.
4. **`components.html()` iframes in Streamlit are sandboxed without `allow-top-navigation`** (confirmed via Streamlit's compiled `IFrameUtil.0n70gnmO.js`: sandbox = `allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-downloads`). Any code that tries `window.parent.location = ...` from inside one is silently vetoed by the browser — no JS exception, the click just does nothing. Fixed for the feedback bar in commit `06ab897` by switching to plain `onclick` attributes directly in `st.markdown(unsafe_allow_html=True)`, which run in the top-level (non-sandboxed) frame. Streamlit does NOT sanitize/strip onclick attributes from `unsafe_allow_html` markdown (verified — no DOMPurify/rehype-sanitize anywhere in the compiled frontend bundle), contrary to an earlier, incorrect assumption baked into the original feedback-bar code.
5. **`load_dotenv` needs `override=True`** everywhere `config/.env` is loaded — an empty `ANTHROPIC_API_KEY` exists in the Windows system environment and wins over the .env value otherwise.
6. **`config/users.yaml` was removed from git tracking** in commit `17004bf` (still exists on disk, gitignored now) because it holds bcrypt password hashes. Production's copy was preserved via backup/restore around the `git pull` during deploy — any future deploy script touching this repo must do the same (back up `config/users.yaml`, pull, restore) or it'll wipe production users.

---

## 10. Production deployment

- **URL:** `http://168.144.26.72`
- **Droplet:** DigitalOcean `s-1vcpu-2gb`, Ubuntu 22.04, region `blr1`
- **SSH:** `ssh -i "C:\Users\Admin\.ssh\ev_research_do" root@168.144.26.72`
- **Process:** systemd service `ev-research.service` → `streamlit run rag/chat_ui/app.py --server.port=8501 --server.address=127.0.0.1 --server.headless=true`, behind nginx (port 80 → 8501)
- **Restart:** `systemctl restart ev-research` · **Logs:** `journalctl -u ev-research -n 50`
- **Deploy path:** `git pull origin dev` then restart (no CI/CD pipeline — manual)
- Production currently on commit `06ab897` (deployed this session, includes the feedback-bar + role-lookup fixes)
- TLS: self-signed cert live; needs a real domain for a trusted cert

---

## 11. Config / credentials (names only — see `config/.env.example` for the full template)

`config/.env` (gitignored) holds: `DATABASE_URL`, `DATABASE_ADMIN_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `YOUTUBE_API_KEY`, `FIRECRAWL_API_KEY`, `DO_TOKEN`, `DO_SPACES_*`, `CHUNK_SIZE`, `CHUNK_OVERLAP`, `TOP_K`. A Node.js backend would need its own access to `DATABASE_URL` (Postgres/pgvector) and `ANTHROPIC_API_KEY` at minimum — likely by calling the existing/extended FastAPI service rather than holding these secrets in a JS process.

---

## 12. Git state at time of writing

- **Current branch:** `dev` (also exists: `main`, `feature/prosumer-expansion`, `release/v1.1.0`, `release/v2.0.0`, all with remotes)
- **Latest commits:** `06ab897` (feedback bar fix) → `17004bf` (Volt design + role lookup fix) → `13bc76e` (mobile redesign + feedback bar added) → ... → `9f7c167` (v2.0.0 prosumer expansion release)
- Working tree clean as of this dump.

---

## 13. Suggested approach for a Node.js frontend rebuild

Based on everything above, a sane migration path:
1. **Extend `rag/api/query.py`** (FastAPI) to cover everything the Streamlit app currently does directly against `retriever.py`: category filter, comparison mode, source-specific retrieval, and a way to get/post chat history, feedback, and (read-only) observability stats. Keep Python owning all RAG/DB logic — don't reimplement retrieval in JS.
2. **Stand up real auth** — migrate `config/users.yaml` into a Postgres `users` table (same `name`/`password_hash`/`role` shape, lowercased usernames) and issue JWTs or session cookies from a small auth endpoint (can live in the same FastAPI app). Don't try to reuse `streamlit-authenticator` outside Streamlit.
3. **Port the Volt design system directly** — `NewDesign/components/*.jsx` and `styles.css` are already React + plain CSS, framework-agnostic. This is the fastest-win part of the rebuild.
4. **Rebuild page-for-page:** Login → Chat (with sidebar filters, history, feedback) → Admin Portal (5 tabs) → Observability (5 tabs), using the FastAPI endpoints from step 1.
5. Don't port `streamlit-authenticator`'s cookie/session mechanics or any of the Streamlit-specific workarounds in §9 items 2–4 — those only existed because of Streamlit's execution model (script reruns, sandboxed `components.html`, session_state). A real SPA with client-side routing and a REST/WS backend sidesteps all of them by construction.
