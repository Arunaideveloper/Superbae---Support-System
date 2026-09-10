/**
 * Zod schemas for request validation. Kept in one file so the API contract is
 * easy to read. Controllers can trust that req.body is already shaped and typed.
 */
import { z } from "zod";
import {
  TicketStatus, Priority, Source, ArticleStatus, Visibility,
} from "./constants.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "must be a valid id");
const nonEmpty = (label = "value") => z.string().trim().min(1, `${label} is required`);

/* ------------------------------- Auth ------------------------------- */
export const registerSchema = z.object({
  username: nonEmpty("username").max(150),
  password: z.string().min(6, "password must be at least 6 characters").max(200),
  email: z.string().email("invalid email").max(254).optional().or(z.literal("")),
});
export const loginSchema = z.object({
  username: nonEmpty("username"),
  password: nonEmpty("password"),
});
export const refreshSchema = z.object({ refresh: nonEmpty("refresh") });

/* ------------------------------- Users ------------------------------ */
const role = z.enum(["admin", "agent", "customer"]);
export const createUserSchema = z.object({
  username: nonEmpty("username").max(150),
  password: z.string().min(6, "password must be at least 6 characters").max(200),
  email: z.string().email("invalid email").max(254).optional().or(z.literal("")),
  role: role.optional(),
});
export const updateUserSchema = z.object({
  is_active: z.boolean().optional(),
  email: z.string().email("invalid email").max(254).optional().or(z.literal("")),
  role: role.optional(),
  password: z.string().min(6).max(200).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });

/* ------------------------------ Tickets ----------------------------- */
export const publicTicketSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email("a valid email is required"),
  subject: nonEmpty("subject").max(200),
  description: z.string().trim().max(5000).optional(),
});

export const createTicketSchema = z.object({
  subject: nonEmpty("subject").max(300),
  description: z.string().max(20000).optional(),
  priority: z.enum(Priority as unknown as [string, ...string[]]).optional(),
  category: z.string().max(120).optional(),
  subcategory: z.string().max(120).optional(),
  source: z.enum(Source as unknown as [string, ...string[]]).optional(),
  team: z.string().max(120).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
  requester: objectId.optional().nullable(),
});
export const updateTicketSchema = z.object({
  subject: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(20000).optional(),
  category: z.string().max(120).optional(),
  subcategory: z.string().max(120).optional(),
  team: z.string().max(120).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
  status: z.enum(TicketStatus as unknown as [string, ...string[]]).optional(),
  priority: z.enum(Priority as unknown as [string, ...string[]]).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });

export const messageSchema = z.object({
  body: nonEmpty("body").max(20000),
  is_internal: z.boolean().optional(),
});
export const assignSchema = z.object({ assigned_to: objectId.nullable() });
export const statusSchema = z.object({ status: z.enum(TicketStatus as unknown as [string, ...string[]]) });
export const prioritySchema = z.object({ priority: z.enum(Priority as unknown as [string, ...string[]]) });

/* -------------------------------- KB -------------------------------- */
export const categorySchema = z.object({
  name: nonEmpty("name").max(150),
  description: z.string().max(2000).optional(),
  icon: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
  order: z.number().int().optional(),
});
export const updateCategorySchema = categorySchema.partial()
  .refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });

export const createArticleSchema = z.object({
  title: nonEmpty("title").max(300),
  body: z.string().max(100000).optional(),
  category: objectId.nullable().optional(),
  category_id: objectId.nullable().optional(),
  status: z.enum(ArticleStatus as unknown as [string, ...string[]]).optional(),
  visibility: z.enum(Visibility as unknown as [string, ...string[]]).optional(),
});
export const updateArticleSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  body: z.string().max(100000).optional(),
  category: objectId.nullable().optional(),
  category_id: objectId.nullable().optional(),
  status: z.enum(ArticleStatus as unknown as [string, ...string[]]).optional(),
  visibility: z.enum(Visibility as unknown as [string, ...string[]]).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });

export const restoreSchema = z.object({
  version: objectId.optional(),
  version_id: objectId.optional(),
}).refine((v) => v.version || v.version_id, { message: "version is required" });

export const feedbackSchema = z.object({
  helpful: z.boolean(),
  comment: z.string().max(2000).optional(),
});

/* ----------------------------- Assistant ---------------------------- */
export const askSchema = z.object({
  question: nonEmpty("question").max(2000),
  session_key: z.string().max(100).optional(),
});
export const logSchema = z.object({
  session_key: z.string().max(100).optional(),
  question: z.string().max(2000).optional(),
  answer: z.string().max(20000).optional(),
  source: z.string().max(40).optional(),
});
export const assistantConfigSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().max(60).optional(),
  greeting: z.string().max(1000).optional(),
  suggested_questions: z.array(z.string().max(300)).max(12).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });

export const qaSchema = z.object({
  question: nonEmpty("question").max(500),
  answer: nonEmpty("answer").max(20000),
  keywords: z.string().max(500).optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
});
export const updateQaSchema = qaSchema.partial()
  .refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });
