"""
RAG (Retrieval-Augmented Generation) pipeline orchestrator.

End-to-end flow:
  1. Classify intent
  2. Generate query embedding
  3. Retrieve relevant chunks from Pinecone
  4. Assemble context (vector results + student personalised data)
  5. Generate grounded response with Gemini
  6. Return response with source citations

Falls back to rule-based responses when:
  - Gemini/Pinecone not configured
  - Retrieval returns low-confidence results
  - Query is for personal student data (handled directly from DB)
"""

import time
from typing import List, Optional

from config import get_settings
from models.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationMessage,
    SourceDocument,
    UserContext,
)
from services.embeddings import get_embedding_service
from services.llm_service import get_llm_service
from services.vector_store import get_vector_store
from utils.logger import get_logger

logger = get_logger("rag_pipeline")
settings = get_settings()


# ─── Fallback rule-based responses ───────────────────────────────────────────

FALLBACK_RESPONSES = {
    "greeting": (
        "Hello! I'm your College Support Assistant. I can help you with:\n"
        "• Your enrolled courses and schedule\n"
        "• Outstanding fees and payment deadlines\n"
        "• Admission procedures\n"
        "• Hostel applications\n"
        "• Exam schedules\n"
        "• Academic policies\n\n"
        "What would you like to know?"
    ),
    "personal_courses": (
        "I can see your enrolled courses. Please log in to get your personalised course information, "
        "or ask me about a specific course code."
    ),
    "personal_fees": (
        "Please log in to see your outstanding fee details. "
        "I can also tell you about general fee structures and payment plans."
    ),
    "admission": (
        "**Admission Process:**\n"
        "To apply to the university, you need to submit an online application form, "
        "along with academic transcripts, reference letters, and a personal statement. "
        "The application portal is open throughout the year. "
        "Entry requirements vary by programme — please check the course-specific pages for details."
    ),
    "hostel": (
        "**Hostel Application:**\n"
        "Hostel accommodation is available on a first-come, first-served basis. "
        "Apply through the Student Services portal after receiving your offer letter. "
        "Rooms are allocated based on distance from campus and study year. "
        "Contact accommodation@college.edu for availability."
    ),
    "examination": (
        "**Examination Information:**\n"
        "Exam timetables are published 6 weeks before the examination period. "
        "Check the student portal for your personalised schedule. "
        "Semester 1 exams typically run in January; Semester 2 in May/June. "
        "You must register for examinations by the deadline — late registration incurs a fee."
    ),
    "fees_general": (
        "**Fees, Scholarships & Financial Aid:**\n"
        "Tuition fees vary by programme and student status (home/international). "
        "Fees can be paid in full at enrolment or in three instalments. "
        "A 5% late payment penalty applies after the due date.\n\n"
        "Scholarships and bursaries are available for eligible students — "
        "contact the Finance Office or check the university website for current awards. "
        "Contact: finance@westminster.ac.uk"
    ),
    "academic_policy": (
        "**Academic Policies:**\n"
        "• Minimum 80% attendance is required for all modules\n"
        "• GPA is calculated on a 4.0 scale\n"
        "• Reassessment is available for failed modules (capped at minimum pass mark)\n"
        "• Academic misconduct (plagiarism) results in disciplinary action\n"
        "• Extension requests must be submitted before the deadline"
    ),
}

NO_CONTEXT_RESPONSE = (
    "I don't have specific information about that in my current knowledge base. "
    "For the most accurate and up-to-date information, please:\n"
    "• Visit the university website\n"
    "• Contact the relevant department directly\n"
    "• Reach out to Student Services"
)


class RAGPipeline:
    """Orchestrates the full RAG pipeline for the college support chatbot."""

    def __init__(self):
        self.embeddings = get_embedding_service()
        self.vector_store = get_vector_store()
        self.llm = get_llm_service()
        logger.info(
            f"RAG pipeline initialized | "
            f"embeddings={'✓' if self.embeddings.is_available else '✗'} | "
            f"vector_store={'✓' if self.vector_store.is_available else '✗'} | "
            f"llm={'✓' if self.llm.is_available else '✗'}"
        )

    @property
    def rag_ready(self) -> bool:
        return (
            self.embeddings.is_available
            and self.vector_store.is_available
            and self.llm.is_available
        )

    async def process(self, request: ChatRequest) -> ChatResponse:
        """
        Process a chat request through the full RAG pipeline.

        Args:
            request: ChatRequest with query, history, and optional user context.

        Returns:
            ChatResponse with answer, sources, and metadata.
        """
        start = time.time()
        query = request.query.strip()
        intent = self.llm.classify_intent(query)

        logger.info(f"Processing query | intent={intent} | rag_ready={self.rag_ready}")

        # ── Personalised queries (no RAG needed) ──────────────────────────────
        if intent in ("personal_courses", "personal_fees") and request.user_context:
            answer = await self._handle_personal_query(
                intent, request.user_context, query, request.conversation_history
            )
            return ChatResponse(
                answer=answer,
                sources=[],
                intent=intent,
                confidence=0.92,
                response_time_ms=int((time.time() - start) * 1000),
                rag_used=False,
                model_used="rule_based+db",
            )

        # ── Greeting fast path ────────────────────────────────────────────────
        if intent == "greeting":
            name = (
                request.user_context.name.split()[0]
                if request.user_context
                else None
            )
            greeting = (
                f"Hello {name}! " if name else "Hello! "
            ) + FALLBACK_RESPONSES["greeting"][len("Hello! "):]
            return ChatResponse(
                answer=greeting,
                sources=[],
                intent=intent,
                confidence=0.99,
                response_time_ms=int((time.time() - start) * 1000),
                rag_used=False,
                model_used="rule_based",
            )

        # ── RAG path ──────────────────────────────────────────────────────────
        if self.rag_ready and request.use_rag:
            return await self._rag_path(request, intent, start)

        # ── Rule-based fallback ───────────────────────────────────────────────
        return self._fallback(request, intent, start)

    async def _rag_path(
        self, request: ChatRequest, intent: str, start: float
    ) -> ChatResponse:
        """Full RAG path: embed → retrieve → generate."""
        try:
            # 1. Embed the query
            query_embedding = await self.embeddings.embed_text_async(
                request.query, task_type="retrieval_query"
            )

            # 2. Retrieve from Pinecone
            sources = await self.vector_store.query_async(
                query_embedding,
                top_k=settings.top_k_retrieval,
                min_score=settings.min_relevance_score,
            )

            # 3. Generate response
            if sources or request.user_context:
                answer = await self.llm.generate_async(
                    request.query,
                    sources,
                    request.conversation_history,
                    request.user_context,
                )
                confidence = self._compute_confidence(sources, intent)
            else:
                # No relevant context found — use fallback
                answer = FALLBACK_RESPONSES.get(intent, NO_CONTEXT_RESPONSE)
                confidence = 0.60

            return ChatResponse(
                answer=answer,
                sources=sources,
                intent=intent,
                confidence=round(confidence, 3),
                response_time_ms=int((time.time() - start) * 1000),
                rag_used=True,
                model_used=settings.generation_model,
            )

        except Exception as e:
            logger.error(f"RAG path failed: {e}, falling back to rule-based")
            return self._fallback(request, intent, start)

    def _fallback(
        self, request: ChatRequest, intent: str, start: float
    ) -> ChatResponse:
        """Rule-based fallback when RAG is unavailable."""
        answer = FALLBACK_RESPONSES.get(intent, NO_CONTEXT_RESPONSE)
        return ChatResponse(
            answer=answer,
            sources=[],
            intent=intent,
            confidence=0.70,
            response_time_ms=int((time.time() - start) * 1000),
            rag_used=False,
            model_used="rule_based",
        )

    async def _handle_personal_query(
        self,
        intent: str,
        user_context: UserContext,
        query: str,
        history: List[ConversationMessage],
    ) -> str:
        """
        Handle personalised student queries using the attached user context.
        If LLM is available, generate a natural language response;
        otherwise fall back to structured text.
        """
        if self.llm.is_available:
            # Build a targeted prompt with only personal data (no vector search needed)
            try:
                answer = await self.llm.generate_async(
                    query,
                    sources=[],  # No vector sources — only personal data
                    conversation_history=history,
                    user_context=user_context,
                )
                return answer
            except Exception as e:
                logger.error(f"LLM personal query failed: {e}")

        # Structured fallback
        if intent == "personal_courses":
            return self._format_courses(user_context)
        return self._format_fees(user_context)

    def _format_courses(self, ctx: UserContext) -> str:
        if not ctx.enrolled_courses:
            return "You are not currently enrolled in any courses."
        lines = [f"Hi {ctx.name.split()[0]}, you're enrolled in {len(ctx.enrolled_courses)} course(s):\n"]
        for c in ctx.enrolled_courses:
            lines.append(
                f"• **{c.get('courseCode', '')}** — {c.get('courseName', '')}\n"
                f"  Instructor: {c.get('instructor', {}).get('name', 'N/A')}, "
                f"Credits: {c.get('credits', 'N/A')}"
            )
        return "\n".join(lines)

    def _format_fees(self, ctx: UserContext) -> str:
        if not ctx.pending_fees:
            return f"Great news, {ctx.name.split()[0]}! You have no outstanding fees."
        total = sum(f.get("amount", 0) for f in ctx.pending_fees)
        lines = [f"Hi {ctx.name.split()[0]}, you have {len(ctx.pending_fees)} outstanding payment(s):\n"]
        for f in ctx.pending_fees:
            status = f.get("status", "pending").upper()
            lines.append(
                f"• **{f.get('description', 'Fee')}** — £{f.get('amount', 0):.2f} "
                f"| Due: {f.get('dueDate', 'N/A')} [{status}]"
            )
        lines.append(f"\n**Total outstanding: £{total:.2f}**")
        return "\n".join(lines)

    def _compute_confidence(
        self, sources: List[SourceDocument], intent: str
    ) -> float:
        """Heuristic confidence score based on retrieval quality."""
        if not sources:
            return 0.55
        top_score = sources[0].relevance_score if sources else 0.0
        if top_score >= 0.90:
            return 0.95
        if top_score >= 0.80:
            return 0.88
        if top_score >= 0.70:
            return 0.80
        return 0.70


# Module-level singleton
_pipeline: Optional[RAGPipeline] = None


def get_rag_pipeline() -> RAGPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = RAGPipeline()
    return _pipeline
