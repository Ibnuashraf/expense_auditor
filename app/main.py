from fastapi import FastAPI, Depends, UploadFile, File
from sqlalchemy.orm import Session
import shutil
import os

from . import models, database, crud, schemas
from .gemini_service import extract_receipt_data

# Create DB tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# DB dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# CREATE EXPENSE
# =========================
@app.post("/expense", response_model=schemas.ExpenseResponse)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    return crud.create_expense(db, expense)


# =========================
# GET ALL EXPENSES
# =========================
@app.get("/expenses")
def get_expenses(db: Session = Depends(get_db)):
    return crud.get_expenses(db)


# =========================
# UPLOAD RECEIPT + GEMINI OCR
# =========================
@app.post("/upload/{expense_id}")
def upload_receipt(expense_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):

    print("Incoming Expense ID:", expense_id)

    # 🔹 Ensure uploads folder exists
    if not os.path.exists("uploads"):
        os.makedirs("uploads")

    file_location = f"uploads/{file.filename}"

    # 🔹 Save file
    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        return {"error": f"File save failed: {str(e)}"}

    # 🔹 Fetch expense
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()

    if not expense:
        return {"error": "Expense not found"}

    # Save path
    expense.receipt_path = file_location

    # 🔹 Gemini OCR
    try:
        data = extract_receipt_data(file_location)
        print("GEMINI OUTPUT:", data)

        if "error" not in data:
            expense.merchant = data.get("merchant") or expense.merchant

            # SAFE amount handling
            try:
                expense.amount = float(data.get("amount") or expense.amount or 0)
            except:
                expense.amount = 0

            expense.date = data.get("date") or expense.date

        db.commit()

    except Exception as e:
        print("FINAL ERROR:", e)
        return {"error": str(e)}

    return {
        "message": "Upload successful",
        "gemini_data": data,
        "expense_id": expense_id
    }