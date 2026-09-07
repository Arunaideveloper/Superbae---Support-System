import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireStaff, attachUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  categorySchema, updateCategorySchema, createArticleSchema, updateArticleSchema,
  restoreSchema, feedbackSchema,
} from "../../schemas.js";
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  listArticles, createArticleCtrl, retrieveArticle, updateArticleCtrl, deleteArticle,
  listVersions, restore, listArticleFeedback, kbStats,
  publicCategories, publicArticles, publicArticle, publicFeedback,
} from "./controller.js";

/* Admin router — mounted at /api/kb, staff only. */
export const kbAdminRouter = Router();
kbAdminRouter.use(requireStaff);

kbAdminRouter.get("/stats", asyncHandler(kbStats));

kbAdminRouter.get("/categories", asyncHandler(listCategories));
kbAdminRouter.post("/categories", validate(categorySchema), asyncHandler(createCategory));
kbAdminRouter.patch("/categories/:id", validate(updateCategorySchema), asyncHandler(updateCategory));
kbAdminRouter.delete("/categories/:id", asyncHandler(deleteCategory));

kbAdminRouter.get("/articles", asyncHandler(listArticles));
kbAdminRouter.post("/articles", validate(createArticleSchema), asyncHandler(createArticleCtrl));
kbAdminRouter.get("/articles/:id", asyncHandler(retrieveArticle));
kbAdminRouter.patch("/articles/:id", validate(updateArticleSchema), asyncHandler(updateArticleCtrl));
kbAdminRouter.delete("/articles/:id", asyncHandler(deleteArticle));
kbAdminRouter.get("/articles/:id/versions", asyncHandler(listVersions));
kbAdminRouter.post("/articles/:id/restore", validate(restoreSchema), asyncHandler(restore));
kbAdminRouter.get("/articles/:id/feedback", asyncHandler(listArticleFeedback));

/* Public router — mounted at /api/public/kb, no auth required. */
export const kbPublicRouter = Router();
kbPublicRouter.use(attachUser);

kbPublicRouter.get("/categories", asyncHandler(publicCategories));
kbPublicRouter.get("/articles", asyncHandler(publicArticles));
kbPublicRouter.get("/articles/:id", asyncHandler(publicArticle));
kbPublicRouter.post("/articles/:id/feedback", validate(feedbackSchema), asyncHandler(publicFeedback));
