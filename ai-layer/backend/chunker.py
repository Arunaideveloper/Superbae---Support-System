from pathlib import Path

INPUT_FILE = Path("knowledge.txt")
OUTPUT_FILE = Path("chunks.txt")

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200


def create_chunks(text: str) -> list[str]:
    chunks = []
    start = 0

    while start < len(text):
        end = start + CHUNK_SIZE
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        start += CHUNK_SIZE - CHUNK_OVERLAP

    return chunks


def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Knowledge file not found: {INPUT_FILE}")

    text = INPUT_FILE.read_text(encoding="utf-8")
    chunks = create_chunks(text)

    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        for index, chunk in enumerate(chunks, start=1):
            file.write(f"\n===== CHUNK {index} =====\n")
            file.write(chunk)
            file.write("\n")

    print(f"Created {len(chunks)} chunks.")
    print(f"Saved chunks to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()