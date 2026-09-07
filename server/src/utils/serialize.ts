/**
 * Serializers turn Mongoose documents into the JSON shapes the API exposes.
 * They use snake_case field names so the contract stays stable and predictable
 * for any client. Each helper tolerates refs that are either populated
 * documents or bare ObjectIds.
 */

function idOf(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v._id) return String(v._id);
  return String(v);
}

function isPopulated(v: any): boolean {
  return !!v && typeof v === "object" && v.username !== undefined;
}

export function roleOf(u: any): "admin" | "agent" | "customer" {
  if (!u) return "customer";
  if (u.isSuperuser) return "admin";
  if (u.isStaff) return "agent";
  return "customer";
}

/** Full user shape for admin/self endpoints. */
export function serializeUser(u: any) {
  if (!u) return null;
  return {
    id: String(u._id),
    username: u.username,
    email: u.email || "",
    is_staff: !!u.isStaff,
    is_superuser: !!u.isSuperuser,
    is_active: u.isActive !== false,
    role: roleOf(u),
    date_joined: u.createdAt || null,
    last_login: u.lastLoginAt || null,
  };
}

/** Compact user reference embedded inside other objects. */
export function serializeUserRef(v: any) {
  if (!v) return null;
  if (isPopulated(v)) {
    return {
      id: String(v._id),
      username: v.username,
      email: v.email || "",
      role: roleOf(v),
    };
  }
  return { id: idOf(v), username: null, email: "", role: null };
}

export function serializeMessage(m: any) {
  return {
    id: String(m._id),
    ticket: idOf(m.ticket),
    author: serializeUserRef(m.author),
    body: m.body,
    is_internal: !!m.isInternal,
    created_at: m.createdAt || null,
  };
}

export function serializeEvent(e: any) {
  return {
    id: String(e._id),
    ticket: idOf(e.ticket),
    actor: serializeUserRef(e.actor),
    type: e.type,
    detail: e.detail || "",
    created_at: e.createdAt || null,
  };
}

export function serializeTicket(t: any, extra: { message_count?: number; sla?: any } = {}) {
  return {
    id: String(t._id),
    subject: t.subject,
    description: t.description || "",
    status: t.status,
    priority: t.priority,
    category: t.category || "",
    subcategory: t.subcategory || "",
    source: t.source || "web",
    team: t.team || "",
    tags: t.tags || [],
    created_by: serializeUserRef(t.createdBy),
    assigned_to: serializeUserRef(t.assignedTo),
    first_response_at: t.firstResponseAt || null,
    resolved_at: t.resolvedAt || null,
    created_at: t.createdAt || null,
    updated_at: t.updatedAt || null,
    ...(extra.message_count !== undefined ? { message_count: extra.message_count } : {}),
    ...(extra.sla !== undefined ? { sla: extra.sla } : {}),
  };
}

export function serializeCategory(c: any, extra: { article_count?: number } = {}) {
  return {
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    description: c.description || "",
    icon: c.icon || "",
    color: c.color || "",
    order: c.order || 0,
    ...(extra.article_count !== undefined ? { article_count: extra.article_count } : {}),
  };
}

export function serializeArticle(a: any, extra: { helpful_percent?: number | null; feedback_count?: number } = {}) {
  const cat = a.category;
  return {
    id: String(a._id),
    title: a.title,
    slug: a.slug,
    body: a.body || "",
    category: cat && isCategory(cat) ? serializeCategory(cat) : null,
    category_id: idOf(cat),
    status: a.status,
    visibility: a.visibility,
    author: serializeUserRef(a.author),
    views: a.views || 0,
    published_at: a.publishedAt || null,
    created_at: a.createdAt || null,
    updated_at: a.updatedAt || null,
    ...(extra.helpful_percent !== undefined ? { helpful_percent: extra.helpful_percent } : {}),
    ...(extra.feedback_count !== undefined ? { feedback_count: extra.feedback_count } : {}),
  };
}

function isCategory(v: any): boolean {
  return !!v && typeof v === "object" && v.name !== undefined && v.slug !== undefined;
}

export function serializeVersion(v: any) {
  return {
    id: String(v._id),
    article: idOf(v.article),
    number: v.number,
    title: v.title,
    body: v.body || "",
    author: serializeUserRef(v.author),
    note: v.note || "",
    created_at: v.createdAt || null,
  };
}

export function serializeFeedback(f: any) {
  return {
    id: String(f._id),
    article: idOf(f.article),
    helpful: !!f.helpful,
    comment: f.comment || "",
    user: serializeUserRef(f.user),
    created_at: f.createdAt || null,
  };
}
