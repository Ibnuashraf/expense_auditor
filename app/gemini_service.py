"""
Receipt extraction — vision-first (LLM), then lightweight OCR fallbacks.

Priority (stops early when merchant, amount > 0, and date are all present):
  1. Google Gemini Vision (GEMINI_API_KEY)
  2. OpenAI vision (OPENAI_API_KEY, default gpt-4o-mini)
  3. RapidOCR (offline ONNX; no keys needed)
  4. Tesseract + heuristics (optional binary on PATH)
  5. PaddleOCR (optional; only if installed — not required)

Configure models:
  GEMINI_VISION_MODEL   (default: gemini-2.0-flash)
  OPENAI_VISION_MODEL   (default: gpt-4o-mini)
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import tempfile
import warnings
from pathlib import Path
from typing import Any, Optional

warnings.filterwarnings("ignore")
logging.getLogger("ppocr").setLevel(logging.ERROR)
logging.getLogger("paddle").setLevel(logging.ERROR)

# ── Optional PaddleOCR (lazy; may be uninstalled) ─────────────────────────────
_paddle_ocr = None


def _get_paddle_ocr():
    global _paddle_ocr
    if _paddle_ocr is None:
        try:
            from paddleocr import PaddleOCR

            try:
                _paddle_ocr = PaddleOCR(
                    lang="en",
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                )
            except TypeError:
                _paddle_ocr = PaddleOCR(lang="en")
            logging.info("PaddleOCR initialised (fallback).")
        except Exception as exc:
            logging.debug("PaddleOCR unavailable: %s", exc)
            _paddle_ocr = None
    return _paddle_ocr


def _pdf_first_page_to_png(pdf_path: str) -> str:
    """Rasterise first page of a PDF to a temporary PNG (higher res for vision models)."""
    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    try:
        page = doc.load_page(0)
        mat = fitz.Matrix(3.0, 3.0)  # sharper for LLM / OCR
        pix = page.get_pixmap(matrix=mat, alpha=False)
        fd, tmp = tempfile.mkstemp(suffix=".png", prefix="auditra_ocr_")
        os.close(fd)
        pix.save(tmp)
        return tmp
    finally:
        doc.close()


def _paddle_page_to_rec_dict(page) -> dict:
    if page is None:
        return {}
    if isinstance(page, dict):
        inner = page.get("res")
        if isinstance(inner, dict) and ("rec_texts" in inner or "texts" in inner):
            return inner
        if "rec_texts" in page or "texts" in page:
            return page
        return {}
    res_attr = getattr(page, "res", None)
    if isinstance(res_attr, dict) and ("rec_texts" in res_attr or "texts" in res_attr):
        return res_attr
    for attr in ("json",):
        if hasattr(page, attr):
            try:
                raw = getattr(page, attr)
                if callable(raw):
                    raw = raw()
                if isinstance(raw, dict):
                    return _paddle_page_to_rec_dict(raw)
            except Exception:
                pass
    return {}


def _scores_to_list(scores) -> list[float]:
    if scores is None:
        return []
    if hasattr(scores, "tolist"):
        try:
            scores = scores.tolist()
        except Exception:
            pass
    if not isinstance(scores, (list, tuple)):
        return []
    out: list[float] = []
    for s in scores:
        try:
            out.append(float(s))
        except (TypeError, ValueError):
            out.append(1.0)
    return out


def _paddle_extract_text(image_path: str) -> str:
    ocr = _get_paddle_ocr()
    if ocr is None:
        raise RuntimeError("PaddleOCR is not available.")

    result = ocr.predict(image_path)
    lines: list[str] = []
    pages: list = []
    if result is not None:
        if isinstance(result, (list, tuple)):
            pages = list(result)
        else:
            try:
                pages = list(result)
            except TypeError:
                pages = [result]

    for page in pages:
        rec = _paddle_page_to_rec_dict(page)
        texts = rec.get("rec_texts") or rec.get("texts") or []
        scores = _scores_to_list(rec.get("rec_scores") or rec.get("scores") or [])

        if texts:
            for idx, text in enumerate(texts):
                if not isinstance(text, str) or not text.strip():
                    continue
                score = scores[idx] if idx < len(scores) else 1.0
                if float(score) >= 0.50:
                    lines.append(text.strip())
            continue

        if isinstance(page, list):
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


# ── Heuristic parsing of raw text ─────────────────────────────────────────────
_TOTAL_KEYWORDS = re.compile(
    r"\b(grand\s*t[o0]t[a4][l1]|t[o0]t[a4][l1]\s*amount|t[o0]t[a4][l1]\s*due|amount\s*due|"
    r"net\s*t[o0]t[a4][l1]|subt[o0]t[a4][l1]|sub\s*t[o0]t[a4][l1]|t[o0]t[a4][l1]|amount|due|balance|"
    r"pay|payable|bill\s*amount|inv(?:oice)?\s*t[o0]t[a4][l1])\b",
    re.IGNORECASE,
)

_AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?|inr|₹|\$|€|£|usd|eur|gbp)?\s*"
    r"(\d+(?:\.\d{1,2})?|\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)"
    r"(?:\s*(?:rs\.?|inr|₹|\$|€|£))?",
    re.IGNORECASE,
)

_DATE_PATTERNS = [
    re.compile(r"\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b"),
    re.compile(r"\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b"),
    re.compile(
        r"\b(\d{1,2}[\s\-\/\.]*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-\/\.]*\d{2,4})\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-\/\.]*\d{1,2}(?:[\s\-\/\.]*,?[\s\-\/\.]*|\s+)\d{2,4})\b",
        re.IGNORECASE,
    ),
]


def _parse_amount(text: str) -> float:
    lines = text.split("\n")
    candidate_amounts: list[float] = []
    for idx, line in enumerate(lines):
        # Ignore ID-like numbers (bill/invoice/order/card/phone/date/table/time/gstin)
        if re.search(r"(?i)\b(bill|invoice|inv|order|no\.?|number|ref|reference|card|phone|tel|table|waiter|gstin|date|time)\b", line):
            if not re.search(r"(?i)\b(total|grand|subtotal|payable)\b", line):
                continue
            if re.search(r"(?i)\b(no|number|#|id|tel|phone|table|waiter|gstin)\b", line):
                continue

        # Ignore lines containing qty, item, desc, rate, unit which are typical table headers
        if re.search(r"(?i)\b(qty|item|desc|description|rate|unit)\b", line):
            continue

        if _TOTAL_KEYWORDS.search(line):
            has_num = False
            for m in _AMOUNT_PATTERN.finditer(line):
                raw = m.group(1).replace(",", "").replace(" ", "")
                try:
                    candidate_amounts.append(float(raw))
                    has_num = True
                except ValueError:
                    pass
            
            # Lookahead to next line if no amount on this line
            if not has_num and idx + 1 < len(lines):
                next_line = lines[idx + 1].strip()
                # If next line is not skipped
                if not re.search(r"(?i)\b(qty|item|desc|description|rate|unit|bill|invoice|inv|order|no\.?|number|ref|reference|card|phone|tel|table|waiter|gstin|date|time)\b", next_line):
                    m = _AMOUNT_PATTERN.search(next_line)
                    if m:
                        raw = m.group(1).replace(",", "").replace(" ", "")
                        try:
                            candidate_amounts.append(float(raw))
                        except ValueError:
                            pass

    if candidate_amounts:
        return max(candidate_amounts)

    # Pass 2 – prefer amounts that look like money (currency symbol/code nearby)
    all_amounts: list[float] = []
    money_like: list[float] = []
    for line in lines:
        if re.search(r"(?i)\b(bill|invoice|inv|order|no\.?|number|ref|reference|card|phone|tel|table|waiter|gstin|date|time)\b", line):
            if not re.search(r"(?i)\b(total|grand|subtotal|payable)\b", line):
                continue
            if re.search(r"(?i)\b(no|number|#|id|tel|phone|table|waiter|gstin)\b", line):
                continue

        if re.search(r"(?i)\b(qty|item|desc|description|rate|unit)\b", line):
            continue

        for m in _AMOUNT_PATTERN.finditer(line):
            raw = m.group(1).replace(",", "").replace(" ", "")
            try:
                val = float(raw)
            except ValueError:
                continue
            if val <= 0:
                continue
            all_amounts.append(val)
            # If we see a currency marker on the same line, treat as money-like
            if re.search(r"(?i)(₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\b", line):
                money_like.append(val)

    if money_like:
        return max(money_like)
    # If only small integers exist (typical bill/order numbers), return 0 to avoid false totals
    if all_amounts and max(all_amounts) < 1000 and not re.search(r"(?i)\b(total|grand)\b", text):
        return 0.0
    return max(all_amounts) if all_amounts else 0.0


def _normalize_extracted_date(date_str: str) -> str:
    months = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
    }
    cleaned = re.sub(r"\s+", " ", date_str).strip()
    m_match = re.search(r"(?i)(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*", cleaned)
    if m_match:
        month_name = m_match.group(0).lower()[:3]
        month_num = months[month_name]
        parts = re.split(r"(?i)(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*", cleaned)
        if len(parts) >= 2:
            before = re.findall(r"\d+", parts[0])
            after = re.findall(r"\d+", parts[1])
            day = None
            year = None
            if before and after:
                day = int(before[0])
                year = int(after[0])
            elif after:
                if len(after) >= 2:
                    day = int(after[0])
                    year = int(after[1])
            
            if day is not None and year is not None:
                if year < 100:
                    year += 2000
                return f"{year:04d}-{month_num:02d}-{day:02d}"
                
    from datetime import datetime
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y", "%d.%m.%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
            
    return cleaned


def _parse_date(text: str) -> str:
    for pattern in _DATE_PATTERNS:
        m = pattern.search(text)
        if m:
            raw_date = m.group(1).strip()
            try:
                return _normalize_extracted_date(raw_date)
            except Exception:
                return raw_date
    return ""


def _parse_merchant(text: str) -> str:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    for line in lines[:6]:
        if _AMOUNT_PATTERN.search(line) and not re.search(r"[a-zA-Z]{3,}", line):
            continue
        if any(p.search(line) for p in _DATE_PATTERNS):
            continue
        if len(line) < 3:
            continue
        cleaned = re.sub(
            r"(?i)\b(invoice|receipt|bill|tax\s*invoice|gst\s*invoice)\b", "", line
        ).strip()
        if len(cleaned) >= 3:
            return cleaned
    return lines[0] if lines else ""


def _parse_structured(ocr_text: str) -> dict:
    return {
        "merchant": _parse_merchant(ocr_text),
        "amount": _parse_amount(ocr_text),
        "date": _parse_date(ocr_text),
        "raw_text": ocr_text,
    }


# ── Vision LLM shared prompt ─────────────────────────────────────────────────
_VISION_JSON_PROMPT = """
You are an expert receipt and invoice analyst. Read the image carefully.

Extract exactly these fields:
- merchant: store or company name (main business name on the receipt)
- currency: ISO-like code (INR, USD, EUR, GBP, etc.)
- date: transaction or invoice date as printed
- total_amount: final amount payable / grand total as a number only (no currency symbol)
- line_items: list of objects with keys name, amount (number), category (Meals, Lodging, Transport, Other)

Return ONLY valid JSON with exactly these keys:
{"merchant":"...","currency":"...","date":"...","total_amount":0.0,"line_items":[{"name":"...","amount":0.0,"category":"..."}]}
No markdown, no code fences, no explanation.
""".strip()


def _json_from_llm_text(text: str) -> Optional[dict]:
    if not text:
        return None
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.DOTALL).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    return None


def _normalize_vision_payload(data: dict[str, Any]) -> dict[str, Any]:
    if not data:
        return {}
    try:
        amt = float(data.get("total_amount", 0) or 0)
    except (TypeError, ValueError):
        amt = 0.0
    return {
        "merchant": str(data.get("merchant", "") or "").strip(),
        "currency": str(data.get("currency", "") or "INR").strip() or "INR",
        "amount": amt,
        "date": str(data.get("date", "") or "").strip(),
        "line_items": data.get("line_items", []) or [],
    }


_gemini_client = None


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        try:
            from google import genai

            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                return None
            _gemini_client = genai.Client(api_key=api_key)
        except Exception as exc:
            logging.error("Gemini client init failed: %s", exc)
            _gemini_client = None
    return _gemini_client


def _gemini_extract(image_path: str) -> dict:
    try:
        from PIL import Image as PILImage

        client = _get_gemini_client()
        if client is None:
            return {}

        model = os.getenv("GEMINI_VISION_MODEL", "gemini-2.0-flash")
        image = PILImage.open(image_path)
        response = client.models.generate_content(
            model=model,
            contents=[_VISION_JSON_PROMPT, image],
        )
        raw = getattr(response, "text", None) or ""
        if not raw and getattr(response, "candidates", None):
            try:
                parts = response.candidates[0].content.parts
                raw = "".join(getattr(p, "text", "") or "" for p in parts)
            except (IndexError, AttributeError, TypeError):
                raw = ""

        data = _json_from_llm_text(raw.strip())
        if not data:
            logging.warning("Gemini returned unparseable JSON.")
            return {}
        return _normalize_vision_payload(data)
    except Exception as exc:
        logging.warning("Gemini Vision extraction failed: %s", exc)
        return {}


def _openai_vision_extract(image_path: str) -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {}
    try:
        from openai import OpenAI

        path = Path(image_path)
        suffix = path.suffix.lower()
        mime_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }
        mime = mime_map.get(suffix, "image/png")
        with open(path, "rb") as f:
            b64 = base64.standard_b64encode(f.read()).decode("ascii")

        model = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _VISION_JSON_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{b64}",
                            },
                        },
                    ],
                }
            ],
            max_tokens=2048,
        )
        choice = resp.choices[0]
        raw = (choice.message.content or "").strip()
        data = _json_from_llm_text(raw)
        if not data:
            logging.warning("OpenAI vision returned unparseable JSON.")
            return {}
        return _normalize_vision_payload(data)
    except Exception as exc:
        logging.warning("OpenAI vision extraction failed: %s", exc)
        return {}


def _tesseract_extract_text(image_path: str) -> str:
    try:
        import pytesseract
        from PIL import Image

        img = Image.open(image_path)
        return (pytesseract.image_to_string(img) or "").strip()
    except Exception as exc:
        logging.debug("Tesseract OCR skipped: %s", exc)
        return ""

def _rapidocr_extract_text(image_path: str) -> str:
    """
    Offline OCR with RapidOCR (onnxruntime backend).
    This works without GEMINI/OpenAI keys and without the system tesseract binary.
    """
    try:
        from rapidocr_onnxruntime import RapidOCR

        engine = RapidOCR()
        res, _ = engine(str(image_path))
        if not res:
            return ""
        # res is typically: [[box, text, score], ...]
        lines: list[str] = []
        for item in res:
            try:
                text = item[1]
            except Exception:
                continue
            if isinstance(text, str) and text.strip():
                lines.append(text.strip())
        return "\n".join(lines)
    except Exception as exc:
        logging.debug("RapidOCR skipped: %s", exc)
        return ""


def _is_extract_complete(row: dict) -> bool:
    m = (row.get("merchant") or "").strip()
    d = (row.get("date") or "").strip()
    try:
        amt = float(row.get("amount") or 0)
    except (TypeError, ValueError):
        amt = 0.0
    return bool(m) and bool(d) and amt > 0


def _merge_partial(into: dict, src: dict) -> dict:
    """Fill empty / zero fields in `into` from `src`."""
    if not src:
        return into
    out = dict(into)
    if not (out.get("merchant") or "").strip():
        out["merchant"] = (src.get("merchant") or "").strip()
    try:
        cur_amt = float(out.get("amount") or 0)
    except (TypeError, ValueError):
        cur_amt = 0.0
    try:
        src_amt = float(src.get("amount") or 0)
    except (TypeError, ValueError):
        src_amt = 0.0
    if cur_amt <= 0 and src_amt > 0:
        out["amount"] = src_amt
    if not (out.get("date") or "").strip():
        out["date"] = (src.get("date") or "").strip()
    cur_cur = (out.get("currency") or "INR").strip()
    if not cur_cur or cur_cur == "INR":
        sc = (src.get("currency") or "").strip()
        if sc:
            out["currency"] = sc
    if not out.get("line_items") and src.get("line_items"):
        out["line_items"] = src["line_items"]
    rt = (out.get("raw_text") or "").strip()
    if not rt and (src.get("raw_text") or "").strip():
        out["raw_text"] = src["raw_text"]
    return out


def extract_receipt_data(image_path: str) -> dict:
    """
    Extract merchant, amount, date (and optional line items) from a receipt image or PDF.

    Vision APIs are tried first; classic OCR only fills gaps.
    """
    image_path = str(image_path)

    if not Path(image_path).exists():
        return {"error": f"File not found: {image_path}"}

    work_path = image_path
    temp_png: Optional[str] = None
    ext = Path(image_path).suffix.lower()
    if ext == ".pdf":
        try:
            temp_png = _pdf_first_page_to_png(image_path)
            work_path = temp_png
            logging.info("Rasterised PDF for extraction: %s", work_path)
        except Exception as exc:
            logging.error("PDF rasterisation failed: %s", exc)
            return {"error": f"Could not read PDF for extraction: {exc}"}

    merged: dict[str, Any] = {
        "merchant": "",
        "currency": "INR",
        "amount": 0.0,
        "date": "",
        "line_items": [],
        "raw_text": "",
    }

    try:
        has_gemini = bool(os.getenv("GEMINI_API_KEY"))
        has_openai = bool(os.getenv("OPENAI_API_KEY"))
        primary = (os.getenv("RECEIPT_VISION_PRIMARY") or "gemini").strip().lower()

        if not has_gemini and not has_openai:
            logging.warning(
                "No GEMINI_API_KEY or OPENAI_API_KEY — receipt extraction will rely on "
                "Tesseract/Paddle only; set a vision API key for reliable results."
            )

        def _run_gemini() -> None:
            nonlocal merged
            g = _gemini_extract(work_path)
            merged = _merge_partial(merged, g)
            logging.info("After Gemini: %s", merged)

        def _run_openai() -> None:
            nonlocal merged
            o = _openai_vision_extract(work_path)
            merged = _merge_partial(merged, o)
            logging.info("After OpenAI: %s", merged)

        # 1–2) Vision LLMs: primary first, then the other if still incomplete
        if primary == "openai" and has_openai:
            _run_openai()
            if has_gemini and not _is_extract_complete(merged):
                _run_gemini()
        else:
            if has_gemini:
                _run_gemini()
            if has_openai and not _is_extract_complete(merged):
                _run_openai()

        # 3) RapidOCR (offline) + heuristics
        if not _is_extract_complete(merged):
            txt = _rapidocr_extract_text(work_path)
            if txt.strip():
                parsed = _parse_structured(txt)
                merged = _merge_partial(merged, parsed)
                logging.info("After RapidOCR: %s", merged)

        # 4) Tesseract + heuristics
        if not _is_extract_complete(merged):
            txt = _tesseract_extract_text(work_path)
            if txt.strip():
                parsed = _parse_structured(txt)
                merged = _merge_partial(merged, parsed)
                logging.info("After Tesseract: %s", merged)

        # 5) PaddleOCR (optional)
        if not _is_extract_complete(merged):
            try:
                ptxt = _paddle_extract_text(work_path)
                if ptxt.strip():
                    parsed = _parse_structured(ptxt)
                    merged = _merge_partial(merged, parsed)
                    logging.info("After PaddleOCR: %s", merged)
            except Exception as exc:
                logging.debug("Paddle fallback: %s", exc)

        # Normalise raw_text for downstream policy / RAG
        raw = (merged.get("raw_text") or "").strip()
        if not raw:
            parts = [merged.get("merchant"), str(merged.get("amount")), merged.get("date")]
            raw = "\n".join(p for p in parts if p)
            if merged.get("line_items"):
                try:
                    raw = raw + "\n" + json.dumps(merged["line_items"], ensure_ascii=False)
                except (TypeError, ValueError):
                    pass
        merged["raw_text"] = raw

        if not (merged.get("merchant") or "").strip():
            merged["merchant"] = ""
        if not (merged.get("date") or "").strip():
            merged["date"] = ""
        try:
            amt = float(merged.get("amount") or 0)
        except (TypeError, ValueError):
            amt = 0.0
        merged["amount"] = amt

        if not merged["merchant"] and merged["amount"] <= 0 and not merged["date"]:
            hint = (
                "Set GEMINI_API_KEY and/or OPENAI_API_KEY for vision extraction, "
                "or install Tesseract OCR and add it to PATH."
            )
            return {"error": f"Could not extract receipt data. {hint}"}

        return {
            "merchant": merged["merchant"],
            "currency": merged.get("currency") or "INR",
            "amount": merged["amount"],
            "date": merged["date"],
            "line_items": merged.get("line_items") or [],
            "raw_text": merged["raw_text"],
        }
    finally:
        if temp_png and os.path.isfile(temp_png):
            try:
                os.unlink(temp_png)
            except OSError:
                pass
