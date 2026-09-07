import { Schema, model, Types } from "mongoose";

const configSchema = new Schema(
  {
    key: { type: String, default: "singleton", unique: true },
    enabled: { type: Boolean, default: true },
    name: { type: String, default: "Ara" },
    greeting: {
      type: String,
      default: "Hi! I'm Ara 💜 Ask me anything about using Superbae — your closet, outfits, account and more.",
    },
    suggestedQuestions: { type: [String], default: [] },
  },
  { timestamps: true }
);
export const AssistantConfig = model("AssistantConfig", configSchema);

const qaSchema = new Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    keywords: { type: String, default: "" },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const AssistantQA = model("AssistantQA", qaSchema);

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, default: "" },
    source: { type: String, default: "" },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);
const convoSchema = new Schema(
  {
    sessionKey: { type: String, default: "" },
    user: { type: Types.ObjectId, ref: "User", default: null },
    messages: { type: [messageSchema], default: [] },
    lastAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
export const AssistantConversation = model("AssistantConversation", convoSchema);
