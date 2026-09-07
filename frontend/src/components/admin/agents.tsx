"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchTeamStats, fetchTickets, UnauthorizedError } from "@/lib/api";
import type { AdminUser, TicketListRow } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { initials, avColor } from "@/lib/theme";
import { cn } from "@/lib/utils";

const TERMINAL = ["resolved", "closed"];

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-foreground" style={{ width: size, height: size, background: avColor(name), fontSize: size * 0.38 }}>{initials(name)}</span>;
}

interface Row { user: AdminUser; assigned: number; resolved: number; }

export function Agents({ query = "" }: { query?: string }) {
  const [agents, setAgents] = useState<AdminUser[]>([]);
  const [tickets, setTickets] = useState<TicketListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr("");
    Promise.all([fetchTeamStats(), fetchTickets({})])
      .then(([ts, rows]) => { if (cancelled) return; setAgents(ts.agents); setTickets(rows); })
      .catch((e) => { if (!cancelled) setErr(e instanceof UnauthorizedError ? "Session expired — please sign in again." : "Could not load agents."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const byAgent = useMemo(() => {
    const open = new Map<string, number>(); const resolved = new Map<string, number>();
    for (const t of tickets) { if (!t.assigned_to) continue; const m = TERMINAL.includes(t.status) ? resolved : open; m.set(t.assigned_to, (m.get(t.assigned_to) || 0) + 1); }
    return { open, resolved };
  }, [tickets]);

  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents
      .filter((u) => filter === "all" || (filter === "active" ? u.is_active : !u.is_active))
      .filter((u) => !q || u.username.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q))
      .map((u) => ({ user: u, assigned: byAgent.open.get(u.username) || 0, resolved: byAgent.resolved.get(u.username) || 0 }));
  }, [agents, byAgent, filter, query]);

  const maxAssigned = Math.max(1, ...rows.map((r) => r.assigned));
  const openTotal = tickets.filter((t) => !TERMINAL.includes(t.status)).length;
  const unassignedOpen = tickets.filter((t) => !TERMINAL.includes(t.status) && !t.assigned_to).length;
  const resolvedTotal = tickets.filter((t) => TERMINAL.includes(t.status)).length;

  const kpis = [
    { label: "Agents", value: String(agents.length), bg: "#d8c6f7" },
    { label: "Open Tickets", value: String(openTotal), bg: "#c8e6d6" },
    { label: "Unassigned", value: String(unassignedOpen), bg: "#f7b7d4" },
    { label: "Resolved", value: String(resolvedTotal), bg: "#c8e6d6" },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f4f8] px-6 pb-10 pt-[22px]">
      <div className="mb-4.5">
        <h2 className="mb-0.5 text-lg font-semibold text-foreground">Agents</h2>
        <p className="text-[13.5px] text-muted-foreground">Your support team and their live ticket workload.</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-3.5">
        {kpis.map((k) => (
          <Card key={k.label} className="min-w-[160px] flex-[1_0_160px] rounded-2xl border border-[#efe6ee] p-[16px_18px] shadow-none">
            <div className="mb-2.5 size-2.5 rounded" style={{ background: k.bg }} />
            <div className="text-2xl font-bold text-foreground">{loading ? "…" : k.value}</div>
            <div className="text-[12.5px] text-muted-foreground">{k.label}</div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "active", "blocked"] as const).map((f) => {
          const active = filter === f;
          return <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3.5 py-2 text-[13px] capitalize cursor-pointer", active ? "sb-brand-gradient border-transparent font-semibold" : "border-border bg-white font-medium")}>{f}</button>;
        })}
      </div>

      {err && <Card className="mb-4 border border-[#efe6ee] p-4 text-[13.5px] text-destructive shadow-none">{err}</Card>}

      <Card className="overflow-x-auto rounded-2xl border border-[#efe6ee] shadow-none">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Agent", "Role", "Open Workload", "Resolved", "Last Login", "Status"].map((h) => <TableHead key={h} className="px-4 py-3.5">{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="py-7 text-center text-[13px] text-muted-foreground">Loading agents…</TableCell></TableRow>
            ) : rows.map((r) => {
              const load = Math.round((r.assigned / maxAssigned) * 100);
              const loadColor = r.assigned >= 10 ? "#d9557b" : r.assigned >= 5 ? "#d9a93c" : "#3e8e5a";
              return (
                <TableRow key={String(r.user.id)} className="hover:bg-transparent">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3"><Avatar name={r.user.username} /><div><div className="text-[13.5px] font-semibold text-foreground">{r.user.username}</div><div className="text-xs text-[#a0a0a0]">{r.user.email || "—"}</div></div></div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-[13px] capitalize text-foreground whitespace-nowrap">{r.user.role}</TableCell>
                  <TableCell className="min-w-[160px] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-[7px] min-w-[70px] flex-1 overflow-hidden rounded-full bg-[#f1ecf4]"><div className="h-full" style={{ width: load + "%", background: loadColor }} /></div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{r.assigned} open</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-[13.5px] text-foreground">{r.resolved}</TableCell>
                  <TableCell className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{r.user.last_login ? new Date(r.user.last_login).toLocaleDateString() : "Never"}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><span className="size-2 rounded-full" style={{ background: r.user.is_active ? "#3e8e5a" : "#b4aeba" }} />{r.user.is_active ? "Active" : "Blocked"}</span>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && rows.length === 0 && !err && <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="py-7 text-center text-[13px] text-muted-foreground">No agents match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <div className="mt-3 text-xs text-[#a0a0a0]">Workload is live from the ticket list. CSAT and real-time presence aren&rsquo;t tracked by the backend.</div>
    </div>
  );
}
