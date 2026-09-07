"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import type { Ticket } from "@/lib/types";
import { listTickets, UnauthorizedError } from "@/lib/api";
import { Sidebar, type NavGroup } from "@/components/layout/sidebar";
import { Topbar, type TopbarNotification } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { DashboardHome } from "@/components/admin/dashboard-home";
import { Teams } from "@/components/admin/teams";
import { AdminTickets } from "@/components/admin/admin-tickets";
import { Escalations } from "@/components/admin/escalations";
import { Sla } from "@/components/admin/sla";
import { Users } from "@/components/admin/users";
import { Agents } from "@/components/admin/agents";
import { KnowledgeBase } from "@/components/admin/knowledge-base";

const GROUPS: NavGroup[] = [
  { title: "OPERATIONS", items: [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "tickets", label: "Tickets", icon: "🎫" },
    { key: "escalations", label: "Escalations", icon: "⚠️" },
    { key: "sla", label: "SLA", icon: "⏱️" },
  ]},
  { title: "PEOPLE", items: [
    { key: "users", label: "Users", icon: "👥" },
    { key: "agents", label: "Agents", icon: "🎧" },
    { key: "teams", label: "Teams", icon: "🫂" },
  ]},
  { title: "KNOWLEDGE", items: [{ key: "kb", label: "Knowledge Base", icon: "📚" }] },
  { title: "INSIGHTS", items: [{ key: "analytics", label: "Analytics", icon: "📈" }, { key: "reports", label: "Reports", icon: "📄" }] },
  { title: "AUTOMATION", items: [{ key: "automations", label: "Automations", icon: "🤖" }, { key: "notifications", label: "Notifications", icon: "🔔" }] },
  { title: "ADMINISTRATION", items: [
    { key: "roles", label: "Roles & Permissions", icon: "🔐" },
    { key: "audit", label: "Audit Logs", icon: "📝" },
    { key: "integrations", label: "Integrations", icon: "🔌" },
    { key: "settings", label: "Settings", icon: "⚙️" },
  ]},
];
const ALL_ITEMS = GROUPS.flatMap((g) => g.items);
const labelFor = (key: string) => ALL_ITEMS.find((i) => i.key === key)?.label ?? key;

const SUBTITLES: Record<string, string> = {
  dashboard: "Live overview of your support operations.",
  tickets: "Search, filter, and manage support tickets.",
  escalations: "Track, filter, and act on escalated tickets.",
  sla: "Configure SLA policies, business hours, and breach rules.",
  users: "Everyone who has raised a ticket with Superbae.",
  agents: "Your support team, their workload and performance.",
  teams: "Groups of agents that own areas of support.",
  kb: "Write and publish the articles customers read at /help.",
};

export default function AdminPage() {
  const { me, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  function logout() { signOut(); router.replace("/login"); }

  useEffect(() => {
    if (authLoading) return;
    if (!me) router.replace("/login");
    else if (!me.is_staff) router.replace("/tickets");
  }, [authLoading, me, router]);

  async function load() {
    setLoading(true);
    try { setTickets(await listTickets()); }
    catch (e) { if (e instanceof UnauthorizedError) return logout(); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (me?.is_staff) load(); /* eslint-disable-next-line */ }, [me]);

  const notifications = useMemo<TopbarNotification[]>(() => {
    const list: TopbarNotification[] = [];
    const highOpen = tickets.filter((t) => t.priority === "high" && (t.status === "open" || t.status === "in_progress"));
    if (highOpen.length) list.push({ id: "high", text: `${highOpen.length} high-priority ticket${highOpen.length > 1 ? "s" : ""} need attention`, tone: "high", meta: "Critical queue" });
    const open = tickets.filter((t) => t.status === "open").length;
    if (open) list.push({ id: "open", text: `${open} open ticket${open > 1 ? "s" : ""} awaiting triage`, tone: "info" });
    const today = tickets.filter((t) => new Date(t.created_at).toDateString() === new Date().toDateString()).length;
    if (today) list.push({ id: "today", text: `${today} ticket${today > 1 ? "s" : ""} created today`, tone: "info", meta: "Last 24h" });
    return list;
  }, [tickets]);

  if (authLoading || !me || !me.is_staff) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  const title = section === "dashboard" ? "Dashboard" : labelFor(section);
  const subtitle = SUBTITLES[section] ?? "This section is on the roadmap.";
  const useSearch = ["tickets", "escalations", "users", "agents", "teams", "kb"].includes(section);

  return (
    <div className="flex h-screen overflow-hidden sb-page-gradient">
      <Sidebar roleLabel="SUPPORT" roleTitle="Administrator" username={me.username} groups={GROUPS} active={section} onSelect={setSection} onLogout={logout} mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} username={me.username} roleTitle="Administrator"
          searchValue={useSearch ? query : undefined} onSearchChange={useSearch ? setQuery : undefined}
          searchPlaceholder={section === "escalations" ? "Search escalations or tickets…" : section === "kb" ? "Search articles…" : "Search tickets…"}
          notifications={notifications} onLogout={logout} onMenu={() => setNavOpen(true)} />

        {section === "tickets" ? <AdminTickets me={me} query={query} onUnauthorized={logout} />
        : section === "escalations" ? <Escalations query={query} />
        : section === "sla" ? <Sla />
        : section === "users" ? <Users query={query} onUnauthorized={logout} />
        : section === "agents" ? <Agents query={query} />
        : section === "teams" ? <Teams query={query} />
        : section === "kb" ? <KnowledgeBase query={query} onUnauthorized={logout} />
        : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <main className="mx-auto w-full max-w-[980px] px-4 pb-16 pt-7 sm:px-8">
              {section === "dashboard" ? (
                loading ? <p className="text-muted-foreground">Loading…</p> : <DashboardHome tickets={tickets} onOpenTickets={() => setSection("tickets")} />
              ) : (
                <Card className="p-[48px_24px] text-center text-muted-foreground">
                  <div className="mb-2.5 text-4xl">🚧</div>
                  <div className="mb-1 font-semibold text-foreground">{labelFor(section)} — coming soon</div>
                  <div className="text-sm">This area isn&rsquo;t built yet. We&rsquo;ll wire it up in a future step.</div>
                </Card>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
