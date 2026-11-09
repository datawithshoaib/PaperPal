import logging
from functools import lru_cache

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_chroma import Chroma
from langchain_core.documents import Document

from paperpal.core.config import get_settings
from paperpal.db.models import PaperChunk
from paperpal.rag.embeddings import get_embeddings

logger = logging.getLogger(__name__)
COLLECTION = "paper_chunks"


@lru_cache
def get_vectorstore() -> Chroma:
    settings = get_settings()
    client_settings = ChromaSettings(anonymized_telemetry=False)
    if settings.chroma_host:
        client = chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port, settings=client_settings)
    else:
        client = chromadb.PersistentClient(path=settings.chroma_dir, settings=client_settings)
    return Chroma(
        client=client,
        collection_name=COLLECTION,
        embedding_function=get_embeddings(),
        collection_metadata={"hnsw:space": "cosine"},
    )


def index_chunks(paper_id: str, chunks: list[PaperChunk]) -> None:
    store = get_vectorstore()
    delete_paper(paper_id)
    documents = [
        Document(
            page_content=f"{chunk.section_title}\n{chunk.text}",
            metadata={
                "paper_id": paper_id,
                "chunk_id": chunk.id,
                "section_type": chunk.section_type,
                "page_start": chunk.page_start,
            },
        )
        for chunk in chunks
    ]
    for start in range(0, len(documents), 64):
        batch = documents[start : start + 64]
        store.add_documents(batch, ids=[doc.metadata["chunk_id"] for doc in batch])


def search(paper_id: str, query: str, k: int) -> list[tuple[str, float]]:
    """Return (chunk_id, cosine similarity) pairs for one paper."""
    results = get_vectorstore().similarity_search_with_score(query, k=k, filter={"paper_id": paper_id})
    return [(doc.metadata["chunk_id"], 1 - distance) for doc, distance in results]


def delete_paper(paper_id: str) -> None:
    try:
        get_vectorstore().delete(where={"paper_id": paper_id})
    except Exception:  # deleting from an empty collection is not an error worth surfacing
        logger.debug("Nothing to delete from the vector store for paper %s", paper_id)
