# Knowledge sources (RAG inputs)

`ingest.py` reads the documents in this folder to build the FAISS index
(`knowledge.index` + `knowledge_metadata.pkl`). The large source **PDFs are
intentionally excluded from git** (see repo `.gitignore`) because they are
large binaries (~230 MB total), not code.

Store and retrieve them via **Git LFS** or an object-storage bucket
(e.g. GCS `gs://<bucket>/superbae/knowledge_sources/`) before running ingestion.
The smaller `.docx` sources are tracked in git for reference.

Files expected here (not in git):
- Tracker.pdf, me Section.pdf, Club.pdf, Fits (1).pdf, Journal MVP (1).pdf,
  SuperBae PRD — Analysis, Gap-Fill Addendum & Roadmap (1).pdf
