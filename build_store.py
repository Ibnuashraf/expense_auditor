import os
import sys

# Ensure 'app' matches the package structure correctly by adding project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.rag_store import build_vector_store, save_store
from app.policy_chunker import create_policy_chunks

def build():
    print("Chunking policy PDF...")
    chunks = create_policy_chunks("C:/Users/HP/auditor/Travel_Expense_Policy.pdf")
    
    if not chunks:
        print("Failed to chunk PDF.")
        return
        
    print(f"Created {len(chunks)} chunks. Building vector store...")
    index, embeddings = build_vector_store(chunks)

    save_store(index, chunks, "policy_store")
    print("Store built successfully!")

if __name__ == "__main__":
    build()
