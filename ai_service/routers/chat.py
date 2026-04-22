"""
Chat router — handles all conversational queries.

POST /chat/query   — process a student query through the RAG pipeline
"""

from fastapi import APIRouter, HTTPException, status
from models.schemas import ChatRequest, ChatResponse
from services.rag_pipeline import get_rag_pipeline
from utils.logger import get_logger

logger = get_logger("router.chat")
router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post(
    "/query",
    response_model=ChatResponse,
    summary="Process a student query",
    description=(
        "Processes a natural language query through the RAG pipeline. "
        "If RAG is configured (Gemini + Pinecone), retrieves relevant context "
        "and generates a grounded response. Otherwise falls back to rule-based answers."
    ),
)
async def query(request: ChatRequest) -> ChatResponse:
    """
    UC1 (general info) and UC2 (personal student info) handler.

    The caller (Node.js backend) should:
    - Include conversation_history for multi-turn context (FR5)
    - Include user_context when the student is authenticated (FR3/FR4)
    - Set use_rag=False to force the rule-based fallback
    """
    if not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Query cannot be empty",
        )

    pipeline = get_rag_pipeline()

    try:
        response = await pipeline.process(request)
        logger.info(
            f"Query processed | intent={response.intent} | "
            f"rag={response.rag_used} | "
            f"sources={len(response.sources)} | "
            f"confidence={response.confidence:.2f} | "
            f"time={response.response_time_ms}ms"
        )
        return response
    except Exception as e:
        logger.error(f"Query processing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process query: {str(e)}",
        )
