"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchEscalations, fetchTicket, UnauthorizedError } from "@/lib/api";
import type { ApiTicket, EscalationsResponse, TicketDetail, SlaStage } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { initials, avColor, timeAgo } from "@/lib/theme";
import { cn } from "@/lib/utils";

const PRIO_COLOR: Record<string, string> = { critical: "#D9557B", high: "#E8883C", medium: "#D9A93C", low: "#3E8E5A" };
const SOURCE_LABEL: Record<string, string> = { web: "Web", email: "Email", android_app: "Android App", ios_app: "iOS App", api: "API" };
const LEVEL: Record<string, { bg: string; fg: string }> = { L1: { bg: "#FBF0DA", fg: "#B0863C" }, L2: { bg: "#FCE6D2", fg: "#C4723C" }, L3: { bg: "#FADBD9", fg: "#C0453C" } };

type SlaS = "breached" | "at_risk" | "within";
const SLA_STYLE: Record<SlaS, { bg: string; fg: string; label: string }> = {
  breached: { bg: "#FADBD9", fg: "#C0453C", label: "Breached" },
  at_risk: { bg: "#FBF0DA", fg: "#B0863C", label: "At Risk" },
  within: { bg: "#E4F3EA", fg: "#3E8E5A", label: "Within SLA" },
};
function slaStateOf(t: ApiTicket): SlaS {
  const fr = t.sla?.first_response, rz = t.sla?.resolution;
  if (fr?.breached || rz?.breached) return "breached";
  const rem = Math.min(fr?.remaining_seconds ?? Infinity, rz?.remaining_seconds ?? Infinity);
  return rem < 1800 ? "at_risk" : "within";
}
const levelOf = (p: string) => (p === "critical" ? "L3" : p === "high" ? "L2" : "L1");
function fmtDur(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m`;
  return `${sec}s`;
}
function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-foreground" style={{ width: size, height: size, background: avColor(name), fontSize: size * 0.38 }}>{initials(name)}</span>;
}
function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: bg, color: fg }}>{text}</span>;
}
function SlaBar({ stage, label }: { stage: SlaStage; label: string }) {
  const tone = stage.breached ? "#D9557B" : stage.met ? "#3E8E5A" : "#8A6C92";
  const total = Math.max(1, stage.target_minutes * 60);
  const pct = stage.completed_at ? 100 : stage.breached ? 100 : Math.max(3, Math.min(100, ((total - stage.remaining_seconds) / total) * 100));
  const right = stage.completed_at ? (stage.met ? "Met" : "Late") : stage.breached ? "Overdue " + fmtDur(-stage.remaining_seconds) : fmtDur(stage.remaining_seconds) + " left";
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-semibold" style={{ color: tone }}>{right}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#f1ecf4]"><div className="h-full" style={{ width: pct + "%", background: tone }} /></div>
    </div>
  );
}

const TABS = [
  { key: "all", label: "All Escalations" },
  { key: "critical", label: "Critical" },
  { key: "breached", label: "SLA Breached" },
  { key: "at_risk", label: "At Risk" },
] as const;

export function Escalations({ query = "" }: { query?: string }) {
  const [data, setData] = useState<EscalationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dtab, setDtab] = useState("Conversation");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr("");
    fetchEscalations()
      .then((d) => { if (cancelled) return; setData(d); setSelId((prev) => (prev && d.results.some((r) => r.id === prev) ? prev : d.results[0]?.id ?? null)); })
      .catch((e) => { if (!cancelled) setErr(e instanceof UnauthorizedError ? "Session expired — please sign in again." : "Could not load escalations."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selId) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true); setDtab("Conversation");
    fetchTicket(selId).then((d) => { if (!cancelled) setDetail(d); }).catch(() => {}).finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.results || []).filter((t) => {
      const s = slaStateOf(t);
      const byTab = tab === "all" || (tab === "critical" ? t.priority === "critical" : tab === "breached" ? s === "breached" : s === "at_risk");
      const byQ = !q || t.subject.toLowerCase().includes(q) || (t.created_by?.username || "").toLowerCase().includes(q);
      return byTab && byQ;
    });
  }, [data, tab, query]);

  const counts = {
    all: data?.count ?? 0, critical: data?.critical ?? 0, breached: data?.breached ?? 0,
    at_risk: (data?.results || []).filter((t) => slaStateOf(t) === "at_risk").length,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f7f4f8]">
      <div className="px-6 pt-5">
        <h2 className="mb-0.5 text-lg font-semibold text-foreground">Escalations</h2>
        <p className="mb-3.5 text-[13.5px] text-muted-foreground">High-priority and SLA-breaching tickets that need attention.</p>
        <div className="flex gap-5 overflow-x-auto border-b border-[#efe6ee]">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={cn("whitespace-nowrap border-b-2 pb-3 text-[13.5px] cursor-pointer", active ? "border-[#8a6c92] font-bold text-[#8a6c92]" : "border-transparent font-medium text-muted-foreground")}>
                {t.label} <span className="text-[#a0a0a0]">({counts[t.key as keyof typeof counts]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {err && <Card className="m-4 border border-[#efe6ee] p-4 text-[13.5px] text-destructive shadow-none">{err}</Card>}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-auto rounded-2xl border border-[#efe6ee] shadow-none">
          {loading ? (
            <div className="p-7 text-center text-[13px] text-muted-foreground">Loading escalations…</div>
          ) : rows.length === 0 ? (
            <div className="p-7 text-center text-[13px] text-muted-foreground">No escalations here. 🎉</div>
          ) : rows.map((t) => {
            const s = slaStateOf(t); const st = SLA_STYLE[s]; const lv = levelOf(t.priority); const active = t.id === selId;
            return (
              <div key={t.id} onClick={() => setSelId(t.id)} className={cn("flex cursor-pointer items-start gap-3 border-b border-[#f4eef6] px-4 py-3.5", active ? "bg-[#f7f2fa]" : "bg-transparent")}>
                <Avatar name={t.created_by?.username || "?"} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{t.subject}</span>
                    <Pill text={lv} bg={LEVEL[lv].bg} fg={LEVEL[lv].fg} />
                    <Pill text={st.label} bg={st.bg} fg={st.fg} />
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">
                    <span className="font-semibold capitalize" style={{ color: PRIO_COLOR[t.priority] }}>{t.priority}</span>
                    {" · "}by {t.created_by?.username || "—"}{" · "}{t.assigned_to ? `owner ${t.assigned_to.username}` : "unassigned"}{" · "}{timeAgo(t.created_at)}{" · via "}{SOURCE_LABEL[t.source] ?? t.source}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>

        <Card className="flex flex-col overflow-auto rounded-2xl border border-[#efe6ee] shadow-none">
          {!selId ? (
            <div className="p-7 text-center text-[13px] text-muted-foreground">Select an escalation.</div>
          ) : detailLoading || !detail ? (
            <div className="p-7 text-center text-[13px] text-muted-foreground">Loading ticket…</div>
          ) : (
            <div className="p-[18px]">
              <div className="mb-1.5 text-[15px] font-bold text-foreground">{detail.subject}</div>
              <div className="mb-3.5 flex flex-wrap gap-1.5">
                <Pill text={detail.priority} bg="#F5EEF9" fg="#8A6C92" />
                <Pill text={detail.status.replace("_", " ")} bg="#EEF0F4" fg="#6B7280" />
                <Pill text={"via " + (SOURCE_LABEL[detail.source] ?? detail.source)} bg="#EEF0F4" fg="#6B7280" />
              </div>

              <div className="mb-3.5 rounded-xl border border-[#f0e6ec] p-3.5">
                {[["Requester", detail.created_by.username], ["Assigned", detail.assigned_to?.username ?? "Unassigned"], ["Created", timeAgo(detail.created_at)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-0.5 text-[12.5px]"><span className="text-[#a0a0a0]">{k}</span><span className="font-semibold text-foreground">{v}</span></div>
                ))}
              </div>

              {detail.sla && (
                <div className="mb-3.5">
                  <div className="mb-2 text-[12.5px] font-bold text-foreground">SLA</div>
                  <SlaBar stage={detail.sla.first_response} label="First response" />
                  <SlaBar stage={detail.sla.resolution} label="Resolution" />
                </div>
              )}

              <div className="mb-2.5 flex gap-4 border-b border-[#efe6ee]">
                {["Conversation", "History"].map((t) => {
                  const active = dtab === t; const n = t === "History" ? detail.events.length : detail.messages.length;
                  return <button key={t} onClick={() => setDtab(t)} className={cn("border-b-2 pb-2 text-[13px] cursor-pointer", active ? "border-[#8a6c92] font-bold text-[#8a6c92]" : "border-transparent font-medium text-muted-foreground")}>{t} ({n})</button>;
                })}
              </div>

              {dtab === "Conversation" ? (
                detail.messages.length === 0 ? <div className="py-2.5 text-[13px] text-muted-foreground">No messages yet.</div> :
                detail.messages.map((m) => (
                  <div key={String(m.id)} className="mb-3 flex gap-2.5">
                    <Avatar name={m.author} size={30} />
                    <div className="flex-1">
                      <div className="mb-0.5 text-[12.5px]"><span className="font-semibold text-foreground">{m.author}</span>{m.is_internal && <span className="ml-1.5 rounded-full bg-[#fbf0da] px-1.5 py-px text-[11px] text-[#b0863c]">internal</span>} <span className="text-[#a0a0a0]">· {timeAgo(m.created_at)}</span></div>
                      <div className="rounded-xl border border-[#f0e6ec] bg-[#faf6fb] px-2.5 py-2 text-[13px] leading-relaxed text-foreground">{m.body}</div>
                    </div>
                  </div>
                ))
              ) : (
                detail.events.length === 0 ? <div className="py-2.5 text-[13px] text-muted-foreground">No history.</div> :
                detail.events.map((ev) => (
                  <div key={String(ev.id)} className="mb-2.5 flex gap-2.5 text-[12.5px]">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#d8c6f7]" />
                    <div><span className="font-semibold text-foreground">{ev.type}</span> {ev.detail && <span className="text-muted-foreground">— {ev.detail}</span>}<div className="text-[#a0a0a0]">{typeof ev.actor === "string" && ev.actor ? ev.actor + " · " : ""}{timeAgo(ev.created_at)}</div></div>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
