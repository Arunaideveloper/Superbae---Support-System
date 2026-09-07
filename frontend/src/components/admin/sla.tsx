"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchSlaReport, UnauthorizedError } from "@/lib/api";
import type { SlaReportResponse } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PRIO_ORDER = ["critical", "high", "medium", "low"];
const PRIO_COLOR: Record<string, string> = { critical: "#D9557B", high: "#E8883C", medium: "#D9A93C", low: "#3E8E5A" };
const PRIO_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

function fmtMins(m: number): string {
  if (m < 60) return `${m} mins`;
  if (m % 60 === 0) return `${m / 60} hrs`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: bg, color: fg }}>{text}</span>;
}
function Legend({ c, label, value }: { c: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: c }} />
      <span className="flex-1 text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-[12.5px] font-semibold text-foreground">{value}</span>
    </div>
  );
}
function Donut({ met, breached }: { met: number; breached: number }) {
  const R = 54, C = 2 * Math.PI * R;
  const total = Math.max(1, met + breached);
  const segs = [{ v: (met / total) * 100, c: "#3E8E5A" }, { v: (breached / total) * 100, c: "#D9557B" }];
  let acc = 0;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r={R} fill="none" stroke="#EFEAF0" strokeWidth="16" />
      {segs.map((s, i) => {
        const len = (C * s.v) / 100; const off = (C * acc) / 100; acc += s.v;
        return <circle key={i} cx="75" cy="75" r={R} fill="none" stroke={s.c} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 75 75)" />;
      })}
      <text x="75" y="72" textAnchor="middle" fontSize="26" fontWeight="700" fill="#2b2b2b">{met + breached}</text>
      <text x="75" y="92" textAnchor="middle" fontSize="11" fill="#7a7a7a">Open Tickets</text>
    </svg>
  );
}

export function Sla() {
  const [data, setData] = useState<SlaReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selKey, setSelKey] = useState("critical");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr("");
    fetchSlaReport()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setErr(e instanceof UnauthorizedError ? "Session expired — please sign in again." : "Could not load the SLA report."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const policies = useMemo(() => {
    const p = data?.policy || {};
    return PRIO_ORDER.filter((k) => p[k]).map((k) => ({ key: k, label: PRIO_LABEL[k], color: PRIO_COLOR[k], firstResponse: fmtMins(p[k].firstResponse), resolution: fmtMins(p[k].resolution) }));
  }, [data]);

  const breachesByPriority = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data?.breaching || []) m.set(t.priority, (m.get(t.priority) || 0) + 1);
    return m;
  }, [data]);

  const breachedCount = data?.breaching.length ?? 0;
  const open = data?.open ?? 0;
  const met = Math.max(0, open - breachedCount);
  const compliance = data?.compliance_percent ?? 100;
  const sel = policies.find((p) => p.key === selKey) ?? policies[0];

  const kpis = [
    { label: "Open Tickets", value: String(open), bg: "#d8c6f7" },
    { label: "SLA Compliance", value: compliance + "%", bg: "#c8e6d6" },
    { label: "First-Response Breaches", value: String(data?.first_response_breaches ?? 0), bg: "#f7b7d4" },
    { label: "Resolution Breaches", value: String(data?.resolution_breaches ?? 0), bg: "#f6c9a5" },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f4f8] px-6 pb-10 pt-5">
      <div className="mb-4.5">
        <h2 className="mb-0.5 text-lg font-semibold text-foreground">SLA</h2>
        <p className="text-[13.5px] text-muted-foreground">Live SLA policies and breach status from the ticket engine.</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-3.5">
        {kpis.map((k) => (
          <Card key={k.label} className="min-w-[170px] flex-[1_0_170px] rounded-2xl border border-[#efe6ee] p-[16px_18px] shadow-none">
            <div className="mb-2.5 size-2.5 rounded" style={{ background: k.bg }} />
            <div className="text-2xl font-bold text-foreground">{loading ? "…" : k.value}</div>
            <div className="text-[12.5px] text-muted-foreground">{k.label}</div>
          </Card>
        ))}
      </div>

      {err && <Card className="mb-4 border border-[#efe6ee] p-4 text-[13.5px] text-destructive shadow-none">{err}</Card>}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <h3 className="mb-1 text-base font-semibold text-foreground">SLA Policies</h3>
          <p className="mb-3.5 text-[13.5px] text-muted-foreground">Response and resolution targets applied automatically by ticket priority.</p>
          <Card className="overflow-x-auto rounded-2xl border border-[#efe6ee] shadow-none">
            <Table className="min-w-[560px]">
              <TableHeader><TableRow className="hover:bg-transparent">{["Priority", "First Response", "Resolution", "Breaches", "Status"].map((h) => <TableHead key={h} className="px-4 py-3.5">{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="py-6 text-center text-[13px] text-muted-foreground">Loading policies…</TableCell></TableRow>
                ) : policies.map((p) => {
                  const active = p.key === selKey;
                  return (
                    <TableRow key={p.key} onClick={() => setSelKey(p.key)} className={cn("cursor-pointer", active ? "bg-[#f7f2fa] hover:bg-[#f7f2fa]" : "")}>
                      <TableCell className="px-4 py-3.5 whitespace-nowrap"><span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: p.color }}>{p.label}<span className="size-[7px] rounded-full" style={{ background: p.color }} /></span></TableCell>
                      <TableCell className="px-4 py-3.5 text-[13.5px] font-semibold whitespace-nowrap" style={{ color: p.color }}>{p.firstResponse}</TableCell>
                      <TableCell className="px-4 py-3.5 text-[13.5px] font-semibold whitespace-nowrap" style={{ color: p.color }}>{p.resolution}</TableCell>
                      <TableCell className="px-4 py-3.5 text-[13.5px] text-foreground">{breachesByPriority.get(p.key) || 0}</TableCell>
                      <TableCell className="px-4 py-3.5"><Pill text="Active" bg="#E4F3EA" fg="#3E8E5A" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <h3 className="mb-3 mt-5 text-base font-semibold text-foreground">Currently Breaching ({breachedCount})</h3>
          <Card className="overflow-hidden rounded-2xl border border-[#efe6ee] shadow-none">
            {loading ? <div className="p-5 text-[13px] text-muted-foreground">Loading…</div>
            : breachedCount === 0 ? <div className="p-5 text-[13.5px] text-[#3e8e5a]">No tickets are breaching SLA right now. 🎉</div>
            : (
              <Table className="min-w-[520px]"><TableBody>
                {(data?.breaching || []).map((t) => (
                  <TableRow key={t.id} className="hover:bg-transparent">
                    <TableCell className="px-4 py-3 text-[13.5px] font-semibold text-foreground">{t.subject}</TableCell>
                    <TableCell className="px-4 py-3"><span className="text-[12.5px] font-semibold capitalize" style={{ color: PRIO_COLOR[t.priority] || "#7a7a7a" }}>{t.priority}</span></TableCell>
                    <TableCell className="px-4 py-3 text-[12.5px] text-muted-foreground whitespace-nowrap">{t.assigned_to?.username ?? "Unassigned"}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      {t.sla?.first_response?.breached && <Pill text="First response" bg="#FADBD9" fg="#C0453C" />}
                      {t.sla?.resolution?.breached && <span className="ml-1.5"><Pill text="Resolution" bg="#FADBD9" fg="#C0453C" /></span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="rounded-2xl border border-[#efe6ee] p-[18px] shadow-none">
            <h3 className="mb-3.5 text-sm font-bold text-foreground">SLA Overview</h3>
            <div className="flex items-center gap-1.5">
              <Donut met={met} breached={breachedCount} />
              <div className="flex flex-1 flex-col gap-2.5">
                <Legend c="#3E8E5A" label="Within SLA" value={`${met} (${compliance}%)`} />
                <Legend c="#D9557B" label="Breaching" value={`${breachedCount}`} />
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border border-[#efe6ee] p-[18px] shadow-none">
            <h3 className="mb-3 text-sm font-bold text-foreground">Breaches by Priority</h3>
            <div className="flex gap-4">
              <div><div className="text-[34px] font-bold leading-none text-destructive">{breachedCount}</div><div className="mt-1 text-xs text-[#a0a0a0]">Total Breaching</div></div>
              <div className="flex flex-1 flex-col gap-1">
                {PRIO_ORDER.map((k) => (
                  <div key={k} className="flex justify-between text-[12.5px]"><span className="text-muted-foreground">{PRIO_LABEL[k]}</span><span className="font-semibold text-foreground">{breachesByPriority.get(k) || 0}</span></div>
                ))}
              </div>
            </div>
          </Card>

          {sel && (
            <Card className="rounded-2xl border border-[#efe6ee] p-[18px] shadow-none">
              <h3 className="mb-3 text-sm font-bold text-foreground">Selected Policy · {sel.label}</h3>
              <div className="flex justify-between border-b border-[#f4eef6] py-1.5 text-[12.5px]"><span className="text-muted-foreground">First response</span><span className="font-semibold" style={{ color: sel.color }}>{sel.firstResponse}</span></div>
              <div className="flex justify-between border-b border-[#f4eef6] py-1.5 text-[12.5px]"><span className="text-muted-foreground">Resolution</span><span className="font-semibold" style={{ color: sel.color }}>{sel.resolution}</span></div>
              <div className="flex justify-between py-1.5 text-[12.5px]"><span className="text-muted-foreground">SLA start</span><span className="font-semibold text-foreground">When created</span></div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
