"""Local sentence embeddings for ChromaDB.

Groq serves chat models only, so embeddings run locally with Chroma's bundled ONNX
all-MiniLM-L6-v2 model (downloaded once to ~/.cache/chroma). No API key or GPU is needed.
"""
from functools import lru_cache

from langchain_core.embeddings import Embeddings


class ChromaOnnxEmbeddings(Embeddings):
    def __init__(self) -> None:
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

        self._embed = DefaultEmbeddingFunction()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[float(value) for value in vector] for vector in self._embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]


@lru_cache
def get_embeddings() -> Embeddings:
    return ChromaOnnxEmbeddings()
