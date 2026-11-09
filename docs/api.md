# API

Base path `/api/v1`; interactive docs at `/docs`. All routes except `/auth/config` and `/auth/demo` require `Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/auth/config` | Which auth methods and LLM are enabled |
| `POST` | `/auth/demo` | Issue a demo-session token (optional `{email, password}` body) |
| `GET` | `/auth/me` | The current user |
| `GET` | `/papers` | List the user's papers |
| `POST` | `/papers` | Upload a PDF (multipart `file`) |
| `POST` | `/papers/arxiv` | Add by `{arxiv_url}` (link or ID) |
| `GET` | `/papers/{id}` | Status, metadata, analysis |
| `GET` | `/papers/{id}/sections` | Detected section outline |
| `GET` | `/papers/{id}/pdf` | The private PDF |
| `POST` | `/papers/{id}/analyze` | Regenerate the analysis |
| `DELETE` | `/papers/{id}` | Delete the paper, PDF, vectors, and chats |
| `GET` | `/jobs/{id}` | Processing status and stage |
| `POST` | `/jobs/{id}/retry` | Retry a failed job |
| `POST` | `/papers/{id}/chat` | Ask a question (JSON response) |
| `POST` | `/papers/{id}/chat/stream` | Same, as server-sent events |
| `GET` | `/papers/{id}/conversations` | Conversation history |
| `GET` / `DELETE` | `/conversations/{id}` | Load or delete a conversation |
| `POST` | `/feedback` | `{message_id, rating: helpful \| unhelpful}` |
| `GET` | `/papers/{id}/related` | Related papers (verified citations vs. similarity) |
| `GET` | `/papers/{id}/graph` | Nodes and edges for the graph view |

Chat request: `{question, explanation_level: beginner|undergraduate|graduate|expert, conversation_id?}`.

SSE events: `status {stage}`, `route {task}`, `evidence {citations}`, `token {text}`, `final {answer, citations, task, insufficient_evidence, conversation_id, message_id}`, `error {detail}`. The `final` payload is authoritative; token text is a live preview.

A citation is `{ref, chunk_id, section, page_start, page_end, quote}`. Errors are `{"detail": "..."}` with the usual status codes (401, 404, 409 while processing, 413/415 for bad uploads, 502 for upstream services).
