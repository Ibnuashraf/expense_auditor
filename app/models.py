from sqlalchemy import Column, Integer, String, Float
from .database import Base

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    merchant = Column(String)
    amount = Column(Float)
    date = Column(String)
    category = Column(String)
    justification = Column(String)
    status = Column(String, default="pending")


    receipt_path = Column(String, nullable=True)