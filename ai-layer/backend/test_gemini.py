import os, pathlib
from dotenv import load_dotenv
from google import genai
load_dotenv(pathlib.Path(__file__).resolve().parent / ".env")
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
for name in ["gemini-flash-latest", "gemini-3.8-flash", "gemini-2.5-flash-lite"]:
    try:
        r = client.models.generate_content(model=name, contents="Say hello in three words")
        print(f"  OK  {name}  ->  {(r.text or '').strip()[:50]}")
    except Exception as e:
        print(f"  FAIL {name}: {str(e)[:80]}")
print("\nConfigured model (GEMINI_MODEL):", os.getenv("GEMINI_MODEL"))
