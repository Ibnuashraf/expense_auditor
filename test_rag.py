import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.rag_store import load_store
from app.rag_retriever import retrieve_relevant_chunks
from app.policy_engine import run_policy_audit

def test():
    # 1. Load store
    index, chunks = load_store()
    
    # 2. Expense data
    category = "Meals"
    amount = 5000
    merchant = "Taj Hotel Mumbai"
    grade = "E-3"
    justification = "Client meeting lunch regarding the Q3 product roadmap"
    
    # 3. Simulate Query Builder
    query = f"""
    Category: {category}
    Amount: {amount}
    Location: {merchant}
    Employee Grade: {grade}
    Purpose: {justification}

    Retrieve exact policy rules including:
    - spending limits
    - restrictions
    - exceptions
    """
    
    # 4. Run Retrieval
    policy_snippets = retrieve_relevant_chunks(query, chunks, original_index=index, category=category)
    
    print("\n" + "="*50)
    print("🎯 RETRIEVED CHUNKS:")
    print("="*50)
    for i, snippet in enumerate(policy_snippets):
        print(f"\n--- Snippet {i+1} ---")
        print(snippet.strip())
        
    # 5. Run Policy Audit
    result = run_policy_audit(
        merchant=merchant,
        amount=amount,
        date_str="08/04/2026",
        category=category,
        business_purpose=justification,
        grade=grade,
        raw_text=merchant,
        receipt_path=None,
        recent_expense_dates=[],
        policy_snippets=policy_snippets
    )
    
    print("\n" + "="*50)
    print("⚖️ FINAL DECISION:")
    print("="*50)
    print(f"Status:      {result.status}")
    print(f"Explanation: {result.explanation}")
    print(f"Rule:        {result.policy_rule}")
    print("Violations:")
    for v in result.violations:
        print(f"  - [{v.severity.upper()}] {v.rule}: {v.message}")

if __name__ == "__main__":
    test()
