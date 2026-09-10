"use client";
import { useEffect, useMemo, useState } from "react";
import { listFraudAssessments, analyzeFraud, updateFraudAssessment, UnauthorizedError } from "@/lib/api";
import type { FraudAssessment, FraudStatus } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const RISK_COLOR: Record<string, { bg: string; fg: string }> = {
  high: { bg: "#FBE3EA", fg: "#B23A5E" },
  medium: { bg: "#FBEEDD", fg: "#B26B23" },
  low: { bg: "#E4F3EA", fg: "#2E7D4F" },
};
const STATUS_LABEL: Record<FraudStatus, string> = {
  flagged: "Flagged", under_review: "Under review", confirmed: "Confirmed", dismissed: "Dismissed",
};
const STATUSES: FraudStatus[] = ["flagged", "under_review", "confirmed", "dismissed"];

function RiskBadge({ level, score }: { level: string; score: number }) {
  const c = RISK_COLOR[level] ?? RISK_COLOR.low;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: c.bg, color: c.fg }}>
      {level.toUpperCase()} · {Math.round(score)}
    </span>
  );
}

const inputCls = "rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-[#d8c6f7] focus:ring-[3px] focus:ring-ring/30";

/** Blank activity form. Only activity_id is required; everything else feeds a signal analyzer. */
const EMPTY_FORM = {
  activity_id: "", activity_type: "referral", referrer_id: "", clicks: "", conversions: "",
  conversion_status: "", device_type: "", country: "", transaction_amount: "",
};

export function Fraud() {
  const [rows, setRows] = useState<FraudAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<FraudAssessment | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [running, setRunning] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [notes, setNotes] = useState("");
  const [savingStatus, setSavingStatus] = useState<FraudStatus | "">("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const data = await listFraudAssessments(statusFilter ? { status: statusFilter } : {});
      setRows(data.assessments);
    } catch (e) {
      if (e instanceof UnauthorizedError) { setErr("Session expired. Please sign in again."); return; }
      setErr("Couldn't load fraud assessments. Is the AI layer running?");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const r of rows) c[r.risk_level] = (c[r.risk_level] ?? 0) + 1;
    return c;
  }, [rows]);

  function openDetail(a: FraudAssessment) { setSelected(a); setNotes(a.review_notes ?? ""); }

  async function runAnalysis() {
    if (!form.activity_id.trim()) { setFormErr("Activity ID is required."); return; }
    setRunning(true); setFormErr("");
    try {
      const payload: Record<string, unknown> = { activity_id: form.activity_id.trim(), activity_type: form.activity_type.trim() || "referral" };
      if (form.referrer_id.trim()) payload.referrer_id = form.referrer_id.trim();
      if (form.conversion_status.trim()) payload.conversion_status = form.conversion_status.trim();
      if (form.device_type.trim()) payload.device_type = form.device_type.trim();
      if (form.country.trim()) payload.country = form.country.trim();
      if (form.clicks !== "") payload.clicks = Number(form.clicks);
      if (form.conversions !== "") payload.conversions = Number(form.conversions);
      if (form.transaction_amount !== "") payload.transaction_amount = Number(form.transaction_amount);
      const result = await analyzeFraud(payload);
      setShowForm(false); setForm({ ...EMPTY_FORM });
      await load();
      openDetail(result);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Analysis failed.");
    } finally { setRunning(false); }
  }

  async function setStatus(next: FraudStatus) {
    if (!selected) return;
    setSavingStatus(next);
    try {
      const updated = await updateFraudAssessment(selected.id, { investigation_status: next, review_notes: notes });
      setSelected(updated);
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      setErr("Could not update the assessment.");
    } finally { setSavingStatus(""); }
  }

  return (
    <div className="space-y-5">
      {/* summary + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <SummaryChip label="High risk" value={counts.high} c={RISK_COLOR.high} />
        <SummaryChip label="Medium" value={counts.medium} c={RISK_COLOR.medium} />
        <SummaryChip label="Low" value={counts.low} c={RISK_COLOR.low} />
        <div className="ml-auto flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <Button variant="brand" size="sm" onClick={() => { setShowForm((v) => !v); setFormErr(""); }}>
            {showForm ? "Close" : "Analyze activity"}
          </Button>
        </div>
      </div>

      {/* analyze form */}
      {showForm && (
        <Card className="p-4">
          <h3 className="mb-3 text-[14px] font-semibold text-foreground">Analyze an activity</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Activity ID *"><input className={inputCls} value={form.activity_id} onChange={(e) => setForm({ ...form, activity_id: e.target.value })} placeholder="act_1024" /></Field>
            <Field label="Type"><input className={inputCls} value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value })} placeholder="referral" /></Field>
            <Field label="Referrer ID"><input className={inputCls} value={form.referrer_id} onChange={(e) => setForm({ ...form, referrer_id: e.target.value })} placeholder="user_88" /></Field>
            <Field label="Conversion status"><input className={inputCls} value={form.conversion_status} onChange={(e) => setForm({ ...form, conversion_status: e.target.value })} placeholder="completed" /></Field>
            <Field label="Clicks"><input className={inputCls} type="number" value={form.clicks} onChange={(e) => setForm({ ...form, clicks: e.target.value })} placeholder="120" /></Field>
            <Field label="Conversions"><input className={inputCls} type="number" value={form.conversions} onChange={(e) => setForm({ ...form, conversions: e.target.value })} placeholder="119" /></Field>
            <Field label="Device"><input className={inputCls} value={form.device_type} onChange={(e) => setForm({ ...form, device_type: e.target.value })} placeholder="mobile" /></Field>
            <Field label="Country"><input className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="IN" /></Field>
            <Field label="Txn amount"><input className={inputCls} type="number" value={form.transaction_amount} onChange={(e) => setForm({ ...form, transaction_amount: e.target.value })} placeholder="4999" /></Field>
          </div>
          {formErr && <p className="mt-2 text-[12.5px] text-destructive">{formErr}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="brand" size="sm" onClick={runAnalysis} disabled={running}>{running ? "Analyzing…" : "Run analysis"}</Button>
          </div>
        </Card>
      )}

      {err && <Card className="p-4 text-[13.5px] text-foreground">{err}</Card>}

      {/* table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Analyzed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell className="text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell className="text-muted-foreground">No assessments yet. Use “Analyze activity” to create one.</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} onClick={() => openDetail(r)} className={cn("cursor-pointer", selected?.id === r.id && "bg-[#faf6fd]")}>
                  <TableCell className="font-medium text-foreground">{r.activity_id}</TableCell>
                  <TableCell className="text-muted-foreground">{r.activity_type}</TableCell>
                  <TableCell><RiskBadge level={r.risk_level} score={r.risk_score} /></TableCell>
                  <TableCell className="text-muted-foreground">{STATUS_LABEL[r.investigation_status]}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.analysis_date).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* detail */}
      {selected && (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-foreground">{selected.activity_id}</h3>
                <RiskBadge level={selected.risk_level} score={selected.risk_score} />
              </div>
              <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{selected.explanation}</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Method: {selected.analysis_method} · Confidence: {Math.round(selected.confidence * 100)}% · Signals used: {selected.signals_used.join(", ") || "—"}
                {selected.signals_unavailable.length ? ` · Missing: ${selected.signals_unavailable.join(", ")}` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Close</Button>
          </div>

          <div className="mt-4">
            <h4 className="mb-2 text-[13px] font-semibold text-foreground">Signals</h4>
            <div className="space-y-2">
              {selected.indicators.map((s) => (
                <div key={s.signal_name} className="rounded-lg border border-[#f0e6ec] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-foreground">
                      {s.signal_name}{" "}
                      <span className={cn("ml-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold", s.triggered ? "bg-[#FBE3EA] text-[#B23A5E]" : "bg-[#E4F3EA] text-[#2E7D4F]")}>
                        {s.triggered ? "TRIGGERED" : "clear"}
                      </span>
                    </span>
                    <span className="text-[12px] text-muted-foreground">+{Math.round(s.risk_contribution)} risk</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{s.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="fraud-notes">Review notes</Label>
            <Textarea id="fraud-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add investigation notes…" className="mt-1" />
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map((st) => (
                <Button key={st} size="sm" variant={selected.investigation_status === st ? "brand" : "outline"} disabled={savingStatus === st} onClick={() => setStatus(st)}>
                  {savingStatus === st ? "Saving…" : STATUS_LABEL[st]}
                </Button>
              ))}
            </div>
            {selected.reviewed_by && (
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                Last reviewed by {selected.reviewed_by}{selected.reviewed_at ? ` · ${new Date(selected.reviewed_at).toLocaleString()}` : ""}
              </p>
            )}
          </div>
        </Card>
      )}

      <p className="text-[11.5px] text-muted-foreground">
        Assessments persist to MongoDB (the fraud_assessments collection) and survive restarts. Detection thresholds and signal weights are tunable via FRAUD_* environment variables in the AI layer.
      </p>
    </div>
  );
}

function SummaryChip({ label, value, c }: { label: string; value: number; c: { bg: string; fg: string } }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#f0e6ec] px-3 py-2">
      <span className="rounded-md px-2 py-0.5 text-[13px] font-bold" style={{ background: c.bg, color: c.fg }}>{value}</span>
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>{children}</div>;
}
