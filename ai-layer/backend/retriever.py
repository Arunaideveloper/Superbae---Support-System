from pathlib import Path
import pickle

import faiss
from sentence_transformers import SentenceTransformer


INDEX_FILE = Path("knowledge.index")
METADATA_FILE = Path("knowledge_metadata.pkl")

TOP_K = 3


class KnowledgeRetriever:
    def __init__(self):
        if not INDEX_FILE.exists():
            raise FileNotFoundError(f"Missing {INDEX_FILE}")

        if not METADATA_FILE.exists():
            raise FileNotFoundError(f"Missing {METADATA_FILE}")

        self.index = faiss.read_index(str(INDEX_FILE))

        with METADATA_FILE.open("rb") as file:
            metadata = pickle.load(file)

        self.chunks = metadata["chunks"]
        self.model_name = metadata["model"]

        self.model = SentenceTransformer(self.model_name)

    def search(self, query: str, top_k: int = TOP_K) -> list[dict]:
        query_embedding = self.model.encode(
            [query],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        scores, indices = self.index.search(query_embedding, top_k)

        results = []

        for score, index in zip(scores[0], indices[0]):
            if index < 0 or index >= len(self.chunks):
                continue

            results.append(
                {
                    "score": float(score),
                    "chunk": self.chunks[index],
                }
            )

        return results


if __name__ == "__main__":
    retriever = KnowledgeRetriever()

    query = input("Enter your question: ").strip()

    if not query:
        print("No question entered.")
        raise SystemExit(1)

    results = retriever.search(query)

    print("\n===== SEARCH RESULTS =====\n")

    for number, result in enumerate(results, start=1):
        print(f"--- Result {number} | Score: {result['score']:.4f} ---")
        print(result["chunk"])
        print()