import { Schema, model, Types } from "mongoose";

const schema = new Schema(
  {
    article: { type: Types.ObjectId, ref: "Article", required: true, index: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    author: { type: Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ArticleVersion = model("ArticleVersion", schema);
