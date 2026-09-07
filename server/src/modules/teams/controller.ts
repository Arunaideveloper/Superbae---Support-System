import type { Request, Response } from "express";
import { Ticket } from "../../models/Ticket.js";
import { User } from "../../models/User.js";
import { serializeUser } from "../../utils/serialize.js";
import { TERMINAL_STATUS } from "../../constants.js";

/**
 * Support teams map to product areas (the ticket "category"/"team" fields).
 * This returns each team's live open-ticket volume plus the agent roster —
 * real data, no client-side derivation.
 */
const TEAMS = [
  { key: "Your Closet", label: "Closet Team" },
  { key: "Outfits & Ara", label: "Styling & Ara" },
  { key: "Account & Billing", label: "Billing Team" },
  { key: "Troubleshooting", label: "Technical Team" },
];

export async function teamStats(_req: Request, res: Response) {
  const rows = await Ticket.aggregate([
    { $match: { status: { $nin: TERMINAL_STATUS } } },
    { $group: { _id: "$category", total: { $sum: 1 } } },
  ]);
  const openByCategory = new Map<string, number>(rows.map((r) => [String(r._id), r.total]));

  const teams = TEAMS.map((t) => ({
    key: t.key,
    label: t.label,
    open_tickets: openByCategory.get(t.key) || 0,
  }));

  const agents = await User.find({ isStaff: true, isSuperuser: false }).sort({ createdAt: -1 });

  res.json({ teams, agents: agents.map(serializeUser) });
}
