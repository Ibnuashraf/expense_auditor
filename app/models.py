"""
models.py — SQLAlchemy ORM models for Auditra.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id             = Column(Integer, primary_key=True, index=True)
    username       = Column(String, unique=True, index=True, nullable=False)
    email          = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role           = Column(String, default="employee")   # "employee" | "auditor"
    grade          = Column(String, default="E-1")        # NEW: E-1 through E-9
    created_at     = Column(DateTime, default=datetime.utcnow)

    expenses = relationship("Expense", back_populates="owner")


class Expense(Base):
    __tablename__ = "expenses"

    id               = Column(Integer, primary_key=True, index=True)
    merchant         = Column(String, nullable=True)
    amount           = Column(Float, nullable=True, default=0.0)
    date             = Column(String, nullable=True)
    category         = Column(String, nullable=True)
    business_purpose = Column(String, nullable=True)   # replaces old "justification"
    justification    = Column(String, nullable=True)   # legacy — kept for migration compat
    status           = Column(String, default="pending")  # pending|approved|flagged|rejected
    receipt_path     = Column(String, nullable=True)

    # ── New fields ───────────────────────────────────────────────────────
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=True)
    explanation       = Column(String, nullable=True, default="Awaiting policy audit")
    risk_level        = Column(String, nullable=True, default="pending")
    policy_rule       = Column(String, nullable=True)                     # primary rule triggered
    policy_reference  = Column(String, nullable=True)                     # supporting policy citation/context
    created_at        = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="expenses")