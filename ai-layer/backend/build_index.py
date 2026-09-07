from pathlib import Path
import pickle

import faiss
from sentence_transformers import SentenceTransformer


CHUNKS_FILE = Path("chunks.txt")
INDEX_FILE = Path("knowledge.index")
METADATA_FILE = Path("knowledge_metadata.pkl")

MODEL_NAME = "all-MiniLM-L6-v2"


def load_chunks() -> list[str]:
    text = CHUNKS_FILE.read_text(encoding="utf-8")

    raw_chunks = text.split("===== CHUNK ")

    chunks = []

    for raw_chunk in raw_chunks:
        if not raw_chunk.strip():
            continue

        lines = raw_chunk.splitlines()

        # Remove the chunk number line
        content = "\n".join(lines[1:]).strip()

        if content:
            chunks.append(content)

    return chunks


def main():
    if not CHUNKS_FILE.exists():
        raise FileNotFoundError(f"Missing {CHUNKS_FILE}")

    chunks = load_chunks()

    if not chunks:
        raise RuntimeError("No chunks found.")

    print(f"Loaded {len(chunks)} chunks.")

    print(f"Loading embedding model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)

    print("Creating embeddings...")
    embeddings = model.encode(
        chunks,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )

    dimension = embeddings.shape[1]

    print(f"Embedding dimension: {dimension}")

    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    faiss.write_index(index, str(INDEX_FILE))

    metadata = {
        "model": MODEL_NAME,
        "chunks": chunks,
    }

    with METADATA_FILE.open("wb") as file:
        pickle.dump(metadata, file)

    print("Vector index created successfully.")
    print(f"Saved index: {INDEX_FILE}")
    print(f"Saved metadata: {METADATA_FILE}")


if __name__ == "__main__":
    main()