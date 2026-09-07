import { Schema, model, Types } from "mongoose";
import { ArticleStatus, Visibility } from "../constants.js";

const schema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    body: { type: String, default: "" },
    category: { type: Types.ObjectId, ref: "Category", default: null },
    status: { type: String, enum: ArticleStatus, default: "draft", index: true },
    visibility: { type: String, enum: Visibility, default: "everyone", index: true },
    author: { type: Types.ObjectId, ref: "User", default: null },
    views: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Article = model("Article", schema);
