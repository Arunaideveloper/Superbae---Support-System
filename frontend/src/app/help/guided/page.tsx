"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, CheckCircle2, LifeBuoy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { publicArticles, assistantAsk } from "@/lib/api";
import type { KbArticle } from "@/lib/types";
import {
  GUIDED_CATEGORIES,
  getCategory,
  type GuidedCategory,
  type GuidedNode,
  type SolutionNode,
} from "@/lib/guided-flow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TrailStep = { prompt: string; answer: string };

export default function GuidedSupportPage() {
  const { me } = useAuth();
  const router = useRouter();
  const sessionKey = useRef(`guided-${Math.random().toString(36).slice(2, 10)}`);

  const [cat, setCat] = useState<GuidedCategory | null>(null);
  const [nodeId, setNodeId] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [trail, setTrail] = useState<TrailStep[]>([]);

  // per-solution state
  const [solved, setSolved] = useState<null | boolean>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [collected, setCollected] = useState<Record<string, string>>({});
  const [article, setArticle] = useState<KbArticle | null>(null);
  const [ara, setAra] = useState<{ loading: boolean; answer: string | null; asked: boolean }>({ loading: false, answer: null, asked: false });

  const node: GuidedNode | null = cat && nodeId ? cat.nodes[nodeId] ?? null : null;
  const solution = node && node.kind === "solution" ? (node as SolutionNode) : null;

  // Reset per-solution UI whenever we land on a new solution, and fetch a
  // related KB article (best-effort; never blocks the flow).
  useEffect(() => {
    if (!solution) return;
    setSolved(null);
    setShowRequest(!!solution.escalate);
    setArticle(null);
    setAra({ loading: false, answer: null, asked: false });
    if (solution.articleQuery) {
      let cancelled = false;
      publicArticles({ search: solution.articleQuery })
        .then((list) => { if (!cancelled) setArticle(list[0] ?? null); })
        .catch(() => {});
      return () => { cancelled = true; };
    }
  }, [nodeId, solution]);

  function startCategory(c: GuidedCategory) {
    setCat(c);
    setNodeId(c.start);
    setHistory([]);
    setTrail([]);
  }

  function choose(prompt: string, label: string, to: string) {
    setHistory((h) => [...h, nodeId]);
    setTrail((t) => [...t, { prompt, answer: label }]);
    setNodeId(to);
  }

  function back() {
    if (history.length === 0) { reset(); return; }
    setHistory((h) => h.slice(0, -1));
    setTrail((t) => t.slice(0, -1));
    setNodeId(history[history.length - 1]);
  }

  function reset() {
    setCat(null); setNodeId(""); setHistory([]); setTrail([]);
    setSolved(null); setShowRequest(false); setCollected({});
  }

  async function askAra() {
    if (!cat || !solution) return;
    setAra((a) => ({ ...a, loading: true, asked: true }));
    const question = trail.length
      ? `${cat.title}: ${trail.map((s) => s.answer).join("; ")}`
      : `${cat.title} — ${solution.title}`;
    const { answer } = await assistantAsk(question, sessionKey.current);
    setAra({ loading: false, answer, asked: true });
  }

  const requestHref = useMemo(() => {
    if (!cat || !solution) return "/tickets?new=1";
    const lines: string[] = [`Category: ${cat.title}`];
    trail.forEach((s) => lines.push(`• ${s.prompt} — ${s.answer}`));
    (solution.collect ?? []).forEach((f) => {
      const v = (collected[f.name] || "").trim();
      if (v) lines.push(`${f.label}: ${v}`);
    });
    lines.push(`Suggested solution shown: ${solution.title}`);
    if (!solution.escalate) lines.push("(This didn't resolve my issue.)");
    const subj = solution.ticketSubject;
    const target = `/tickets?new=1&subj=${encodeURIComponent(subj)}&desc=${encodeURIComponent(lines.join("\n"))}`;
    return !me ? `/login?next=${encodeURIComponent(target)}` : me.is_staff ? "/admin" : target;
  }, [cat, solution, trail, collected, me]);

  /* ------------------------------- render ------------------------------- */

  // Step 1 — category picker
  if (!cat) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12">
        <div className="mb-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Link href="/help" className="inline-flex items-center gap-1 font-medium text-[#8a6c92]"><ArrowLeft className="size-3.5" /> Help Center</Link>
        </div>
        <h1 className="text-[28px] font-semibold leading-tight text-foreground sm:text-3xl">What problem are you facing?</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Pick a topic and we&rsquo;ll walk you through it — no login needed until you want to reach a person.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDED_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => startCategory(c)}
              className="group flex flex-col gap-2 rounded-2xl border border-[#efe6ee] bg-card p-5 text-left transition-shadow hover:shadow-[0_16px_36px_rgba(43,43,43,0.10)] cursor-pointer">
              <div className="flex size-11 items-center justify-center rounded-xl sb-brand-gradient text-xl">{c.icon}</div>
              <div className="mt-1 text-base font-semibold text-foreground group-hover:text-[#8a6c92]">{c.title}</div>
              <div className="text-[13px] leading-relaxed text-muted-foreground">{c.blurb}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Done screen
  if (solved === true) {
    return (
      <div className="mx-auto max-w-[640px] px-5 py-20 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full sb-brand-gradient"><CheckCircle2 className="size-8 text-foreground" /></div>
        <h1 className="mt-5 text-2xl font-semibold text-foreground">Glad we could help! 🎉</h1>
        <p className="mt-2 text-muted-foreground">You sorted it out without waiting for support.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button variant="brand" onClick={reset}>Help with something else</Button>
          <Link href="/help"><Button variant="outline">Back to Help Center</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-5 py-10">
      <div className="mb-5 flex items-center justify-between">
        <button onClick={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8a6c92] cursor-pointer">
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><span>{cat.icon}</span><span>{cat.title}</span></div>
      </div>

      {/* Question node */}
      {node && node.kind === "question" && (
        <Card className="p-[26px]">
          <h1 className="text-xl font-semibold text-foreground">{node.prompt}</h1>
          {node.note && <p className="mt-1.5 text-[13px] text-muted-foreground">{node.note}</p>}
          <div className="mt-5 flex flex-col gap-2.5">
            {node.options.map((o) => (
              <button key={o.to + o.label} onClick={() => choose(node.prompt, o.label, o.to)}
                className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3.5 text-left text-sm font-medium text-foreground transition-colors hover:border-[#d8c6f7] hover:bg-[#faf5fb] cursor-pointer">
                <span>{o.label}</span>
                <span className="text-[#c9b6d4]">→</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Solution node */}
      {solution && (
        <>
          <Card className="p-[26px]">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-wide text-[#a08bb0]"><Sparkles className="size-4" /> Suggested fix</div>
            <h1 className="mt-2 text-xl font-semibold text-foreground">{solution.title}</h1>
            <ol className="mt-4 flex flex-col gap-3">
              {solution.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full sb-brand-gradient text-[12px] font-bold text-foreground">{i + 1}</span>
                  <span className="text-sm leading-relaxed text-foreground">{s}</span>
                </li>
              ))}
            </ol>

            {article && (
              <Link href={`/help/article/${article.slug}`}
                className="mt-5 flex items-center gap-2 rounded-xl border border-[#efe6ee] bg-[#fbf6f9] px-4 py-3 text-sm font-medium text-[#8a6c92] hover:bg-[#f7eef4]">
                📄 Related article: {article.title}
              </Link>
            )}

            {/* Optional Ara answer — best effort, hidden when unavailable */}
            {!solution.escalate && (
              <div className="mt-5">
                {!ara.asked ? (
                  <button onClick={askAra} className="inline-flex items-center gap-2 rounded-full border border-[#e6d6ef] bg-white px-4 py-2 text-[13px] font-semibold text-[#8a6c92] hover:bg-[#faf5fb] cursor-pointer">
                    <Sparkles className="size-4" /> Ask Ara about this
                  </button>
                ) : ara.loading ? (
                  <div className="text-[13px] text-muted-foreground">Ara is thinking…</div>
                ) : ara.answer ? (
                  <div className="rounded-xl border border-[#e6d6ef] bg-[#faf5fb] p-4">
                    <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#8a6c92]"><Sparkles className="size-3.5" /> Ara</div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{ara.answer}</div>
                  </div>
                ) : (
                  <div className="text-[13px] text-muted-foreground">Ara isn&rsquo;t available right now — the steps above should still help.</div>
                )}
              </div>
            )}
          </Card>

          {/* Did this solve it? (skipped for escalate solutions) */}
          {!solution.escalate && !showRequest && (
            <Card className="mt-4 flex flex-wrap items-center justify-between gap-4 p-[22px]">
              <span className="text-sm font-semibold text-foreground">Did this solve your problem?</span>
              <div className="flex gap-2.5">
                <Button variant="brand" onClick={() => setSolved(true)}>Yes, all sorted</Button>
                <Button variant="outline" onClick={() => { setSolved(false); setShowRequest(true); }}>No, I need support</Button>
              </div>
            </Card>
          )}

          {/* Create support request */}
          {showRequest && (
            <Card className="mt-4 p-[26px]">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><LifeBuoy className="size-4 text-[#8a6c92]" /> {solution.escalate ? "Send this to our team" : "Create a support request"}</div>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                We&rsquo;ll pre-fill everything you told us here. {me ? "" : "You'll sign in first so you can track the reply."}
              </p>

              {(solution.collect ?? []).length > 0 && (
                <div className="mt-4 flex flex-col gap-3">
                  {solution.collect!.map((f) => (
                    <div key={f.name} className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-foreground">{f.label}</label>
                      {f.type === "textarea" ? (
                        <Textarea rows={3} placeholder={f.placeholder} value={collected[f.name] || ""}
                          onChange={(e) => setCollected((c) => ({ ...c, [f.name]: e.target.value }))} className="resize-y" />
                      ) : (
                        <Input type={f.type === "email" ? "email" : "text"} placeholder={f.placeholder} value={collected[f.name] || ""}
                          onChange={(e) => setCollected((c) => ({ ...c, [f.name]: e.target.value }))} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button variant="brand" onClick={() => router.push(requestHref)}>
                  {me ? "Create support request" : "Sign in & create request"}
                </Button>
                {!solution.escalate && (
                  <button onClick={() => { setShowRequest(false); setSolved(null); }} className="text-[13px] font-medium text-muted-foreground hover:text-foreground cursor-pointer">
                    Actually, that helped
                  </button>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
