"""
Pinecone vector store service.

Handles:
  - Index creation / connection
  - Upsert of document chunk vectors
  - Semantic similarity search
  - Vector deletion by document ID
"""

import asyncio
import time
from typing import Any, Dict, List, Optional, Tuple

from config import get_settings
from models.schemas import DocumentChunk, SourceDocument
from utils.logger import get_logger

logger = get_logger("vector_store")
settings = get_settings()


class VectorStoreService:
    """Manages the Pinecone vector index."""

    def __init__(self):
        self._index = None
        self._pc = None
        self._setup()

    def _setup(self):
        if not settings.pinecone_api_key:
            logger.warning("PINECONE_API_KEY not set — vector store is disabled")
            return
        try:
            from pinecone import Pinecone, ServerlessSpec

            self._pc = Pinecone(api_key=settings.pinecone_api_key)
            self._ensure_index()
            self._index = self._pc.Index(settings.pinecone_index_name)
            logger.info(f"Pinecone connected — index: {settings.pinecone_index_name}")
        except Exception as e:
            logger.error(f"Pinecone setup failed: {e}")

    def _ensure_index(self):
        """Create the Pinecone index if it doesn't already exist."""
        from pinecone import ServerlessSpec

        existing = [idx.name for idx in self._pc.list_indexes()]
        if settings.pinecone_index_name not in existing:
            logger.info(f"Creating Pinecone index: {settings.pinecone_index_name}")
            self._pc.create_index(
                name=settings.pinecone_index_name,
                dimension=settings.embedding_dimensions,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region=settings.pinecone_environment,
                ),
            )
            # Wait for index to be ready
            for _ in range(10):
                desc = self._pc.describe_index(settings.pinecone_index_name)
                # Pinecone v5 returns an object; status.ready is a bool attribute
                status = desc.status
                ready = status.ready if hasattr(status, "ready") else status.get("ready", False)
                if ready:
                    break
                time.sleep(2)
            logger.info("Pinecone index created and ready")

    @property
    def is_available(self) -> bool:
        return self._index is not None

    def get_vector_count(self) -> int:
        """Return the number of vectors in the index."""
        if not self.is_available:
            return 0
        try:
            stats = self._index.describe_index_stats()
            # Pinecone v5 SDK returns an object, not a dict
            return stats.total_vector_count or 0
        except Exception:
            return 0

    def upsert_chunks(
        self,
        chunks: List[DocumentChunk],
        embeddings: List[List[float]],
    ) -> int:
        """
        Upsert document chunks with their embeddings into Pinecone.

        Args:
            chunks: List of DocumentChunk objects.
            embeddings: Corresponding embedding vectors.

        Returns:
            Number of vectors upserted.
        """
        if not self.is_available:
            raise RuntimeError("Vector store not available — check PINECONE_API_KEY")

        if len(chunks) != len(embeddings):
            raise ValueError("chunks and embeddings must have the same length")

        vectors = []
        for chunk, embedding in zip(chunks, embeddings):
            vectors.append(
                {
                    "id": chunk.chunk_id,
                    "values": [float(v) for v in embedding],  # ensure native Python floats
                    "metadata": {
                        "document_id": chunk.document_id,
                        "document_name": chunk.document_name,
                        "chunk_index": chunk.chunk_index,
                        "page_number": chunk.page_number or 0,
                        "category": chunk.metadata.get("category", "general"),
                        "tags": chunk.metadata.get("tags", []),
                        "text": chunk.text[:1000],  # Pinecone metadata limit
                    },
                }
            )

        # Upsert in batches of 100
        upserted = 0
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i : i + batch_size]
            response = self._index.upsert(vectors=batch)
            # Pinecone v5 returns UpsertResponse object with .upserted_count attribute
            upserted += response.upserted_count if hasattr(response, "upserted_count") else len(batch)

        logger.info(f"Upserted {upserted} vectors for document chunks")
        return upserted

    def query(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        filter_dict: Optional[Dict[str, Any]] = None,
        min_score: float = 0.0,
    ) -> List[SourceDocument]:
        """
        Retrieve the most relevant chunks for a query embedding.

        Args:
            query_embedding: The query vector.
            top_k: Number of results to return.
            filter_dict: Optional Pinecone metadata filter.
            min_score: Minimum cosine similarity threshold.

        Returns:
            List of SourceDocument objects sorted by relevance.
        """
        if not self.is_available:
            return []

        kwargs: Dict[str, Any] = {
            "vector": [float(v) for v in query_embedding],  # ensure native floats
            "top_k": top_k,
            "include_metadata": True,
        }
        if filter_dict:
            kwargs["filter"] = filter_dict

        results = self._index.query(**kwargs)

        # Pinecone v5: results is a QueryResponse object — use .matches attribute
        matches = results.matches if hasattr(results, "matches") else results.get("matches", [])

        sources = []
        for match in matches:
            # Pinecone v5: match is a ScoredVector object — use attribute access
            score = match.score if hasattr(match, "score") else match.get("score", 0.0)
            if score < min_score:
                continue
            # match.metadata is a regular dict even in v5
            meta = match.metadata if hasattr(match, "metadata") else match.get("metadata", {})
            meta = meta or {}
            sources.append(
                SourceDocument(
                    document_id=meta.get("document_id", ""),
                    document_name=meta.get("document_name", "Unknown"),
                    chunk_text=meta.get("text", ""),
                    relevance_score=round(score, 4),
                    page_number=meta.get("page_number") or None,
                    category=meta.get("category"),
                )
            )

        logger.debug(f"Vector search returned {len(sources)} results (min_score={min_score})")
        return sources

    def delete_document_vectors(self, document_id: str) -> int:
        """Delete all vectors belonging to a specific document."""
        if not self.is_available:
            return 0
        try:
            dummy_vec = [0.0] * settings.embedding_dimensions
            results = self._index.query(
                vector=dummy_vec,
                top_k=1000,
                filter={"document_id": {"$eq": document_id}},
                include_metadata=False,
            )
            # Pinecone v5: attribute access
            matches = results.matches if hasattr(results, "matches") else results.get("matches", [])
            ids = [
                (m.id if hasattr(m, "id") else m["id"])
                for m in matches
            ]
            if ids:
                self._index.delete(ids=ids)
                logger.info(f"Deleted {len(ids)} vectors for document {document_id}")
            return len(ids)
        except Exception as e:
            logger.error(f"Error deleting vectors: {e}")
            return 0

    async def query_async(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        min_score: float = 0.0,
    ) -> List[SourceDocument]:
        """Async wrapper around query."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.query(query_embedding, top_k=top_k, min_score=min_score),
        )


# Module-level singleton
_vector_store: Optional[VectorStoreService] = None


def get_vector_store() -> VectorStoreService:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStoreService()
    return _vector_store
