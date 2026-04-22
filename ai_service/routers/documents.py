"""
Documents router — handles document ingestion pipeline.

POST /documents/process    — process a PDF/text file into vectors (UC3)
POST /documents/ingest-faqs — ingest structured FAQ JSON into vectors
DELETE /documents/{doc_id} — remove all vectors for a document
GET  /documents/status     — index statistics
"""

import os
import time

from fastapi import APIRouter, HTTPException, status

from models.schemas import (
    DeleteDocumentRequest,
    DocumentStatus,
    FAQEntry,
    IngestFAQsRequest,
    ProcessDocumentRequest,
    ProcessDocumentResponse,
)
from services.document_processor import chunk_document, extract_text
from services.embeddings import get_embedding_service
from services.vector_store import get_vector_store
from utils.logger import get_logger

logger = get_logger("router.documents")
router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post(
    "/process",
    response_model=ProcessDocumentResponse,
    summary="Process a document into the vector store",
    description=(
        "Extracts text from a PDF or TXT file, chunks it, generates embeddings "
        "using Gemini text-embedding-004, and upserts vectors into Pinecone. "
        "Implements UC3 (Administrative Document Upload)."
    ),
)
async def process_document(request: ProcessDocumentRequest) -> ProcessDocumentResponse:
    """
    Full document ingestion pipeline:
    PDF → text extraction → chunking → embedding → Pinecone upsert
    """
    start = time.time()
    embed_svc = get_embedding_service()
    vector_store = get_vector_store()

    if not embed_svc.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding service not configured — set GEMINI_API_KEY",
        )
    if not vector_store.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vector store not configured — set PINECONE_API_KEY",
        )

    # Validate file exists
    if not os.path.exists(request.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {request.file_path}",
        )

    try:
        logger.info(f"Processing document: {request.document_name} ({request.file_path})")

        # 1. Extract text
        full_text, pages = extract_text(request.file_path)
        if not full_text.strip():
            return ProcessDocumentResponse(
                document_id=request.document_id,
                status=DocumentStatus.FAILED,
                chunks_created=0,
                vectors_upserted=0,
                processing_time_ms=int((time.time() - start) * 1000),
                error="No text could be extracted from the file",
            )

        # 2. Chunk document
        chunks = chunk_document(
            document_id=request.document_id,
            document_name=request.document_name,
            full_text=full_text,
            pages=pages,
            category=request.category or "general",
            tags=request.tags,
        )

        if not chunks:
            return ProcessDocumentResponse(
                document_id=request.document_id,
                status=DocumentStatus.FAILED,
                chunks_created=0,
                vectors_upserted=0,
                processing_time_ms=int((time.time() - start) * 1000),
                error="Document produced no chunks",
            )

        # 3. Generate embeddings (batch)
        texts = [chunk.text for chunk in chunks]
        embeddings = await embed_svc.embed_batch_async(texts, task_type="retrieval_document")

        # 4. Upsert to Pinecone
        upserted = vector_store.upsert_chunks(chunks, embeddings)

        elapsed = int((time.time() - start) * 1000)
        logger.info(
            f"Document '{request.document_name}' processed: "
            f"{len(chunks)} chunks, {upserted} vectors, {elapsed}ms"
        )

        return ProcessDocumentResponse(
            document_id=request.document_id,
            status=DocumentStatus.PROCESSED,
            chunks_created=len(chunks),
            vectors_upserted=upserted,
            processing_time_ms=elapsed,
        )

    except Exception as e:
        logger.error(f"Document processing error: {e}")
        return ProcessDocumentResponse(
            document_id=request.document_id,
            status=DocumentStatus.FAILED,
            chunks_created=0,
            vectors_upserted=0,
            processing_time_ms=int((time.time() - start) * 1000),
            error=str(e),
        )


@router.post(
    "/ingest-faqs",
    summary="Ingest FAQ entries into the vector store",
    description="Converts structured FAQ data into vectors for semantic search.",
)
async def ingest_faqs(request: IngestFAQsRequest) -> dict:
    """
    Ingest FAQ JSON entries into Pinecone.
    Combines question + answer for richer embeddings.
    """
    start = time.time()
    embed_svc = get_embedding_service()
    vector_store = get_vector_store()

    if not embed_svc.is_available or not vector_store.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RAG services not configured",
        )

    from models.schemas import DocumentChunk

    chunks = []
    for faq in request.faqs:
        combined = f"Q: {faq.question}\nA: {faq.answer}"
        chunks.append(
            DocumentChunk(
                chunk_id=f"faq_{faq.faq_id}",
                document_id=f"faq_{faq.category}",
                document_name=f"FAQ — {faq.category.title()}",
                text=combined,
                chunk_index=0,
                metadata={
                    "document_id": f"faq_{faq.category}",
                    "document_name": f"FAQ — {faq.category.title()}",
                    "category": faq.category,
                    "tags": faq.keywords,
                    "chunk_index": 0,
                    "text_length": len(combined),
                },
            )
        )

    texts = [c.text for c in chunks]
    embeddings = await embed_svc.embed_batch_async(texts, task_type="retrieval_document")
    upserted = vector_store.upsert_chunks(chunks, embeddings)

    return {
        "status": "success",
        "faqs_ingested": len(chunks),
        "vectors_upserted": upserted,
        "processing_time_ms": int((time.time() - start) * 1000),
    }


@router.delete(
    "/{document_id}",
    summary="Remove a document's vectors from the store",
)
async def delete_document(document_id: str) -> dict:
    """Delete all Pinecone vectors associated with a document."""
    vector_store = get_vector_store()
    if not vector_store.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vector store not configured",
        )
    deleted = vector_store.delete_document_vectors(document_id)
    return {
        "status": "success",
        "document_id": document_id,
        "vectors_deleted": deleted,
    }


@router.get(
    "/status",
    summary="Get vector store statistics",
)
async def get_status() -> dict:
    """Return current Pinecone index stats."""
    vector_store = get_vector_store()
    embed_svc = get_embedding_service()

    return {
        "vector_store_available": vector_store.is_available,
        "embeddings_available": embed_svc.is_available,
        "total_vectors": vector_store.get_vector_count(),
        "index_name": get_vector_store()._index.name if vector_store.is_available else None,
    }
