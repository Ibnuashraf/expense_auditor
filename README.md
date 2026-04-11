# expense_auditor

## Environment Variables

Set these before starting the API:

- `SECRET_KEY`: JWT signing key used by `auth.py`.
- `GEMINI_API_KEY`: Gemini key for OCR fallback + policy explanation generation.

PowerShell example:

```powershell
$env:SECRET_KEY = "replace-with-a-long-random-secret"
$env:GEMINI_API_KEY = "your-gemini-api-key"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```