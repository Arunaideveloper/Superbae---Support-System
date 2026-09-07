export interface Me {
  id?: number | string;
  username: string;
  email?: string;
  is_staff: boolean;
  is_superuser?: boolean;
}

export interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}
export interface TicketInput { subject: string; description: string; priority: string; }
export interface TicketUpdate { status?: string; priority?: string; subject?: string; description?: string; }

export interface UserBrief { id: number | string; username: string; email?: string; }

export interface TicketMessage { id: number; author: string; body: string; is_internal: boolean; created_at: string; }
export interface TicketEvent { id: number; actor: string | null; type: string; detail: string; created_at: string; }

export interface SlaStage { target_minutes: number; due_at: string; completed_at: string | null; met: boolean; breached: boolean; remaining_seconds: number; }
export interface TicketSla { first_response: SlaStage; resolution: SlaStage; }

export interface TicketListRow {
  id: number; subject: string; status: string; priority: string; category: string;
  created_by: string; assigned_to: string | null; created_at: string; updated_at: string;
}

export interface TicketDetail {
  id: number; subject: string; description: string; status: string; priority: string;
  category: string; subcategory: string; source: string; team: string; tags: string[];
  created_by: UserBrief; assigned_to: UserBrief | null;
  first_response_at: string | null; resolved_at: string | null;
  created_at: string; updated_at: string;
  messages: TicketMessage[]; events: TicketEvent[]; sla: TicketSla;
}

export interface TicketStats { all: number; mine: number; unassigned: number; by_status: Record<string, number>; }

export interface AdminUser {
  id: number | string; username: string; email: string; is_staff: boolean; is_active: boolean;
  date_joined: string; last_login: string | null; tickets: number; role: string;
}

export interface ApiTicket {
  id: string; subject: string; status: string; priority: string; category: string; source: string;
  created_by: UserBrief; assigned_to: UserBrief | null; created_at: string; updated_at: string; sla: TicketSla;
}

export interface TeamStat { key: string; label: string; open_tickets: number; }
export interface TeamStatsResponse { teams: TeamStat[]; agents: AdminUser[]; }

export interface EscalationsResponse { count: number; critical: number; breached: number; results: ApiTicket[]; }

export interface SlaPolicyEntry { firstResponse: number; resolution: number; }
export interface SlaReportResponse {
  policy: Record<string, SlaPolicyEntry>; open: number;
  first_response_breaches: number; resolution_breaches: number;
  compliance_percent: number; breaching: ApiTicket[];
}

/* ---- public knowledge base ---- */
export interface KbCategory {
  id: string; name: string; slug: string; description: string;
  icon: string; color: string; order: number; article_count?: number;
}
export interface KbArticle {
  id: string; title: string; slug: string; body: string;
  category: KbCategory | null; category_id: string | null;
  status: string; visibility: string; views: number;
  published_at: string | null; created_at: string | null; updated_at: string | null;
  helpful_percent?: number | null; feedback_count?: number;
}
