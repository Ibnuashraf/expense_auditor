from pydantic import BaseModel

class ExpenseCreate(BaseModel):
    merchant: str
    amount: float
    date: str
    category: str
    justification: str

class ExpenseResponse(ExpenseCreate):
    id: int
    status: str
    receipt_path: str | None = None

    class Config:
        orm_mode = True