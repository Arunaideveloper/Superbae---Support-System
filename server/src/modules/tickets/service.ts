/**
 * Ticket domain logic lives here so controllers stay thin. Every state change
 * writes an audit event, and SLA timing is derived in one place. If a bug ever
 * shows up in ticket behaviour, this is the single file to read.
 */
import { Types } from "mongoose";
import { Ticket } from "../../models/Ticket.js";
import { TicketMessage } from "../../models/TicketMessage.js";
import { TicketEvent } from "../../models/TicketEvent.js";
import { SLA_POLICY, DEFAULT_SLA, TERMINAL_STATUS } from "../../constants.js";
import { ApiError } from "../../utils/asyncHandler.js";

type Id = string | Types.ObjectId;

async function logEvent(ticketId: Id, actor: Id | null, type: string, detail = "") {
  await TicketEvent.create({ ticket: ticketId, actor: actor || null, type, detail });
}

export interface CreateTicketInput {
  subject: string;
  description?: string;
  priority?: string;
  category?: string;
  subcategory?: string;
  source?: string;
  team?: string;
  tags?: string[];
  requester?: Id | null; // staff creating on behalf of a customer
}

export async function createTicket(actorId: Id, isStaff: boolean, input: CreateTicketInput) {
  if (!input.subject || !String(input.subject).trim()) {
    throw new ApiError(400, "subject is required.");
  }
  // Staff may open a ticket on behalf of a customer; everyone else is the requester.
  const createdBy = isStaff && input.requester ? input.requester : actorId;

  const ticket = await Ticket.create({
    subject: String(input.subject).trim(),
    description: input.description || "",
    priority: input.priority || "medium",
    category: input.category || "",
    subcategory: input.subcategory || "",
    source: input.source || "web",
    team: input.team || "",
    tags: Array.isArray(input.tags) ? input.tags : [],
    createdBy,
    status: "open",
  });

  await logEvent(ticket._id, actorId, "created", `Ticket "${ticket.subject}" created.`);
  return ticket;
}

export interface AddMessageInput {
  body: string;
  isInternal?: boolean;
}

export async function addMessage(ticketId: Id, authorId: Id, authorIsStaff: boolean, input: AddMessageInput) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found.");
  if (!input.body || !String(input.body).trim()) throw new ApiError(400, "Message body is required.");

  const isInternal = !!input.isInternal;
  const message = await TicketMessage.create({
    ticket: ticket._id,
    author: authorId,
    body: String(input.body).trim(),
    isInternal,
  });

  // The first public reply from staff stamps the first-response time (for SLA).
  if (authorIsStaff && !isInternal && !ticket.firstResponseAt) {
    ticket.firstResponseAt = new Date();
    await ticket.save();
  }

  await logEvent(ticket._id, authorId, isInternal ? "note_added" : "replied",
    isInternal ? "Internal note added." : "Reply sent.");
  return { ticket, message };
}

export async function changeStatus(ticketId: Id, actorId: Id, status: string) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found.");
  const prev = ticket.status;
  if (prev === status) return ticket;

  ticket.status = status as typeof ticket.status;
  // Stamp / clear the resolution time as the ticket enters or leaves a terminal state.
  if (TERMINAL_STATUS.includes(status) && !ticket.resolvedAt) ticket.resolvedAt = new Date();
  if (!TERMINAL_STATUS.includes(status)) ticket.resolvedAt = null;
  await ticket.save();

  await logEvent(ticket._id, actorId, "status_changed", `Status: ${prev} → ${status}.`);
  return ticket;
}

export async function changePriority(ticketId: Id, actorId: Id, priority: string) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found.");
  const prev = ticket.priority;
  if (prev === priority) return ticket;

  ticket.priority = priority as typeof ticket.priority;
  await ticket.save();
  await logEvent(ticket._id, actorId, "priority_changed", `Priority: ${prev} → ${priority}.`);
  return ticket;
}

export async function assignTicket(ticketId: Id, actorId: Id, assigneeId: Id | null) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found.");

  ticket.assignedTo = (assigneeId as any) || null;
  await ticket.save();
  await logEvent(ticket._id, actorId, "assigned",
    assigneeId ? `Assigned to user ${assigneeId}.` : "Unassigned.");
  return ticket;
}

const UPDATABLE = ["subject", "description", "category", "subcategory", "team", "tags"] as const;

export async function updateTicket(ticketId: Id, actorId: Id, data: Record<string, unknown>) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found.");

  const changed: string[] = [];
  for (const field of UPDATABLE) {
    if (data[field] !== undefined) {
      (ticket as any)[field] = data[field];
      changed.push(field);
    }
  }
  // Status and priority have their own audited paths.
  if (data.status !== undefined && data.status !== ticket.status) {
    return changeStatus(ticketId, actorId, String(data.status));
  }
  if (data.priority !== undefined && data.priority !== ticket.priority) {
    await changePriority(ticketId, actorId, String(data.priority));
  }
  if (changed.length) {
    await ticket.save();
    await logEvent(ticket._id, actorId, "updated", `Updated: ${changed.join(", ")}.`);
  }
  return Ticket.findById(ticketId);
}

/** Derive SLA timing for a ticket. Pure function of the ticket's own fields. */
export function slaStatus(ticket: any, now: Date = new Date()) {
  const policy = SLA_POLICY[ticket.priority] || DEFAULT_SLA;
  const created = new Date(ticket.createdAt).getTime();
  const frDue = new Date(created + policy.firstResponse * 60000);
  const resDue = new Date(created + policy.resolution * 60000);

  const frMetAt = ticket.firstResponseAt ? new Date(ticket.firstResponseAt) : null;
  const resolved = !!ticket.resolvedAt || TERMINAL_STATUS.includes(ticket.status);
  const resMetAt = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;

  const frBreached = frMetAt ? frMetAt > frDue : now > frDue;
  const resBreached = resMetAt ? resMetAt > resDue : resolved ? false : now > resDue;

  const minsLeft = (target: Date) => Math.round((target.getTime() - now.getTime()) / 60000);

  return {
    policy_minutes: policy,
    first_response: {
      due_at: frDue,
      met_at: frMetAt,
      breached: frBreached,
      minutes_remaining: frMetAt ? null : minsLeft(frDue),
    },
    resolution: {
      due_at: resDue,
      met_at: resMetAt,
      breached: resBreached,
      resolved,
      minutes_remaining: resolved ? null : minsLeft(resDue),
    },
  };
}
