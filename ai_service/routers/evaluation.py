"""
Evaluation router — RAGAS-inspired quality assessment.

POST /evaluation/run    — evaluate a batch of QA samples
GET  /evaluation/demo   — run a built-in demo evaluation
"""

from fastapi import APIRouter, HTTPException, status

from models.schemas import (
    ConversationMessage,
    EvaluationRequest,
    EvaluationResponse,
    EvaluationSample,
)
from services.evaluation import get_evaluation_service
from utils.logger import get_logger

logger = get_logger("router.evaluation")
router = APIRouter(prefix="/evaluation", tags=["Evaluation"])


# Built-in demo samples representing typical college chatbot interactions
DEMO_SAMPLES = [
    EvaluationSample(
        query="How do I apply for admission to the university?",
        answer=(
            "To apply for admission, visit the university admissions portal and complete "
            "the online application form. You will need to submit academic transcripts, "
            "two reference letters, and a personal statement. "
            "Entry requirements vary by programme. [Source: Admissions Policy Guide]"
        ),
        contexts=[
            "The university accepts applications through its online portal year-round. "
            "Applicants must submit transcripts, references, and a personal statement. "
            "Decisions are communicated within 4 weeks.",
            "Entry requirements for undergraduate programmes typically include A-level grades "
            "or equivalent qualifications. International students may need English proficiency proof.",
        ],
        ground_truth="Submit an application via the online portal with required documents.",
    ),
    EvaluationSample(
        query="What are the examination dates for this semester?",
        answer=(
            "Semester 2 examinations are scheduled for May and June. "
            "Individual timetables are published on the student portal six weeks before the exam period. "
            "You must register for examinations by the deadline to avoid late fees. "
            "[Source: Examination Regulations 2025]"
        ),
        contexts=[
            "Examination timetables are released six weeks prior to the exam period via the student portal. "
            "Semester 1 exams occur in January; Semester 2 exams in May/June.",
            "Students must register for each examination module. Late registration incurs a £25 fee. "
            "Deferral requests must be submitted with supporting evidence.",
        ],
        ground_truth="Exam timetables are published 6 weeks before the exam period on the student portal.",
    ),
    EvaluationSample(
        query="What is the attendance policy?",
        answer=(
            "The university requires a minimum 80% attendance for all taught modules. "
            "Attendance below this threshold may result in exclusion from examinations. "
            "If you have extenuating circumstances, submit a mitigating circumstances form. "
            "[Source: Academic Regulations 2025-26]"
        ),
        contexts=[
            "Students are expected to attend all scheduled teaching sessions. "
            "A minimum of 80% attendance is mandatory. Persistent absence may result in "
            "exclusion from assessments or withdrawal from the programme.",
            "Mitigating circumstances that affect attendance must be reported promptly with evidence. "
            "The Academic Progress Committee reviews attendance records each semester.",
        ],
        ground_truth="Minimum 80% attendance is required. Poor attendance may lead to exclusion from exams.",
    ),
    EvaluationSample(
        query="How do I apply for hostel accommodation?",
        answer=(
            "Hostel accommodation is allocated on a first-come, first-served basis. "
            "After receiving your offer letter, log in to the Student Services portal "
            "and submit an accommodation application. "
            "Contact accommodation@college.edu for room availability. "
            "[Source: Student Accommodation Guide]"
        ),
        contexts=[
            "On-campus accommodation is available to all enrolled students subject to availability. "
            "Applications open on the first day of enrolment and are processed in order received.",
            "Room types include single ensuite, shared facilities, and studio apartments. "
            "Fees range from £120 to £200 per week depending on room type.",
        ],
        ground_truth="Apply via the Student Services portal after receiving your offer. First-come, first-served.",
    ),
]


@router.post(
    "/run",
    response_model=EvaluationResponse,
    summary="Evaluate RAG quality using RAGAS-inspired metrics",
    description=(
        "Evaluates answer relevance, context precision, and faithfulness "
        "on provided QA samples. Implements NFR2 (≥80% faithfulness threshold)."
    ),
)
async def run_evaluation(request: EvaluationRequest) -> EvaluationResponse:
    """
    Run RAGAS-inspired evaluation.

    Required fields per sample:
    - query: The question asked
    - answer: The chatbot's response
    - contexts: List of retrieved document chunks used to generate the answer
    - ground_truth: (optional) Reference answer for comparison

    Returns per-sample and aggregate scores.
    """
    if not request.samples:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one evaluation sample is required",
        )
    if len(request.samples) > 100:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Maximum 100 samples per evaluation run",
        )

    eval_svc = get_evaluation_service()

    try:
        result = eval_svc.evaluate(request)
        return result
    except Exception as e:
        logger.error(f"Evaluation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evaluation failed: {str(e)}",
        )


@router.get(
    "/demo",
    response_model=EvaluationResponse,
    summary="Run the built-in demonstration evaluation",
    description=(
        "Runs evaluation on 4 sample college support QA pairs. "
        "Demonstrates the RAGAS-inspired metrics implemented for this FYP. "
        "No request body needed."
    ),
)
async def demo_evaluation() -> EvaluationResponse:
    """
    Run evaluation on the built-in demo samples.
    Useful for demonstrating NFR2 compliance without collecting real data.
    """
    eval_svc = get_evaluation_service()
    request = EvaluationRequest(samples=DEMO_SAMPLES)

    try:
        result = eval_svc.evaluate(request)
        logger.info(
            f"Demo evaluation completed — "
            f"Overall={result.aggregate.get('overall', 0):.3f} | "
            f"NFR2 met: {result.meets_threshold}"
        )
        return result
    except Exception as e:
        logger.error(f"Demo evaluation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Demo evaluation failed: {str(e)}",
        )
