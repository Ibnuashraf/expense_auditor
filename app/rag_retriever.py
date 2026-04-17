import numpy as np
from app.rag_store import get_model, build_vector_store

def filter_chunks_by_category(chunks, category):
    # Fallback to pure array if empty category
    if not category:
        return chunks
        
    filtered = [
        c for c in chunks 
        if category.lower() in c["text"].lower() or category.lower() in c["section"].lower()
    ]
    # If filter is too aggressive and yields nothing, fall back to full set
    return filtered if filtered else chunks

def rerank_chunks(query, chunks):
    scored = []
    for c in chunks:
        # Give higher weight to exact lexical match as a boost since FAISS covers semantic proximity
        score = 1.0 if query.lower() in c["text"].lower() else 0.0
        scored.append((score, c))
    
    # Python sorted is stable, so original FAISS ordering is preserved among ties
    return [item[1] for item in sorted(scored, key=lambda x: x[0], reverse=True)]

def retrieve_relevant_chunks(query, chunks, original_index=None, category=None, k=3):
    m = get_model()
    
    # 1. Light filtering
    filtered_chunks = filter_chunks_by_category(chunks, category)
    
    # 2. Re-embed query
    query_embedding = m.encode([query])
    
    # 3. If we filtered, rebuild a temporary FAISS index (or use flat L2 distance manually).
    # Since arrays are tiny, we just build a fast tmp index for the filtered subset.
    if len(filtered_chunks) < len(chunks):
        tmp_index, _ = build_vector_store(filtered_chunks)
        distances, indices = tmp_index.search(np.array(query_embedding, dtype='float32'), min(k, len(filtered_chunks)))
        results = [filtered_chunks[idx] for idx in indices[0] if idx != -1]
    else:
        # Full search on original
        distances, indices = original_index.search(np.array(query_embedding, dtype='float32'), min(k, len(chunks)))
        results = [chunks[idx] for idx in indices[0] if idx != -1]
    
    # 4. Rerank
    final_results = rerank_chunks(query, results)
    
    return [c["text"] for c in final_results] if final_results else ["No relevant policy found"]

# =============================================================================
# SEMANTIC PROHIBITION (Local embeddings)
# =============================================================================

PROHIBITED_CONCEPTS = [
    "Purchase of alcohol, wine, beer, or liquor for personal or team consumption.",
    "Personal grooming, spa treatments, salon, massage, or wellness therapies.",
    "Traffic fines, parking penalties, speeding tickets.",
    "Personal entertainment subscriptions like Netflix, Spotify, Amazon Prime.",
    "Casino, gambling, betting, or adult entertainment."
]

def cosine_similarity(vec1, vec2):
    dot = np.dot(vec1, vec2)
    norm_a = np.linalg.norm(vec1)
    norm_b = np.linalg.norm(vec2)
    if norm_a == 0 or norm_b == 0: return 0.0
    return dot / (norm_a * norm_b)

def is_semantically_prohibited(item_name: str, threshold: float = 0.65) -> bool:
    if not item_name.strip():
        return False
    
    m = get_model()
    item_emb = m.encode([item_name])[0]
    concept_embs = m.encode(PROHIBITED_CONCEPTS)
    
    for c_emb in concept_embs:
        sim = cosine_similarity(item_emb, c_emb)
        if sim >= threshold:
            return True
            
    return False
