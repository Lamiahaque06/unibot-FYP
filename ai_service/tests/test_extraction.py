"""
test_extraction.py
Unit tests for text extraction functions in document_processor.py.

Covers:
  - extract_text_from_txt: correct text returned, encoding resilience,
    multi-line preservation, empty file, return type
  - extract_text router: correct dispatch by extension,
    rejection of .doc and unsupported extensions
"""

import os
import sys
import tempfile
import pytest

# Allow running from the ai_service root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.document_processor import extract_text, extract_text_from_txt


# ── extract_text_from_txt ─────────────────────────────────────────────────────

class TestExtractTextFromTxt:
    def _write_tmp(self, content: str, encoding: str = "utf-8") -> str:
        """Write content to a temp .txt file and return the path."""
        fd, path = tempfile.mkstemp(suffix=".txt")
        with os.fdopen(fd, "w", encoding=encoding) as f:
            f.write(content)
        return path

    def test_returns_tuple_of_str_and_list(self):
        path = self._write_tmp("Hello world.")
        try:
            result = extract_text_from_txt(path)
            assert isinstance(result, tuple) and len(result) == 2
            full, sections = result
            assert isinstance(full, str)
            assert isinstance(sections, list)
        finally:
            os.unlink(path)

    def test_full_text_matches_file_content(self):
        content = "University of Westminster\nFee structure 2024."
        path = self._write_tmp(content)
        try:
            full, _ = extract_text_from_txt(path)
            assert full == content
        finally:
            os.unlink(path)

    def test_sections_list_contains_full_text_as_single_element(self):
        content = "Some document text."
        path = self._write_tmp(content)
        try:
            full, sections = extract_text_from_txt(path)
            assert len(sections) == 1
            assert sections[0] == full
        finally:
            os.unlink(path)

    def test_multi_line_content_preserved(self):
        lines = ["Line one", "Line two", "Line three"]
        content = "\n".join(lines)
        path = self._write_tmp(content)
        try:
            full, _ = extract_text_from_txt(path)
            for line in lines:
                assert line in full
        finally:
            os.unlink(path)

    def test_empty_file_returns_empty_full_text(self):
        path = self._write_tmp("")
        try:
            full, sections = extract_text_from_txt(path)
            assert full == ""
        finally:
            os.unlink(path)

    def test_unicode_content_preserved(self):
        content = "Tuition: £9,250 per year – international: €15,000"
        path = self._write_tmp(content)
        try:
            full, _ = extract_text_from_txt(path)
            assert "£9,250" in full
            assert "€15,000" in full
        finally:
            os.unlink(path)


# ── extract_text router ───────────────────────────────────────────────────────

class TestExtractTextRouter:
    def test_routes_txt_extension_to_txt_handler(self):
        content = "Module handbook excerpt."
        fd, path = tempfile.mkstemp(suffix=".txt")
        with os.fdopen(fd, "w") as f:
            f.write(content)
        try:
            full, _ = extract_text(path)
            assert full == content
        finally:
            os.unlink(path)

    def test_routes_md_extension_to_txt_handler(self):
        content = "# Heading\n\nParagraph text."
        fd, path = tempfile.mkstemp(suffix=".md")
        with os.fdopen(fd, "w") as f:
            f.write(content)
        try:
            full, _ = extract_text(path)
            assert "Heading" in full
        finally:
            os.unlink(path)

    def test_raises_for_legacy_doc_format(self):
        fd, path = tempfile.mkstemp(suffix=".doc")
        os.close(fd)
        try:
            with pytest.raises(ValueError, match=r"Legacy .doc"):
                extract_text(path)
        finally:
            os.unlink(path)
