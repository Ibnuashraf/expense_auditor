# Auditra — Policy-First AI Expense Auditor

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel&style=for-the-badge)](https://web-ten-liart-x8dqms5qwd.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Repo-181717?logo=github&style=for-the-badge)](https://github.com/Ibnuashraf/expense_auditor)

> 🌐 **Live App**: [https://web-ten-liart-x8dqms5qwd.vercel.app](https://web-ten-liart-x8dqms5qwd.vercel.app)

Auditra is a modern, enterprise-grade AI-powered expense auditing platform. It replaces fragile, manual expense review workflows with a secure, automated, and policy-aware validation system.

Built using a **FastAPI backend** and a **Vite + React frontend**, it leverages **Google Gemini Vision** for receipt parsing and a local **RAG (Retrieval-Augmented Generation)** database to ground audit decisions directly in your corporate policy guidelines.

---

## 🌟 Key Features

* **Vision-First OCR Extraction**: Extracts merchant, total amount, transaction date, and line items using Google Gemini Vision (or OpenAI GPTo-mini) with offline fallbacks (RapidOCR, Tesseract, and PaddleOCR).
* **Local RAG Policy Verification**: Uses semantic text similarity and FAISS vector indices to dynamically fetch corporate spending rules and cross-check claims.
* **Instant Re-Auditing**: Caches OCR raw text in the database to allow auditors to instantly re-run policy audits in `<100ms` when overriding fields.
* **Mismatch Detection**: Detects mismatches between user-input values and receipt data, automatically flagging them for human-in-the-loop review.
* **Modern UI/UX Dashboard**: Intuitive, premium user interface with distinct employee and auditor views, risk levels, and detailed policy insight logs.

---

## 📂 Project Structure

```
expense_auditor/
├── app/                  # FastAPI Backend Server
│   ├── main.py           # Application Entrypoint & API Routes
│   ├── models.py         # SQLAlchemy Database Schema
│   ├── policy_engine.py  # Grade Matrix & Policy Rules Evaluator
│   ├── gemini_service.py # OCR Extraction Engine (LLM + fallbacks)
│   └── database.py       # DB Connection Setup (SQLite / PostgreSQL)
├── web/                  # Vite + React Frontend Client
│   ├── src/
│   │   ├── pages/        # Employee & Auditor Dashboards
│   │   └── components/   # Modals, Shells & Badges
│   └── vercel.json       # SPA Rewrite Router configuration
```

---

## ⚙️ Configuration & Environment Variables

Create an `.env` file in the root of the `expense_auditor/` directory:

| Variable | Description |
| :--- | :--- |
| `SECRET_KEY` | Long, random key used for signing JWT authentication tokens. |
| `GEMINI_API_KEY` | Google Gemini API key used for vision analysis and policy explanation generation. |
| `DATABASE_URL` | *(Optional)* PostgreSQL connection string for production database compliance. Defaults to SQLite locally. |

---

## 🚀 Local Development Setup

### 1. Backend Server Setup
Navigate to the backend directory, install python dependencies, and start uvicorn:
```bash
cd expense_auditor
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Start Server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
*Access API interactive docs at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).*

### 2. Frontend Client Setup
Navigate to the web client directory, install package dependencies, and start Vite:
```bash
cd expense_auditor/web
npm install
npm run dev
```
*Access Web Dashboard at [http://localhost:5173](http://localhost:5173).*

---

## ☁️ Production Deployment

### Frontend (Vercel)
The React client is fully optimized for static deployment to Vercel:
1. Connect your repository to Vercel.
2. Set the **Root Directory** to `expense_auditor/web`.
3. Add the Environment Variable `VITE_API_URL` pointing to your hosted API.

### Backend (Render / Railway)
1. Deploy the `expense_auditor/` directory as a Docker container or Python Web Service.
2. Connect a managed PostgreSQL database (e.g. Neon or Supabase) and pass the `DATABASE_URL` environment variable.
3. Configure start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.