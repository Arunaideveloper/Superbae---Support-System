import type { Request, Response } from "express";
import { Ticket } from "../../models/Ticket.js";
import { TicketMessage } from "../../models/TicketMessage.js";
import { TicketEvent } from "../../models/TicketEvent.js";
import {
  createTicket, addMessage, changeStatus, changePriority, assignTicket, updateTicket, slaStatus,
} from "./service.js";
import {
  serializeTicket, serializeMessage, serializeEvent,
} from "../../utils/serialize.js";
import { ApiError } from "../../utils/asyncHandler.js";
import { TicketStatus, Priority, TERMINAL_STATUS } from "../../constants.js";

const SORT_FIELDS: Record<string, string> = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  priority: "priority",
  status: "status",
  subject: "subject",
};

/** Non-staff users only ever see their own tickets. */
function scopeFor(req: Request): Record<string, unknown> {
  if (req.user?.isStaff) return {};
  return { createdBy: req.user!._id };
}

/** GET /api/tickets — filter, sort, paginate. */
export async function list(req: Request, res: Response) {
  const q = req.query;
  const filter: Record<string, unknown> = { ...scopeFor(req) };

  if (typeof q.status === "string" && q.status) filter.status = q.status;
  if (typeof q.priority === "string" && q.priority) filter.priority = q.priority;
  if (typeof q.assigned_to === "string" && q.assigned_to) {
    filter.assignedTo = q.assigned_to === "unassigned" ? null : q.assigned_to;
  }
  if (typeof q.team === "string" && q.team) filter.team = q.team;
  if (typeof q.search === "string" && q.search.trim()) {
    const rx = { $regex: q.search.trim(), $options: "i" };
    filter.$or = [{ subject: rx }, { description: rx }];
  }

  const page = Math.max(1, parseInt(String(q.page || "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(q.page_size || "20"), 10) || 20));

  const sortField = SORT_FIELDS[String(q.sort || "created_at")] || "createdAt";
  const sortDir = String(q.order || "desc") === "asc" ? 1 : -1;

  const total = await Ticket.countDocuments(filter);
  const tickets = await Ticket.find(filter)
    .sort({ [sortField]: sortDir })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .populate("createdBy", "username email isStaff isSuperuser")
    .populate("assignedTo", "username email isStaff isSuperuser");

  const ids = tickets.map((t) => t._id);
  const counts = await TicketMessage.aggregate([
    { $match: { ticket: { $in: ids }, isInternal: false } },
    { $group: { _id: "$ticket", n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));

  const results = tickets.map((t) =>
    serializeTicket(t, {
      message_count: countMap.get(String(t._id)) || 0,
      sla: slaStatus(t),
    })
  );

  res.json({ count: total, page, page_size: pageSize, results });
}

async function loadOwned(req: Request) {
  const ticket = await Ticket.findById(req.params.id)
    .populate("createdBy", "username email isStaff isSuperuser")
    .populate("assignedTo", "username email isStaff isSuperuser");
  if (!ticket) throw new ApiError(404, "Ticket not found.");
  if (!req.user?.isStaff && String((ticket.createdBy as any)?._id) !== String(req.user!._id)) {
    throw new ApiError(403, "You do not have access to this ticket.");
  }
  return ticket;
}

/** GET /api/tickets/:id — full detail with messages and audit trail. */
export async function retrieve(req: Request, res: Response) {
  const ticket = await loadOwned(req);
  const messageFilter: Record<string, unknown> = { ticket: ticket._id };
  if (!req.user?.isStaff) messageFilter.isInternal = false; // hide internal notes from customers

  const messages = await TicketMessage.find(messageFilter)
    .sort({ createdAt: 1 })
    .populate("author", "username email isStaff isSuperuser");
  const events = req.user?.isStaff
    ? await TicketEvent.find({ ticket: ticket._id })
        .sort({ createdAt: 1 })
        .populate("actor", "username email isStaff isSuperuser")
    : [];

  res.json({
    ...serializeTicket(ticket, { message_count: messages.filter((m) => !m.isInternal).length, sla: slaStatus(ticket) }),
    messages: messages.map(serializeMessage),
    events: events.map(serializeEvent),
  });
}

/** POST /api/tickets — create (customers for themselves, staff optionally on behalf of a customer). */
export async function create(req: Request, res: Response) {
  const b = req.body || {};
  const ticket = await createTicket(req.user!._id, !!req.user?.isStaff, {
    subject: b.subject,
    description: b.description,
    priority: b.priority,
    category: b.category,
    subcategory: b.subcategory,
    source: b.source,
    team: b.team,
    tags: b.tags,
    requester: b.requester || null,
  });
  const full = await Ticket.findById(ticket._id)
    .populate("createdBy", "username email isStaff isSuperuser")
    .populate("assignedTo", "username email isStaff isSuperuser");
  res.status(201).json(serializeTicket(full, { message_count: 0, sla: slaStatus(full) }));
}

/** PATCH /api/tickets/:id — update fields / status / priority. */
export async function update(req: Request, res: Response) {
  await loadOwned(req);
  if (!req.user?.isStaff) {
    // Customers may only edit their own ticket's subject/description.
    const { subject, description } = req.body || {};
    const t = await updateTicket(req.params.id, req.user!._id, { subject, description });
    return res.json(serializeTicket(await populate(t), { sla: slaStatus(t) }));
  }
  const t = await updateTicket(req.params.id, req.user!._id, req.body || {});
  res.json(serializeTicket(await populate(t), { sla: slaStatus(t) }));
}

async function populate(t: any) {
  return Ticket.findById(t._id)
    .populate("createdBy", "username email isStaff isSuperuser")
    .populate("assignedTo", "username email isStaff isSuperuser");
}

/** GET /api/tickets/:id/messages — list messages on a ticket. */
export async function listMessages(req: Request, res: Response) {
  await loadOwned(req);
  const filter: Record<string, unknown> = { ticket: req.params.id };
  if (!req.user?.isStaff) filter.isInternal = false;
  const messages = await TicketMessage.find(filter)
    .sort({ createdAt: 1 })
    .populate("author", "username email isStaff isSuperuser");
  res.json(messages.map(serializeMessage));
}

/** POST /api/tickets/:id/messages — reply or add an internal note (staff only for notes). */
export async function postMessage(req: Request, res: Response) {
  await loadOwned(req);
  const b = req.body || {};
  const isInternal = !!b.is_internal && !!req.user?.isStaff;
  const { message } = await addMessage(req.params.id, req.user!._id, !!req.user?.isStaff, {
    body: b.body,
    isInternal,
  });
  const full = await TicketMessage.findById(message._id).populate(
    "author",
    "username email isStaff isSuperuser"
  );
  res.status(201).json(serializeMessage(full));
}

/** POST /api/tickets/:id/assign — staff only. */
export async function assign(req: Request, res: Response) {
  const t = await assignTicket(req.params.id, req.user!._id, req.body?.assigned_to || null);
  res.json(serializeTicket(await populate(t), { sla: slaStatus(t) }));
}

/** POST /api/tickets/:id/status — staff only. */
export async function setStatus(req: Request, res: Response) {
  const status = String(req.body?.status || "");
  if (!TicketStatus.includes(status as any)) throw new ApiError(400, "Invalid status.");
  const t = await changeStatus(req.params.id, req.user!._id, status);
  res.json(serializeTicket(await populate(t), { sla: slaStatus(t) }));
}

/** POST /api/tickets/:id/priority — staff only. */
export async function setPriority(req: Request, res: Response) {
  const priority = String(req.body?.priority || "");
  if (!Priority.includes(priority as any)) throw new ApiError(400, "Invalid priority.");
  const t = await changePriority(req.params.id, req.user!._id, priority);
  res.json(serializeTicket(await populate(t), { sla: slaStatus(t) }));
}

/** GET /api/tickets/stats — dashboard counters (staff only). */
export async function stats(_req: Request, res: Response) {
  const byStatus = await Ticket.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  const byPriority = await Ticket.aggregate([{ $group: { _id: "$priority", n: { $sum: 1 } } }]);

  const statusCounts: Record<string, number> = {};
  for (const s of TicketStatus) statusCounts[s] = 0;
  for (const row of byStatus) statusCounts[row._id] = row.n;

  const priorityCounts: Record<string, number> = {};
  for (const p of Priority) priorityCounts[p] = 0;
  for (const row of byPriority) priorityCounts[row._id] = row.n;

  const total = await Ticket.countDocuments({});
  const open = await Ticket.countDocuments({ status: { $nin: TERMINAL_STATUS } });
  const unassigned = await Ticket.countDocuments({ assignedTo: null, status: { $nin: TERMINAL_STATUS } });

  // SLA breaches computed against currently-open tickets.
  const openTickets = await Ticket.find({ status: { $nin: TERMINAL_STATUS } });
  let frBreached = 0;
  let resBreached = 0;
  for (const t of openTickets) {
    const s = slaStatus(t);
    if (s.first_response.breached) frBreached++;
    if (s.resolution.breached) resBreached++;
  }

  res.json({
    total,
    open,
    unassigned,
    by_status: statusCounts,
    by_priority: priorityCounts,
    sla_breaches: { first_response: frBreached, resolution: resBreached },
  });
}
