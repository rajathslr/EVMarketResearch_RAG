"""
Splits text into overlapping chunks using tiktoken for token counting.
Chunk size: 512 tokens, overlap: 64 tokens.
Short texts (reviews) that fit in one chunk are returned as-is.
"""
import tiktoken

CHUNK_SIZE    = 512
CHUNK_OVERLAP = 64

_enc = tiktoken.get_encoding("cl100k_base")


def chunk_text(text: str) -> list[str]:
    """Return a list of token-bounded chunks from text."""
    text = text.strip()
    if not text:
        return []

    tokens = _enc.encode(text)

    if len(tokens) <= CHUNK_SIZE:
        return [text]

    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunk_tokens = tokens[start:end]
        chunks.append(_enc.decode(chunk_tokens))
        if end == len(tokens):
            break
        start += CHUNK_SIZE - CHUNK_OVERLAP

    return chunks
