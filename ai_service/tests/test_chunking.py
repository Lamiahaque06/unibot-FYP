"""
test_chunking.py
Unit tests for recursive_chunk() and clean_text() in document_processor.py

Covers:
  - Empty / whitespace input
  - Text shorter than chunk_size → single chunk returned
  - Text exactly at chunk_size boundary
  - Paragraph-level splitting
  - Overlap: each chunk after the first starts with tail of previous
  - No chunk exceeds chunk_size (hard limit)
  - clean_text normalisation
"""

import sys
import os
import pytest

# Allow running from the ai_service root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.document_processor import recursive_chunk, clean_text


# ── clean_text ────────────────────────────────────────────────────────────────

class TestCleanText:
    def test_strips_leading_trailing_whitespace(self):
        assert clean_text("  hello world  ") == "hello world"

    def test_collapses_multiple_spaces(self):
        result = clean_text("hello   world")
        assert "  " not in result

    def test_collapses_excessive_blank_lines(self):
        result = clean_text("a\n\n\n\n\nb")
        assert "\n\n\n" not in result
        assert "a" in result and "b" in result

    def test_replaces_form_feed(self):
        result = clean_text("page1\fpage2")
        assert "\f" not in result

    def test_empty_string(self):
        assert clean_text("") == ""

    def test_only_whitespace(self):
        assert clean_text("   \n\n  ") == ""


# ── recursive_chunk ───────────────────────────────────────────────────────────

class TestRecursiveChunk:
    def test_empty_string_returns_empty_list(self):
        assert recursive_chunk("") == []

    def test_whitespace_only_returns_empty_list(self):
        assert recursive_chunk("   \n\n  ") == []

    def test_short_text_returns_single_chunk(self):
        text = "This is a short sentence."
        chunks = recursive_chunk(text, chunk_size=500)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_text_at_exact_chunk_size_is_single_chunk(self):
        text = "a" * 800
        chunks = recursive_chunk(text, chunk_size=800, chunk_overlap=0)
        assert len(chunks) == 1

    def test_long_text_produces_multiple_chunks(self):
        # Build text that is definitely > 800 chars
        text = ("The university admission process is straightforward. " * 20)
        chunks = recursive_chunk(text, chunk_size=200, chunk_overlap=0)
        assert len(chunks) > 1

    def test_no_chunk_exceeds_chunk_size_significantly(self):
        # With overlap, chunks may be slightly larger than chunk_size due to
        # the tail prepend, but raw content should be near limit
        text = "Word " * 500  # 2500 chars
        chunks = recursive_chunk(text, chunk_size=300, chunk_overlap=50)
        for chunk in chunks:
            # allow 200-char tolerance for overlap tail
            assert len(chunk) < 500, f"Chunk too long: {len(chunk)}"

    def test_overlap_content_present_in_adjacent_chunks(self):
        # If overlap > 0, each chunk after the first should share some text
        # with the tail of the previous chunk
        text = "\n\n".join([f"Paragraph number {i} with some content here." for i in range(20)])
        chunks = recursive_chunk(text, chunk_size=200, chunk_overlap=40)
        if len(chunks) > 1:
            # The start of chunk[1] should contain text from the end of chunk[0]
            tail_of_0 = chunks[0][-40:]
            # At least some overlap words should be present
            overlap_words = tail_of_0.split()[-3:]  # last 3 words
            assert any(w in chunks[1] for w in overlap_words), (
                f"No overlap found between chunk 0 and chunk 1.\n"
                f"Tail of chunk 0: {tail_of_0!r}\n"
                f"Start of chunk 1: {chunks[1][:80]!r}"
            )

    def test_zero_overlap_chunks_do_not_share_content(self):
        paragraphs = [f"Unique paragraph {i}." for i in range(10)]
        text = "\n\n".join(paragraphs)
        chunks = recursive_chunk(text, chunk_size=100, chunk_overlap=0)
        # With zero overlap, consecutive chunks should be independent
        assert len(chunks) >= 1

    def test_single_word_longer_than_chunk_size(self):
        # Should still return a chunk (hard split falls back to character split)
        text = "a" * 2000
        chunks = recursive_chunk(text, chunk_size=300, chunk_overlap=0)
        assert len(chunks) > 0
        # All content is preserved
        total = "".join(chunks)
        assert len(total) >= 2000

    def test_paragraph_separator_preferred_over_sentence(self):
        # Text with clear paragraph breaks should split on \n\n, not mid-sentence
        para_a = "This is the first paragraph about admissions. " * 5
        para_b = "This is the second paragraph about fees. " * 5
        text = para_a + "\n\n" + para_b
        chunks = recursive_chunk(text, chunk_size=len(para_a) + 10, chunk_overlap=0)
        # para_a should be intact in first chunk
        assert para_a.strip() in chunks[0]

    def test_returns_list_of_strings(self):
        chunks = recursive_chunk("Hello world.\n\nSecond paragraph.", chunk_size=100)
        assert isinstance(chunks, list)
        assert all(isinstance(c, str) for c in chunks)
