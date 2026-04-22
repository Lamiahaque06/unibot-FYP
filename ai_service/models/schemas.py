"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


# ─── Conversation ─────────────────────────────────────────────────────────────

class ConversationMessage(BaseModel):
    role: MessageRole
    content: str


class UserContext(BaseModel):
    """Student-specific context fetched from Node.js backend."""
    user_id: str
    name: str
    student_id: Optional[str] = None
    enrolled_courses: List[Dict[str, Any]] = Field(default_factory=list)
    pending_fees: List[Dict[str, Any]] = Field(default_factory=list)
    upcoming_deadlines: List[Dict[str, Any]] = Field(default_factory=list)


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    conversation_history: List[ConversationMessage] = Field(default_factory=list)
    user_context: Optional[UserContext] = None
    use_rag: bool = True


class SourceDocument(BaseModel):
    document_id: str
    document_name: str
    chunk_text: str
    relevance_score: float
    page_number: Optional[int] = None
    category: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceDocument] = Field(default_factory=list)
    intent: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    response_time_ms: int
    rag_used: bool
    model_used: str


# ─── Documents ────────────────────────────────────────────────────────────────

class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    text: str
    chunk_index: int
    page_number: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProcessDocumentRequest(BaseModel):
    document_id: str
    document_name: str
    file_path: str
    category: Optional[str] = "general"
    tags: List[str] = Field(default_factory=list)


class ProcessDocumentResponse(BaseModel):
    document_id: str
    status: DocumentStatus
    chunks_created: int
    vectors_upserted: int
    processing_time_ms: int
    error: Optional[str] = None


class DeleteDocumentRequest(BaseModel):
    document_id: str


# ─── Knowledge Base (JSON/FAQ) ─────────────────────────────────────────────────

class FAQEntry(BaseModel):
    faq_id: str
    question: str
    answer: str
    category: str
    keywords: List[str] = Field(default_factory=list)


class IngestFAQsRequest(BaseModel):
    faqs: List[FAQEntry]


# ─── Evaluation ───────────────────────────────────────────────────────────────

class EvaluationSample(BaseModel):
    query: str
    answer: str
    contexts: List[str]
    ground_truth: Optional[str] = None


class EvaluationRequest(BaseModel):
    samples: List[EvaluationSample]


class MetricScore(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    explanation: str


class EvaluationResult(BaseModel):
    sample_index: int
    query: str
    answer_relevance: MetricScore
    context_precision: MetricScore
    faithfulness: MetricScore
    overall_score: float


class EvaluationResponse(BaseModel):
    total_samples: int
    results: List[EvaluationResult]
    aggregate: Dict[str, float]
    meets_threshold: bool
    threshold: float = 0.80


# ─── System ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    rag_enabled: bool
    pinecone_connected: bool
    gemini_connected: bool
    vector_count: int
    version: str = "2.0.0"
