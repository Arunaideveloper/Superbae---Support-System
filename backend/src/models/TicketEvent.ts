import { Schema, model, Types } from "mongoose";
import { EventType } from "../constants.js";

const schema = new Schema(
  {
    ticket: { type: Types.ObjectId, ref: "Ticket", required: true, index: true },
    actor: { type: Types.ObjectId, ref: "User", default: null },
    type: { type: String, enum: EventType, required: true },
    detail: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TicketEvent = model("TicketEvent", schema);
