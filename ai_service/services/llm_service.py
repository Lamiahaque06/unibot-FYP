"""
LLM service using Google Gemini.

Handles:
  - Response generation with grounded RAG context
  - System prompt engineering for college support domain
  - Streaming support
  - Safety settings configuration
"""

import asyncio
import time
from typing import List, Optional

from google import genai
from google.genai import types

from config import get_settings
from models.schemas import ConversationMessage, SourceDocument, UserContext
from utils.logger import get_logger

logger = get_logger("llm_service")
settings = get_settings()


SYSTEM_PROMPT = """You are an intelligent College Support Assistant for University of Westminster students.
You provide accurate, helpful, and empathetic responses about academic and administrative matters.

CAPABILITIES:
- Answer questions about admissions, courses, fees, hostel, exams, and academic policies
- Provide personalised responses based on the student's enrolled courses and outstanding fees
- Retrieve and cite information from official university documents

RESPONSE GUIDELINES:
1. Be concise but thorough — aim for 2-4 short paragraphs
2. Do NOT include inline source citations or document names in your response text
3. If information is not in the provided context, acknowledge the limitation clearly
4. For personalised queries (fees, schedule), always refer to the student's specific data
5. Never fabricate deadlines, fees, or course details — only state what is in the context
6. Use a friendly, professional tone appropriate for a university setting
7. For urgent matters (overdue fees, upcoming deadlines), highlight them prominently
8. When multiple related FAQs are relevant, synthesise them into a coherent answer

FALLBACK:
If the retrieved context does not contain enough information, say:
"I don't have specific information about that in my current knowledge base.
Please contact the university helpdesk or check the official website for accurate details."
"""


def _build_context_block(
    sources: List[SourceDocument],
    user_context: Optional[UserContext],
) -> str:
    """Assemble the context string injected into the prompt."""
    parts = []

    # Retrieved document chunks
    if sources:
        parts.append("=== RETRIEVED KNOWLEDGE BASE ===")
        for i, src in enumerate(sources, 1):
            parts.append(
                f"[{i}] Source: {src.document_name} "
                f"(relevance: {src.relevance_score:.2f})\n{src.chunk_text}"
            )

    # Personalised student data
    if user_context:
        parts.append(f"\n=== STUDENT PROFILE ===")
        parts.append(f"Name: {user_context.name}")
        if user_context.student_id:
            parts.append(f"Student ID: {user_context.student_id}")

        if user_context.enrolled_courses:
            parts.append("\nEnrolled Courses:")
            for course in user_context.enrolled_courses:
                parts.append(
                    f"  • {course.get('courseCode', '')} — {course.get('courseName', '')} "
                    f"({course.get('credits', '')} credits), "
                    f"Instructor: {course.get('instructor', {}).get('name', 'N/A')}"
                )

        if user_context.pending_fees:
            parts.append("\nOutstanding Fees:")
            for fee in user_context.pending_fees:
                due = fee.get("dueDate", "N/A")
                status = fee.get("status", "pending").upper()
                parts.append(
                    f"  • {fee.get('description', 'Fee')}: "
                    f"£{fee.get('amount', 0):.2f} — Due: {due} [{status}]"
                )

        if user_context.upcoming_deadlines:
            parts.append("\nUpcoming Deadlines:")
            for dl in user_context.upcoming_deadlines:
                parts.append(f"  • {dl.get('title', 'Deadline')}: {dl.get('date', 'N/A')}")

    return "\n".join(parts)


def _build_history_text(history: List[ConversationMessage], max_turns: int = 6) -> str:
    """Format recent conversation history for the prompt."""
    if not history:
        return ""
    recent = history[-max_turns * 2 :]
    lines = ["=== CONVERSATION HISTORY ==="]
    for msg in recent:
        prefix = "Student" if msg.role == "user" else "Assistant"
        lines.append(f"{prefix}: {msg.content}")
    return "\n".join(lines)


class LLMService:
    """Gemini-powered response generator."""

    def __init__(self):
        self._client: Optional[genai.Client] = None
        self._model_name: Optional[str] = None
        self._gen_config: Optional[types.GenerateContentConfig] = None
        self._setup()

    def _setup(self):
        if not settings.gemini_api_key:
            logger.warning("GEMINI_API_KEY not set — LLM service is disabled")
            return

        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model_name = settings.generation_model

        self._gen_config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.3,
            top_p=0.8,
            top_k=40,
            max_output_tokens=1024,
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_ONLY_HIGH",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_ONLY_HIGH",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_ONLY_HIGH",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_ONLY_HIGH",
                ),
            ],
        )
        logger.info(f"LLM service ready: model={self._model_name}")

    @property
    def is_available(self) -> bool:
        return self._client is not None

    def generate(
        self,
        query: str,
        sources: List[SourceDocument],
        conversation_history: List[ConversationMessage],
        user_context: Optional[UserContext] = None,
    ) -> str:
        """
        Generate a grounded response using RAG context.

        The prompt structure:
          [SYSTEM] (set in generation config)
          [CONTEXT] retrieved chunks + student data
          [HISTORY] recent conversation turns
          [QUERY] current user message
        """
        if not self.is_available:
            raise RuntimeError("LLM service not configured — set GEMINI_API_KEY")

        context_block = _build_context_block(sources, user_context)
        history_block = _build_history_text(conversation_history)

        prompt_parts = []
        if context_block:
            prompt_parts.append(context_block)
        if history_block:
            prompt_parts.append(history_block)
        prompt_parts.append(f"\n=== STUDENT QUERY ===\n{query}")
        prompt_parts.append(
            "\nPlease answer the student's query based on the provided context above."
        )

        full_prompt = "\n\n".join(prompt_parts)

        for attempt in range(3):
            try:
                response = self._client.models.generate_content(
                    model=self._model_name,
                    contents=full_prompt,
                    config=self._gen_config,
                )
                return response.text
            except Exception as e:
                if attempt < 2:
                    logger.warning(f"Generation attempt {attempt + 1} failed: {e}")
                    time.sleep(1)
                else:
                    logger.error(f"All generation attempts failed: {e}")
                    raise

    async def generate_async(
        self,
        query: str,
        sources: List[SourceDocument],
        conversation_history: List[ConversationMessage],
        user_context: Optional[UserContext] = None,
    ) -> str:
        """Async wrapper around generate."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.generate(query, sources, conversation_history, user_context),
        )

    def classify_intent(self, query: str) -> str:
        """
        Fast intent classification using whole-word keyword matching.
        Uses regex \\b boundaries to avoid false matches (e.g. "scholarships"
        containing "hi", "festival" containing "fee", "protest" containing "test").
        Falls back to 'general' if no keyword matches.
        """
        import re

        def _match(words: list) -> bool:
            pattern = r'\b(?:' + '|'.join(re.escape(w) for w in words) + r')\b'
            return bool(re.search(pattern, query.lower()))

        if _match(["my course", "my courses", "enrolled", "my schedule", "my timetable",
                   "my classes", "what am i taking", "what courses am i"]):
            return "personal_courses"
        if _match(["my fee", "my fees", "my payment", "i owe", "outstanding fee",
                   "outstanding fees", "outstanding balance", "how much do i owe",
                   "fee status", "what are my fees", "what do i owe"]):
            return "personal_fees"
        # fees_general and academic_policy must come before admission —
        # "apply" in admission would otherwise steal "apply for a bursary" or
        # "apply for extenuating circumstances"
        if _match(["tuition fee", "tuition fees", "fee structure", "scholarship",
                   "scholarships", "bursary", "bursaries", "financial aid",
                   "payment plan", "instalment", "installment", "refund policy",
                   "how much does it cost", "course fee", "course fees"]):
            return "fees_general"
        if _match(["attendance policy", "attendance rule", "grading policy",
                   "academic policy", "academic policies", "plagiarism",
                   "extenuating circumstances", "late submission", "gpa",
                   "degree classification", "pass mark", "academic misconduct",
                   "learning support"]):
            return "academic_policy"
        # hostel before admission — "apply" in admission would otherwise match "apply for accommodation"
        if _match(["hostel", "accommodation", "dormitory", "residence hall",
                   "student housing", "room application", "halls of residence"]):
            return "hostel"
        if _match(["admission", "admissions", "apply", "application", "how to join",
                   "how to enrol", "how to enroll", "entry requirement", "how to apply"]):
            return "admission"
        if _match(["exam", "exams", "examination", "examinations", "midterm",
                   "final exam", "resit", "resits", "exam schedule",
                   "exam timetable", "exam date", "exam registration"]):
            return "examination"
        if _match(["hi", "hello", "hey", "good morning", "good afternoon",
                   "good evening", "greetings"]):
            return "greeting"
        return "general"


# Module-level singleton
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
