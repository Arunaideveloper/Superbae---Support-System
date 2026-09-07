import type { Request, Response } from "express";
import { Article } from "../../models/Article.js";
import { Category } from "../../models/Category.js";
import { ArticleVersion } from "../../models/ArticleVersion.js";
import { ArticleFeedback } from "../../models/ArticleFeedback.js";
import {
  createArticle, updateArticle, restoreVersion, recordView, submitFeedback,
  feedbackStats, categoryArticleCounts, ensureCategorySlug,
} from "./service.js";
import {
  serializeArticle, serializeCategory, serializeVersion, serializeFeedback,
} from "../../utils/serialize.js";
import { ApiError } from "../../utils/asyncHandler.js";
import { isValidObjectId } from "mongoose";

/* ------------------------------- Categories ------------------------------- */

export async function listCategories(_req: Request, res: Response) {
  const cats = await Category.find({}).sort({ order: 1, name: 1 });
  const counts = await categoryArticleCounts();
  res.json(cats.map((c) => serializeCategory(c, { article_count: counts.get(String(c._id)) || 0 })));
}

export async function createCategory(req: Request, res: Response) {
  const { name, description, icon, color, order } = req.body || {};
  if (!name || !String(name).trim()) throw new ApiError(400, "name is required.");
  const slug = await ensureCategorySlug(String(name));
  const cat = await Category.create({
    name: String(name).trim(),
    slug,
    description: description || "",
    icon: icon || "",
    color: color || "",
    order: order || 0,
  });
  res.status(201).json(serializeCategory(cat, { article_count: 0 }));
}

export async function updateCategory(req: Request, res: Response) {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new ApiError(404, "Category not found.");
  const b = req.body || {};
  if (b.name !== undefined && String(b.name).trim() && b.name !== cat.name) {
    cat.name = String(b.name).trim();
    cat.slug = await ensureCategorySlug(cat.name, cat._id);
  }
  if (b.description !== undefined) cat.description = b.description;
  if (b.icon !== undefined) cat.icon = b.icon;
  if (b.color !== undefined) cat.color = b.color;
  if (b.order !== undefined) cat.order = b.order;
  await cat.save();
  res.json(serializeCategory(cat));
}

export async function deleteCategory(req: Request, res: Response) {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new ApiError(404, "Category not found.");
  await Article.updateMany({ category: cat._id }, { $set: { category: null } });
  await cat.deleteOne();
  res.status(204).end();
}

/* -------------------------------- Articles -------------------------------- */

function articleFilter(req: Request): Record<string, unknown> {
  const q = req.query;
  const filter: Record<string, unknown> = {};
  if (typeof q.status === "string" && q.status) filter.status = q.status;
  if (typeof q.visibility === "string" && q.visibility) filter.visibility = q.visibility;
  if (typeof q.category === "string" && q.category) filter.category = q.category;
  if (typeof q.search === "string" && q.search.trim()) {
    const rx = { $regex: q.search.trim(), $options: "i" };
    filter.$or = [{ title: rx }, { body: rx }];
  }
  return filter;
}

export async function listArticles(req: Request, res: Response) {
  const articles = await Article.find(articleFilter(req))
    .sort({ updatedAt: -1 })
    .populate("category")
    .populate("author", "username email isStaff isSuperuser");
  const fb = await feedbackStats(articles.map((a) => a._id));
  res.json(
    articles.map((a) => {
      const s = fb.get(String(a._id));
      return serializeArticle(a, { helpful_percent: s?.percent ?? null, feedback_count: s?.total ?? 0 });
    })
  );
}

export async function createArticleCtrl(req: Request, res: Response) {
  const b = req.body || {};
  const article = await createArticle(req.user!._id, {
    title: b.title,
    body: b.body,
    category: b.category || b.category_id || null,
    status: b.status,
    visibility: b.visibility,
  });
  const full = await Article.findById(article._id).populate("category").populate("author", "username email");
  res.status(201).json(serializeArticle(full, { helpful_percent: null, feedback_count: 0 }));
}

export async function retrieveArticle(req: Request, res: Response) {
  const article = await Article.findById(req.params.id)
    .populate("category")
    .populate("author", "username email isStaff isSuperuser");
  if (!article) throw new ApiError(404, "Article not found.");
  const fb = await feedbackStats([article._id]);
  const s = fb.get(String(article._id));
  const versions = await ArticleVersion.find({ article: article._id })
    .sort({ number: -1 })
    .populate("author", "username email");
  res.json({
    ...serializeArticle(article, { helpful_percent: s?.percent ?? null, feedback_count: s?.total ?? 0 }),
    versions: versions.map(serializeVersion),
  });
}

export async function updateArticleCtrl(req: Request, res: Response) {
  const b = req.body || {};
  const article = await updateArticle(req.params.id, req.user!._id, {
    title: b.title,
    body: b.body,
    category: b.category !== undefined ? b.category : b.category_id,
    status: b.status,
    visibility: b.visibility,
  });
  const full = await Article.findById(article._id).populate("category").populate("author", "username email");
  res.json(serializeArticle(full));
}

export async function deleteArticle(req: Request, res: Response) {
  const article = await Article.findById(req.params.id);
  if (!article) throw new ApiError(404, "Article not found.");
  await ArticleVersion.deleteMany({ article: article._id });
  await ArticleFeedback.deleteMany({ article: article._id });
  await article.deleteOne();
  res.status(204).end();
}

export async function listVersions(req: Request, res: Response) {
  const versions = await ArticleVersion.find({ article: req.params.id })
    .sort({ number: -1 })
    .populate("author", "username email");
  res.json(versions.map(serializeVersion));
}

export async function restore(req: Request, res: Response) {
  const versionId = req.body?.version || req.body?.version_id;
  if (!versionId) throw new ApiError(400, "version is required.");
  const article = await restoreVersion(req.params.id, versionId, req.user!._id);
  const full = await Article.findById(article._id).populate("category").populate("author", "username email");
  res.json(serializeArticle(full));
}

export async function listArticleFeedback(req: Request, res: Response) {
  const rows = await ArticleFeedback.find({ article: req.params.id })
    .sort({ createdAt: -1 })
    .populate("user", "username email");
  res.json(rows.map(serializeFeedback));
}

/** GET /api/kb/stats — KB-wide dashboard numbers. */
export async function kbStats(_req: Request, res: Response) {
  const total = await Article.countDocuments({});
  const published = await Article.countDocuments({ status: "published" });
  const draft = await Article.countDocuments({ status: "draft" });
  const archived = await Article.countDocuments({ status: "archived" });
  const categories = await Category.countDocuments({});

  const mostViewed = await Article.find({}).sort({ views: -1 }).limit(5).populate("category");
  const allIds = (await Article.find({}, { _id: 1 })).map((a) => a._id);
  const fb = await feedbackStats(allIds);

  const mostHelpful = [...fb.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .filter((v) => v.total >= 1)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 5);

  const helpfulArticles = await Article.find({ _id: { $in: mostHelpful.map((m) => m.id) } });
  const helpfulMap = new Map(helpfulArticles.map((a) => [String(a._id), a]));

  res.json({
    total,
    published,
    draft,
    archived,
    categories,
    total_views: mostViewed.reduce((s, a) => s + (a.views || 0), 0),
    most_viewed: mostViewed.map((a) => serializeArticle(a, {})),
    most_helpful: mostHelpful
      .map((m) => {
        const a = helpfulMap.get(m.id);
        return a ? serializeArticle(a, { helpful_percent: m.percent, feedback_count: m.total }) : null;
      })
      .filter(Boolean),
  });
}

/* --------------------------------- Public --------------------------------- */

/** Only published, everyone-visible content is exposed publicly. */
const PUBLIC_MATCH = { status: "published", visibility: "everyone" };

export async function publicCategories(_req: Request, res: Response) {
  const cats = await Category.find({}).sort({ order: 1, name: 1 });
  const counts = await Article.aggregate([
    { $match: PUBLIC_MATCH },
    { $group: { _id: "$category", n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  // Only surface categories that actually have public articles.
  res.json(
    cats
      .filter((c) => (countMap.get(String(c._id)) || 0) > 0)
      .map((c) => serializeCategory(c, { article_count: countMap.get(String(c._id)) || 0 }))
  );
}

export async function publicArticles(req: Request, res: Response) {
  const filter: Record<string, unknown> = { ...PUBLIC_MATCH };
  const q = req.query;
  if (typeof q.category === "string" && q.category) filter.category = q.category;
  if (typeof q.search === "string" && q.search.trim()) {
    const rx = { $regex: q.search.trim(), $options: "i" };
    filter.$or = [{ title: rx }, { body: rx }];
  }
  const articles = await Article.find(filter).sort({ views: -1, updatedAt: -1 }).populate("category");
  res.json(articles.map((a) => serializeArticle(a, {})));
}

export async function publicArticle(req: Request, res: Response) {
  const key = req.params.id;
  const byId = isValidObjectId(key) ? { _id: key } : null;
  const article = await Article.findOne({ ...PUBLIC_MATCH, ...(byId || { slug: key }) }).populate("category");
  if (!article) throw new ArticleNotFound();
  await recordView(article._id);
  const fb = await feedbackStats([article._id]);
  const s = fb.get(String(article._id));
  res.json(serializeArticle(article, { helpful_percent: s?.percent ?? null, feedback_count: s?.total ?? 0 }));
}

class ArticleNotFound extends ApiError {
  constructor() {
    super(404, "Article not found.");
  }
}

export async function publicFeedback(req: Request, res: Response) {
  const helpful = !!(req.body?.helpful);
  const comment = req.body?.comment || "";
  await submitFeedback(req.params.id, helpful, comment, req.user?._id || null);
  res.status(201).json({ ok: true });
}
