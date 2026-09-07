"""Extract knowledge-source documents into knowledge.txt.

Only cleanly-extracted documents are kept. Image/mockup PDFs that pypdf turns
into space-shattered noise are rejected by a quality gate, so the RAG index is
never polluted by garbled text. Pipeline: python ingest.py -> chunker.py -> build_index.py
"""
from pathlib import Path

from docx import Document
from pypdf import PdfReader

BASE_DIR = Path(__file__).resolve().parent
SOURCE_DIRS = [
    BASE_DIR / "knowledge_sources",
    BASE_DIR.parent.parent / "Superbae Design",  # extra curated docs, if present
]
OUTPUT_FILE = BASE_DIR / "knowledge.txt"
SUPPORTED = {".pdf", ".docx"}

# A document whose extracted text is more than this fraction of stray single
# letters is treated as garbled (a mockup/screenshot PDF) and skipped.
MAX_SINGLE_LETTER_RATIO = 0.15


def _extract(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages).strip()
    doc = Document(path)
    return "\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())


def _single_letter_ratio(text: str) -> float:
    tokens = text.split()
    if not tokens:
        return 1.0
    singles = sum(1 for t in tokens if len(t) == 1 and t.isalpha())
    return singles / len(tokens)


def _collect_files() -> list[Path]:
    seen: dict[str, Path] = {}
    for directory in SOURCE_DIRS:
        if not directory.is_dir():
            continue
        for f in sorted(directory.iterdir()):
            if f.suffix.lower() in SUPPORTED and f.name not in seen:
                seen[f.name] = f
    return list(seen.values())


def main() -> None:
    documents: list[str] = []
    kept = skipped = 0

    for source_file in _collect_files():
        try:
            text = _extract(source_file)
        except Exception as error:  # noqa: BLE001 - report and continue
            print(f"SKIP  {source_file.name}: extraction failed ({error})")
            skipped += 1
            continue

        if not text:
            print(f"SKIP  {source_file.name}: no text extracted")
            skipped += 1
            continue

        ratio = _single_letter_ratio(text)
        if ratio > MAX_SINGLE_LETTER_RATIO:
            print(f"SKIP  {source_file.name}: garbled extraction ({ratio:.0%} single letters)")
            skipped += 1
            continue

        documents.append(f"===== {source_file.name} =====\n\n{text}")
        kept += 1
        print(f"KEEP  {source_file.name}: {len(text):,} chars ({ratio:.0%} single letters)")

    OUTPUT_FILE.write_text("\n\n".join(documents), encoding="utf-8")
    print(f"\nProcessed: {kept} kept, {skipped} skipped -> {OUTPUT_FILE}")
    if kept == 0:
        raise SystemExit("No usable documents — the index would be empty.")


if __name__ == "__main__":
    main()
