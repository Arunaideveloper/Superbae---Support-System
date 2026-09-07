from pathlib import Path
from docx import Document
from pypdf import PdfReader

SOURCE_DIR = Path("knowledge_sources")
OUTPUT_FILE = Path("knowledge.txt")


def main():
    documents = []
    total_characters = 0

    for source_file in sorted(SOURCE_DIR.iterdir()):
        if source_file.suffix.lower() not in {".pdf", ".docx"}:
            continue

        try:
            if source_file.suffix.lower() == ".pdf":
                text = "\n".join(
                    page.extract_text() or ""
                    for page in PdfReader(source_file).pages
                ).strip()
            else:
                doc = Document(source_file)
                text = "\n".join(
                    paragraph.text.strip()
                    for paragraph in doc.paragraphs
                    if paragraph.text.strip()
                )
        except Exception as error:
            print(f"Could not process {source_file.name}: {error}")
            continue

        if not text:
            print(f"No text extracted from {source_file.name}")

        documents.append(f"===== {source_file.name} =====\n\n{text}")
        total_characters += len(text)

    OUTPUT_FILE.write_text("\n\n".join(documents), encoding="utf-8")

    print("Knowledge base processed successfully.")
    print(f"Documents processed: {len(documents)}")
    print(f"Saved to: {OUTPUT_FILE}")
    print(f"Characters extracted: {total_characters:,}")


if __name__ == "__main__":
    main()