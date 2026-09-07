"use client";
import type { Ticket } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DAY = 86400000;

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1ecf4]">
      <div className="h-full sb-brand-gradient" style={{ width: pct + "%" }} />
    </div>
  );
}

export function DashboardHome({ tickets, onOpenTickets }: { tickets: Ticket[]; onOpenTickets?: () => void }) {
  const now = new Date();
  const isUnresolved = (t: Ticket) => t.status === "open" || t.status === "in_progress";

  const open = tickets.filter((t) => t.status === "open").length;
  const pending = tickets.filter((t) => t.status === "in_progress").length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;
  const total = tickets.length;
  const critical = tickets.filter((t) => t.priority === "high" && isUnresolved(t));
  const overdue = tickets.filter((t) => isUnresolved(t) && now.getTime() - new Date(t.created_at).getTime() > 2 * DAY).length;
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;

  const days: { label: string; cnt: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    const key = d.toDateString();
    days.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), cnt: tickets.filter((t) => new Date(t.created_at).toDateString() === key).length });
  }
  const maxCnt = Math.max(1, ...days.map((d) => d.cnt));

  const kpis = [
    { label: "Open", value: open, bg: "#f7b7d4" },
    { label: "Pending", value: pending, bg: "#d8c6f7" },
    { label: "Critical", value: critical.length, bg: "#f6a5c0" },
    { label: "Overdue", value: overdue, bg: "#e6b8b0" },
    { label: "Resolved", value: resolutionRate + "%", bg: "#c8e6d6" },
  ];

  const R = 52, C = 2 * Math.PI * R, off = C * (1 - resolutionRate / 100);

  const workload = [{ name: "Arun", pct: 82 }, { name: "Kumar", pct: 64 }, { name: "Priya", pct: 41 }];
  const categories = [{ name: "Payment", pct: 32 }, { name: "Login", pct: 24 }, { name: "Account", pct: 18 }, { name: "Other", pct: 26 }];
  const sampleTag = <Badge variant="muted" className="ml-2 bg-[#f5eef9] text-[10px] text-[#b08ab8]">SAMPLE</Badge>;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3.5">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="mb-2.5 size-2.5 rounded" style={{ background: k.bg }} />
            <div className="text-2xl font-bold text-foreground">{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card className="p-[22px]">
          <h3 className="mb-4 text-[15px] font-semibold text-foreground">Ticket Volume · last 7 days</h3>
          <div className="flex h-[140px] items-end gap-2.5">
            {days.map((d, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <div className="text-[11px] text-[#a0a0a0]">{d.cnt}</div>
                <div className="w-[70%] rounded-t-md sb-brand-gradient" style={{ height: (d.cnt / maxCnt) * 100 + "%", minHeight: 4 }} />
                <div className="text-[11px] text-muted-foreground">{d.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center p-[22px]">
          <h3 className="mb-4 self-start text-[15px] font-semibold text-foreground">Resolution Rate</h3>
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle cx="65" cy="65" r={R} fill="none" stroke="#F1ECF4" strokeWidth="12" />
            <circle cx="65" cy="65" r={R} fill="none" stroke="#F7B7D4" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 65 65)" />
            <text x="65" y="62" textAnchor="middle" fontSize="26" fontWeight="700" fill="#2b2b2b">{resolutionRate}%</text>
            <text x="65" y="82" textAnchor="middle" fontSize="11" fill="#7a7a7a">resolved</text>
          </svg>
        </Card>
      </div>

      <Card className="p-[22px]">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground">Critical / Immediate Attention</h3>
          {onOpenTickets && <button onClick={onOpenTickets} className="text-[13px] font-semibold text-[#b08ab8] cursor-pointer">View all →</button>}
        </div>
        {critical.length === 0 ? (
          <div className="text-sm text-muted-foreground">No critical tickets right now. 🎉</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {critical.map((t) => {
              const ageDays = Math.floor((now.getTime() - new Date(t.created_at).getTime()) / DAY);
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 border-b border-[#f4eef6] py-2.5">
                  <div className="min-w-0"><span className="font-semibold text-foreground">#{t.id}</span><span className="ml-2 text-foreground">{t.subject}</span></div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge className="bg-[#f6a5c0] text-[11px] text-foreground">High</Badge>
                    <span className="text-xs text-[#a0a0a0]">{ageDays === 0 ? "today" : ageDays + "d old"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-[22px]">
          <h3 className="mb-4 flex items-center text-[15px] font-semibold text-foreground">Agent Workload {sampleTag}</h3>
          <div className="flex flex-col gap-3.5">
            {workload.map((w) => (
              <div key={w.name} className="flex items-center gap-3">
                <div className="w-14 text-[13px] text-foreground">{w.name}</div><Bar pct={w.pct} /><div className="w-10 text-right text-[13px] text-muted-foreground">{w.pct}%</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-[22px]">
          <h3 className="mb-4 flex items-center text-[15px] font-semibold text-foreground">Top Issue Categories {sampleTag}</h3>
          <div className="flex flex-col gap-3.5">
            {categories.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="w-[72px] text-[13px] text-foreground">{c.name}</div><Bar pct={c.pct} /><div className="w-10 text-right text-[13px] text-muted-foreground">{c.pct}%</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
