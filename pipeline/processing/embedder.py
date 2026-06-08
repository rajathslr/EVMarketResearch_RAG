"""
Local embedder using BAAI/bge-small-en-v1.5 (384 dims, ~130MB).
Model is downloaded once and cached by sentence-transformers.
"""
import logging
from functools import lru_cache

log = logging.getLogger(__name__)

MODEL_NAME = "BAAI/bge-small-en-v1.5"
BATCH_SIZE = 64


@lru_cache(maxsize=1)
def _get_model():
    from sentence_transformers import SentenceTransformer
    log.info("Loading embedding model %s (first run downloads ~130MB)...", MODEL_NAME)
    model = SentenceTransformer(MODEL_NAME)
    log.info("Model loaded.")
    return model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of strings. Returns list of 384-dim vectors."""
    if not texts:
        return []
    model = _get_model()
    # bge models work best with a query prefix for retrieval
    prefixed = [f"Represent this sentence: {t}" for t in texts]
    vectors = model.encode(
        prefixed,
        batch_size=BATCH_SIZE,
        show_progress_bar=False,
        normalize_embeddings=True,
    )
    return vectors.tolist()
