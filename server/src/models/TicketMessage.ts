import { Schema, model, Types } from "mongoose";

const schema = new Schema(
  {
    ticket: { type: Types.ObjectId, ref: "Ticket", required: true, index: true },
    author: { type: Types.ObjectId, ref: "User", default: null },
    body: { type: String, required: true },
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TicketMessage = model("TicketMessage", schema);
