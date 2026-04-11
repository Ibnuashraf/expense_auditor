"""
schemas.py — Pydantic request/response models for Auditra.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr


# ─────────────────────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "employee"        # "employee" | "auditor"
    grade: str = "E-1"            # "E-1" to "E-9"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    grade: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    grade: str
    username: str
    user_id: int


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSE — Create
# ─────────────────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    merchant:         str   = ""
    amount:           float = 0.0
    date:             str   = ""
    category:         str   = ""
    business_purpose: str   = ""


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSE — Update (all optional for PATCH)
# ─────────────────────────────────────────────────────────────────────────────

class ExpenseUpdate(BaseModel):
    merchant:         Optional[str]   = None
    amount:           Optional[float] = None
    date:             Optional[str]   = None
    category:         Optional[str]   = None
    business_purpose: Optional[str]   = None
    status:           Optional[str]   = None
    explanation:      Optional[str]   = None
    risk_level:       Optional[str]   = None
    policy_rule:      Optional[str]   = None
    policy_reference: Optional[str]   = None


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSE — Response
# ─────────────────────────────────────────────────────────────────────────────

class ExpenseResponse(BaseModel):
    id:               int
    merchant:         Optional[str]   = ""
    amount:           Optional[float] = 0.0
    date:             Optional[str]   = ""
    category:         Optional[str]   = ""
    business_purpose: Optional[str]   = ""
    status:           str             = "pending"
    receipt_path:     Optional[str]   = None
    explanation:      Optional[str]   = "Awaiting policy audit"
    risk_level:       Optional[str]   = "pending"
    policy_rule:      Optional[str]   = None
    policy_reference: Optional[str]   = None
    user_id:          Optional[int]   = None
    created_at:       Optional[datetime] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────────────────────────────────
# AUDIT RESULT RESPONSE (for /audit endpoint)
# ─────────────────────────────────────────────────────────────────────────────

class ViolationItem(BaseModel):
    severity: str
    rule:     str
    message:  str


class AuditResultResponse(BaseModel):
    expense_id:        int
    status:            str
    risk_level:        str
    explanation:       str
    policy_rule:       str
    currency_detected: str
    region_detected:   str
    violations:        list[ViolationItem]