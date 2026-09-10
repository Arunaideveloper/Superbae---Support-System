"use client";
import { useEffect, useState } from "react";
import { fetchAiUsageSummary, fetchAiUsageBreakdown, UnauthorizedError } from "@/lib/api";
import type { UsageSummary, UsageBreakdown } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const ACCENT = "#b9a3e3";

function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
function fmtCost(c: number | null, currency: string): string {
  if (c == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 4 }).format(c);
}
function successRate(s: { total_requests: number; successful_requests: number }): number {
  return s.total_requests ? Math.round((s.successful_requests / s.total_requests) * 1000) / 10 : 0;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[12.5px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      {sub ? <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div> : null}
    </Card>
  );
}

function BreakdownCard({ title, rows, label }: { title: string; rows: UsageBreakdown[]; label: string }) {
  const maxReq = Math.max(1, ...rows.map((r) => r.total_requests));
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[#f0e6ec] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-[13px] text-muted-foreground">No data yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{label}</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Success</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Est. cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.group}>
                  <TableCell>
                    <div className="font-medium text-foreground">{r.group || "—"}</div>
                    <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-[#efeaf0]">
                      <div className="h-full rounded-full" style={{ width: `${(r.total_requests / maxReq) * 100}%`, background: ACCENT }} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(r.total_requests)}</TableCell>
                  <TableCell className="text-right tabular-nums">{successRate(r)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(r.known_total_tokens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCost(r.estimated_cost, r.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

export function Analytics() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [byProvider, setByProvider] = useState<UsageBreakdown[]>([]);
  const [byModel, setByModel] = useState<UsageBreakdown[]>([]);
  const [byFeature, setByFeature] = useState<UsageBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [s, p, m, f] = await Promise.all([
          fetchAiUsageSummary(),
          fetchAiUsageBreakdown("provider"),
          fetchAiUsageBreakdown("model"),
          fetchAiUsageBreakdown("feature"),
        ]);
        if (cancelled) return;
        setSummary(s); setByProvider(p); setByModel(m); setByFeature(f);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof UnauthorizedError) { setErr("Your session expired. Please sign in again."); return; }
        setErr("Couldn't load AI analytics. Is the AI layer running?");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="text-[13.5px] text-muted-foreground">Loading AI analytics…</div>;
  }
  if (err) {
    return <Card className="p-5 text-[13.5px] text-foreground">{err}</Card>;
  }
  if (!summary || summary.total_requests === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="text-[15px] font-semibold text-foreground">No AI usage recorded yet</div>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
          Chat with Ara (the assistant widget) to generate usage. Every question Ara answers is recorded here — requests, tokens, success rate, and cost.
        </p>
      </Card>
    );
  }

  const costConfigured = summary.estimated_cost != null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total requests" value={fmtNum(summary.total_requests)} sub={`${fmtNum(summary.successful_requests)} ok · ${fmtNum(summary.failed_requests)} failed`} />
        <Kpi label="Success rate" value={`${successRate(summary)}%`} />
        <Kpi label="Total tokens" value={fmtNum(summary.known_total_tokens)} sub={`${fmtNum(summary.requests_with_token_usage)} reqs reported usage`} />
        <Kpi label="Est. cost" value={fmtCost(summary.estimated_cost, summary.currency)} sub={costConfigured ? `${fmtNum(summary.requests_with_estimated_cost)} priced reqs` : "pricing not configured"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownCard title="By provider" rows={byProvider} label="Provider" />
        <BreakdownCard title="By model" rows={byModel} label="Model" />
      </div>
      <BreakdownCard title="By feature" rows={byFeature} label="Feature" />

      <p className="text-[11.5px] text-muted-foreground">
        Usage is recorded on every Ara answer and persisted to MongoDB. Costs appear once a pricing catalog is configured in the AI layer.
      </p>
    </div>
  );
}
