import type { Request, Response } from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { User } from "../../models/User.js";
import { Ticket } from "../../models/Ticket.js";
import { hashPassword } from "../../utils/password.js";
import { createTicket } from "./service.js";
import { sendMail, mailerConfigured } from "../../utils/mailer.js";
import { ticketEmailHtml, ticketEmailText } from "../../utils/ticketEmail.js";

/**
 * Guest support requests: no login required. We find-or-create a lightweight
 * customer account keyed by email so the ticket has a valid requester and a
 * returning guest's tickets group under one account.
 */
async function findOrCreateGuest(name: string, email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: cleanEmail });
  if (existing) return existing;

  const base = (name.trim() || cleanEmail.split("@")[0] || "guest").slice(0, 40) || "guest";
  let username = base;
  let n = 0;
  while (await User.findOne({ username })) {
    n += 1;
    username = `${base} (${n})`;
  }
  const passwordHash = await hashPassword(crypto.randomBytes(24).toString("hex"));
  return User.create({ username, email: cleanEmail, passwordHash, isStaff: false, isActive: true });
}

/** Human-friendly, unique-ish reference like SB-2025-0526. */
async function generateReference(): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 8; i += 1) {
    const ref = `SB-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await Ticket.findOne({ reference: ref }))) return ref;
  }
  return `SB-${year}-${Date.now().toString().slice(-4)}`;
}

/** POST /api/public/tickets — create a ticket from an unauthenticated visitor. */
export async function createPublicTicket(req: Request, res: Response) {
  const { name, email, subject, description } = req.body || {};
  const cleanEmail = String(email).trim().toLowerCase();
  const guest = await findOrCreateGuest(String(name || ""), cleanEmail);

  const ticket = await createTicket(guest._id, false, {
    subject: String(subject),
    description: String(description || ""),
    priority: "medium",
    source: "web",
  });

  const reference = await generateReference();
  (ticket as any).reference = reference;
  await ticket.save();

  // Email the ticket to the guest (non-fatal — a mail failure never blocks creation).
  const emailData = { reference, subject: ticket.subject, status: ticket.status, name: String(name || "") };
  const bannerPath = path.join(process.cwd(), "assets", "ticket-banner.png");
  const attachments = fs.existsSync(bannerPath)
    ? [{ filename: "superbae-ticket.png", path: bannerPath, cid: "ticketBanner" }]
    : undefined;
  const mail = await sendMail({
    to: cleanEmail,
    subject: `Your Superbae support ticket ${reference}`,
    html: ticketEmailHtml(emailData),
    text: ticketEmailText(emailData),
    attachments,
  });
  const emailed = mail.sent && mailerConfigured();   // true only for real inbox delivery

  res.status(201).json({
    ok: true,
    id: String(ticket._id),
    reference,
    subject: ticket.subject,
    status: ticket.status,
    email: cleanEmail,
    emailed,                       // true if a copy was actually sent
    emailConfigured: mailerConfigured(),
    previewUrl: mail.previewUrl,   // dev-only: Ethereal preview link when no real SMTP
    createdAt: (ticket as any).createdAt || new Date().toISOString(),
  });
}
