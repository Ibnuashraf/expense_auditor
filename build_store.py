import os
import sys

# Ensure 'app' matches the package structure correctly by adding project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.rag_store import build_vector_store, save_store
from app.policy_chunker import create_policy_chunks

def _policy_pdf_path() -> str:
    env_path = os.getenv("POLICY_PDF_PATH")
    if env_path:
        return env_path
    # expense_auditor/data/Travel_Expense_Policy.pdf (Docker + Railway)
    local = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "Travel_Expense_Policy.pdf")
    if os.path.isfile(local):
        return local
    # Legacy dev path (Windows)
    legacy = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Travel_Expense_Policy.pdf")
    return os.path.normpath(legacy)


def build():
    pdf_path = _policy_pdf_path()
    if not os.path.isfile(pdf_path):
        print(f"Policy PDF not found at {pdf_path}")
        return
    print(f"Chunking policy PDF: {pdf_path}")
    chunks = create_policy_chunks(pdf_path)
    
    if not chunks:
        print("Failed to chunk PDF.")
        return
        
    print(f"Created {len(chunks)} chunks. Building vector store...")
    index, embeddings = build_vector_store(chunks)

    save_store(index, chunks, "policy_store")
    print("Store built successfully!")

if __name__ == "__main__":
    build()
