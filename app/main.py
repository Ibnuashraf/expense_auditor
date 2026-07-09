"""
main.py — Auditra FastAPI application.

Endpoints
─────────
Public
  POST  /auth/register
  POST  /auth/login
  GET   /health

Protected (JWT required)
  GET   /auth/me
  POST  /expense
  GET   /expenses          ?status= &category= &search= &sort_by= &mine=
  GET   /expense/{id}
  PATCH /expense/{id}
  POST  /upload/{expense_id}

Static
  GET   /uploads/{filename}   (receipt image preview)
"""

import logging
import os
import re
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

_DOTENV_PATH = Path(__file__).resolve().parents[1] / ".env"  # expense_auditor/.env
_DOTENV_LOADED = False
_DOTENV_READ_OK = None  # None=dotenv unavailable, True/False=load_dotenv return
_DOTENV_CHANGED_ANY = None

try:
    # Load environment variables from expense_auditor/.env when present.
    # This fixes vision_configured=false when keys are only in a local .env.
    from dotenv import load_dotenv

    _before = (
        bool(os.getenv("GEMINI_API_KEY")),
        bool(os.getenv("OPENAI_API_KEY")),
    )
    _DOTENV_READ_OK = load_dotenv(dotenv_path=_DOTENV_PATH, override=False)
    _after = (
        bool(os.getenv("GEMINI_API_KEY")),
        bool(os.getenv("OPENAI_API_KEY")),
    )
    # load_dotenv() returns True only if it set at least one previously-unset var.
    # It can be False even when the file was read (e.g. vars already existed).
    _DOTENV_LOADED = bool(_DOTENV_READ_OK)
    _DOTENV_CHANGED_ANY = _before != _after
except Exception:
    # dotenv is optional at runtime; env vars may be provided by the shell/host.
    pass

from fastapi import (
    Depends, FastAPI, File, HTTPException, Query,
    UploadFile, status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import crud, database, models, schemas
from .auth import (
    create_access_token,
    get_current_user,
    require_role,
    verify_password,
    get_db,
)
from .gemini_service import extract_receipt_data
from .policy_engine import run_policy_audit

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Upload dir ───────────────────────────────────────────────────────────────
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp", ".pdf"}


def _normalize_text(value: Optional[str]) -> str:
    # Normalize for matching: case-insensitive, ignore punctuation and whitespace.
    return re.sub(r"\s+", "", re.sub(r"[^a-z0-9\s]", "", (value or "").lower())).strip()


def _normalize_date_text(value: Optional[str]) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    raw2 = re.sub(r"\s+", " ", raw).strip()
    # Accept both numeric dates and month-name formats (e.g. 20 SEP 2026).
    formats = (
        "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y", "%d.%m.%Y", "%Y/%m/%d",
        "%d %b %Y", "%d %B %Y", "%d %b, %Y", "%d %B, %Y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(raw2, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Handle cases like "20 SEP 2026" vs "20/09/2026" more forgivingly.
    # If parsing fails, fall back to a whitespace/punctuation-insensitive tokenization.
    return _normalize_text(raw2)


def _collect_ocr_mismatches(expense: models.Expense, ocr_data: dict) -> list[str]:
    mismatches: list[str] = []
    ocr_merchant = str(ocr_data.get("merchant") or "").strip()
    ocr_date = str(ocr_data.get("date") or "").strip()
    ocr_amount_raw = ocr_data.get("amount")

    comparable_fields = 0

    # In testing stage: only do soft merchant checking (case/space insensitive),
    # and only flag if it's clearly different (not just casing/spacing).
    if ocr_merchant:
        entered_merchant = _normalize_text(expense.merchant)
        extracted_merchant = _normalize_text(ocr_merchant)
        if entered_merchant and extracted_merchant:
            comparable_fields += 1
            if entered_merchant not in extracted_merchant and extracted_merchant not in entered_merchant:
                mismatches.append(
                    f"Merchant mismatch: entered '{expense.merchant}' but receipt shows '{ocr_merchant}'."
                )

    # Amount: only enforce when OCR looks like a real total (non-zero and not obviously an ID).
    try:
        if ocr_amount_raw not in (None, ""):
            ocr_amount = float(ocr_amount_raw)
            if ocr_amount > 0:
                comparable_fields += 1
                if expense.amount is None or abs(float(expense.amount) - ocr_amount) > 0.01:
                    mismatches.append(
                        f"Amount mismatch: entered {expense.amount} but receipt shows {ocr_amount}."
                    )
    except (TypeError, ValueError):
        # Don't hard-fail in testing stage.
        pass

    if ocr_date:
        comparable_fields += 1
        if _normalize_date_text(expense.date) != _normalize_date_text(ocr_date):
            mismatches.append(
                f"Date mismatch: entered '{expense.date}' but receipt shows '{ocr_date}'."
            )

    if comparable_fields == 0:
        return ["OCR extraction unavailable for mandatory cross-checking; manual auditor review required."]

    return mismatches

# ─────────────────────────────────────────────────────────────────────────────
# DB MIGRATION HELPER (safe ALTER TABLE for SQLite)
# ─────────────────────────────────────────────────────────────────────────────

def _run_safe_migrations():
    """
    Add new columns to an existing DB without dropping any data.
    SQLite doesnt support IF NOT EXISTS on ALTER TABLE, so we swallow errors.
    """
    new_expense_cols = [
        ("user_id",           "INTEGER"),
        ("explanation",       "TEXT DEFAULT 'Awaiting policy audit'"),
        ("risk_level",        "TEXT DEFAULT 'pending'"),
        ("created_at",        "DATETIME"),
        ("business_purpose",  "TEXT"),
        ("policy_rule",       "TEXT"),            # policy engine
        ("policy_reference",  "TEXT"),            # store retrieved RAG chunk
        ("ocr_merchant",      "TEXT"),
        ("ocr_amount",        "FLOAT"),
        ("ocr_date",          "TEXT"),
        ("ocr_raw_text",      "TEXT"),
    ]
    with database.engine.connect() as conn:
        for col_name, col_def in new_expense_cols:
            try:
                conn.execute(
                    text(f"ALTER TABLE expenses ADD COLUMN {col_name} {col_def}")
                )
                conn.commit()
                logger.info("Migration: added column expenses.%s", col_name)
            except Exception:
                pass  # column already exists — ignore
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN grade TEXT DEFAULT 'E-1'"))
            conn.commit()
            logger.info("Migration: added column users.grade")
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Auditra API",
    version="3.0.0",
    description="Policy-first expense API with receipt OCR — built so every audit carries the same calm clarity as an aura of trusted automation.",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # tighten to frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static file serving for receipt images ───────────────────────────────────
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ─────────────────────────────────────────────────────────────────────────────
# STARTUP EVENT
# ─────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    # 1. Create any new tables
    models.Base.metadata.create_all(bind=database.engine)
    logger.info("DB tables ensured.")

    # 2. Add new columns to existing tables (safe migration)
    _run_safe_migrations()

    # 3. Seed demo users
    db = database.SessionLocal()
    try:
        crud.seed_demo_users(db)
    finally:
        db.close()

    logger.info("Auditra API started. Demo credentials: employee/employee123  auditor/auditor123")
    # Safe debug: never print secret values, just presence.
    logger.info(
        "Vision keys present: GEMINI=%s OPENAI=%s (loaded from %s)",
        bool(os.getenv("GEMINI_API_KEY")),
        bool(os.getenv("OPENAI_API_KEY")),
        str(Path(__file__).resolve().parents[1] / ".env"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    gemini = bool(os.getenv("GEMINI_API_KEY"))
    openai = bool(os.getenv("OPENAI_API_KEY"))
    return {
        "status": "ok",
        "version": "3.0.0",
        "ocr_engine": "Gemini/OpenAI vision (primary) + Tesseract + optional PaddleOCR",
        "vision_configured": gemini or openai,
        # Debug with no secrets: helps confirm you're hitting THIS server process.
        "debug": {
            "gemini_present": gemini,
            "openai_present": openai,
            "pid": os.getpid(),
            "cwd": os.getcwd(),
            "dotenv_path": str(_DOTENV_PATH),
            "dotenv_exists": _DOTENV_PATH.is_file(),
            # Note: python-dotenv's return value is "did it set any new vars",
            # not "did it read the file".
            "dotenv_load_return": _DOTENV_READ_OK,
            "dotenv_changed_any": _DOTENV_CHANGED_ANY,
        },
        "policy_engine": "ACTIVE — Auditra Global T&E Policy (India + USA)",
    }


# ─────────────────────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=schemas.UserResponse, tags=["Auth"])
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Create a new user account."""
    if crud.get_user_by_username(db, user.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken.",
        )
    if crud.get_user_by_email(db, user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
        )
    if user.role not in ("employee", "auditor"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'employee' or 'auditor'.",
        )
    return crud.create_user(db, user)


@app.post("/auth/login", response_model=schemas.Token, tags=["Auth"])
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate with username + password.
    Returns a JWT access token and the user's role for frontend routing.
    """
    user = crud.get_user_by_username(db, credentials.username)
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )
    token = create_access_token({"sub": user.username, "role": user.role, "grade": user.grade})
    return schemas.Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        grade=user.grade,
        username=user.username,
        user_id=user.id,
    )


@app.get("/auth/me", response_model=schemas.UserResponse, tags=["Auth"])
def me(current_user: models.User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSES — Create
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/expense", response_model=schemas.ExpenseResponse, tags=["Expenses"])
def create_expense(
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a new expense record.
    If category is blank, it will be inferred from the merchant name.
    """
    if not expense.merchant.strip() or not expense.date.strip() or not expense.category.strip() or not expense.business_purpose.strip():
        raise HTTPException(status_code=400, detail="Merchant, amount, date, category, and business purpose are mandatory.")
    return crud.create_expense(db, expense, user_id=current_user.id)


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSES — List (with filters + search + sort)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/expenses", response_model=list[schemas.ExpenseResponse], tags=["Expenses"])
def list_expenses(
    status:   Optional[str] = Query(None, description="Filter: pending|approved|flagged|rejected"),
    category: Optional[str] = Query(None, description="Filter by category substring"),
    search:   Optional[str] = Query(None, description="Search merchant / purpose / category"),
    sort_by:  Optional[str] = Query(None, description="Sort: risk | amount | date"),
    mine:     bool           = Query(False, description="If true, return only the current user's expenses"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List expenses.
    - Employees always see only their own (mine=True is auto-applied).
    - Auditors see all by default; pass mine=True to see only their own.
    """
    filter_user_id: Optional[int] = None
    if current_user.role == "employee" or mine:
        filter_user_id = current_user.id

    return crud.get_expenses(
        db,
        status=status,
        category=category,
        search=search,
        sort_by=sort_by,
        user_id=filter_user_id,
    )


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSES — Single detail
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/expense/{expense_id}", response_model=schemas.ExpenseResponse, tags=["Expenses"])
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get full detail for one expense (Audit Detail View)."""
    expense = crud.get_expense(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")

    # Employees can only view their own
    if current_user.role == "employee" and expense.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    return expense


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSES — Update (PATCH)
# ─────────────────────────────────────────────────────────────────────────────

@app.patch("/expense/{expense_id}", response_model=schemas.ExpenseResponse, tags=["Expenses"])
def update_expense(
    expense_id: int,
    data: schemas.ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Partially update an expense.
    - Employees can edit their own (merchant, amount, date, business_purpose, category).
    - Auditors can additionally update status, explanation, risk_level.
    """
    expense = crud.get_expense(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")

    # Employees can only edit their own; strip auditor-only fields
    if current_user.role == "employee":
        if expense.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied.")
        # Employees cannot change status / explanation / risk_level
        data.status      = None
        data.explanation = None
        data.risk_level  = None
    else:
        # Auditors are restricted to decision metadata only.
        data.merchant = None
        data.amount = None
        data.date = None
        data.category = None
        data.business_purpose = None

    updated = crud.update_expense(db, expense_id, data)

    # Automatically re-run policy audit on employee edit if receipt is present
    if updated.receipt_path and os.path.isfile(updated.receipt_path):
        ocr_data = {}
        if updated.ocr_raw_text:
            ocr_data = {
                "merchant": updated.ocr_merchant,
                "amount": updated.ocr_amount,
                "date": updated.ocr_date,
                "raw_text": updated.ocr_raw_text
            }
        else:
            try:
                ocr_data = extract_receipt_data(updated.receipt_path)
                if ocr_data and "error" not in ocr_data:
                    updated.ocr_raw_text = ocr_data.get("raw_text")
                    db.commit()
            except Exception as exc:
                logger.warning("Update expense OCR failed: %s", exc)

        input_mismatch_warnings = _collect_ocr_mismatches(updated, ocr_data) if ocr_data else []

        # Fetch recent meal dates for duplicate checking
        recent_meals = (
            db.query(models.Expense)
            .filter(
                models.Expense.user_id == updated.user_id,
                models.Expense.category == "Meals",
                models.Expense.id != expense_id,
            )
            .order_by(models.Expense.id.desc())
            .limit(10)
            .all()
        )
        recent_dates = [e.date for e in recent_meals if e.date]

        # RAG snippets
        policy_snippets = ["No relevant policy found"]
        try:
            from app.rag_store import load_store
            from app.rag_retriever import retrieve_relevant_chunks
            
            index, chunks = load_store()
            query = (
                f"Category: {updated.category}\nAmount: {updated.amount}\n"
                f"Location: {updated.merchant}\nEmployee Grade: {updated.owner.grade if updated.owner else 'E-1'}\n"
                f"Purpose: {updated.business_purpose}\n\n"
                "Retrieve exact policy rules including:\n- spending limits\n- restrictions\n- exceptions"
            )
            policy_snippets = retrieve_relevant_chunks(query, chunks, original_index=index, category=updated.category)
        except Exception as exc:
            logger.error(f"Update expense RAG failure: {exc}")

        policy_result = run_policy_audit(
            merchant             = updated.merchant or "",
            amount               = updated.amount or 0.0,
            date_str             = updated.date or "",
            category             = updated.category or "Other",
            business_purpose     = updated.business_purpose or "",
            grade                = updated.owner.grade if updated.owner else "E-1",
            raw_text             = updated.ocr_raw_text or "",
            receipt_path         = updated.receipt_path,
            recent_expense_dates = recent_dates,
            policy_snippets      = policy_snippets,
            input_mismatch       = " ".join(input_mismatch_warnings) if input_mismatch_warnings else None,
        )

        updated.status            = policy_result.status
        updated.explanation       = policy_result.explanation
        updated.risk_level        = policy_result.risk_level
        updated.policy_rule       = policy_result.policy_rule
        if policy_snippets:
            updated.policy_reference = policy_snippets[0]

        try:
            db.commit()
            db.refresh(updated)
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"DB error: {exc}")

    return updated


# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD RECEIPT (OCR + category inference)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/upload/{expense_id}", tags=["Expenses"])
def upload_receipt(
    expense_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Upload a receipt image for an existing expense.
    Runs PaddleOCR → regex parser → Gemini fallback.
    Automatically infers category from extracted text.
    Status stays 'pending' until the policy engine is plugged in.
    """
    logger.info(
        "Upload: expense_id=%s  user=%s  file=%s",
        expense_id, current_user.username, file.filename,
    )

    # ── Validate extension ────────────────────────────────────────────────────
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Accepted: {sorted(ALLOWED_EXTENSIONS)}",
        )

    # ── Fetch expense & ownership check ───────────────────────────────────────
    expense = crud.get_expense(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")
    if current_user.role == "employee" and expense.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    # ── Save file (use UUID prefix to avoid collisions) ───────────────────────
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    file_location = os.path.join(UPLOAD_DIR, safe_name)
    try:
        with open(file_location, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
        logger.info("Saved: %s", file_location)
    except Exception as exc:
        logger.exception("File save failed")
        raise HTTPException(status_code=500, detail=f"File save error: {exc}")

    expense.receipt_path = file_location

    # ── OCR ───────────────────────────────────────────────────────────────────
    ocr_data: dict = {}
    ocr_error: Optional[str] = None

    try:
        ocr_data = extract_receipt_data(file_location)
        logger.info("OCR result: %s", ocr_data)
    except Exception as exc:
        ocr_error = str(exc)
        logger.exception("OCR failed")

    # ── Apply OCR data to expense ─────────────────────────────────────────────
    input_mismatch_warnings: list[str] = []

    if ocr_data and "error" not in ocr_data:
        expense.ocr_merchant = str(ocr_data.get("merchant") or "").strip() or None
        try:
            expense.ocr_amount = float(ocr_data.get("amount")) if ocr_data.get("amount") not in (None, "") else None
        except (TypeError, ValueError):
            expense.ocr_amount = None
        expense.ocr_date = str(ocr_data.get("date") or "").strip() or None
        expense.ocr_raw_text = str(ocr_data.get("raw_text") or "").strip() or None

        if ocr_data.get("merchant") and not expense.merchant:
            expense.merchant = ocr_data["merchant"]
        
        if ocr_data.get("amount"):
            try:
                ocr_amt = float(ocr_data["amount"])
                if not expense.amount:
                    expense.amount = ocr_amt
            except (TypeError, ValueError):
                pass
                
        if ocr_data.get("date"):
            ocr_d = ocr_data["date"]
            if not expense.date:
                expense.date = ocr_d

        # ── Infer category from extracted text (if not already set) ────────────
        if not expense.category or expense.category == "Other":
            raw_text = ocr_data.get("raw_text", "")
            expense.category = crud.infer_category(
                expense.merchant or "", raw_text
            )
    elif ocr_data and "error" in ocr_data:
        ocr_error = ocr_data["error"]
        logger.warning("OCR error: %s", ocr_error)

    input_mismatch_warnings = _collect_ocr_mismatches(expense, ocr_data)

    # First, fetch recent meal dates for duplicate checking (§11.4)
    recent_meals = (
        db.query(models.Expense)
        .filter(
            models.Expense.user_id == expense.user_id,
            models.Expense.category == "Meals",
            models.Expense.id != expense_id,
        )
        .order_by(models.Expense.id.desc())
        .limit(10)
        .all()
    )
    recent_dates = [e.date for e in recent_meals if e.date]

    # ── RAG Retrieval ─────────────────────────────────────────────────────────
    # Local RAG setup
    try:
        from app.rag_store import load_store
        from app.rag_retriever import retrieve_relevant_chunks
        
        index, chunks = load_store()
        query = f"Category: {expense.category}\nAmount: {expense.amount}\nLocation: {expense.merchant}\nEmployee Grade: {current_user.grade}\nPurpose: {expense.business_purpose}\n\nRetrieve exact policy rules including:\n- spending limits\n- restrictions\n- exceptions"
        policy_snippets = retrieve_relevant_chunks(query, chunks, original_index=index, category=expense.category)
    except Exception as exc:
        logger.error(f"RAG failure: {exc}")
        policy_snippets = ["No relevant policy found"]
        
    policy_result = run_policy_audit(
        merchant             = expense.merchant or "",
        amount               = expense.amount or 0.0,
        date_str             = expense.date or "",
        category             = expense.category or "Other",
        business_purpose     = expense.business_purpose or "",
        grade                = current_user.grade,
        raw_text             = ocr_data.get("raw_text", ""),
        receipt_path         = file_location,
        recent_expense_dates = recent_dates,
        policy_snippets      = policy_snippets,
        input_mismatch       = " ".join(input_mismatch_warnings) if input_mismatch_warnings else None,
    )

    # ── Update expense with policy result ─────────────────────────────────────
    expense.status            = policy_result.status
    expense.explanation       = policy_result.explanation
    expense.risk_level        = policy_result.risk_level
    expense.policy_rule       = policy_result.policy_rule
    expense.policy_reference  = policy_snippets[0] if policy_snippets else "No relevant policy found"

    try:
        db.commit()
        db.refresh(expense)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {exc}")

    response = {
        "message":     "Upload successful. Audit decision generated.",
        "expense_id":  expense_id,
        "receipt_url": f"/uploads/{safe_name}",
        "ocr_data": {
            "merchant": expense.ocr_merchant or expense.merchant,
            "amount":   expense.ocr_amount if expense.ocr_amount is not None else expense.amount,
            "date":     expense.ocr_date or expense.date,
            "category": expense.category,
        },
        "audit": {
            "status":            policy_result.status,
            "risk_level":        policy_result.risk_level,
            "explanation":       policy_result.explanation,
            "policy_rule":       policy_result.policy_rule,
            "violations":  [
                {"severity": v.severity, "rule": v.rule, "message": v.message}
                for v in policy_result.violations
            ],
        },
    }
    if ocr_error:
        response["ocr_warning"] = ocr_error

    return response


# =============================================================================
# MANUAL RE-AUDIT (auditor only — §17 Human-in-the-loop)
# =============================================================================

@app.post(
    "/expense/{expense_id}/audit",
    response_model=schemas.AuditResultResponse,
    tags=["Audit"],
)
def re_audit_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("auditor")),
):
    """
    Re-run the policy audit on an existing expense (auditor only).
    Useful after an employee updates their business purpose or the auditor
    wants a fresh decision after overriding fields.
    Implements §17 Human-in-the-Loop audit trail.
    """
    expense = crud.get_expense(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")

    # Fetch recent meal dates for same employee (frequency check §11.4)
    recent_meals = (
        db.query(models.Expense)
        .filter(
            models.Expense.user_id == expense.user_id,
            models.Expense.category == "Meals",
            models.Expense.id != expense_id,
        )
        .order_by(models.Expense.id.desc())
        .limit(10)
        .all()
    )
    recent_dates = [e.date for e in recent_meals if e.date]

    ocr_data: dict = {}
    raw_text = ""
    if expense.ocr_raw_text:
        raw_text = expense.ocr_raw_text
        ocr_data = {
            "merchant": expense.ocr_merchant,
            "amount": expense.ocr_amount,
            "date": expense.ocr_date,
            "raw_text": raw_text
        }
    elif expense.receipt_path and os.path.isfile(expense.receipt_path):
        try:
            ocr_data = extract_receipt_data(expense.receipt_path)
            if ocr_data and "error" not in ocr_data:
                raw_text = str(ocr_data.get("raw_text") or "")
                expense.ocr_raw_text = raw_text
                db.commit()
        except Exception as exc:
            logger.warning("Re-audit OCR refresh failed: %s", exc)

    input_mismatch_warnings = _collect_ocr_mismatches(expense, ocr_data) if ocr_data else []

    policy_snippets: list[str] = ["No relevant policy found"]
    try:
        from app.rag_store import load_store
        from app.rag_retriever import retrieve_relevant_chunks

        index, chunks = load_store()
        query = (
            f"Category: {expense.category}\nAmount: {expense.amount}\n"
            f"Location: {expense.merchant}\nEmployee Grade: {expense.owner.grade if expense.owner else 'E-1'}\n"
            f"Purpose: {expense.business_purpose}\n\n"
            "Retrieve exact policy rules including:\n- spending limits\n- restrictions\n- exceptions"
        )
        policy_snippets = retrieve_relevant_chunks(
            query,
            chunks,
            original_index=index,
            category=expense.category,
        )
    except Exception as exc:
        logger.error("Re-audit RAG failure: %s", exc)

    result = run_policy_audit(
        merchant             = expense.merchant or "",
        amount               = expense.amount or 0,
        date_str             = expense.date or "",
        category             = expense.category or "Other",
        business_purpose     = expense.business_purpose or "",
        grade                = expense.owner.grade if expense.owner else "E-1",
        raw_text             = raw_text,
        receipt_path         = expense.receipt_path,
        recent_expense_dates = recent_dates,
        policy_snippets      = policy_snippets,
        input_mismatch       = " ".join(input_mismatch_warnings) if input_mismatch_warnings else None,
    )

    # Persist updated decision
    expense.status            = result.status
    expense.risk_level        = result.risk_level
    expense.explanation       = result.explanation
    expense.policy_rule       = result.policy_rule
    expense.policy_reference  = policy_snippets[0] if policy_snippets else expense.policy_reference

    db.commit()
    db.refresh(expense)

    logger.info(
        "Re-audit: expense_id=%s  user=%s  new_status=%s",
        expense_id, current_user.username, result.status,
    )

    return schemas.AuditResultResponse(
        expense_id        = expense_id,
        status            = result.status,
        risk_level        = result.risk_level,
        explanation       = result.explanation,
        policy_rule       = result.policy_rule,
        currency_detected = result.currency_detected,
        region_detected   = result.region_detected,
        violations        = [
            schemas.ViolationItem(
                severity = v.severity,
                rule     = v.rule,
                message  = v.message,
            )
            for v in result.violations
        ],
    )