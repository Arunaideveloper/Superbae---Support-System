import { Schema, model, Types } from "mongoose";

const schema = new Schema(
  {
    article: { type: Types.ObjectId, ref: "Article", required: true, index: true },
    helpful: { type: Boolean, required: true },
    comment: { type: String, default: "" },
    user: { type: Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ArticleFeedback = model("ArticleFeedback", schema);
