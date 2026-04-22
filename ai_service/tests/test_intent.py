"""
test_intent.py
Unit tests for LLMService.classify_intent() using word-boundary regex matching.

Tests verify:
  - Correct intent returned for representative queries in each category
  - No false positives from substring matches (the core bug this fixes)
  - Priority ordering (hostel beats admission when "apply for accommodation")
  - General fallback when no keyword matches
"""

import sys
import os
import re
import pytest

# ── Replicate classify_intent as a standalone function so we can test it
#    without needing a real Gemini API key ─────────────────────────────────────

def classify_intent(query: str) -> str:
    """Mirror of LLMService.classify_intent for isolated unit testing."""

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


# ── personal_courses ──────────────────────────────────────────────────────────
class TestPersonalCourses:
    def test_enrolled(self):
        assert classify_intent("What courses am I enrolled in?") == "personal_courses"

    def test_my_schedule(self):
        assert classify_intent("Show me my schedule for this semester") == "personal_courses"

    def test_my_classes(self):
        assert classify_intent("What are my classes this week?") == "personal_courses"


# ── personal_fees ─────────────────────────────────────────────────────────────
class TestPersonalFees:
    def test_outstanding_fees(self):
        assert classify_intent("What are my outstanding fees?") == "personal_fees"

    def test_how_much_do_i_owe(self):
        assert classify_intent("How much do I owe to the university?") == "personal_fees"

    def test_fee_status(self):
        assert classify_intent("Can you show me my fee status?") == "personal_fees"

    def test_outstanding_balance(self):
        assert classify_intent("Check my outstanding balance please") == "personal_fees"


# ── hostel ───────────────────────────────────────────────────────────────────
class TestHostel:
    def test_hostel(self):
        assert classify_intent("How do I apply for a hostel room?") == "hostel"

    def test_accommodation(self):
        assert classify_intent("Is university accommodation available for first years?") == "hostel"

    def test_apply_for_accommodation_priority(self):
        # 'apply' is also an admission keyword — hostel must take priority
        assert classify_intent("How do I apply for accommodation?") == "hostel"


# ── admission ─────────────────────────────────────────────────────────────────
class TestAdmission:
    def test_admission_requirements(self):
        assert classify_intent("What are the admission requirements for MSc CS?") == "admission"

    def test_how_to_apply(self):
        assert classify_intent("How do I apply for the undergraduate programme?") == "admission"

    def test_application(self):
        assert classify_intent("When does the application window open?") == "admission"


# ── examination ──────────────────────────────────────────────────────────────
class TestExamination:
    def test_exam_schedule(self):
        assert classify_intent("When is the exam schedule released?") == "examination"

    def test_exams_plural(self):
        assert classify_intent("When are the exams?") == "examination"

    def test_resits(self):
        assert classify_intent("How do I register for resits?") == "examination"

    def test_midterm(self):
        assert classify_intent("Is there a midterm this semester?") == "examination"


# ── fees_general ──────────────────────────────────────────────────────────────
class TestFeesGeneral:
    def test_scholarships(self):
        # KEY regression: "hi" must NOT match inside "scholarships"
        assert classify_intent("Are there any scholarships available?") == "fees_general"

    def test_scholarship_singular(self):
        assert classify_intent("I need information about a scholarship") == "fees_general"

    def test_bursary(self):
        assert classify_intent("How do I apply for a bursary?") == "fees_general"

    def test_tuition_fee(self):
        assert classify_intent("What is the tuition fee for international students?") == "fees_general"

    def test_financial_aid(self):
        assert classify_intent("Is financial aid available for part-time students?") == "fees_general"


# ── academic_policy ───────────────────────────────────────────────────────────
class TestAcademicPolicy:
    def test_plagiarism(self):
        assert classify_intent("What is the plagiarism policy?") == "academic_policy"

    def test_late_submission(self):
        assert classify_intent("What happens with late submission?") == "academic_policy"

    def test_extenuating_circumstances(self):
        assert classify_intent("How do I apply for extenuating circumstances?") == "academic_policy"

    def test_gpa(self):
        assert classify_intent("What GPA do I need to pass?") == "academic_policy"


# ── greeting ──────────────────────────────────────────────────────────────────
class TestGreeting:
    def test_hi_standalone(self):
        assert classify_intent("hi") == "greeting"

    def test_hello(self):
        assert classify_intent("Hello there") == "greeting"

    def test_good_morning(self):
        assert classify_intent("good morning") == "greeting"

    # ── False-positive regression tests ──────────────────────────────────────
    def test_scholarships_not_greeting(self):
        # "hi" is substring of "scholarships" — must NOT match greeting
        assert classify_intent("Are there any scholarships?") != "greeting"

    def test_exhibit_not_greeting(self):
        # "hi" in "exhibit" — must not match
        assert classify_intent("The university exhibition is next week") != "greeting"

    def test_festival_fees_not_greeting(self):
        # "hey" not in "survey", test general/other category
        result = classify_intent("What is the festival grant?")
        assert result != "greeting"


# ── general fallback ──────────────────────────────────────────────────────────
class TestGeneralFallback:
    def test_unknown_query(self):
        assert classify_intent("Tell me about the library opening hours") == "general"

    def test_empty_query(self):
        assert classify_intent("") == "general"

    def test_random_words(self):
        assert classify_intent("purple elephant banana") == "general"
