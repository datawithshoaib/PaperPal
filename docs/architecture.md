# Architecture

```
Browser (Next.js) ──Bearer JWT──▶ FastAPI ──▶ SQLAlchemy (SQLite / Postgres)
   │  Supabase Auth                  │──▶ ChromaDB (chunk embeddings)
   └─ or demo token                  │──▶ Groq via LangChain (routing, answers, analysis)
                                     └──▶ arXiv + Semantic Scholar (related papers)
```

## Ingestion

`POST /papers` or `/papers/arxiv` stores the PDF privately, creates a `Paper` and a `ProcessingJob`, and dispatches `process_paper`: in-process locally, through Celery when `USE_CELERY=true`. The job advances through `parsing → embedding → analyzing → done`, and the UI polls it.

1. **Parse** (`ingestion/parser.py`): PyMuPDF text blocks in reading order, each tagged with its page.
2. **Sections** (`ingestion/sections.py`): headings such as `1 Introduction` or `3.2 Experimental Setup` map to canonical types (`method`, `results`, `limitations`, ...). Text before the first heading is `front_matter`.
3. **Chunk** (`ingestion/chunker.py`): paragraphs are packed into ~2,200-character chunks that never cross a section boundary and remember their page range.
4. **Index** (`rag/vectorstore.py`): chunks are embedded locally (ONNX MiniLM) into a Chroma collection filtered by `paper_id`.
5. **Analyze** (`services/analysis_service.py`): Groq structured output (`PaperAnalysis`), or extractive fallback.

## Research graph

```
START → route ─┬─ retrieve → answer → validate ─┬─ finalize → END
               │                  ▲              └─ repair ─┘ (once)
               ├─ related_papers → END
               └─ general → END
```

- **route**: the fast Groq model returns a structured `Route` (task + standalone search query using conversation history). Keyword routing is the fallback.
- **retrieve**: BM25 and Chroma dense search, fused with reciprocal rank fusion, with a boost for sections that suit the task. References and title-page text are excluded unless asked for.
- **answer**: the evidence policy prompt plus an explanation-level instruction. Evidence is passed as `[E1]...[En]`; the model must cite inline. Tokens stream to the client.
- **validate**: server-side contract. Every cited ID must exist in the supplied evidence, and a non-abstaining answer must cite something. One repair attempt runs on violation.
- **finalize**: strips unresolved markers and resolves surviving citations to chunk IDs, sections, pages, and quotes. An answer with no valid citations is flagged `insufficient_evidence`.
- **related_papers**: Semantic Scholar references/citations (verified) and arXiv search (similarity), summarized by the model.

State stays compact: chunks are loaded per request and passed through LangGraph's `configurable`, not the state.

## Frontend

Client-held tokens (Supabase session or demo token) are attached by `lib/api.ts`. The chat uses `fetch` streaming over SSE (`status`, `route`, `evidence`, `token`, `final`, `error`). Model output renders through `react-markdown` without raw HTML; `[E#]` markers become buttons that open the PDF at the cited page.
