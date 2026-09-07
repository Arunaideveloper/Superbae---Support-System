"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Me, TicketListRow, TicketDetail, SlaStage, AdminUser } from "@/lib/types";
import {
  fetchTickets, fetchTicket, postTicketMessage, patchTicket,
  assignTicket, fetchTicketStats, fetchUsers, adminCreateTicket, UnauthorizedError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PRIO: Record<string, { color: string; label: string }> = {
  critical: { color: "#D9557B", label: "Critical" }, high: { color: "#E8883C", label: "High" },
  medium: { color: "#D9A93C", label: "Medium" }, low: { color: "#8F9BB3", label: "Low" },
};
const STAT: Record<string, { bg: string; fg: string; label: string }> = {
  open: { bg: "#EEF0F4", fg: "#6B7280", label: "Open" },
  in_progress: { bg: "#E8ECFB", fg: "#5B6CB8", label: "In Progress" },
  pending: { bg: "#F3ECEF", fg: "#B07A90", label: "Pending" },
  resolved: { bg: "#E4F3EA", fg: "#3E8E5A", label: "Resolved" },
  closed: { bg: "#ECECEC", fg: "#7A7A7A", label: "Closed" },
};
const SOURCE_LABEL: Record<string, string> = { web: "Web", email: "Email", android_app: "Android App", ios_app: "iOS App", api: "API" };
const ACCENT = "#8A6C92";
const AV = ["#F7B7D4", "#D8C6F7", "#C8E6D6", "#F6C9A5", "#B7D4F7", "#E7B7D4", "#C6D8F7", "#D4E7B7", "#F7D4B7"];

const STATUS_OPTS = ["open", "in_progress", "pending", "resolved", "closed"];
const PRIORITY_OPTS = ["low", "medium", "high", "critical"];
const CATEGORY_OPTS = ["", "Payments", "Login", "Account", "Technical", "Billing", "Other"];
const SUBCAT_OPTS = ["", "Checkout Issue", "Refund", "Password", "Crash", "Delivery", "General"];
const TEAM_OPTS = ["", "Support Tier 1", "Support Tier 2", "Billing Team"];
const PAGE_SIZE = 15;
const NONE = "__none__";

const LEFT_DEFAULT = 340, LEFT_MIN = 260, LEFT_MAX = 560;
const RIGHT_DEFAULT = 300, RIGHT_MIN = 240, RIGHT_MAX = 520;
const clampW = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
function readW(key: string, def: number, min: number, max: number): number {
  try { const v = parseInt(localStorage.getItem(key) || "", 10); return Number.isFinite(v) ? clampW(v, min, max) : def; } catch { return def; }
}

const avatarColor = (id: number | string) => { const s = String(id); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return AV[Math.abs(h) % AV.length]; };
const initials = (name: string) => (name || "?").trim().slice(0, 2).toUpperCase();

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now"; if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}
function fmtDur(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${sec}s`;
}
function fmtSlaTarget(min: number): string {
  if (min >= 60 && min % 60 === 0) return `${min / 60}h SLA`;
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m SLA`;
  return `${min}m SLA`;
}
function slaView(stage: SlaStage, tone: string) {
  const total = stage.target_minutes * 60;
  if (stage.completed_at) return { pct: 100, color: stage.met ? "#3E8E5A" : "#D9557B", left: stage.met ? "Met on time" : "Completed (late)", target: fmtSlaTarget(stage.target_minutes) };
  if (stage.breached) return { pct: 100, color: "#D9557B", left: "Overdue by " + fmtDur(-stage.remaining_seconds), target: fmtSlaTarget(stage.target_minutes) };
  const used = total - stage.remaining_seconds;
  return { pct: Math.max(3, Math.min(100, (used / total) * 100)), color: tone, left: fmtDur(stage.remaining_seconds) + " left", target: fmtSlaTarget(stage.target_minutes) };
}

function Avatar({ name, id, size = 36 }: { name: string; id: number; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-foreground" style={{ width: size, height: size, background: avatarColor(id), fontSize: size * 0.38 }}>{initials(name)}</span>;
}
function withCurrent(opts: string[], val: string) { return val && !opts.includes(val) ? [val, ...opts] : opts; }
function optLabel(field: string, v: string) { if (v === "") return "—"; if (field === "status") return STAT[v]?.label ?? v; if (field === "priority") return PRIO[v]?.label ?? v; return v; }

/** shadcn Select that tolerates "" options (Radix forbids empty value) via a sentinel. */
function PropSelect({ field, value, opts, onChange }: { field: string; value: string; opts: string[]; onChange: (v: string) => void }) {
  return (
    <Select value={value === "" ? NONE : value} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="h-9 rounded-[9px] text-[13px]"><SelectValue /></SelectTrigger>
      <SelectContent>{opts.map((o) => <SelectItem key={o || NONE} value={o === "" ? NONE : o}>{optLabel(field, o)}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-[130px] flex-[1_1_130px]"><div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#a0a0a0]">{label}</div>{children}</div>;
}

function ResizeHandle({ onMouseDown, onDoubleClick }: { onMouseDown: (e: React.MouseEvent) => void; onDoubleClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title="Drag to resize · double-click to reset" className="flex w-[7px] shrink-0 cursor-col-resize justify-center bg-transparent">
      <div style={{ width: hover ? 3 : 1, background: hover ? ACCENT : "#ECE3EC", transition: "width .1s, background .1s" }} />
    </div>
  );
}

export function AdminTickets({ me, query = "", onUnauthorized }: { me: Me; query?: string; onUnauthorized: () => void }) {
  const [tab, setTab] = useState<"all" | "mine" | "unassigned">("all");
  const [sort, setSort] = useState("newest");
  const [rows, setRows] = useState<TicketListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [stats, setStats] = useState<{ all: number; mine: number; unassigned: number } | null>(null);
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [selId, setSelId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [ctab, setCtab] = useState("Conversation");
  const [replyMode, setReplyMode] = useState<"reply" | "note">("reply");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [leftW, setLeftW] = useState(LEFT_DEFAULT);
  const [rightW, setRightW] = useState(RIGHT_DEFAULT);
  useEffect(() => { setLeftW(readW("sb_tickets_leftW", LEFT_DEFAULT, LEFT_MIN, LEFT_MAX)); setRightW(readW("sb_tickets_rightW", RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX)); }, []);
  const dragRef = useRef<{ side: "left" | "right"; startX: number; startW: number } | null>(null);

  const onDrag = useCallback((e: MouseEvent) => {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.startX;
    if (d.side === "left") setLeftW(clampW(d.startW + dx, LEFT_MIN, LEFT_MAX)); else setRightW(clampW(d.startW - dx, RIGHT_MIN, RIGHT_MAX));
  }, []);
  const endDrag = useCallback(() => {
    dragRef.current = null; document.body.style.cursor = ""; document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onDrag); window.removeEventListener("mouseup", endDrag);
  }, [onDrag]);
  const startDrag = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { side, startX: e.clientX, startW: side === "left" ? leftW : rightW };
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onDrag); window.addEventListener("mouseup", endDrag);
  }, [leftW, rightW, onDrag, endDrag]);
  useEffect(() => { try { localStorage.setItem("sb_tickets_leftW", String(leftW)); localStorage.setItem("sb_tickets_rightW", String(rightW)); } catch {} }, [leftW, rightW]);
  useEffect(() => () => { window.removeEventListener("mousemove", onDrag); window.removeEventListener("mouseup", endDrag); }, [onDrag, endDrag]);

  const guard = useCallback((e: unknown) => { if (e instanceof UnauthorizedError) { onUnauthorized(); return true; } return false; }, [onUnauthorized]);

  const loadStats = useCallback(async () => {
    try { const s = await fetchTicketStats(); setStats({ all: s.all, mine: s.mine, unassigned: s.unassigned }); } catch (e) { guard(e); }
  }, [guard]);

  const loadList = useCallback(async () => {
    setListLoading(true); setErr("");
    try {
      const assigned = tab === "mine" ? String((me as any).id ?? "") : tab === "unassigned" ? "unassigned" : undefined;
      const data = await fetchTickets({ assigned, search: query || undefined });
      setRows(data); setPage(1);
      setSelId((prev) => (prev && data.some((r) => r.id === prev) ? prev : data[0]?.id ?? null));
    } catch (e) { if (!guard(e)) setErr("Could not load tickets."); }
    finally { setListLoading(false); }
  }, [tab, query, guard, me]);

  useEffect(() => { const id = setTimeout(loadList, 250); return () => clearTimeout(id); }, [loadList]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { fetchUsers().then((all) => setStaff(all.filter((u) => u.is_staff))).catch(() => {}); }, []);

  useEffect(() => {
    if (selId == null) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true); setCtab("Conversation"); setReply(""); setReplyMode("reply");
    fetchTicket(selId).then((d) => { if (!cancelled) setDetail(d); }).catch((e) => { if (!cancelled && !guard(e)) setErr("Could not load ticket."); }).finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selId, guard]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    if (sort === "oldest") arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    else if (sort === "priority") arr.sort((a, b) => PRIORITY_OPTS.indexOf(b.priority) - PRIORITY_OPTS.indexOf(a.priority));
    else arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return arr;
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((u) => map.set(String((u as any).id), u.username));
    if (detail?.assigned_to) map.set(String((detail.assigned_to as any).id), detail.assigned_to.username);
    return Array.from(map, ([id, username]) => ({ id, username }));
  }, [staff, detail]);

  function syncRow(d: TicketDetail) {
    setRows((rs) => rs.map((r) => r.id === d.id ? { ...r, status: d.status, priority: d.priority, category: d.category, assigned_to: d.assigned_to?.username ?? null } : r));
  }
  async function applyPatch(data: Record<string, unknown>) {
    if (!detail) return;
    try { const updated = await patchTicket(detail.id, data); setDetail(updated); syncRow(updated); loadStats(); } catch (e) { if (!guard(e)) setErr("Could not update ticket."); }
  }
  async function applyAssign(value: string) {
    if (!detail) return;
    const assignee = value === "__unassigned__" ? null : value;
    try { const updated = await assignTicket(detail.id, assignee); setDetail(updated); syncRow(updated); loadStats(); } catch (e) { if (!guard(e)) setErr("Could not assign ticket."); }
  }
  async function send() {
    if (!reply.trim() || !detail) return;
    setSending(true);
    try {
      await postTicketMessage(detail.id, reply.trim(), replyMode === "note");
      setReply(""); const fresh = await fetchTicket(detail.id); setDetail(fresh);
      requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }));
    } catch (e) { if (!guard(e)) setErr("Could not send message."); } finally { setSending(false); }
  }
  function handleCreated(created: TicketDetail) { setNewOpen(false); setTab("all"); setSelId(created.id); loadStats(); }

  const prio = detail ? PRIO[detail.priority] ?? PRIO.medium : PRIO.medium;
  const CTABS = ["Conversation", "Details", "SLA", "History", "Activities", "Attachments", "Related Tickets"];
  const subTab = "border-b-2 pb-3 text-[13.5px] cursor-pointer whitespace-nowrap flex items-center gap-1.5";

  return (
    <div className="flex min-h-0 flex-1 bg-[#f7f4f8]">
      {/* LEFT LIST */}
      <div className="flex min-h-0 shrink-0 flex-col bg-white" style={{ width: leftW }}>
        <div className="flex gap-4.5 border-b border-[#f0e6ec] px-4 pt-3.5">
          {([["mine", "My Tickets", stats?.mine], ["unassigned", "Unassigned", stats?.unassigned], ["all", "All Tickets", stats?.all]] as const).map(([k, label, count]) => {
            const active = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} className={cn(subTab, active ? "border-[#8a6c92] font-bold text-[#8a6c92]" : "border-transparent font-medium text-muted-foreground")}>
                {label}{count != null && <span className={cn("text-[11px] font-bold", active ? "text-[#8a6c92]" : "text-[#a0a0a0]")}>{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 w-auto rounded-[9px] text-[12.5px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="newest">Sort: Newest</SelectItem><SelectItem value="oldest">Sort: Oldest</SelectItem><SelectItem value="priority">Sort: Priority</SelectItem></SelectContent>
          </Select>
          <Button variant="brand" size="sm" onClick={() => setNewOpen(true)}>+ New</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {listLoading ? <div className="p-6 text-center text-[13px] text-muted-foreground">Loading…</div>
          : pageRows.length === 0 ? <div className="p-6 text-center text-[13px] text-muted-foreground">No tickets found.</div>
          : pageRows.map((t) => {
            const active = t.id === selId; const p = PRIO[t.priority] ?? PRIO.medium; const s = STAT[t.status] ?? STAT.open;
            return (
              <div key={t.id} onClick={() => setSelId(t.id)} className={cn("cursor-pointer border-b border-[#f5eff4] px-4 py-3.5", active ? "bg-[#f7f2fa]" : "")} style={{ borderLeft: "3px solid " + (active ? ACCENT : "transparent") }}>
                <div className="flex gap-3">
                  <Avatar name={t.created_by} id={t.id} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2"><span className="text-[12.5px] font-semibold text-[#8a6c92]">#TK-{t.id}</span><span className="whitespace-nowrap text-[11px] text-[#a0a0a0]">{timeAgo(t.created_at)}</span></div>
                    <div className="my-0.5 truncate text-[13.5px] font-semibold text-foreground">{t.subject}</div>
                    <div className="mb-2 text-xs text-muted-foreground">{t.created_by}</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: p.color }}><span className="size-[7px] rounded-full" style={{ background: p.color }} />{p.label}</span>
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-[#f0e6ec] px-4 py-2.5 text-xs text-[#a0a0a0]">
          <span>Showing {pageRows.length} of {sortedRows.length}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button className="flex size-[26px] items-center justify-center rounded-md border border-border bg-white disabled:opacity-40 cursor-pointer" disabled={pageClamped <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="size-3.5" /></button>
              <span className="px-1.5">{pageClamped}/{totalPages}</span>
              <button className="flex size-[26px] items-center justify-center rounded-md border border-border bg-white disabled:opacity-40 cursor-pointer" disabled={pageClamped >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="size-3.5" /></button>
            </div>
          )}
        </div>
      </div>

      <ResizeHandle onMouseDown={(e) => startDrag("left", e)} onDoubleClick={() => setLeftW(LEFT_DEFAULT)} />

      {/* CENTER */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!detail ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">{detailLoading ? "Loading ticket…" : "Select a ticket to view it."}</div>
        ) : (
          <>
            <div className="border-b border-[#f0e6ec] px-6 pt-4.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13px] font-semibold text-muted-foreground">#TK-{detail.id}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: prio.color }}><span className="size-[7px] rounded-full" style={{ background: prio.color }} />{prio.label}</span>
                  </div>
                  <h1 className="my-1 text-[22px] font-semibold text-foreground">{detail.subject}</h1>
                  <div className="text-[13px] text-muted-foreground">{detail.created_by.username}{detail.created_by.email ? ` (${detail.created_by.email})` : ""} · Created {timeAgo(detail.created_at)} · Via {SOURCE_LABEL[detail.source] ?? detail.source}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm">✎ Edit</Button>
                  <Button variant="outline" size="sm">••• More</Button>
                </div>
              </div>

              <div className="mt-4.5 flex flex-wrap gap-3.5">
                <Field label="Status"><PropSelect field="status" value={detail.status} opts={STATUS_OPTS} onChange={(v) => applyPatch({ status: v })} /></Field>
                <Field label="Priority"><PropSelect field="priority" value={detail.priority} opts={PRIORITY_OPTS} onChange={(v) => applyPatch({ priority: v })} /></Field>
                <Field label="Category"><PropSelect field="category" value={detail.category} opts={withCurrent(CATEGORY_OPTS, detail.category)} onChange={(v) => applyPatch({ category: v })} /></Field>
                <Field label="Sub-category"><PropSelect field="subcategory" value={detail.subcategory} opts={withCurrent(SUBCAT_OPTS, detail.subcategory)} onChange={(v) => applyPatch({ subcategory: v })} /></Field>
                <Field label="Assigned To">
                  <Select value={(detail.assigned_to as any)?.id ?? "__unassigned__"} onValueChange={applyAssign}>
                    <SelectTrigger className="h-9 rounded-[9px] text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__unassigned__">Unassigned</SelectItem>{assigneeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.username}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Team"><PropSelect field="team" value={detail.team} opts={withCurrent(TEAM_OPTS, detail.team)} onChange={(v) => applyPatch({ team: v })} /></Field>
              </div>

              {err && <div className="mt-3 text-[13px] text-destructive">{err}</div>}

              <div className="mt-4 flex gap-5.5 overflow-x-auto">
                {CTABS.map((t) => {
                  const active = ctab === t;
                  const count = t === "Attachments" || t === "Related Tickets" ? 0 : t === "Activities" || t === "History" ? detail.events.length : null;
                  return <button key={t} onClick={() => setCtab(t)} className={cn(subTab, active ? "border-[#8a6c92] font-bold text-[#8a6c92]" : "border-transparent font-medium text-muted-foreground")}>{t}{count != null && count > 0 ? ` (${count})` : ""}</button>;
                })}
              </div>
            </div>

            <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto bg-[#faf7fb] px-6 py-5.5">
              {ctab === "Conversation" ? <ConversationView detail={detail} />
              : ctab === "Details" ? <DetailsView detail={detail} />
              : ctab === "SLA" ? <SlaViewPane detail={detail} />
              : ctab === "History" || ctab === "Activities" ? <EventsView detail={detail} />
              : (
                <div className="rounded-2xl border border-[#efe6ee] bg-white p-[44px_20px] text-center text-muted-foreground">
                  <div className="mb-2 text-3xl">🗂️</div>
                  <div className="mb-1 font-semibold text-foreground">No {ctab.toLowerCase()} yet</div>
                  <div className="text-[13px]">This will populate once {ctab.toLowerCase()} are added to the backend.</div>
                </div>
              )}
            </div>

            {ctab === "Conversation" && (
              <div className="border-t border-[#f0e6ec] bg-white px-6 pb-4 pt-3">
                <div className="mb-2.5 flex gap-4.5">
                  {(["reply", "note"] as const).map((m) => {
                    const active = replyMode === m;
                    return <button key={m} onClick={() => setReplyMode(m)} className={cn("border-b-2 pb-1.5 text-[13px] cursor-pointer", active ? "border-[#8a6c92] font-bold text-[#8a6c92]" : "border-transparent font-medium text-muted-foreground")}>{m === "reply" ? "Reply to user" : "Internal note"}</button>;
                  })}
                </div>
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={replyMode === "reply" ? "Type your message..." : "Add an internal note (agents only)..."} className={cn("resize-y", replyMode === "note" && "bg-[#fdf9ec]")} />
                <div className="mt-2.5 flex justify-end">
                  <Button variant="brand" onClick={send} disabled={sending || !reply.trim()}>{sending ? "Sending…" : replyMode === "reply" ? "Send Reply" : "Add Note"}</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ResizeHandle onMouseDown={(e) => startDrag("right", e)} onDoubleClick={() => setRightW(RIGHT_DEFAULT)} />

      {/* RIGHT RAIL */}
      <div className="min-h-0 shrink-0 overflow-y-auto bg-[#fbf9fb] p-4" style={{ width: rightW }}>
        {!detail ? null : (
          <>
            <div className="mb-3.5 rounded-2xl border border-[#efe6ee] bg-white p-4">
              <div className="mb-3.5 flex items-center justify-between"><h3 className="text-[13px] font-bold text-foreground">SLA Timer</h3><span className="text-[11.5px] font-semibold text-[#8a6c92]">View SLA Policy</span></div>
              <SlaBar label="First Response" stage={detail.sla.first_response} tone="#3E8E5A" />
              <div className="h-3.5" />
              <SlaBar label="Resolution" stage={detail.sla.resolution} tone="#5B6CB8" />
            </div>
            <div className="mb-3.5 rounded-2xl border border-[#efe6ee] bg-white p-4">
              <h3 className="mb-3 text-[13px] font-bold text-foreground">Customer Information</h3>
              <div className="mb-3 flex gap-3"><Avatar name={detail.created_by.username} id={detail.id} size={38} /><div className="min-w-0"><div className="text-sm font-semibold text-foreground">{detail.created_by.username}</div><div className="truncate text-xs text-muted-foreground">{detail.created_by.email || "—"}</div></div></div>
              <div className="mt-1 text-[12.5px] font-semibold text-[#8a6c92] cursor-pointer">View full profile →</div>
            </div>
            <div className="mb-3.5 rounded-2xl border border-[#efe6ee] bg-white p-4">
              <h3 className="mb-3 text-[13px] font-bold text-foreground">Ticket Properties</h3>
              <PropRow k="Source" v={SOURCE_LABEL[detail.source] ?? detail.source} />
              <PropRow k="Created At" v={fmtDateTime(detail.created_at)} />
              <PropRow k="Last Updated" v={fmtDateTime(detail.updated_at)} />
              <PropRow k="Assigned" v={detail.assigned_to?.username ?? "Unassigned"} />
              <div className="mt-2.5">
                <div className="mb-1.5 text-xs text-[#a0a0a0]">Tags</div>
                {detail.tags.length ? <div className="flex flex-wrap gap-1.5">{detail.tags.map((tg) => <span key={tg} className="rounded-md bg-[#f1ecf4] px-2 py-0.5 text-[11.5px] text-[#7a6c82]">{tg}</span>)}</div> : <div className="text-[12.5px] text-[#a0a0a0]">No tags</div>}
              </div>
            </div>
            <div className="mb-3.5 rounded-2xl border border-[#efe6ee] bg-white p-4">
              <h3 className="mb-3 text-[13px] font-bold text-foreground">Quick Actions</h3>
              <div className="mb-2 flex gap-2"><Button variant="outline" size="sm" className="flex-1">⇄ Transfer</Button><Button variant="outline" size="sm" className="flex-1">⌥ Merge</Button></div>
              <Button variant="outline" onClick={() => applyPatch({ status: "closed" })} disabled={detail.status === "closed"} className="w-full border-[#f0c3d2] text-destructive">⊘ {detail.status === "closed" ? "Ticket Closed" : "Close Ticket"}</Button>
            </div>
          </>
        )}
      </div>
      {newOpen && <NewTicketModal onClose={() => setNewOpen(false)} onCreated={handleCreated} onUnauthorized={onUnauthorized} />}
    </div>
  );
}

function NewTicketModal({ onClose, onCreated, onUnauthorized }: { onClose: () => void; onCreated: (t: TicketDetail) => void; onUnauthorized: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [requester, setRequester] = useState("__self__");
  const [customers, setCustomers] = useState<AdminUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { fetchUsers("customer").then(setCustomers).catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) { setErr("Subject is required."); return; }
    setSaving(true); setErr("");
    try {
      const t = await adminCreateTicket({ subject: subject.trim(), description: description.trim(), priority, requester: requester === "__self__" ? undefined : requester });
      onCreated(t);
    } catch (e2) { if (e2 instanceof UnauthorizedError) { onUnauthorized(); return; } setErr(e2 instanceof Error ? e2.message : "Could not create ticket."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader><DialogTitle>New Ticket</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2"><Label htmlFor="t-subject">Subject</Label><Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of the issue" autoFocus /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="t-desc">Description</Label><Textarea id="t-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue..." className="resize-y" /></div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2"><Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITY_OPTS.map((p) => <SelectItem key={p} value={p}>{PRIO[p].label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex flex-1 flex-col gap-2"><Label>Requester</Label>
              <Select value={requester} onValueChange={setRequester}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__self__">Myself (agent)</SelectItem>{customers.map((c) => <SelectItem key={String(c.id)} value={c.username}>{c.username}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          {err && <p className="text-[13px] text-destructive">{err}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" disabled={saving}>{saving ? "Creating…" : "Create ticket"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConversationView({ detail }: { detail: TicketDetail }) {
  if (detail.messages.length === 0) return <div className="rounded-2xl border border-[#efe6ee] bg-white p-[40px_20px] text-center text-muted-foreground">No messages yet. Start the conversation below.</div>;
  return (
    <>
      {detail.messages.map((m) => {
        if (m.is_internal) {
          return (
            <div key={m.id} className="mb-4 rounded-xl border border-[#f2e6c2] bg-[#fdf6e3] p-[14px_16px]">
              <div className="mb-1.5 flex items-center gap-2"><span className="text-[13px] font-bold text-[#9a7b2e]">📝 Internal Note</span><span className="text-xs text-[#a0a0a0]">{m.author} · {timeAgo(m.created_at)}</span></div>
              <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#6b5a2e]">{m.body}</div>
              <div className="mt-2 text-[11.5px] text-[#b7a567]">Visible to agents only</div>
            </div>
          );
        }
        const isAgent = m.author !== detail.created_by.username;
        return (
          <div key={m.id} className={cn("mb-4.5 flex gap-3", isAgent ? "flex-row-reverse" : "flex-row")}>
            <Avatar name={m.author} id={detail.id + (isAgent ? 7 : 0)} size={36} />
            <div className="max-w-[78%]">
              <div className={cn("mb-1.5 flex items-center gap-2", isAgent ? "justify-end" : "justify-start")}>
                <span className="text-[13px] font-semibold text-foreground">{m.author}</span>
                <span className="text-[11.5px] text-[#a0a0a0]">({isAgent ? "Agent" : "User"})</span>
                <span className="text-[11.5px] text-[#a0a0a0]">{timeAgo(m.created_at)}</span>
              </div>
              <div className={cn("whitespace-pre-wrap rounded-2xl border px-3.5 py-3 text-[13.5px] leading-relaxed text-foreground", isAgent ? "border-[#cde8d8] bg-[#e4f3ea]" : "border-[#efe6ee] bg-white")}>{m.body}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function DetailsView({ detail }: { detail: TicketDetail }) {
  return (
    <div className="rounded-2xl border border-[#efe6ee] bg-white p-4">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#b4aeba]">Description</div>
      <div className={cn("mb-5 whitespace-pre-wrap text-sm leading-relaxed", detail.description ? "text-foreground" : "text-[#a0a0a0]")}>{detail.description || "No description provided."}</div>
      <div className="grid grid-cols-2 gap-3.5">
        <PropRow k="Category" v={detail.category || "—"} /><PropRow k="Sub-category" v={detail.subcategory || "—"} />
        <PropRow k="Team" v={detail.team || "—"} /><PropRow k="Source" v={SOURCE_LABEL[detail.source] ?? detail.source} />
        <PropRow k="First response" v={fmtDateTime(detail.first_response_at)} /><PropRow k="Resolved" v={fmtDateTime(detail.resolved_at)} />
      </div>
    </div>
  );
}
function SlaViewPane({ detail }: { detail: TicketDetail }) {
  return (
    <div className="rounded-2xl border border-[#efe6ee] bg-white p-4">
      <h3 className="mb-3 text-[13px] font-bold text-foreground">Service Level Agreement</h3>
      <SlaBar label="First Response" stage={detail.sla.first_response} tone="#3E8E5A" />
      <div className="h-4.5" />
      <SlaBar label="Resolution" stage={detail.sla.resolution} tone="#5B6CB8" />
    </div>
  );
}
function EventsView({ detail }: { detail: TicketDetail }) {
  if (detail.events.length === 0) return <div className="rounded-2xl border border-[#efe6ee] bg-white p-[40px_20px] text-center text-muted-foreground">No activity recorded yet.</div>;
  return (
    <div className="rounded-2xl border border-[#efe6ee] bg-white p-4">
      {detail.events.map((ev) => (
        <div key={ev.id} className="flex gap-3 border-b border-[#f4eef6] py-2.5">
          <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: ACCENT }} />
          <div className="flex-1"><div className="text-[13.5px] text-foreground">{ev.detail || ev.type}</div><div className="mt-0.5 text-[11.5px] text-[#a0a0a0]">{ev.actor || "system"} · {timeAgo(ev.created_at)}</div></div>
        </div>
      ))}
    </div>
  );
}
function SlaBar({ label, stage, tone }: { label: string; stage: SlaStage; tone: string }) {
  const v = slaView(stage, tone);
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[12.5px]"><span className="font-semibold text-foreground">{label}</span><span className="text-[#a0a0a0]">{v.target}</span></div>
      <div className="h-[7px] overflow-hidden rounded-full bg-[#efe9f0]"><div className="h-full rounded-full" style={{ width: v.pct + "%", background: v.color }} /></div>
      <div className="mt-1 text-right text-[11.5px]" style={{ color: v.color }}>{v.left}</div>
    </div>
  );
}
function PropRow({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2.5 py-1 text-[12.5px]"><span className="text-[#a0a0a0]">{k}</span><span className="break-words text-right font-medium text-foreground">{v}</span></div>;
}
