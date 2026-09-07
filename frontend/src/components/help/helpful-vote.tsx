"use client";
import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { submitArticleFeedback } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ContactSupport } from "@/components/help/contact-support";

export function HelpfulVote({ slug, title }: { slug: string; title: string }) {
  const [voted, setVoted] = useState<null | "up" | "down">(null);
  const [sending, setSending] = useState(false);

  async function vote(helpful: boolean) {
    if (voted || sending) return;
    setSending(true);
    try { await submitArticleFeedback(slug, helpful); } catch {}
    setVoted(helpful ? "up" : "down");
    setSending(false);
  }

  return (
    <div className="rounded-2xl border border-[#efe6ee] bg-[#fbf6f9] p-5">
      {!voted ? (
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold text-foreground">Was this helpful?</span>
          <div className="flex gap-2">
            <button onClick={() => vote(true)} disabled={sending} className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-muted cursor-pointer disabled:opacity-50"><ThumbsUp className="size-4" /> Yes</button>
            <button onClick={() => vote(false)} disabled={sending} className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-muted cursor-pointer disabled:opacity-50"><ThumbsDown className="size-4" /> No</button>
          </div>
        </div>
      ) : voted === "up" ? (
        <div className="text-sm text-foreground">Thanks for your feedback! 💜 Glad this helped.</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-foreground">Sorry this didn&rsquo;t help. Our team can take it from here.</div>
          <div className="flex flex-wrap items-center gap-3">
            <ContactSupport topic={title} />
            <span className="text-[13px] text-muted-foreground">We&rsquo;ll pick up right where you left off.</span>
          </div>
        </div>
      )}
    </div>
  );
}
