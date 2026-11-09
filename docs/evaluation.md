# Evaluation

The repository ships deterministic checks, not benchmark results. No quality scores are reported because none have been measured on a reviewed dataset.

## What runs today

`backend/tests` (`uv run pytest`):

- Section detection, chunking with page provenance, BM25, and arXiv ID parsing.
- The citation contract: unknown `[E#]` IDs are rejected, uncited answers are flagged, and surviving citations resolve to the right chunks.
- The LangGraph workflow with a fake LangChain chat model: token streaming, the single repair pass, and abstention.
- An end-to-end API flow on a generated PDF: demo login, upload, processing, analysis, chat (JSON and SSE), feedback, deletion.

`paperpal.evals.runner` provides `recall_at_k` and `citation_ids_valid` for use against a golden set.

## Next steps

Build a small, hand-reviewed golden set (question, expected chunk IDs, reference answer) over several papers, then track retrieval recall@k and citation validity in CI, and add an LLM-judged groundedness metric once the set exists. Compare dense-only, BM25-only, and fused retrieval on that set before tuning chunk size or adding a reranker.
