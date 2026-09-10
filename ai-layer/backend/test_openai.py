import os, pathlib, httpx
from dotenv import load_dotenv
load_dotenv(pathlib.Path(__file__).resolve().parent / ".env")
key=os.getenv("OPENAI_API_KEY","")
h={"Authorization":f"Bearer {key}"}
print("key prefix:", key[:7], "len:", len(key))
try:
    r=httpx.get("https://api.openai.com/v1/models", headers=h, timeout=30)
    print("list models HTTP", r.status_code)
    if r.status_code==200:
        ids=sorted(m["id"] for m in r.json()["data"])
        print("  chat-ish models:", [i for i in ids if any(x in i for x in ["gpt-4o","gpt-4.1","gpt-5","o1","o3","o4"])][:20])
    else:
        print("  ", r.text[:200])
except Exception as e:
    print("list error:", e)
for model in ["gpt-4o-mini","gpt-4.1-mini","gpt-4o"]:
    try:
        rr=httpx.post("https://api.openai.com/v1/chat/completions",
            headers={**h,"Content-Type":"application/json"},
            json={"model":model,"messages":[{"role":"user","content":"Say hello in three words"}]}, timeout=30)
        if rr.status_code==200:
            print(f"  OK  {model}  ->  {rr.json()['choices'][0]['message']['content'][:50]}")
        else:
            print(f"  FAIL {model}: {rr.status_code} {rr.text[:100]}")
    except Exception as e:
        print(f"  FAIL {model}: {e}")
