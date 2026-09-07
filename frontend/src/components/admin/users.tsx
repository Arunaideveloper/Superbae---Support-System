"use client";
import { useEffect, useMemo, useState } from "react";
import type { AdminUser } from "@/lib/types";
import { fetchUsers, createUser, updateUser, UnauthorizedError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const AV = ["#F7B7D4", "#D8C6F7", "#C8E6D6", "#F6C9A5", "#B7D4F7", "#E7B7D4", "#C6D8F7", "#D4E7B7"];
const initials = (n: string) => (n || "?").trim().slice(0, 2).toUpperCase();
const hash = (id: number | string) => { const s = String(id); let a = 0; for (const c of s) a += c.charCodeAt(0); return a; };
const avColor = (id: number | string) => AV[Math.abs(hash(id)) % AV.length];

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return fmtDate(iso);
}
function Avatar({ name, id, size = 34 }: { name: string; id: number | string; size?: number }) {
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-foreground" style={{ width: size, height: size, background: avColor(id), fontSize: size * 0.38 }}>{initials(name)}</span>;
}
function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: bg, color: fg }}>{text}</span>;
}
const statusStyle = (active: boolean) => active ? { bg: "#E4F3EA", fg: "#3E8E5A", label: "Active" } : { bg: "#FADBD9", fg: "#C0453C", label: "Blocked" };

export function Users({ query = "", onUnauthorized }: { query?: string; onUnauthorized: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [selId, setSelId] = useState<number | string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  function guard(e: unknown): boolean { if (e instanceof UnauthorizedError) { onUnauthorized(); return true; } return false; }

  async function load() {
    setLoading(true); setError("");
    try { setUsers(await fetchUsers("customer")); }
    catch (e) { if (!guard(e)) setError("Could not load users."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const kpis = useMemo(() => {
    const monthAgo = Date.now() - 30 * 86400000;
    return [
      { label: "Total Users", value: String(users.length), bg: "#f7b7d4" },
      { label: "Active", value: String(users.filter((u) => u.is_active).length), bg: "#c8e6d6" },
      { label: "New (30d)", value: String(users.filter((u) => new Date(u.date_joined).getTime() > monthAgo).length), bg: "#d8c6f7" },
      { label: "Blocked", value: String(users.filter((u) => !u.is_active).length), bg: "#f3cbd5" },
    ];
  }, [users]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const byFilter = filter === "all" || (filter === "active" && u.is_active) || (filter === "blocked" && !u.is_active);
      const byQ = !q || u.username.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
      return byFilter && byQ;
    });
  }, [users, filter, query]);

  const sel = selId != null ? users.find((u) => u.id === selId) ?? null : null;

  async function toggleBlock(u: AdminUser) {
    try {
      const updated = await updateUser(u.id, { is_active: !u.is_active });
      setUsers((us) => us.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) { if (!guard(e)) setError("Could not update user."); }
  }

  return (
    <div className="flex min-h-0 flex-1 bg-[#f7f4f8]">
      <div className="min-w-0 flex-1 overflow-y-auto px-6 pb-10 pt-[22px]">
        <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-0.5 text-lg font-semibold text-foreground">Users</h2>
            <p className="text-[13.5px] text-muted-foreground">Everyone who has raised a ticket with Superbae.</p>
          </div>
          <Button variant="brand" size="sm" onClick={() => setShowAdd(true)}>+ Add User</Button>
        </div>

        <div className="mb-5 flex flex-wrap gap-3.5">
          {kpis.map((k) => (
            <Card key={k.label} className="min-w-[150px] flex-[1_0_150px] rounded-2xl border border-[#efe6ee] p-[16px_18px] shadow-none">
              <div className="mb-2.5 size-2.5 rounded" style={{ background: k.bg }} />
              <div className="text-2xl font-bold text-foreground">{k.value}</div>
              <div className="text-[12.5px] text-muted-foreground">{k.label}</div>
            </Card>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {["all", "active", "blocked"].map((f) => {
            const active = filter === f;
            return <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3.5 py-2 text-[13px] capitalize cursor-pointer", active ? "sb-brand-gradient border-transparent font-semibold" : "border-border bg-white font-medium")}>{f}</button>;
          })}
        </div>

        {error && <p className="mb-3.5 text-destructive">{error}</p>}

        <Card className="overflow-x-auto rounded-2xl border border-[#efe6ee] shadow-none">
          <Table className="min-w-[700px]">
            <TableHeader><TableRow className="hover:bg-transparent">{["User", "Tickets", "Status", "Joined", "Last Active", ""].map((h, i) => <TableHead key={i} className="px-4 py-3.5">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="py-7 text-center text-[13px] text-muted-foreground">Loading users…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="py-7 text-center text-[13px] text-muted-foreground">{users.length === 0 ? "No users yet. Add one to get started." : "No users match."}</TableCell></TableRow>
              ) : rows.map((u) => {
                const s = statusStyle(u.is_active); const active = u.id === selId;
                return (
                  <TableRow key={String(u.id)} onClick={() => setSelId(u.id)} className={cn("cursor-pointer", active ? "bg-[#f7f2fa] hover:bg-[#f7f2fa]" : "")}>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3"><Avatar name={u.username} id={u.id} /><div className="min-w-0"><div className="text-[13.5px] font-semibold text-foreground">{u.username}</div><div className="text-xs text-[#a0a0a0]">{u.email || "—"}</div></div></div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[13.5px] text-foreground">{u.tickets}</TableCell>
                    <TableCell className="px-4 py-3"><Pill text={s.label} bg={s.bg} fg={s.fg} /></TableCell>
                    <TableCell className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{fmtDate(u.date_joined)}</TableCell>
                    <TableCell className="px-4 py-3 text-[13px] text-muted-foreground whitespace-nowrap">{timeAgo(u.last_login)}</TableCell>
                    <TableCell className="px-4 py-3 text-right text-[#a0a0a0]">›</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {sel && (
        <div className="w-[340px] shrink-0 overflow-y-auto border-l border-[#ece3ec] bg-white p-5">
          <div className="mb-4.5 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-foreground">User Profile</h3>
            <button onClick={() => setSelId(null)} className="text-[#a0a0a0] cursor-pointer"><X className="size-4" /></button>
          </div>
          <div className="mb-4.5 text-center">
            <div className="inline-block"><Avatar name={sel.username} id={sel.id} size={64} /></div>
            <div className="mt-2.5 text-[17px] font-semibold text-foreground">{sel.username}</div>
            <div className="text-[13px] text-muted-foreground">{sel.email || "—"}</div>
            <div className="mt-2 flex justify-center"><Pill text={statusStyle(sel.is_active).label} bg={statusStyle(sel.is_active).bg} fg={statusStyle(sel.is_active).fg} /></div>
          </div>
          <ProfileRow k="Role" v={sel.role} />
          <ProfileRow k="Tickets raised" v={String(sel.tickets)} />
          <ProfileRow k="Joined" v={fmtDate(sel.date_joined)} />
          <ProfileRow k="Last active" v={timeAgo(sel.last_login)} />
          <div className="mt-5 flex gap-2">
            <Button variant="brand" className="flex-1">Message</Button>
            <Button variant="outline" onClick={() => toggleBlock(sel)} className={cn("flex-1", sel.is_active && "border-[#f0c3d2] text-destructive")}>{sel.is_active ? "Block" : "Unblock"}</Button>
          </div>
        </div>
      )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onCreated={(u) => { setUsers((us) => [u, ...us]); setShowAdd(false); }} onUnauthorized={onUnauthorized} />}
    </div>
  );
}

function ProfileRow({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 border-b border-[#f4eef6] py-1.5 text-[13px]"><span className="text-[#a0a0a0]">{k}</span><span className="font-medium capitalize text-foreground">{v}</span></div>;
}

function AddUserModal({ onClose, onCreated, onUnauthorized }: { onClose: () => void; onCreated: (u: AdminUser) => void; onUnauthorized: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || password.length < 8) { setErr("Username is required and password must be at least 8 characters."); return; }
    setSaving(true); setErr("");
    try { const u = await createUser({ username: username.trim(), email: email.trim(), password, role }); onCreated(u); }
    catch (e2) { if (e2 instanceof UnauthorizedError) { onUnauthorized(); return; } setErr(e2 instanceof Error ? e2.message : "Could not create user."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2"><Label htmlFor="u-username">Username</Label><Input id="u-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ravi.kumar" autoFocus /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="u-email">Email</Label><Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="u-pass">Temporary password</Label><Input id="u-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
          <div className="flex flex-col gap-2"><Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="agent">Agent (staff)</SelectItem></SelectContent>
            </Select>
          </div>
          {err && <p className="text-[13px] text-destructive">{err}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="brand" disabled={saving}>{saving ? "Creating…" : "Create user"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
