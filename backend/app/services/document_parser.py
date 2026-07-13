"""Document processing - extract text and structured hints from uploads.

Uses PyPDF for PDFs (and Docling if available for richer extraction). The
extracted text is attached to the procurement package and lightly parsed for
obvious numeric fields to pre-fill the form.
"""
from __future__ import annotations

import io
import re
from typing import Dict


def extract_text(filename: str, content: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return _extract_pdf(content)
    if name.endswith((".txt", ".md", ".csv")):
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception:
            return ""
    if name.endswith((".docx",)):
        return _extract_docx(content)
    # Best effort decode.
    try:
        return content.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _extract_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        return ""


def _extract_docx(content: bytes) -> str:
    try:
        import docx

        doc = docx.Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception:
        return ""


def extract_fields(text: str) -> Dict[str, object]:
    """Heuristically pull a few fields from raw text to pre-fill the form."""
    out: Dict[str, object] = {}
    if not text:
        return out

    low = text.lower()

    m = re.search(
        r"(?:contract value|commercial offer|quoted price|package price|total package price|value)[^\d]{0,30}([\d,.]+)\s*(?:cr|crore)",
        low,
    )
    if m:
        try:
            out["contract_value_cr"] = float(m.group(1).replace(",", ""))
        except Exception:
            pass

    m = re.search(r"advance[^\d]{0,20}(\d{1,3})\s*%", low)
    if m:
        out["advance_payment_pct"] = float(m.group(1))

    m = re.search(r"construction[^\d]{0,20}(\d{1,3})\s*%", low)
    if m:
        out["construction_completion_pct"] = float(m.group(1))

    m = re.search(r"(\d{1,3})\s*technicians?\s*available", low)
    if m:
        out["technicians_available"] = int(m.group(1))
    m = re.search(r"(\d{1,3})\s*technicians?\s*required", low)
    if m:
        out["technicians_required"] = int(m.group(1))

    if "warranty" in low and "delivery" in low:
        out["warranty_start"] = "On Delivery"

    return out
