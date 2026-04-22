"""
College Support Chatbot — AI Service
=====================================
FastAPI application providing RAG-powered query answering, document ingestion,
and quality evaluation for the college support chatbot FYP.

Architecture:
  Client Layer  → Node.js Express Backend  → [THIS SERVICE] FastAPI AI
  AI Layer      → Google Gemini 1.5 Flash (generation) + text-embedding-004
  Vector Store  → Pinecone Serverless
  Document DB   → MongoDB (via Node.js)
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from routers import chat_router, documents_router, evaluation_router
from services.embeddings import get_embedding_service
from services.vector_store import get_vector_store
from services.llm_service import get_llm_service
from utils.logger import get_logger

logger = get_logger("main")
settings = get_settings()


# ─── Lifespan (startup / shutdown) ───────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Initialise all services on startup."""
    logger.info("=" * 60)
    logger.info("College Support Chatbot — AI Service v2.0.0")
    logger.info("=" * 60)

    # Warm up singletons
    embed_svc = get_embedding_service()
    vector_store = get_vector_store()
    llm_svc = get_llm_service()

    logger.info(f"Gemini Embeddings : {'✓ READY' if embed_svc.is_available else '✗ NOT CONFIGURED'}")
    logger.info(f"Pinecone Store    : {'✓ READY' if vector_store.is_available else '✗ NOT CONFIGURED'}")
    logger.info(f"Gemini LLM        : {'✓ READY' if llm_svc.is_available else '✗ NOT CONFIGURED'}")

    rag_status = "FULL RAG" if (
        embed_svc.is_available and vector_store.is_available and llm_svc.is_available
    ) else "RULE-BASED FALLBACK"
    logger.info(f"Operating Mode    : {rag_status}")
    logger.info(f"Service running at http://{settings.ai_service_host}:{settings.ai_service_port}")
    logger.info("=" * 60)

    yield

    logger.info("AI Service shutting down")


# ─── Application ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="College Support Chatbot — AI Service",
    description=(
        "RAG-powered AI backend for the University of Westminster College Support Chatbot FYP. "
        "Uses Google Gemini 1.5 Flash for generation and text-embedding-004 for semantic search "
        "with Pinecone as the vector database. "
        "Implements RAGAS-inspired evaluation metrics (faithfulness ≥ 80% — NFR2)."
    ),
    version="2.0.0",
    contact={"name": "Lamia Haque", "email": "w1972138@my.westminster.ac.uk"},
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ─── CORS ────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:8080",  # Node.js backend
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(evaluation_router)


# ─── Health & Root ───────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": "College Support Chatbot AI Service",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "running",
    }


@app.get(
    "/health",
    tags=["System"],
    summary="Service health check",
    description="Returns the operational status of all AI components.",
)
async def health():
    embed_svc = get_embedding_service()
    vector_store = get_vector_store()
    llm_svc = get_llm_service()

    vector_count = vector_store.get_vector_count() if vector_store.is_available else 0

    return {
        "status": "healthy",
        "rag_enabled": embed_svc.is_available and vector_store.is_available and llm_svc.is_available,
        "pinecone_connected": vector_store.is_available,
        "gemini_connected": llm_svc.is_available,
        "embeddings_available": embed_svc.is_available,
        "vector_count": vector_count,
        "embedding_model": settings.embedding_model,
        "generation_model": settings.generation_model,
        "index_name": settings.pinecone_index_name,
        "version": "2.0.0",
    }


# ─── Global error handler ─────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.ai_service_host,
        port=settings.ai_service_port,
        reload=True,
        log_level=settings.log_level.lower(),
    )
