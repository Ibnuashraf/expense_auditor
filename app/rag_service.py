import json
import logging
import math
from typing import List, Dict

try:
    from google import genai
    from app.gemini_service import _get_gemini_client
except ImportError:
    pass

logger = logging.getLogger(__name__)

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm_a = math.sqrt(sum(a * a for a in vec1))
    norm_b = math.sqrt(sum(b * b for b in vec2))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

class DefaultRAGService:
    def __init__(self, policy_text_path: str):
        self.policy_text_path = policy_text_path
        self.chunks: List[str] = []
        self.embeddings: List[List[float]] = []
        self.client = _get_gemini_client()
        self.is_loaded = False
        
        # We can also store the semantic prohibited items here
        self.prohibited_concepts = [
            "Purchase of alcohol, wine, beer, or liquor for personal or team consumption.",
            "Personal grooming, spa treatments, salon, massage, or wellness therapies.",
            "Traffic fines, parking penalties, speeding tickets.",
            "Personal entertainment subscriptions like Netflix, Spotify, Amazon Prime.",
            "Casino, gambling, betting, or adult entertainment."
        ]
        self.prohibited_embeddings = []

    def _chunk_text(self, text: str) -> List[str]:
        """Simple chunking by numeric section headers like 'X. Title'"""
        import re
        # Look for e.g. "1. Purpose" or "3. Meal Allowances"
        raw_chunks = re.split(r'\n(?=\d+\.\s+[A-Z])', text)
        chunks = [c.strip() for c in raw_chunks if c.strip()]
        if not chunks:
            # Fallback
            chunks = text.split('\n\n')
        return [c for c in chunks if len(c) > 50]

    def _get_embedding(self, text: str) -> List[float]:
        if not self.client:
            return []
        try:
            res = self.client.models.embed_content(
                model='text-embedding-004',
                contents=text,
            )
            return res.embeddings[0].values
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            return []

    def load(self):
        """Loads and embeds the policy chunks once."""
        if self.is_loaded:
            return
            
        try:
            with open(self.policy_text_path, 'r', encoding='utf-8') as f:
                text = f.read()
        except Exception:
            return

        self.chunks = self._chunk_text(text)
        
        # Embed policy chunks
        for chunk in self.chunks:
            self.embeddings.append(self._get_embedding(chunk))
            
        # Embed prohibited concepts
        for concept in self.prohibited_concepts:
            self.prohibited_embeddings.append(self._get_embedding(concept))
            
        self.is_loaded = True
        logger.info(f"Loaded RAG service with {len(self.chunks)} chunks.")

    def retrieve_relevant_policy(self, query: str, top_k: int = 2) -> str:
        """Embeds query and retrieves best matching policy chunks."""
        if not self.is_loaded:
            self.load()
            
        if not self.chunks or not self.embeddings:
            return ""

        query_emb = self._get_embedding(query)
        if not query_emb:
            return ""
            
        scored = []
        for i, emb in enumerate(self.embeddings):
            if emb:
                score = cosine_similarity(query_emb, emb)
                scored.append((score, self.chunks[i]))
                
        scored.sort(key=lambda x: x[0], reverse=True)
        top_chunks = [chunk for score, chunk in scored[:top_k]]
        return "\n\n---\n\n".join(top_chunks)

    def is_semantically_prohibited(self, item_name: str, threshold: float = 0.65) -> bool:
        """Checks if a receipt line item matches a prohibited concept heavily."""
        if not self.is_loaded:
            self.load()
        if not self.prohibited_embeddings:
            return False
            
        item_emb = self._get_embedding(item_name)
        if not item_emb:
            return False
            
        for p_emb in self.prohibited_embeddings:
            if not p_emb: continue
            sim = cosine_similarity(item_emb, p_emb)
            if sim >= threshold:
                return True
        return False

rag_service = DefaultRAGService('C:/Users/HP/auditor/policy_text.txt')
