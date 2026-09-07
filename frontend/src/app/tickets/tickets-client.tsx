"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import type { Ticket, TicketDetail } from "@/lib/types";
import { listTickets, createTicket, fetchTicket, postTicketMessage, UnauthorizedError } from "@/lib/api";
import { statusStyle, PRIORITIES, timeAgo } from "@/lib/theme";
import { Sidebar, type NavGroup } from "@/components/layout/sidebar";
import { Topbar, type TopbarNotification } from "@/components/layout/topbar";
import { TicketCard } from "@/components/user/ticket-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

const NAV: NavGroup[] = [{ items: [
  { key: "home", label: "Home", icon: "🏠" },
  { key: "tickets", label: "My Tickets", icon: "🎫" },
  { key: "new", label: "New Ticket", icon: "➕" },
]}];

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

export function TicketsClient() {
  const { me, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const prefillRef = useRef(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState("home");
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [navOpen, setNavOpen] = useState(false);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const [selId, setSelId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  function logout() { signOut(); router.replace("/login"); }
  function guard(e: unknown): boolean { if (e instanceof UnauthorizedError) { logout(); return true; } return false; }

  useEffect(() => {
    if (!authLoading && !me) router.replace("/login");
  }, [authLoading, me, router]);

  // Deep-link from the Help Center: /tickets?new=1&topic=... opens the New Ticket
  // form pre-filled with the article the user came from.
  useEffect(() => {
    if (prefillRef.current || !me) return;
    if (sp.get("new") === "1") {
      prefillRef.current = true;
      setSection("new");
      const subj = sp.get("subj");
      const topic = sp.get("topic");
      const desc = sp.get("desc");
      if (subj) setSubject(subj);
      else if (topic) setSubject(`Need help with: ${topic}`);
      if (desc) setDescription(desc);
    }
  }, [sp, me]);

  async function load() {
    setLoading(true); setError("");
    try { setTickets(await listTickets()); }
    catch (e) { if (!guard(e)) setError("Could not load your tickets."); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (me) load(); /* eslint-disable-next-line */ }, [me]);

  useEffect(() => {
    if (selId == null) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true); setReply("");
    fetchTicket(selId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled && !guard(e)) setError("Could not load the ticket."); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [selId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    try {
      await createTicket({ subject, description, priority });
      setSubject(""); setDescription(""); setPriority("medium");
      setSection("tickets"); load();
    } catch (err) { if (!guard(err)) setError("Could not create your ticket."); }
  }

  async function sendReply() {
    if (!reply.trim() || !detail) return;
    setSending(true);
    try {
      await postTicketMessage(detail.id, reply.trim(), false);
      setReply("");
      setDetail(await fetchTicket(detail.id));
      load();
    } catch (e) { if (!guard(e)) setError("Could not send your reply."); }
    finally { setSending(false); }
  }

  const stats = useMemo(() => ({
    open: tickets.filter((t) => t.status === "open").length,
    inprogress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    total: tickets.length,
  }), [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      const byTab = statusTab === "all" || t.status === statusTab;
      const byQ = !q || t.subject.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
      return byTab && byQ;
    });
  }, [tickets, statusTab, query]);

  const notifications = useMemo<TopbarNotification[]>(() => {
    const active = stats.open + stats.inprogress;
    return active ? [{ id: "active", text: `You have ${active} active ticket${active > 1 ? "s" : ""}`, tone: "info" }] : [];
  }, [stats]);

  if (authLoading || !me) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  const view = selId != null ? "detail" : section;
  const title = view === "detail" ? `Ticket #${selId}` : view === "home" ? `Hi, ${me.username}` : view === "new" ? "New ticket" : "My Tickets";
  const subtitle = view === "home" ? "Welcome to your Superbae Help Center." : view === "new" ? "Tell us what you need help with." : view === "detail" ? "Your conversation with our support team." : "Track the progress of your requests.";

  return (
    <div className="flex min-h-screen sb-page-gradient">
      <Sidebar roleLabel="HELP CENTER" username={me.username} groups={NAV} active={selId != null ? "tickets" : section}
        onSelect={(k) => { setSelId(null); setSection(k); }} onLogout={logout} mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} username={me.username} roleTitle="Help Center"
          searchValue={view === "tickets" ? query : undefined}
          onSearchChange={view === "tickets" ? setQuery : undefined}
          searchPlaceholder="Search your tickets…" notifications={notifications} onLogout={logout} onMenu={() => setNavOpen(true)} />

        <main className={cn("mx-auto w-full px-4 pb-16 pt-7 sm:px-8", view === "detail" ? "max-w-[860px]" : "max-w-[820px]")}>
          {error && <p className="mb-4 text-destructive">{error}</p>}

          {view === "detail" ? (
            <>
              <button onClick={() => { setSelId(null); setSection("tickets"); }} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[#8a6c92] cursor-pointer">
                <ArrowLeft className="size-4" /> Back to my tickets
              </button>
              {detailLoading || !detail ? (
                <p className="text-muted-foreground">Loading conversation…</p>
              ) : (
                <>
                  <Card className="mb-4.5 p-[22px]">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <div className="text-[12.5px] font-semibold text-[#a0a0a0]">#{detail.id}</div>
                        <h2 className="my-1 text-xl font-semibold text-foreground">{detail.subject}</h2>
                        <div className="text-[13px] text-muted-foreground capitalize">{detail.priority} priority · opened {timeAgo(detail.created_at)}</div>
                      </div>
                      <Badge className={cn("h-fit", statusStyle(detail.status).className)}>{statusStyle(detail.status).label}</Badge>
                    </div>
                    {detail.description && <div className="mt-3.5 whitespace-pre-wrap border-t border-[#f4eef6] pt-3.5 text-sm leading-relaxed text-muted-foreground">{detail.description}</div>}
                  </Card>

                  <div className="mb-4.5 flex flex-col gap-3.5">
                    {detail.messages.length === 0 ? (
                      <Card className="p-[22px] text-center text-muted-foreground">No replies yet — our team will get back to you soon.</Card>
                    ) : detail.messages.map((m) => {
                      const self = m.author === me.username;
                      return (
                        <div key={m.id} className={cn("flex gap-3", self ? "flex-row-reverse" : "flex-row")}>
                          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full font-bold text-foreground", self ? "sb-brand-gradient" : "bg-[#ede3f1]")}>
                            {(self ? me.username : m.author).charAt(0).toUpperCase()}
                          </span>
                          <div className="max-w-[80%]">
                            <div className={cn("mb-1.5 flex items-center gap-2", self ? "justify-end" : "justify-start")}>
                              <span className="text-[13px] font-semibold text-foreground">{self ? "You" : m.author}</span>
                              <span className="text-[11.5px] text-[#a0a0a0]">{self ? "" : "Support · "}{timeAgo(m.created_at)}</span>
                            </div>
                            <div className={cn("whitespace-pre-wrap rounded-2xl border px-3.5 py-3 text-sm leading-relaxed text-foreground", self ? "border-[#f4d9e5] bg-[#fceef3]" : "border-[#efe6ee] bg-white")}>{m.body}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Card className="p-[22px]">
                    <div className="mb-2.5 text-[13px] font-semibold text-foreground">Add a reply</div>
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Type your message to our support team…" className="resize-y" />
                    <div className="mt-3 flex justify-end">
                      <Button variant="brand" onClick={sendReply} disabled={sending || !reply.trim()}>{sending ? "Sending…" : "Send reply"}</Button>
                    </div>
                  </Card>
                </>
              )}
            </>
          ) : view === "home" ? (
            <>
              <Card className="mb-5 flex flex-row flex-wrap items-center justify-between gap-4 sb-brand-gradient p-[22px]">
                <div>
                  <div className="text-xl font-bold text-foreground">Need a hand?</div>
                  <div className="mt-1 text-sm text-[#5b4b57]">Raise a ticket and our team will help you out.</div>
                </div>
                <Button onClick={() => setSection("new")} className="bg-white text-foreground hover:brightness-100 shadow-[0_8px_20px_rgba(43,43,43,0.12)]">+ New ticket</Button>
              </Card>

              <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
                {[{ label: "Open", value: stats.open, bg: "#f7b7d4" }, { label: "In Progress", value: stats.inprogress, bg: "#d8c6f7" }, { label: "Resolved", value: stats.resolved, bg: "#c8e6d6" }, { label: "Total", value: stats.total, bg: "#ede3f1" }].map((k) => (
                  <Card key={k.label} className="p-5">
                    <div className="mb-2.5 size-2.5 rounded" style={{ background: k.bg }} />
                    <div className="text-2xl font-bold text-foreground">{k.value}</div>
                    <div className="text-[13px] text-muted-foreground">{k.label}</div>
                  </Card>
                ))}
              </div>

              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Recent tickets</h3>
                {tickets.length > 0 && <button onClick={() => setSection("tickets")} className="text-[13px] font-semibold text-[#8a6c92] cursor-pointer">View all →</button>}
              </div>
              {loading ? <p className="text-muted-foreground">Loading…</p> : tickets.length === 0 ? (
                <Card className="p-[22px] text-center text-muted-foreground">No tickets yet. Raise your first one above.</Card>
              ) : (
                <div className="flex flex-col gap-3">{tickets.slice(0, 4).map((t) => <TicketCard key={t.id} t={t} onClick={() => setSelId(t.id)} />)}</div>
              )}
            </>
          ) : view === "new" ? (
            <Card className="p-[22px]">
              <form onSubmit={submit} className="flex flex-col gap-3">
                <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <Textarea placeholder="Describe your issue..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="resize-y" />
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="submit" variant="brand">Submit ticket</Button>
                </div>
              </form>
            </Card>
          ) : (
            <>
              <div className="mb-4.5 flex flex-wrap gap-2">
                {STATUS_TABS.map((f) => {
                  const active = statusTab === f.key;
                  return (
                    <button key={f.key} onClick={() => setStatusTab(f.key)}
                      className={cn("rounded-full border px-3.5 py-2 text-[13px] cursor-pointer", active ? "sb-brand-gradient border-transparent font-semibold" : "border-border bg-white font-medium")}>
                      {f.label}
                    </button>
                  );
                })}
              </div>
              {loading ? <p className="text-muted-foreground">Loading tickets…</p> : filtered.length === 0 ? (
                <Card className="p-[22px] text-center text-muted-foreground">{tickets.length === 0 ? "No tickets yet. Use “New Ticket” to raise your first one." : "No tickets match."}</Card>
              ) : (
                <div className="flex flex-col gap-3">{filtered.map((t) => <TicketCard key={t.id} t={t} onClick={() => setSelId(t.id)} />)}</div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
