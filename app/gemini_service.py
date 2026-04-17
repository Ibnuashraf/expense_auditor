"""
OCR Service - Multi-Engine Receipt/Bill Text Extraction
Primary: PaddleOCR (PP-OCRv5)
Fallback: Google Gemini Vision
"""

import re
import json
import os
import logging
import warnings
from pathlib import Path

# Suppress verbose PaddleOCR logging
warnings.filterwarnings("ignore")
logging.getLogger("ppocr").setLevel(logging.ERROR)
logging.getLogger("paddle").setLevel(logging.ERROR)

# ── PaddleOCR singleton (lazy-loaded to avoid slow startup on import) ─────────
_paddle_ocr = None

def _get_paddle_ocr():
    """Lazy-load PaddleOCR to avoid slow startup time on every import."""
    global _paddle_ocr
    if _paddle_ocr is None:
        try:
            from paddleocr import PaddleOCR
            _paddle_ocr = PaddleOCR(lang="en")
            logging.info("PaddleOCR initialised successfully.")
        except Exception as exc:
            logging.error("PaddleOCR init failed: %s", exc)
            _paddle_ocr = None
    return _paddle_ocr


# ── Gemini client (lazy-loaded) ───────────────────────────────────────────────
_gemini_client = None

def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        try:
            from google import genai
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                logging.warning("GEMINI_API_KEY not set; Gemini fallback is disabled.")
                return None
            _gemini_client = genai.Client(
                api_key=api_key
            )
        except Exception as exc:
            logging.error("Gemini client init failed: %s", exc)
    return _gemini_client


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 – Extract raw text from image using PaddleOCR
# ─────────────────────────────────────────────────────────────────────────────

def _paddle_extract_text(image_path: str) -> str:
    """Run PaddleOCR on the image and return all detected text as one string."""
    ocr = _get_paddle_ocr()
    if ocr is None:
        raise RuntimeError("PaddleOCR is not available.")

    result = ocr.predict(image_path)

    lines: list[str] = []

    # PaddleOCR v3.x: predict() returns a list of page-level result dicts.
    # Each item has a 'rec_texts' key (list of strings) and a 'rec_scores' key.
    if result and isinstance(result, list):
        for page in result:
            if isinstance(page, dict):
                # v3.x format
                texts = page.get("rec_texts") or page.get("texts") or []
                scores = page.get("rec_scores") or page.get("scores") or []
                for idx, text in enumerate(texts):
                    if isinstance(text, str) and text.strip():
                        # Filter out low-confidence detections
                        score = scores[idx] if idx < len(scores) else 1.0
                        if float(score) >= 0.50:
                            lines.append(text.strip())
            elif isinstance(page, list):
                # Legacy v2.x format: [[bbox, (text, score)], ...]
                for item in page:
                    if isinstance(item, (list, tuple)) and len(item) >= 2:
                        text_info = item[1]
                        if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                            text, score = text_info[0], text_info[1]
                        elif isinstance(text_info, str):
                            text, score = text_info, 1.0
                        else:
                            continue
                        if text and str(text).strip() and float(score) >= 0.50:
                            lines.append(str(text).strip())

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 – Parse structured fields from raw OCR text
# ─────────────────────────────────────────────────────────────────────────────

# Keywords that appear near total-amount lines on receipts
_TOTAL_KEYWORDS = re.compile(
    r"\b(grand\s*total|total\s*amount|total\s*due|amount\s*due|"
    r"net\s*total|subtotal|sub\s*total|total|amount|due|balance|"
    r"pay|payable|bill\s*amount|inv(?:oice)?\s*total)\b",
    re.IGNORECASE,
)

# Currency-prefixed or -suffixed amount
_AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?|inr|₹|\$|€|£|usd|eur|gbp)?\s*"
    r"(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)"
    r"(?:\s*(?:rs\.?|inr|₹|\$|€|£))?",
    re.IGNORECASE,
)

# Common date patterns found on bills
_DATE_PATTERNS = [
    re.compile(r"\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b"),       # DD/MM/YYYY
    re.compile(r"\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b"),          # YYYY/MM/DD
    re.compile(r"\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{2,4})\b", re.IGNORECASE),  # 12 Apr 2024
    re.compile(r"\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{2,4})\b", re.IGNORECASE),  # Apr 12, 2024
]


def _parse_amount(text: str) -> float:
    """
    Find the most likely total amount from OCR text.
    Strategy: find lines that contain a total-related keyword, then grab
    the largest numeric value from those lines.  If that fails, grab the
    largest number in the whole text (bills rarely show bigger numbers
    than the total).
    """
    lines = text.split("\n")

    # Pass 1 – lines with total keywords
    candidate_amounts: list[float] = []
    for line in lines:
        if _TOTAL_KEYWORDS.search(line):
            for m in _AMOUNT_PATTERN.finditer(line):
                raw = m.group(1).replace(",", "").replace(" ", "")
                try:
                    candidate_amounts.append(float(raw))
                except ValueError:
                    pass

    if candidate_amounts:
        return max(candidate_amounts)

    # Pass 2 – largest number in the whole text
    all_amounts: list[float] = []
    for m in _AMOUNT_PATTERN.finditer(text):
        raw = m.group(1).replace(",", "").replace(" ", "")
        try:
            val = float(raw)
            if val > 0:
                all_amounts.append(val)
        except ValueError:
            pass

    return max(all_amounts) if all_amounts else 0.0


def _parse_date(text: str) -> str:
    """Return the first recognisable date found in the OCR text."""
    for pattern in _DATE_PATTERNS:
        m = pattern.search(text)
        if m:
            return m.group(1).strip()
    return ""


def _parse_merchant(text: str) -> str:
    """
    Heuristic: the merchant is usually the first non-trivial line at the top
    of a receipt (before any price / date information appears).
    """
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    for line in lines[:6]:                          # look at top 6 lines only
        # Skip lines that look like amounts, dates, or single words / numbers
        if _AMOUNT_PATTERN.search(line) and not re.search(r"[a-zA-Z]{3,}", line):
            continue
        if any(p.search(line) for p in _DATE_PATTERNS):
            continue
        if len(line) < 3:
            continue
        # Remove common noise words
        cleaned = re.sub(r"(?i)\b(invoice|receipt|bill|tax\s*invoice|gst\s*invoice)\b", "", line).strip()
        if len(cleaned) >= 3:
            return cleaned
    return lines[0] if lines else ""


def _parse_structured(ocr_text: str) -> dict:
    """Convert raw OCR text into {merchant, amount, date}."""
    return {
        "merchant": _parse_merchant(ocr_text),
        "amount":   _parse_amount(ocr_text),
        "date":     _parse_date(ocr_text),
        "raw_text": ocr_text,
    }


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 – Gemini Vision fallback / enhancer
# ─────────────────────────────────────────────────────────────────────────────

_GEMINI_PROMPT = """
You are an expert receipt/bill analysis AI.
Extract the following fields from the receipt image:
- merchant  (store / company name on the receipt)
- currency  (e.g., USD, INR, GBP, EUR)
- date      (transaction date)
- total_amount (the FINAL grand total as a number)
- line_items (a list of purchased items. For each item provide: 'name', 'amount', and predict the 'category' e.g. Meals, Lodging, Transport, Other)

Return ONLY a valid JSON object with exactly these keys:
{"merchant": "...", "currency": "...", "date": "...", "total_amount": 0.0, "line_items": [{"name": "...", "amount": 0.0, "category": "..."}]}
No extra text, no markdown, no explanation.
""".strip()


def _gemini_extract(image_path: str) -> dict:
    """Use Gemini Vision to extract receipt data. Returns {} on failure."""
    try:
        from PIL import Image as PILImage
        client = _get_gemini_client()
        if client is None:
            return {}

        image = PILImage.open(image_path)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[_GEMINI_PROMPT, image],
        )
        text = response.text.strip()

        # Strip markdown code fences if present
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.DOTALL).strip()

        data = json.loads(text)
        return {
            "merchant":   str(data.get("merchant", "") or ""),
            "currency":   str(data.get("currency", "") or "INR"),
            "amount":     float(data.get("total_amount", 0) or 0),
            "date":       str(data.get("date", "") or ""),
            "line_items": data.get("line_items", []) or []
        }
    except Exception as exc:
        logging.warning("Gemini Vision extraction failed: %s", exc)
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def extract_receipt_data(image_path: str) -> dict:
    """
    Extract merchant, amount and date from a receipt/bill image.

    Pipeline:
      1. PaddleOCR → raw text → regex / heuristic parsing
      2. If PaddleOCR result is incomplete, enhance with Gemini Vision
      3. Gemini-only path if PaddleOCR is completely unavailable

    Returns a dict with keys: merchant, amount, date
    On failure: {"error": "<message>"}
    """
    image_path = str(image_path)

    if not Path(image_path).exists():
        return {"error": f"File not found: {image_path}"}

    paddle_data: dict = {}
    ocr_text: str = ""

    # ── Stage 1: PaddleOCR ───────────────────────────────────────────────────
    try:
        ocr_text = _paddle_extract_text(image_path)
        logging.info("PaddleOCR raw text:\n%s", ocr_text)

        if ocr_text.strip():
            paddle_data = _parse_structured(ocr_text)
            logging.info("PaddleOCR parsed: %s", paddle_data)
    except Exception as exc:
        logging.error("PaddleOCR stage failed: %s", exc)

    # ── Stage 2: Evaluate completeness ───────────────────────────────────────
    needs_enhancement = (
        not paddle_data.get("merchant")
        or not paddle_data.get("amount")
        or not paddle_data.get("date")
    )

    gemini_data: dict = {}
    if needs_enhancement:
        logging.info("PaddleOCR result incomplete – calling Gemini Vision.")
        gemini_data = _gemini_extract(image_path)

    # ── Stage 3: Merge results (PaddleOCR wins; Gemini fills gaps) ───────────
    merchant = (paddle_data.get("merchant") or gemini_data.get("merchant") or "").strip()
    date     = (paddle_data.get("date")     or gemini_data.get("date")     or "").strip()

    # For amount, prefer whichever is non-zero; if both are non-zero, take the
    # PaddleOCR value (regex-backed, more reliable for numbers)
    paddle_amount = float(paddle_data.get("amount") or 0)
    gemini_amount = float(gemini_data.get("amount") or 0)
    amount = paddle_amount if paddle_amount > 0 else gemini_amount

    if not merchant and not amount and not date:
        return {"error": "Could not extract any data from the receipt image."}

    return {
        "merchant":   merchant,
        "currency":   gemini_data.get("currency", "INR"),
        "amount":     amount,
        "date":       date,
        "line_items": gemini_data.get("line_items", [])
    }