import { Schema, model, Types } from "mongoose";
import { TicketStatus, Priority, Source } from "../constants.js";

const ticketSchema = new Schema(
  {
    subject: { type: String, required: true },
    reference: { type: String, default: "", index: true },
    description: { type: String, default: "" },
    status: { type: String, enum: TicketStatus, default: "open", index: true },
    priority: { type: String, enum: Priority, default: "medium", index: true },
    category: { type: String, default: "" },
    subcategory: { type: String, default: "" },
    source: { type: String, enum: Source, default: "web" },
    team: { type: String, default: "" },
    tags: { type: [String], default: [] },
    createdBy: { type: Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: Types.ObjectId, ref: "User", default: null, index: true },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Ticket = model("Ticket", ticketSchema);
