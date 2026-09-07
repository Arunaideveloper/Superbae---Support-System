export const TicketStatus = ["open", "in_progress", "pending", "resolved", "closed"] as const;
export type TTicketStatus = (typeof TicketStatus)[number];
export const TERMINAL_STATUS = ["resolved", "closed"];

export const Priority = ["low", "medium", "high", "critical"] as const;
export type TPriority = (typeof Priority)[number];

export const Source = ["web", "email", "android_app", "ios_app", "api"] as const;

export const EventType = [
  "created", "status_changed", "priority_changed", "assigned", "replied", "note_added", "updated",
] as const;

export const ArticleStatus = ["draft", "published", "archived"] as const;
export type TArticleStatus = (typeof ArticleStatus)[number];

export const Visibility = ["everyone", "agents", "teams"] as const;
export type TVisibility = (typeof Visibility)[number];

// SLA targets in minutes, keyed by priority
export const SLA_POLICY: Record<string, { firstResponse: number; resolution: number }> = {
  critical: { firstResponse: 15, resolution: 120 },
  high: { firstResponse: 60, resolution: 240 },
  medium: { firstResponse: 240, resolution: 1440 },
  low: { firstResponse: 480, resolution: 2880 },
};
export const DEFAULT_SLA = { firstResponse: 240, resolution: 1440 };
