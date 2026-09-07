/**
 * Idempotent seed: run `npm run seed`. Safe to re-run — it upserts by natural
 * keys (username, slug) instead of duplicating. Seeds demo accounts, the
 * Superbae knowledge base, Ara's Q&A and a couple of demo tickets.
 */
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { Category } from "../models/Category.js";
import { Article } from "../models/Article.js";
import { ArticleVersion } from "../models/ArticleVersion.js";
import { AssistantConfig, AssistantQA } from "../models/Assistant.js";
import { Ticket } from "../models/Ticket.js";
import { TicketEvent } from "../models/TicketEvent.js";
import { hashPassword } from "../utils/password.js";
import {
  CATEGORIES, ARTICLES, ASSISTANT_QA, SUGGESTED_QUESTIONS, DEMO_USERS, DEMO_TICKETS,
} from "./data.js";

function flagsForRole(role: string) {
  if (role === "admin") return { isStaff: true, isSuperuser: true };
  if (role === "agent") return { isStaff: true, isSuperuser: false };
  return { isStaff: false, isSuperuser: false };
}

export async function runSeed() {
  const usersByName = new Map<string, any>();
  for (const u of DEMO_USERS) {
    let user = await User.findOne({ username: u.username });
    if (!user) {
      user = await User.create({
        username: u.username,
        email: u.email,
        passwordHash: await hashPassword(u.password),
        ...flagsForRole(u.role),
        isActive: true,
      });
    }
    usersByName.set(u.username, user);
  }
  const admin = usersByName.get("admin");

  const catBySlug = new Map<string, any>();
  for (const c of CATEGORIES) {
    let cat = await Category.findOne({ slug: c.slug });
    if (!cat) cat = await Category.create(c);
    catBySlug.set(c.slug, cat);
  }

  for (const a of ARTICLES) {
    let article = await Article.findOne({ title: a.title });
    if (!article) {
      article = await Article.create({
        title: a.title,
        slug: a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        body: a.body,
        category: catBySlug.get(a.categorySlug)?._id || null,
        status: "published",
        visibility: "everyone",
        author: admin?._id || null,
        publishedAt: new Date(),
      });
      await ArticleVersion.create({
        article: article._id, number: 1, title: article.title, body: article.body,
        author: admin?._id || null, note: "Seeded",
      });
    }
  }

  let cfg = await AssistantConfig.findOne({ key: "singleton" });
  if (!cfg) cfg = await AssistantConfig.create({ key: "singleton" });
  cfg.suggestedQuestions = SUGGESTED_QUESTIONS;
  await cfg.save();

  for (const q of ASSISTANT_QA) {
    const exists = await AssistantQA.findOne({ question: q.question });
    if (!exists) await AssistantQA.create({ ...q, active: true });
  }

  for (const t of DEMO_TICKETS) {
    const exists = await Ticket.findOne({ subject: t.subject });
    if (!exists) {
      const by = usersByName.get(t.by);
      const ticket = await Ticket.create({
        subject: t.subject,
        description: t.description,
        priority: t.priority,
        category: t.category,
        source: (t as any).source || "web",
        createdBy: by?._id,
        status: "open",
      });
      await TicketEvent.create({
        ticket: ticket._id, actor: by?._id || null, type: "created",
        detail: `Ticket "${ticket.subject}" created.`,
      });
    }
  }

  return {
    users: await User.countDocuments({}),
    categories: await Category.countDocuments({}),
    articles: await Article.countDocuments({}),
    qa: await AssistantQA.countDocuments({}),
    tickets: await Ticket.countDocuments({}),
  };
}

// Run directly (npm run seed).
const isDirect =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirect) {
  (async () => {
    await connectDB();
    const counts = await runSeed();
    // eslint-disable-next-line no-console
    console.log("Seed complete:", counts);
    await disconnectDB();
    await mongoose.connection.close();
    process.exit(0);
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
