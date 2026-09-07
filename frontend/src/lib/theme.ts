// Status / priority presentation maps (Tailwind classes for the Superbae palette).

export const STATUS_STYLE: Record<string, { className: string; label: string }> = {
  open: { className: "bg-[#f7b7d4] text-foreground", label: "Open" },
  in_progress: { className: "bg-[#d8c6f7] text-foreground", label: "In Progress" },
  pending: { className: "bg-[#f6d6a5] text-foreground", label: "Pending" },
  resolved: { className: "bg-[#c8e6d6] text-foreground", label: "Resolved" },
  closed: { className: "bg-[#e2e2e2] text-foreground", label: "Closed" },
};

export function statusStyle(status: string) {
  return STATUS_STYLE[status] ?? { className: "bg-[#e2e2e2] text-foreground", label: status };
}

export const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-[#e0708f]",
  high: "bg-[#f6a5c0]",
  medium: "bg-[#d8c6f7]",
  low: "bg-[#c8e6d6]",
};

export const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export const PRIORITIES = [
  { value: "low", label: "Low priority" },
  { value: "medium", label: "Medium priority" },
  { value: "high", label: "High priority" },
];

export const assets = {
  heroTeam: "/hero-team.png",
  heroHelp: "/hero-help.png",
  statue: "/statue1.png",
};

// avatar helpers (used by Agents/Teams rosters)
const AV = ["#f7b7d4", "#d8c6f7", "#c8e6d6", "#f6c9a5", "#b7d4f7", "#e7b7d4"];
export const initials = (n: string) =>
  (n || "?").split(/[\s._-]+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
export const avColor = (n: string) =>
  AV[Math.abs([...(n || "?")].reduce((a, c) => a + c.charCodeAt(0), 0)) % AV.length];

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
