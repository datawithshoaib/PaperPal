# PaperPal

PaperPal turns an academic PDF or arXiv paper into an interactive research workspace: a structured analysis, an evidence-grounded chat with four explanation levels, and a related-paper graph that keeps topic similarity separate from verified citations.

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui (Base UI), Motion, TanStack Query, React Flow |
| API | FastAPI, SQLAlchemy 2 (async), Alembic, Celery (optional) |
| LLM | Groq through `langchain-groq` (`llama-3.3-70b-versatile`, with `llama-3.1-8b-instant` for routing) |
| Orchestration | LangGraph supervisor graph with a citation-validation and repair loop |
| RAG | ChromaDB via `langchain-chroma`, local ONNX MiniLM embeddings, fused with BM25 (reciprocal rank fusion) |
| Auth | Supabase Auth (email/password + Google), plus a local demo account |

## Quick start

Requires Python 3.12+, [uv](https://docs.astral.sh/uv/), and Node.js 22+.

```powershell
python run.py
```

This creates `.env` from `.env.example` on first run, installs dependencies, and starts the API on <http://localhost:8000> (docs at `/docs`) and the web app on <http://localhost:3000>.

Open the web app and click **Try the demo account**. No keys are required: the demo account loads *Attention Is All You Need* from arXiv so there is something to explore immediately. The first paper takes a little longer because the embedding model (~80 MB) is downloaded once.

Other modes: `python run.py --api-only`, `--web-only`, or `--docker` (full stack, below).

### Add your Groq key

Without `GROQ_API_KEY` PaperPal still works using keyword routing and extractive answers (passages quoted with citations). With a key, the LangGraph agent routes each question, writes level-adapted answers, streams them, and writes the structured analysis.

1. Create a key at <https://console.groq.com/keys>.
2. Put it in `.env`: `GROQ_API_KEY=gsk_...`
3. Restart the API. The Overview tab will show an AI-written analysis (use **Re-analyze** for existing papers).

### Supabase auth and Google sign-in

1. Create a project at <https://supabase.com>. Under **Project Settings → API**, copy the project URL and the anon (publishable) key into `.env`:
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
2. **Authentication → URL Configuration**: set *Site URL* to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to *Redirect URLs*.
3. **Authentication → Providers → Google**: enable it with an OAuth client ID and secret from the [Google Cloud console](https://console.cloud.google.com/apis/credentials). Add Supabase's callback URL (`https://<ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI there.
4. Restart `python run.py`. For email sign-up, confirmation emails are on by default; turn them off under **Authentication → Providers → Email** for faster local testing.

The API verifies Supabase access tokens itself: asymmetric keys through the project's JWKS endpoint, and legacy HS256 projects through `SUPABASE_JWT_SECRET`. All data is scoped to the token's user ID.

### Demo account

`demo@paperpal.dev` / `paperpal-demo` (configurable via `DEMO_*` in `.env`). The login page signs in with one click; the API issues a short-lived token signed with `AUTH_SECRET`. Set `DEMO_ENABLED=false` for any shared deployment.

## Docker Compose

```powershell
python run.py --docker
```

Starts Postgres, Redis, a Chroma server, the API (running Alembic migrations), a Celery worker, and the web app. The Compose path was written against the same settings as the local one but has not been exercised in CI; check `docker compose logs` if a service fails to come up.

## Repository layout

```
apps/web/                  Next.js app
  app/                       routes: landing, login, signup, auth/callback, (app)/dashboard, (app)/papers/[paperId]
  components/                ui (shadcn), brand, landing, app shell, paper, chat, graph
  lib/                       api client + SSE, auth, supabase, hooks, types
backend/src/paperpal/
  api/v1/                    routers: auth, papers, jobs, chat, related
  agents/                    LangGraph: state, prompts, graph, nodes/{router,research,conversation}
  rag/                       ChromaDB store, embeddings, BM25, hybrid retriever
  ingestion/                 PDF parser, section detection, chunker, arXiv client
  services/                  paper, ingestion, chat, analysis, related-paper, storage, llm
  core/                      config, security (JWT), exceptions, logging
  db/, schemas/, workers/, evals/
backend/tests/             unit, agent (fake LLM), and end-to-end API tests
infra/compose.yaml         full stack
docs/                      architecture, API, security, evaluation
```

## Development

```powershell
cd backend; uv run pytest; uv run ruff check src tests     # 26 tests
cd apps/web; npm run lint; npx tsc --noEmit; npm run build
```

## Known limits

- Scanned PDFs need OCR, which isn't implemented; they fail with a clear message.
- Section detection is heuristic (headings such as "3.2 Method"). Tables and equations are extracted as plain text.
- Related papers: verified citation links come from Semantic Scholar (public API, rate limited, arXiv-ID papers only); topic-similar papers come from arXiv search. If either service is down, the other's results are still shown.
- Embeddings run locally with Chroma's default ONNX model. Groq has no embedding endpoint.
- Chroma runs embedded for local development. With Celery the API and worker must share a Chroma *server* (Compose does this).
- No quality benchmark numbers are claimed; `evals/` contains deterministic metric helpers only. See [evaluation](docs/evaluation.md).

See [architecture](docs/architecture.md), [API](docs/api.md), and [security](docs/security.md).
