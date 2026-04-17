"""
crud.py — Database operations for Auditra.
"""

import logging
from typing import Optional

from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import hash_password

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CATEGORY INFERENCE
# ─────────────────────────────────────────────────────────────────────────────

_CATEGORY_MAP: dict[str, list[str]] = {
    "Meals":           ["restaurant", "cafe", "coffee", "starbucks", "food", "dining",
                        "lunch", "dinner", "breakfast", "pizza", "burger", "kfc",
                        "mcdonald", "swiggy", "zomato", "biryani", "canteen"],
    "Transport":       ["uber", "ola", "taxi", "cab", "metro", "train", "flight",
                        "airfare", "airline", "bus", "auto", "petrol", "fuel",
                        "parking", "rapido", "redbus", "irctc", "makemytrip"],
    "Lodging":         ["hotel", "inn", "resort", "airbnb", "accommodation", "oyo",
                        "marriott", "hilton", "taj", "hyatt", "lodge", "guest house"],
    "Office Supplies": ["stationery", "staples", "office depot", "pen", "paper",
                        "printer", "ink", "folder", "notepad"],
    "Entertainment":   ["cinema", "movie", "theatre", "event", "concert", "pvr",
                        "inox", "bookmyshow"],
    "Medical":         ["pharmacy", "medical", "hospital", "clinic", "doctor",
                        "apollo", "medplus", "lab", "diagnostic"],
    "Communication":   ["airtel", "jio", "vodafone", "bsnl", "phone", "internet",
                        "broadband", "recharge"],
}


def infer_category(merchant: str, raw_text: str = "") -> str:
    """Keyword-based category inference from merchant name + OCR text."""
    haystack = (merchant + " " + raw_text).lower()
    for category, keywords in _CATEGORY_MAP.items():
        if any(kw in haystack for kw in keywords):
            return category
    return "Other"


# ─────────────────────────────────────────────────────────────────────────────
# USER CRUD
# ─────────────────────────────────────────────────────────────────────────────

def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password),
        role=user.role,
        grade=user.grade,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def seed_demo_users(db: Session) -> None:
    """Ensure demo accounts exist on every startup."""
    demo = [
        {"username": "employee", "email": "employee@auditra.com",
         "password": "employee123", "role": "employee", "grade": "E-3"},
        {"username": "auditor", "email": "auditor@auditra.com",
         "password": "auditor123", "role": "auditor", "grade": "E-8"},
    ]
    for u in demo:
        if not get_user_by_username(db, u["username"]):
            create_user(db, schemas.UserCreate(**u))
            logger.info("Demo user created: %s (%s)", u["username"], u["role"])


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSE CRUD
# ─────────────────────────────────────────────────────────────────────────────

def create_expense(
    db: Session,
    expense: schemas.ExpenseCreate,
    user_id: Optional[int] = None,
) -> models.Expense:
    db_expense = models.Expense(
        merchant=expense.merchant,
        amount=expense.amount,
        date=expense.date,
        category=expense.category or infer_category(expense.merchant),
        business_purpose=expense.business_purpose,
        user_id=user_id,
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


def get_expense(db: Session, expense_id: int) -> Optional[models.Expense]:
    return (
        db.query(models.Expense)
        .filter(models.Expense.id == expense_id)
        .first()
    )


def get_expenses(
    db: Session,
    status:   Optional[str] = None,
    category: Optional[str] = None,
    search:   Optional[str] = None,
    sort_by:  Optional[str] = None,
    user_id:  Optional[int] = None,    # None = all (auditor), int = own (employee)
) -> list[models.Expense]:
    q = db.query(models.Expense)

    # ── Ownership filter ──
    if user_id is not None:
        q = q.filter(models.Expense.user_id == user_id)

    # ── Field filters ──
    if status:
        q = q.filter(models.Expense.status == status)
    if category:
        q = q.filter(models.Expense.category.ilike(f"%{category}%"))

    # ── Full-text search ──
    if search:
        q = q.filter(
            or_(
                models.Expense.merchant.ilike(f"%{search}%"),
                models.Expense.business_purpose.ilike(f"%{search}%"),
                models.Expense.category.ilike(f"%{search}%"),
            )
        )

    # ── Sort ──
    if sort_by == "risk":
        # Highest risk first: high → medium → low → pending
        risk_order = case(
            (models.Expense.risk_level == "high",   0),
            (models.Expense.risk_level == "medium", 1),
            (models.Expense.risk_level == "low",    2),
            else_=3,
        )
        q = q.order_by(risk_order)
    elif sort_by == "amount":
        q = q.order_by(models.Expense.amount.desc())
    elif sort_by == "date":
        q = q.order_by(models.Expense.created_at.desc())
    else:
        q = q.order_by(models.Expense.id.desc())

    return q.all()


def update_expense(
    db: Session,
    expense_id: int,
    data: schemas.ExpenseUpdate,
) -> Optional[models.Expense]:
    expense = get_expense(db, expense_id)
    if not expense:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense