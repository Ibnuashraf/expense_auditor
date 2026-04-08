import os
import faiss
import numpy as np
import pickle
import logging
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# Single model instance loaded at module startup to avoid multiple loads
model = None

def get_model():
    global model
    if model is None:
        model = SentenceTransformer("all-MiniLM-L6-v2")
    return model

def build_vector_store(chunks):
    texts = [c["text"] for c in chunks]
    m = get_model()
    embeddings = m.encode(texts)
    
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(np.array(embeddings, dtype='float32'))
    
    return index, embeddings

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def save_store(index, chunks, path="policy_store"):
    abs_path = os.path.join(BASE_DIR, path)
    faiss.write_index(index, f"{abs_path}.index")
    with open(f"{abs_path}.pkl", "wb") as f:
        pickle.dump(chunks, f)
    logger.info(f"Store saved at {abs_path}.index and .pkl")

def load_store(path="policy_store"):
    abs_path = os.path.join(BASE_DIR, path)
    if not os.path.exists(f"{abs_path}.index") or not os.path.exists(f"{abs_path}.pkl"):
        return None, []
    
    index = faiss.read_index(f"{abs_path}.index")
    with open(f"{abs_path}.pkl", "rb") as f:
        chunks = pickle.load(f)
    return index, chunks
