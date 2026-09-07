/**
 * Knowledge Base logic: article lifecycle, version snapshots, view counting and
 * feedback aggregation. Controllers call these so the rules live in one place.
 */
import { Types } from "mongoose";
import { Article } from "../../models/Article.js";
import { ArticleVersion } from "../../models/ArticleVersion.js";
import { ArticleFeedback } from "../../models/ArticleFeedback.js";
import { Category } from "../../models/Category.js";
import { slugify, uniqueSlug } from "../../utils/slug.js";
import { ApiError } from "../../utils/asyncHandler.js";

type Id = string | Types.ObjectId;

async function nextVersionNumber(articleId: Id): Promise<number> {
  const last = await ArticleVersion.findOne({ article: articleId }).sort({ number: -1 });
  return (last?.number || 0) + 1;
}

async function snapshot(article: any, authorId: Id | null, note: string) {
  await ArticleVersion.create({
    article: article._id,
    number: await nextVersionNumber(article._id),
    title: article.title,
    body: article.body,
    author: authorId,
    note,
  });
}

export interface ArticleInput {
  title?: string;
  body?: string;
  category?: Id | null;
  status?: string;
  visibility?: string;
}

export async function createArticle(authorId: Id, input: ArticleInput) {
  if (!input.title || !String(input.title).trim()) throw new ApiError(400, "title is required.");

  const slug = await uniqueSlug(input.title, async (s) => !!(await Article.findOne({ slug: s })));
  const status = input.status || "draft";
  const article = await Article.create({
    title: String(input.title).trim(),
    slug,
    body: input.body || "",
    category: input.category || null,
    status,
    visibility: input.visibility || "everyone",
    author: authorId,
    publishedAt: status === "published" ? new Date() : null,
  });
  await snapshot(article, authorId, "Created");
  return article;
}

export async function updateArticle(articleId: Id, authorId: Id, input: ArticleInput) {
  const article = await Article.findById(articleId);
  if (!article) throw new ApiError(404, "Article not found.");

  const contentChanged =
    (input.title !== undefined && input.title !== article.title) ||
    (input.body !== undefined && input.body !== article.body);

  if (input.title !== undefined) {
    const t = String(input.title).trim();
    if (t && t !== article.title) {
      article.title = t;
      article.slug = await uniqueSlug(t, async (s) =>
        !!(await Article.findOne({ slug: s, _id: { $ne: article._id } }))
      );
    }
  }
  if (input.body !== undefined) article.body = input.body;
  if (input.category !== undefined) article.category = (input.category as any) || null;
  if (input.visibility !== undefined) article.visibility = input.visibility as any;
  if (input.status !== undefined && input.status !== article.status) {
    article.status = input.status as any;
    article.publishedAt = input.status === "published" ? article.publishedAt || new Date() : article.publishedAt;
    if (input.status === "published" && !article.publishedAt) article.publishedAt = new Date();
  }

  await article.save();
  // Snapshot only when the content actually changed, so history stays meaningful.
  if (contentChanged) await snapshot(article, authorId, "Edited");
  return article;
}

export async function restoreVersion(articleId: Id, versionId: Id, authorId: Id) {
  const article = await Article.findById(articleId);
  if (!article) throw new ApiError(404, "Article not found.");
  const version = await ArticleVersion.findOne({ _id: versionId, article: articleId });
  if (!version) throw new ApiError(404, "Version not found.");

  // Save current content as a new version before overwriting, so restore is reversible.
  await snapshot(article, authorId, `Restored to v${version.number}`);
  article.title = version.title;
  article.body = version.body;
  await article.save();
  return article;
}

export async function recordView(articleId: Id) {
  await Article.updateOne({ _id: articleId }, { $inc: { views: 1 } });
}

export async function submitFeedback(articleId: Id, helpful: boolean, comment: string, userId: Id | null) {
  const article = await Article.findById(articleId);
  if (!article) throw new ApiError(404, "Article not found.");
  return ArticleFeedback.create({ article: articleId, helpful, comment: comment || "", user: userId || null });
}

/** Aggregate helpful percentage and counts for a set of articles. */
export async function feedbackStats(articleIds: Id[]) {
  const rows = await ArticleFeedback.aggregate([
    { $match: { article: { $in: articleIds.map((i) => new Types.ObjectId(String(i))) } } },
    {
      $group: {
        _id: "$article",
        total: { $sum: 1 },
        helpful: { $sum: { $cond: ["$helpful", 1, 0] } },
      },
    },
  ]);
  const map = new Map<string, { total: number; helpful: number; percent: number | null }>();
  for (const r of rows) {
    const percent = r.total ? Math.round((r.helpful / r.total) * 100) : null;
    map.set(String(r._id), { total: r.total, helpful: r.helpful, percent });
  }
  return map;
}

export async function categoryArticleCounts() {
  const rows = await Article.aggregate([
    { $match: { category: { $ne: null } } },
    { $group: { _id: "$category", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function ensureCategorySlug(name: string, excludeId?: Id): Promise<string> {
  return uniqueSlug(name, async (s) => {
    const q: Record<string, unknown> = { slug: s };
    if (excludeId) q._id = { $ne: excludeId };
    return !!(await Category.findOne(q));
  });
}

export { slugify };
