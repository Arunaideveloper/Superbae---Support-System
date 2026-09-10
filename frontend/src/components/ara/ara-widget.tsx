"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { assistantAsk } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/help/markdown";

type Role = "user" | "assistant";
interface Msg { role: Role; text: string; }

const GREETING =
  "Hi, I'm Ara ✨ your Superbae assistant. Ask me about outfits, your closet, billing — anything you need a hand with.";

/** Stable per-browser session key so the backend can thread the conversation. */
function makeSessionKey(): string {
  try {
    const existing = localStorage.getItem("ara_session");
    if (existing) return existing;
    const key = crypto?.randomUUID?.() ?? `ara-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("ara_session", key);
    return key;
  } catch {
    return `ara-${Date.now()}`;
  }
}

/** Floating Ara assistant — a launcher button plus a bottom-right chat panel. */
export function AraWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionKey = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { sessionKey.current = makeSessionKey(); }, []);
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages, open]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const { answer, source } = await assistantAsk(q, sessionKey.current);
      const text =
        answer && source !== "unavailable"
          ? answer
          : "I couldn't reach my knowledge base just now. Try browsing the help topics, or contact support and a person will help you out.";
      setMessages((m) => [...m, { role: "assistant", text }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Something went wrong. Please try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Ara assistant" : "Open Ara assistant"}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full text-foreground shadow-[0_10px_30px_-8px_rgba(216,198,247,0.9)] transition-transform hover:scale-105 active:scale-95 sb-brand-gradient",
          open && "rotate-90"
        )}
      >
        {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Ara assistant"
          className="fixed bottom-24 right-5 z-50 flex h-[70vh] max-h-[560px] w-[calc(100vw-2.5rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-[#f0e6ec] bg-card shadow-[0_24px_60px_-20px_rgba(43,43,43,0.35)]"
        >
          <div className="flex items-center gap-3 border-b border-[#f0e6ec] px-4 py-3 sb-brand-gradient">
            <div className="flex size-9 items-center justify-center rounded-full bg-white/70 text-foreground">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold leading-tight text-foreground">Ara</div>
              <div className="text-xs text-foreground/70">Your Superbae assistant</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-lg p-1.5 text-foreground/80 hover:bg-white/40">
              <X className="size-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "whitespace-pre-wrap rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-[#f0e6ec] bg-card text-foreground"
                  )}
                >
                  {m.role === "assistant" ? <Markdown className="md-chat">{m.text}</Markdown> : m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[#f0e6ec] bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Ara is typing…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#f0e6ec] bg-card p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask Ara anything…"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#d8c6f7] focus:ring-[3px] focus:ring-ring/40"
              />
              <button
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="flex size-[42px] shrink-0 items-center justify-center rounded-xl text-foreground transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50 sb-brand-gradient"
              >
                <Send className="size-5" />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Ara can make mistakes. For account actions, contact support.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
