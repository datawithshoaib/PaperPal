# PaperPal --- Production-Grade AI Research Assistant

**Technical Design Document**\
**Stack:** Python · LangChain · LangGraph · FastAPI ·
PostgreSQL/pgvector · Next.js · shadcn/ui\
**Purpose:** Build an end-to-end research assistant that explains
academic papers, extracts methods and limitations, finds related
research, provides evidence-grounded answers, and evaluates its own
quality.

------------------------------------------------------------------------

## 1. Product Vision

PaperPal accepts an arXiv link or PDF and turns it into an interactive
research experience. Users can ask questions, choose an explanation
level, inspect evidence, explore related papers, and view citation
relationships.

### Core features

1.  **Paper ingestion:** Upload a PDF or submit an arXiv URL. Extract
    text, equations where possible, tables, references, page
    information, and section boundaries.
2.  **Multi-level explanations:** Explain the paper at beginner,
    undergraduate, graduate, or expert level.
3.  **Structured paper analysis:** Extract the problem statement,
    contributions, methodology, experiments, findings, assumptions, and
    limitations.
4.  **Evidence-grounded research chat:** Answer questions with citations
    to source chunks, sections, and page ranges.
5.  **Related-paper discovery:** Retrieve semantically related papers
    and enrich them with scholarly metadata.
6.  **Citation graph:** Visualize verified citation relationships
    separately from semantic similarity.
7.  **Evaluation and monitoring:** Measure retrieval quality, answer
    correctness, groundedness, citation quality, latency, cost, and
    failure rates.

### Why this is a strong AI engineering portfolio project

It demonstrates agent orchestration, RAG, structured outputs,
asynchronous processing, persistent state, evaluation pipelines,
observability, security, full-stack development, and deployment. The
objective is not simply to create a PDF chatbot, but to build a testable
research system that explains its evidence and exposes measurable
quality.

------------------------------------------------------------------------

## 2. Recommended Technology Stack

  -----------------------------------------------------------------------
  Layer                   Recommended technology  Purpose
  ----------------------- ----------------------- -----------------------
  Frontend                Next.js App Router,     Web application and
                          TypeScript              routing

  UI                      Tailwind CSS, shadcn/ui Accessible UI
                                                  components and styling

  Graph UI                `@xyflow/react` or      Interactive paper
                          Cytoscape.js            relationship graph

  PDF viewer              PDF.js / `react-pdf`    Read papers and
                                                  navigate pages

  API                     FastAPI, Pydantic       Typed REST APIs,
                                                  validation, streaming

  Agent orchestration     LangGraph               State, routing,
                                                  workflow control,
                                                  retries

  LLM integration         LangChain               Model interface,
                                                  prompts, structured
                                                  output

  LLM provider            Configurable hosted     Summaries, reasoning,
                          model provider          synthesis

  Embeddings              Configurable embedding  Dense semantic
                          model                   retrieval

  Reranking               Optional reranker       Improve ranking of
                                                  retrieved evidence

  Database                PostgreSQL              Application data and
                                                  metadata

  Vector search           pgvector                Store and search
                                                  embeddings

  ORM/migrations          SQLAlchemy 2.x, Alembic Database access and
                                                  schema migrations

  PDF parsing             PyMuPDF                 Fast text extraction
                                                  and page metadata

  Layout-aware parsing    Docling, optionally     Tables, layout, reading
                                                  order

  Scholarly parsing       GROBID, optionally      Bibliographic metadata
                                                  and references

  Queue                   Celery or ARQ, choose   Background jobs
                          one                     

  Queue backend           Redis                   Queue and transient
                                                  coordination

  Object storage          S3-compatible or cloud  Original PDF files
                          object storage          

  Testing                 pytest, pytest-asyncio  Unit and integration
                                                  tests

  Evaluation              DeepEval                Automated RAG and
                                                  answer evaluation

  Observability           LangSmith,              Tracing, debugging,
                          OpenTelemetry           latency and evaluation

  Logging                 structlog or standard   Structured operational
                          structured logging      logs

  Packaging               uv                      Python environment and
                                                  dependency locking

  Deployment              Docker, Docker Compose  Reproducible
                                                  environments

  CI/CD                   GitHub Actions          Tests, linting,
                                                  evaluation gates,
                                                  deployment
  -----------------------------------------------------------------------

### Key architecture decisions

-   **Use LangGraph rather than an unconstrained agent swarm.** Define
    nodes, state, conditional edges, tool permissions, and bounded
    retries explicitly.
-   **Start with PostgreSQL + pgvector.** It can store application
    records, metadata, and vectors. Add a dedicated vector database only
    if measured scale or retrieval requirements justify it.
-   **Process PDFs asynchronously.** API requests should enqueue jobs
    rather than parsing large files in the request process.
-   **Use LangSmith and DeepEval for different purposes.** LangSmith
    helps inspect execution traces and experiments; DeepEval provides
    automated quality tests.
-   **Store PDFs in object storage.** Store only storage keys and
    metadata in PostgreSQL, rather than large binary files in database
    rows.
-   **Keep model and embedding configuration centralized.** Avoid
    hardcoding provider-specific model names throughout the application.

------------------------------------------------------------------------

## 3. High-Level System Architecture

PaperPal has two main execution paths: synchronous user interactions and
asynchronous document processing.

``` mermaid
flowchart TD
    UI[Next.js + shadcn/ui] --> API[FastAPI]
    API --> AUTH[Authentication, validation, quotas]
    AUTH --> GRAPH[LangGraph research workflows]
    AUTH --> QUEUE[Background job queue]
    QUEUE --> WORKER[PDF processing worker]
    GRAPH --> SERVICES[Application services]
    WORKER --> SERVICES
    SERVICES --> DB[(PostgreSQL + pgvector)]
    SERVICES --> STORE[(PDF object storage)]
    GRAPH --> LLM[LLM and embedding provider]
    WORKER --> EMBED[Embedding service]
    EMBED --> DB
    GRAPH --> TRACE[LangSmith / OpenTelemetry]
    WORKER --> TRACE
```

### Flow A --- Add a paper

1.  Frontend sends an arXiv identifier, arXiv URL, or PDF upload to
    FastAPI.
2.  API validates the request, checks quotas, creates a paper record,
    and queues a processing job.
3.  Worker retrieves the PDF if needed and stores it.
4.  Parser extracts text and layout metadata, including page and section
    information.
5.  Chunker creates section-aware chunks with provenance metadata.
6.  Embedding service generates vectors and persists the chunks.
7.  Paper analysis is generated or scheduled.
8.  Job status becomes `ready`, or a recoverable failure state with an
    error code.
9.  Frontend polls job status or receives status events.

### Flow B --- Ask a research question

1.  Frontend sends paper ID, question, conversation ID, and explanation
    level.
2.  FastAPI authenticates the user and checks access to the paper.
3.  LangGraph classifies the task and routes it to retrieval, analysis,
    explanation, or related-paper discovery.
4.  Retrieval returns evidence chunks and optionally reranks them.
5.  Answer node generates a structured answer with evidence references.
6.  Validation node checks output structure, citation IDs, and source
    metadata.
7.  Backend streams the answer and verified citations to the frontend.
8.  Trace and quality signals are recorded.

**Citation rule:** Do not let the model invent page numbers or citation
IDs. Resolve citations from stored chunk metadata.

------------------------------------------------------------------------

## 4. LangGraph Agent Architecture

Use a supervisor-style graph with explicit routing. Agents are logical
responsibilities and do not need to be independent autonomous processes.

``` mermaid
flowchart TD
    START([START]) --> VALIDATE[Validate request and access]
    VALIDATE --> SUPERVISOR[Research supervisor]
    SUPERVISOR -->|Summary / method / limitations| ANALYST[Paper analyst]
    SUPERVISOR -->|Question about paper| RETRIEVE[Retrieve evidence]
    SUPERVISOR -->|Adjust explanation level| EXPLAIN[Explanation node]
    SUPERVISOR -->|Find related work| RELATED[Related-paper search]
    RETRIEVE --> ANSWER[Generate evidence-grounded answer]
    ANALYST --> VALIDATE_OUT[Validate structured output]
    EXPLAIN --> VALIDATE_OUT
    ANSWER --> VALIDATE_OUT
    RELATED --> VALIDATE_OUT
    VALIDATE_OUT -->|Valid| SAVE[Persist result and citations]
    VALIDATE_OUT -->|Retry within budget| REPAIR[Correct invalid output]
    REPAIR --> VALIDATE_OUT
    VALIDATE_OUT -->|Budget exceeded| ABSTAIN[Return safe failure / abstention]
    SAVE --> END([END])
    ABSTAIN --> END
```

### Responsibilities

  -----------------------------------------------------------------------
  Component               Responsibility          Tools
  ----------------------- ----------------------- -----------------------
  Supervisor              Classify intent and     Bounded routing model
                          choose a workflow       or deterministic
                                                  routing

  Paper analyst           Extract summary,        Section retriever,
                          contributions, method,  metadata
                          results, limitations    

  RAG researcher          Answer questions with   Vector search, optional
                          source evidence         keyword search and
                                                  reranker

  Related-paper agent     Find and rank relevant  arXiv metadata and
                          publications            scholarly APIs

  Explanation node        Adapt supported         Paper analysis and
                          explanation to          retrieved evidence
                          requested level         

  Validator               Enforce output and      Pydantic validation and
                          citation contracts      citation lookup
  -----------------------------------------------------------------------

For the MVP, prefer ordinary Python functions and bounded LLM calls
inside graph nodes. This is easier to test and cheaper to run than an
unconstrained multi-agent system.

### Example graph state

``` python
from typing import Literal
from typing_extensions import TypedDict


class ResearchState(TypedDict, total=False):
    user_id: str
    paper_id: str
    question: str
    task: Literal[
        "summarize",
        "explain",
        "methodology",
        "limitations",
        "question_answer",
        "related_papers",
    ]
    explanation_level: Literal[
        "beginner", "undergraduate", "graduate", "expert"
    ]
    retrieved_chunks: list[dict]
    answer: dict
    validation_errors: list[str]
    retry_count: int
```

Keep state compact. Pass chunk IDs and concise metadata rather than
copying full paper text through every node. Never place credentials, raw
uploaded files, or unrelated users' private information in shared state.

### Routing and recovery rules

-   Unsupported task: ask for clarification or return a supported-task
    message.
-   No relevant evidence: state that the paper does not establish the
    claim.
-   Invalid structured output: retry once with a correction prompt, then
    fail safely.
-   Invalid citation ID: reject it and regenerate or abstain.
-   Transient model or retrieval failure: bounded retry with backoff,
    then a recoverable error.
-   Execution budget exceeded: stop and persist failure status.
-   External paper-search outage: return the available main-paper
    analysis without fabricating results.

Use LangGraph persistence/checkpointing when resumability or
conversation continuity is required. Avoid persisting sensitive data
unnecessarily.

------------------------------------------------------------------------

## 5. PDF Ingestion and Section-Aware RAG

Document processing is a core quality component. Poor extraction or
chunking can make a strong LLM produce poor answers.

### 5.1 PDF processing pipeline

``` mermaid
flowchart TD
    A[PDF or arXiv source] --> B[Validate and store safely]
    B --> C[Extract text and layout]
    C --> D[Detect sections and metadata]
    D --> E[Section-aware chunking]
    E --> F[Generate embeddings]
    F --> G[Persist chunks and vectors]
    G --> H[Paper is ready for retrieval]
```

### Parser recommendations

-   **PyMuPDF:** fast text extraction, page information, and basic PDF
    processing.
-   **Docling:** use when layout, tables, reading order, and structured
    document representation matter.
-   **GROBID:** useful for scholarly structure, bibliographic metadata,
    and reference extraction.
-   **OCR:** a separate fallback for scanned documents with little or no
    extractable text.

Do not run every parser for every paper. Start with PyMuPDF, detect
extraction quality issues, and add a layout-aware fallback when needed.

### 5.2 Initial chunking configuration

These are starting values to test, not guaranteed optimal settings.

  Parameter             Initial value
  --------------------- ----------------------------
  Chunk size            500--800 tokens
  Chunk overlap         80--120 tokens
  Retrieval top-k       5--8 chunks
  Reranked context      3--5 chunks
  Boundary preference   Paragraphs within sections

Use section boundaries as the primary constraint. Split oversized
sections into paragraph groups and then into token-bounded chunks.
Retain the parent section and page range.

### Example chunk metadata

``` python
chunk = {
    "chunk_id": "uuid",
    "paper_id": "uuid",
    "section_title": "Experiments",
    "section_type": "experiments",
    "page_start": 7,
    "page_end": 8,
    "text": "...",
    "token_count": 620,
    "chunk_index": 14,
    "parser_version": "v1",
    "embedding_model": "configured-model-id",
}
```

Page ranges and section names must come from extraction metadata; do not
infer them from chunk position.

### 5.3 Retrieval strategy

1.  Filter to the selected paper for paper-specific questions.
2.  Use section filters when helpful, such as prioritizing Methods for
    methodology questions.
3.  Add keyword search for exact terms, acronyms, model names, and
    equations.
4.  Combine dense and lexical retrieval if evaluation shows improvement.
5.  Add a reranker if it improves context precision on the test dataset.
6.  Tune chunk size and top-k based on retrieval evaluation.

The goal is to retrieve the smallest set of evidence that supports a
complete answer, not the largest possible context.

### 5.4 Multi-level explanation

Use one explanation pipeline with a validated `explanation_level`
parameter.

  -----------------------------------------------------------------------
  Level                               Expected output
  ----------------------------------- -----------------------------------
  Beginner                            Everyday analogy, core idea,
                                      minimal jargon

  Undergraduate                       Technical intuition, prerequisites,
                                      equations explained

  Graduate                            Method details, assumptions,
                                      experimental design, comparisons

  Expert                              Formal formulation, novelty,
                                      caveats, reproducibility concerns
  -----------------------------------------------------------------------

All levels must preserve factual accuracy. Simplify language, not the
paper's claims or limitations.

### Shared evidence policy prompt

``` text
You are PaperPal, an academic research assistant.

Use the supplied paper evidence to support claims about the paper.
Do not invent results, equations, experimental details, or citations.
Distinguish statements made by the authors from your own interpretation.
If the evidence is insufficient, state what is unknown.
Keep the requested explanation level without changing the meaning.
Return citations that reference only the supplied evidence IDs.
```

Pair prompts with server-side citation validation. Prompt instructions
alone do not guarantee correctness.

------------------------------------------------------------------------

## 6. Related-Paper Discovery and Citation Graph

Distinguish three relationships:

-   **Semantic similarity:** papers discuss similar ideas, methods, or
    problems.
-   **Citation relationship:** one paper cites another.
-   **Research lineage:** papers extend, compare against, or build on
    earlier work.

Do not treat similarity as proof of citation.

### Data sources

Use arXiv for discovery and metadata when available. Add Semantic
Scholar or another scholarly metadata provider for citation
relationships and broader coverage, subject to API availability and rate
limits.

### Discovery pipeline

1.  Retrieve candidate papers using title, abstract, keywords, and
    embeddings.
2.  Exclude the original paper and deduplicate using DOI, arXiv ID, or
    normalized title.
3.  Rank candidates using semantic similarity and metadata.
4.  Enrich candidates with verified citation relationships where
    available.
5.  Show why each paper is related, with links to the publisher or arXiv
    record.

### Graph schemas

``` python
from typing import Literal
from pydantic import BaseModel, HttpUrl


class PaperNode(BaseModel):
    paper_id: str
    title: str
    year: int | None = None
    url: HttpUrl | None = None


class PaperEdge(BaseModel):
    source_id: str
    target_id: str
    relation: Literal[
        "cites",
        "cited_by",
        "similar_to",
        "extends",
        "compares_with",
    ]
    confidence: float | None = None
```

Only set a confidence score where a meaningful, defined score exists.
For confirmed citation metadata, represent the relationship as verified
rather than assigning an arbitrary confidence.

### Graph UI

Use `@xyflow/react` or Cytoscape.js. Include:

-   Different styles for citation and similarity edges.
-   Clickable paper nodes and a paper details panel.
-   A legend and filters for edge types.
-   A depth and node limit.
-   Links to source records.
-   An accessible list alternative to the graph.

------------------------------------------------------------------------

## 7. Database Design

Use PostgreSQL as the system of record. Implement models with SQLAlchemy
2.x and migrations with Alembic.

  -----------------------------------------------------------------------
  Table                   Important fields        Purpose
  ----------------------- ----------------------- -----------------------
  `users`                 `id`, `email`,          User accounts
                          `created_at`            

  `papers`                `id`, `owner_id`,       Paper identity and
                          `title`, `arxiv_id`,    lifecycle
                          `doi`, `status`,        
                          `storage_key`           

  `paper_sections`        `id`, `paper_id`,       Extracted structure
                          `title`,                
                          `section_type`,         
                          `page_start`,           
                          `page_end`              

  `paper_chunks`          `id`, `paper_id`,       Searchable evidence
                          `section_id`, `text`,   
                          `page_start`,           
                          `page_end`, `embedding` 

  `processing_jobs`       `id`, `paper_id`,       Background job
                          `status`, `attempts`,   lifecycle
                          `error_code`            

  `paper_analyses`        `id`, `paper_id`,       Summary, method,
                          `analysis_type`,        limitations
                          `schema_version`,       
                          `result_json`           

  `conversations`         `id`, `user_id`,        Chat sessions
                          `paper_id`              

  `messages`              `id`,                   Chat history
                          `conversation_id`,      
                          `role`, `content`,      
                          `created_at`            

  `message_citations`     `message_id`,           Verified answer
                          `chunk_id`, `quote`,    evidence
                          `page_number`           

  `paper_relationships`   `source_paper_id`,      Citation and similarity
                          `target_paper_id`,      graph
                          `relation_type`,        
                          `source_provider`       

  `evaluation_runs`       `id`,                   Evaluation history
                          `dataset_version`,      
                          `model_config`,         
                          `metrics_json`          
  -----------------------------------------------------------------------

### Data rules

-   Use UUIDs for internal identifiers.
-   Store embedding model IDs and versions so vectors can be reindexed
    safely.
-   Enforce ownership checks for user-uploaded papers and conversations.
-   Add unique constraints for normalized arXiv identifiers where
    appropriate.
-   Track parser and chunker versions.
-   Store PDFs in object storage and only store the storage key in
    PostgreSQL.
-   Version analysis schemas.
-   Index common filters such as paper ID, owner ID, job status, and
    normalized arXiv ID.
-   Select vector indexes based on corpus size and requirements; measure
    recall and latency before tuning.

------------------------------------------------------------------------

## 8. FastAPI Backend Design

Keep the API layer thin. It authenticates, validates input, calls
application services, and returns well-defined responses. Graph nodes
should not depend directly on HTTP request objects.

### Initial endpoint specification

  -------------------------------------------------------------------------------------------
  Method                  Endpoint                                    Purpose
  ----------------------- ------------------------------------------- -----------------------
  POST                    `/api/v1/papers`                            Upload a PDF or
                                                                      register a supported
                                                                      source

  GET                     `/api/v1/papers`                            List the authenticated
                                                                      user's papers

  GET                     `/api/v1/papers/{paper_id}`                 Get paper metadata,
                                                                      status, and analysis

  DELETE                  `/api/v1/papers/{paper_id}`                 Delete paper and
                                                                      related data per
                                                                      retention policy

  GET                     `/api/v1/jobs/{job_id}`                     Poll processing status
                                                                      and errors

  POST                    `/api/v1/papers/{paper_id}/analyze`         Generate or regenerate
                                                                      structured analysis

  POST                    `/api/v1/papers/{paper_id}/chat`            Ask a question,
                                                                      optionally streaming

  GET                     `/api/v1/papers/{paper_id}/related`         Retrieve and rank
                                                                      related papers

  GET                     `/api/v1/papers/{paper_id}/graph`           Return citation graph
                                                                      nodes and edges

  GET                     `/api/v1/conversations/{conversation_id}`   Load conversation
                                                                      history

  POST                    `/api/v1/feedback`                          Record user feedback
  -------------------------------------------------------------------------------------------

This is an initial contract. Add pagination, standardized error
responses, authentication, and ownership checks consistently.

### Example request

``` json
{
  "question": "What are the main limitations of this method?",
  "explanation_level": "undergraduate",
  "stream": false
}
```

### Example response

``` json
{
  "answer": "The paper identifies limitations related to ...",
  "citations": [
    {
      "chunk_id": "chunk-uuid",
      "section": "Limitations",
      "page_start": 10,
      "page_end": 11,
      "quote": "Verified excerpt from the source paper"
    }
  ],
  "insufficient_evidence": false
}
```

The text is illustrative. In the application, each citation must resolve
to a stored chunk and source metadata.

### Server-Sent Events (SSE)

Use SSE as the initial chat streaming mechanism. Define a stable event
contract:

``` text
event: run_started
data: {"run_id":"..."}

event: token
data: {"text":"The paper proposes..."}

event: citations
data: {"citations":[...]}

event: run_completed
data: {"run_id":"...","status":"completed"}
```

Support structured error events. Define reconnect behavior and event IDs
if resumable streaming is required. Handle client cancellation
explicitly so disconnected users do not leave unnecessary work running.

For citation-sensitive answers, render citations as verified only after
validation. Do not treat every intermediate token as a trustworthy final
answer.

------------------------------------------------------------------------

## 9. Frontend Design --- Next.js + shadcn/ui

Use Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui.

### Suggested pages

  -----------------------------------------------------------------------
  Route                               Purpose
  ----------------------------------- -----------------------------------
  `/dashboard`                        Recent papers, upload area,
                                      processing status, research history

  `/papers/[paperId]`                 Paper overview, PDF viewer, chat,
                                      summary, method, limitations,
                                      citations

  `/papers/[paperId]/graph`           Related-paper network and details

  `/admin/evaluations`                Restricted evaluation runs, quality
                                      trends, failures, model comparisons
  -----------------------------------------------------------------------

### Components

-   `PaperUploadDialog`
-   `PaperProcessingStatus`
-   `PaperMetadataCard`
-   `PaperOutline`
-   `PDFViewer`
-   `ExplanationLevelSelector`
-   `ResearchChat`
-   `StreamingMessage`
-   `CitationCard`
-   `EvidencePanel`
-   `RelatedPaperList`
-   `CitationGraph`
-   `FeedbackButtons`
-   `EvaluationRunTable`

Use PDF.js or `react-pdf` for document navigation. Ensure the PDF worker
and library versions are compatible with the frontend build.

### Frontend state and API integration

-   Use server components for initial page loading where appropriate.
-   Use client components for streaming chat, graph interactions,
    uploads, and other stateful UI.
-   Generate a typed API client from FastAPI's OpenAPI schema, or
    maintain a typed client with contract tests.
-   Use TanStack Query if caching, mutations, background refetching, and
    job polling are useful.
-   Handle loading, empty, partial, retry, and failure states.
-   Preserve the selected explanation level.
-   Render Markdown safely; never allow untrusted PDF text or model
    output to become executable HTML.
-   Never expose provider keys, database credentials, internal traces,
    or privileged evaluation endpoints to the browser.

------------------------------------------------------------------------

## 10. Evaluation Framework

Evaluation should be a first-class project feature. The system should be
able to demonstrate not just that it runs, but that its quality can be
measured and improved.

Use **DeepEval** for automated quality tests and **LangSmith** for
traces, debugging, and evaluation experiments.

### 10.1 What to evaluate

#### Retrieval quality

-   Contextual relevancy.
-   Contextual precision and recall where reference evidence exists.
-   Recall@k and reciprocal rank on a labelled retrieval dataset.

#### Answer quality

-   Faithfulness / groundedness.
-   Answer relevancy.
-   Correctness against reviewed reference answers.
-   Appropriate abstention when evidence is insufficient.

#### Citation quality

-   Citation resolves to a real chunk.
-   Cited excerpt supports the associated claim.
-   Page and section metadata are correct.
-   Factual claims have adequate citation coverage.

#### Agent behavior

-   Correct route selection.
-   Tool selection and argument validity.
-   Task completion.
-   Retry count and unnecessary tool calls.

#### Operational performance

-   p50/p95 latency.
-   Error and timeout rates.
-   Token usage and cost per task.
-   PDF processing duration and queue delay.

### 10.2 Golden evaluation dataset

Start with roughly 50--100 carefully selected questions across 5--10
papers. Expand as failures are found. A small, reviewed dataset is more
useful than a large synthetic dataset that has not been checked.

Example record:

``` json
{
  "paper_id": "paper-001",
  "question": "What baseline models did the authors compare against?",
  "expected_answer": "The paper compares against the baselines listed in its experiments section.",
  "reference_chunk_ids": ["chunk-14", "chunk-16"],
  "task": "question_answer",
  "explanation_level": "undergraduate",
  "expected_citation_pages": [7, 8]
}
```

Include: - Questions answered in the abstract. - Questions requiring
multiple sections. - Methodology and limitations. - Tables, figures,
equations, and ambiguous references. - Questions that cannot be answered
from the paper. - Poorly extracted or scanned papers. - Prompt injection
attempts embedded in document content. - Questions with multiple
plausible interpretations.

Expected answers and reference chunks should be reviewed by a human.
Synthetic questions are candidates, not ground truth.

### 10.3 Initial quality gates

These are proposed project targets, not measured results or universal
industry benchmarks.

  -----------------------------------------------------------------------
  Metric                                                   Initial target
  ------------------------------ ----------------------------------------
  Retrieval Recall@5 on labelled                                 \>= 0.80
  queries                        

  Faithfulness score                                             \>= 0.85

  Answer relevancy score                                         \>= 0.85

  Citation ID validity                                               100%

  Verified citation support                                      \>= 0.90

  Correct abstention on                                          \>= 0.90
  unanswerable cases             

  API error rate under                   Define and measure before launch
  representative load            
  -----------------------------------------------------------------------

LLM-as-a-judge scores are imperfect proxies. Pair them with
deterministic citation checks, human review, and regression tests. A
high average score does not compensate for a fabricated critical result.

### 10.4 Example DeepEval test

Adapt imports and model configuration to the pinned DeepEval version in
the project.

``` python
from deepeval import assert_test
from deepeval.metrics import (
    AnswerRelevancyMetric,
    FaithfulnessMetric,
)
from deepeval.test_case import LLMTestCase


def test_paper_answer_is_grounded():
    question = "What limitations do the authors report?"

    answer, contexts = run_paper_rag(
        paper_id="paper-001",
        question=question,
    )

    test_case = LLMTestCase(
        input=question,
        actual_output=answer.text,
        retrieval_context=contexts,
    )

    metrics = [
        FaithfulnessMetric(threshold=0.85),
        AnswerRelevancyMetric(threshold=0.85),
    ]

    assert_test(test_case, metrics)
```

`run_paper_rag` is an application service to implement. The thresholds
are initial choices to validate on your dataset.

### 10.5 Deterministic citation ID validation

Do not use an LLM judge to check whether a citation ID exists.

``` python
def validate_citations(
    citation_ids: list[str],
    retrieved_chunk_ids: set[str],
) -> bool:
    if not citation_ids:
        return False

    return all(
        citation_id in retrieved_chunk_ids
        for citation_id in citation_ids
    )
```

This validates ID membership only. A separate test must assess whether
each cited passage supports its claim.

### 10.6 CI/CD evaluation policy

Every pull request should run: 1. Unit tests for parsing, chunking,
access control, and citations. 2. Integration tests for database
operations and graph execution. 3. A fast, deterministic subset of the
golden dataset. 4. LLM evaluations when prompts, models, retrieval, or
routing change. 5. Security tests for malicious files, prompt injection,
and unauthorized access.

Run larger evaluation suites nightly or before major releases. Compare
against a saved baseline and block releases for meaningful regressions.
Record model versions, prompts, dataset versions, and application commit
IDs for reproducibility.

------------------------------------------------------------------------

## 11. Production-Grade Python Repository Structure

Use `uv` for Python environment and dependency management. Commit
`uv.lock` so exact resolved versions are reproducible. Pin a supported
Python version and pin container base images and frontend dependencies.

``` text
paperpal/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   ├── dashboard/
│       │   ├── papers/[paperId]/
│       │   ├── papers/[paperId]/graph/
│       │   └── admin/evaluations/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       ├── types/
│       └── package.json
├── backend/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── alembic.ini
│   ├── alembic/
│   ├── src/paperpal/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── dependencies.py
│   │   │   └── v1/
│   │   │       ├── papers.py
│   │   │       ├── chat.py
│   │   │       ├── jobs.py
│   │   │       ├── related.py
│   │   │       └── feedback.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── logging.py
│   │   │   └── exceptions.py
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   ├── models/
│   │   │   └── repositories/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── paper_service.py
│   │   │   ├── ingestion_service.py
│   │   │   ├── retrieval_service.py
│   │   │   ├── citation_service.py
│   │   │   └── analysis_service.py
│   │   ├── ingestion/
│   │   │   ├── parser.py
│   │   │   ├── sections.py
│   │   │   ├── chunker.py
│   │   │   └── embeddings.py
│   │   ├── agents/
│   │   │   ├── state.py
│   │   │   ├── graph.py
│   │   │   ├── routing.py
│   │   │   ├── nodes/
│   │   │   └── prompts/
│   │   ├── workers/
│   │   │   └── tasks.py
│   │   └── evals/
│   │       ├── datasets/
│   │       ├── metrics.py
│   │       └── runner.py
│   └── tests/
│       ├── unit/
│       ├── integration/
│       ├── api/
│       ├── security/
│       └── evals/
├── infra/
│   ├── docker/
│   └── compose.yaml
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── evaluation.md
│   └── security.md
├── .github/workflows/
├── .env.example
├── .gitignore
└── README.md
```

### Coding standards

-   Use type hints in Python and strict TypeScript settings.
-   Validate external data with Pydantic.
-   Use dependency injection for database sessions and services.
-   Use async SQLAlchemy sessions where supported by the selected driver
    and application design.
-   Keep transactions short; do not hold them open during long LLM
    calls.
-   Use structured logs with request IDs, job IDs, and graph run IDs.
-   Apply timeouts, retry policies, and concurrency limits to external
    calls.
-   Centralize model configuration.
-   Use database migrations; do not rely on automatic table creation in
    production.
-   Test service boundaries and failure cases, not just helper
    functions.

------------------------------------------------------------------------

## 12. Python Dependencies and Setup

Use a current, mutually compatible dependency set rather than copying
old tutorial pins. Resolve and lock exact versions when creating the
repository.

### Backend setup

``` bash
mkdir paperpal
cd paperpal

uv init backend
cd backend

uv python pin 3.12
uv add fastapi "uvicorn[standard]" pydantic \
  pydantic-settings python-multipart

uv add langchain langgraph langchain-openai \
  langchain-text-splitters langsmith

uv add sqlalchemy asyncpg alembic \
  pgvector "psycopg[binary]" redis celery

uv add pymupdf docling tenacity httpx structlog

uv add --dev pytest pytest-asyncio httpx \
  ruff mypy deepeval

uv lock
```

This is a starting dependency set, not a requirement to use every
optional component immediately. For example, Docling can be added later
if the MVP initially uses PyMuPDF only. Configure the task queue
according to the chosen Celery deployment.

Python 3.12 is a conservative starting point for a project with PDF and
ML dependencies. Test Python 3.13 compatibility before upgrading. The
locked environment---not the command alone---is the reproducible
environment.

### Frontend setup

``` bash
cd ..

npx create-next-app@latest apps/web \
  --typescript --tailwind --eslint --app

npx shadcn@latest init -t next

cd apps/web

npx shadcn@latest add button card dialog \
  dropdown-menu input textarea select \
  skeleton tabs tooltip sonner
```

Add the PDF viewer, graph library, and query client after the core pages
are running.

### Environment variables

Create `.env` from `.env.example`. Never commit real secrets.

``` dotenv
APP_ENV=development
API_V1_PREFIX=/api/v1

DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/paperpal
REDIS_URL=redis://localhost:6379/0

LLM_PROVIDER=openai
LLM_MODEL=your-configured-model
EMBEDDING_MODEL=your-configured-embedding-model
OPENAI_API_KEY=

LANGSMITH_TRACING=true
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=paperpal-development

OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=paperpal-papers
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=

AUTH_SECRET=
FRONTEND_ORIGIN=http://localhost:3000
```

The model identifiers are placeholders. Keep model names, dimensions,
timeouts, and cost limits in typed settings. Use a secret manager in
production.

------------------------------------------------------------------------

## 13. Security and Reliability

PaperPal processes arbitrary files and consumes paid model APIs. Treat
it as a production application handling untrusted input.

### Authentication and authorization

-   Use a maintained authentication solution.
-   Check ownership on every paper, conversation, job, and citation
    request.
-   Do not assume an opaque UUID makes a resource private.

### Safe PDF handling

-   Enforce file-size, page-count, and processing-time limits.
-   Validate file contents and isolate risky parsers.
-   Use temporary storage safely.
-   Avoid exposing uploaded files through public URLs.

### Prompt injection defense

-   Treat paper text as untrusted evidence.
-   Never let document content authorize tool calls, access secrets, or
    bypass access control.
-   Restrict agent tools to explicitly permitted actions.
-   Test malicious instructions embedded in PDFs.

### Cost and concurrency controls

-   Limit uploads, concurrent jobs, LLM requests, token budgets,
    retries, and external searches.
-   Use per-user quotas and request deadlines.
-   Track cost by task and user where appropriate.

### Persistence and recovery

-   Use durable job records and idempotent processing tasks.
-   Resume or safely repeat jobs without duplicate chunks.
-   Use backups and define retention/deletion policies for PDFs,
    embeddings, cached analyses, and traces.

### Observability and privacy

-   Record traces, latency, token usage, failure codes, and evaluation
    results.
-   Redact secrets and sensitive content from logs.
-   Apply retention controls to prompts and traces.

### Edge cases to test

-   Duplicate PDF uploads without leaking another user's private paper.
-   Worker crashes during embedding.
-   Paper deletion while a job is running.
-   Malformed model JSON.
-   Scanned papers with no extractable text.
-   External API rate limits.
-   Citations with incorrect page metadata.
-   User attempts to access another user's resources.
-   Prompt injection in paper text.
-   Client disconnect during streaming.

------------------------------------------------------------------------

## 14. Deployment Architecture

``` mermaid
flowchart TD
    WEB[Next.js hosting] --> API[FastAPI container]
    API --> DB[(Managed PostgreSQL + pgvector)]
    API --> REDIS[(Redis / queue)]
    API --> LLM[LLM provider]
    REDIS --> WORKER[Worker container]
    WORKER --> DB
    WORKER --> STORE[(Object storage)]
    WORKER --> EMBED[Embedding provider]
    API --> OBS[Tracing and alerts]
    WORKER --> OBS
```

For the initial public deployment, prefer managed services instead of
operating Kubernetes before it is needed.

Production requirements: - Separate API and worker processes. - Managed
PostgreSQL with pgvector and backups. - Redis for the selected queue. -
Persistent object storage for PDFs. - HTTPS and correctly configured
CORS. - Health and readiness endpoints. - Centralized logs and error
reporting. - Database migrations as part of release. - Staging
environment for end-to-end tests. - CI/CD that runs quality and security
checks. - Resource limits for parsers and background workers.

Use Docker Compose locally for API, worker, database, Redis, and
supporting services. Run the Next.js development server separately or
include it in Compose if desired.

------------------------------------------------------------------------

## 15. Implementation Roadmap

### Phase 1 --- Foundation

Create the repository, settings, database models, migrations, FastAPI
health endpoint, Docker Compose setup, and frontend shell.

**Deliverable:** a working full-stack skeleton with a reproducible
development environment.

### Phase 2 --- Ingestion and RAG

Implement upload validation, storage, section extraction, chunking,
embeddings, vector search, and evidence-grounded answers.

**Deliverable:** ask questions about a PDF and receive verifiable
citations.

### Phase 3 --- LangGraph workflows

Add routing, paper analysis, explanation levels, citation validation,
retries, state persistence, and streaming.

**Deliverable:** a reliable research workflow rather than an
unstructured chatbot.

### Phase 4 --- Related research

Add scholarly metadata search, deduplication, semantic ranking, citation
relationships, and interactive graph visualization.

**Deliverable:** users can explore research beyond the uploaded paper.

### Phase 5 --- Evaluation

Create the golden dataset, integrate DeepEval and LangSmith, establish
regression thresholds, and track citation failures, latency, and cost.

**Deliverable:** measurable quality improvements that can be
demonstrated in interviews.

### Phase 6 --- Production hardening

Add authentication, quotas, safe file processing, backups, deployment
automation, security tests, and monitoring.

**Deliverable:** a deployed application with repeatable releases and
documented operational behavior.

------------------------------------------------------------------------

## 16. Definition of Done

### Core functionality

-   [ ] A user can upload a PDF or submit an arXiv paper.
-   [ ] Processing runs asynchronously and survives worker failures.
-   [ ] A user can switch between four explanation levels.
-   [ ] Research answers contain validated evidence citations.
-   [ ] Related-paper search distinguishes similarity from citations.
-   [ ] The UI shows progress, errors, and retry options.

### Engineering quality

-   [ ] LangGraph state and routing are covered by tests.
-   [ ] A versioned golden dataset runs in automated evaluation.
-   [ ] RAG quality, citation validity, latency, and cost are measured.
-   [ ] Authentication, authorization, and upload limits are tested.
-   [ ] Docker deployment and CI/CD are documented.

### Portfolio

-   [ ] README includes architecture, setup, demos, and known
    limitations.
-   [ ] Architecture diagram and API documentation are included.
-   [ ] Evaluation results are reported honestly with dataset and model
    versions.
-   [ ] Known limitations and future improvements are documented.

------------------------------------------------------------------------

## 17. Official Documentation

-   **LangChain:**
    https://docs.langchain.com/oss/python/langchain/overview
-   **LangGraph:**
    https://docs.langchain.com/oss/python/langgraph/overview
-   **FastAPI:** https://fastapi.tiangolo.com/
-   **DeepEval RAG guide:**
    https://deepeval.com/docs/getting-started-rag
-   **DeepEval metrics:** https://deepeval.com/docs/metrics-introduction
-   **LangSmith observability:**
    https://docs.langchain.com/langsmith/observability
-   **LangSmith evaluation:**
    https://docs.langchain.com/langsmith/evaluation
-   **Next.js App Router:** https://nextjs.org/docs/app
-   **shadcn/ui:** https://ui.shadcn.com/docs
-   **arXiv API:** https://info.arxiv.org/help/api/

------------------------------------------------------------------------

## Final Recommendation

Build PaperPal in this order:

**Document ingestion → evidence-grounded RAG → LangGraph workflows →
evaluations → related-paper discovery → production hardening.**

Make citations and evaluation the differentiators. A basic PDF chatbot
is easy to reproduce; an application that shows where each answer came
from, knows when evidence is missing, measures failure modes, and can be
deployed reliably is a much stronger AI engineering portfolio project.
