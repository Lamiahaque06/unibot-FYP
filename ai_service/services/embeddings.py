"""
Embedding service using Google's text-embedding-004 model.

Produces 768-dimensional dense vectors optimised for semantic search.
Supports both single-text and batch embedding with automatic retry.
"""

import asyncio
import time
from typing import List, Optional

from google import genai
from google.genai import types

from config import get_settings
from utils.logger import get_logger

logger = get_logger("embeddings")
settings = get_settings()

# Map friendly task-type strings → SDK constants
_TASK_MAP = {
    "retrieval_document": "RETRIEVAL_DOCUMENT",
    "retrieval_query":    "RETRIEVAL_QUERY",
    "semantic_similarity": "SEMANTIC_SIMILARITY",
}


class EmbeddingService:
    """Wraps the Google GenAI embedding API with caching and retry."""

    TASK_DOCUMENT = "retrieval_document"
    TASK_QUERY    = "retrieval_query"
    TASK_SEMANTIC = "semantic_similarity"

    def __init__(self):
        self._client: Optional[genai.Client] = None
        self._setup()

    def _setup(self):
        if not settings.gemini_api_key:
            logger.warning("GEMINI_API_KEY not set — embedding service is disabled")
            return
        self._client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(api_version="v1beta"),
        )
        logger.info(
            f"Embedding service ready: model={settings.embedding_model}, "
            f"dims={settings.embedding_dimensions}"
        )

    @property
    def is_available(self) -> bool:
        return self._client is not None

    def embed_text(
        self,
        text: str,
        task_type: str = TASK_QUERY,
        title: Optional[str] = None,
    ) -> List[float]:
        """
        Embed a single text string.

        Args:
            text:      The text to embed.
            task_type: 'retrieval_query' for queries, 'retrieval_document' for docs.
            title:     Optional title (improves document embedding quality).

        Returns:
            768-dimensional float vector.
        """
        if not self._client:
            raise RuntimeError("Embedding service not configured — set GEMINI_API_KEY")

        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")

        # Truncate to avoid API limits (~2048 tokens ≈ ~8000 chars)
        text = text[:8000]

        sdk_task = _TASK_MAP.get(task_type, "RETRIEVAL_QUERY")
        embed_config = types.EmbedContentConfig(
            task_type=sdk_task,
            output_dimensionality=settings.embedding_dimensions,
        )

        model_name = settings.embedding_model

        for attempt in range(3):
            try:
                response = self._client.models.embed_content(
                    model=model_name,
                    contents=text,
                    config=embed_config,
                )
                return list(response.embeddings[0].values)
            except Exception as e:
                if attempt < 2:
                    wait = 2 ** attempt
                    logger.warning(f"Embed attempt {attempt + 1} failed: {e}. Retrying in {wait}s")
                    time.sleep(wait)
                else:
                    logger.error(f"All embedding attempts failed: {e}")
                    raise

    def embed_batch(
        self,
        texts: List[str],
        task_type: str = TASK_DOCUMENT,
        batch_size: int = 20,
    ) -> List[List[float]]:
        """
        Embed a list of texts, respecting the API's rate limits.

        Returns:
            List of 768-dimensional float vectors.
        """
        if not self._client:
            raise RuntimeError("Embedding service not configured")

        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            for text in batch:
                embedding = self.embed_text(text, task_type=task_type)
                all_embeddings.append(embedding)
            # Small delay to respect rate limits (60 req/min on free tier)
            if i + batch_size < len(texts):
                time.sleep(0.5)

        logger.info(f"Embedded {len(all_embeddings)} texts")
        return all_embeddings

    async def embed_text_async(
        self,
        text: str,
        task_type: str = TASK_QUERY,
    ) -> List[float]:
        """Async wrapper around the synchronous embed_text method."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, lambda: self.embed_text(text, task_type=task_type)
        )

    async def embed_batch_async(
        self,
        texts: List[str],
        task_type: str = TASK_DOCUMENT,
    ) -> List[List[float]]:
        """Async wrapper around embed_batch."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, lambda: self.embed_batch(texts, task_type=task_type)
        )


# Module-level singleton
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
