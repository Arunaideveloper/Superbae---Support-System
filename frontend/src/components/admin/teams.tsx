"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchTeamStats, UnauthorizedError } from "@/lib/api";
import type { AdminUser, TeamStat } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { initials, avColor } from "@/lib/theme";

const DESC: Record<string, string> = {
  "Your Closet": "Closet uploads, syncing and photos.",
  "Outfits & Ara": "Styling, outfit suggestions and the Ara assistant.",
  "Account & Billing": "Login, profiles, subscriptions and payments.",
  "Troubleshooting": "App crashes, bugs and technical issues.",
};

export function Teams({ query = "" }: { query?: string }) {
  const [teams, setTeams] = useState<TeamStat[]>([]);
  const [agents, setAgents] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr("");
    fetchTeamStats()
      .then((ts) => { if (!cancelled) { setTeams(ts.teams); setAgents(ts.agents); } })
      .catch((e) => { if (!cancelled) setErr(e instanceof UnauthorizedError ? "Session expired — please sign in again." : "Could not load teams."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => teams.filter((t) => !q || t.label.toLowerCase().includes(q) || t.key.toLowerCase().includes(q)), [teams, q]);
  const maxOpen = Math.max(1, ...teams.map((t) => t.open_tickets));
  const totalOpen = teams.reduce((a, t) => a + t.open_tickets, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f4f8] px-6 pb-10 pt-[22px]">
      <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="mb-0.5 text-lg font-semibold text-foreground">Teams</h2>
          <p className="text-[13.5px] text-muted-foreground">Support areas and their live open-ticket volume.</p>
        </div>
      </div>

      <div className="mb-[22px] flex flex-wrap gap-3.5">
        {[{ label: "Teams", value: String(teams.length), bg: "#d8c6f7" }, { label: "Agents", value: String(agents.length), bg: "#f7b7d4" }, { label: "Open Tickets", value: String(totalOpen), bg: "#c8e6d6" }].map((k) => (
          <Card key={k.label} className="min-w-[170px] flex-[1_0_170px] rounded-2xl border border-[#efe6ee] p-[16px_18px] shadow-none">
            <div className="mb-2.5 size-2.5 rounded" style={{ background: k.bg }} />
            <div className="text-2xl font-bold text-foreground">{loading ? "…" : k.value}</div>
            <div className="text-[12.5px] text-muted-foreground">{k.label}</div>
          </Card>
        ))}
      </div>

      {err && <Card className="mb-4 border border-[#efe6ee] p-4 text-[13.5px] text-destructive shadow-none">{err}</Card>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {loading ? (
          <Card className="border border-[#efe6ee] p-[18px] text-[13px] text-muted-foreground shadow-none">Loading teams…</Card>
        ) : shown.map((t) => {
          const pct = Math.round((t.open_tickets / maxOpen) * 100);
          return (
            <Card key={t.key} className="rounded-2xl border border-[#efe6ee] p-[18px] shadow-none">
              <div className="text-base font-semibold text-foreground">{t.label}</div>
              <div className="mt-1 min-h-[34px] text-[12.5px] leading-relaxed text-muted-foreground">{DESC[t.key] || `Handles “${t.key}” tickets.`}</div>
              <div className="mb-1.5 mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold leading-none text-foreground">{t.open_tickets}</span>
                <span className="text-[12.5px] text-muted-foreground">open tickets</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full bg-[#f1ecf4]"><div className="h-full sb-brand-gradient" style={{ width: pct + "%" }} /></div>
              <div className="mt-3.5 flex items-center justify-between border-t border-[#f4eef6] pt-3.5">
                <span className="rounded-full bg-[#f5eef9] px-2.5 py-1 text-xs text-[#a0a0a0]">Category · {t.key}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {!loading && agents.length > 0 && (
        <Card className="mt-5 rounded-2xl border border-[#efe6ee] p-[18px] shadow-none">
          <div className="mb-3.5 text-sm font-bold text-foreground">Support Agents ({agents.length})</div>
          <div className="flex flex-wrap gap-3">
            {agents.map((a) => (
              <div key={String(a.id)} className="flex min-w-[200px] items-center gap-2.5 rounded-xl border border-[#f0e6ec] px-3 py-2">
                <span className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-foreground" style={{ background: avColor(a.username) }}>{initials(a.username)}</span>
                <div><div className="text-[13px] font-semibold text-foreground">{a.username}</div><div className="text-xs text-[#a0a0a0]">{a.email || "—"}</div></div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="mt-3 text-xs text-[#a0a0a0]">Open-ticket volume is live per support area. Per-team membership and SLA aren&rsquo;t modelled in the backend yet.</div>
    </div>
  );
}
