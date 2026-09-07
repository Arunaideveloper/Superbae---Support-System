import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireStaff, attachUser } from "../../middleware/auth.js";
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
kbAdminRouter.post("/categories", asyncHandler(createCategory));
kbAdminRouter.patch("/categories/:id", asyncHandler(updateCategory));
kbAdminRouter.delete("/categories/:id", asyncHandler(deleteCategory));

kbAdminRouter.get("/articles", asyncHandler(listArticles));
kbAdminRouter.post("/articles", asyncHandler(createArticleCtrl));
kbAdminRouter.get("/articles/:id", asyncHandler(retrieveArticle));
kbAdminRouter.patch("/articles/:id", asyncHandler(updateArticleCtrl));
kbAdminRouter.delete("/articles/:id", asyncHandler(deleteArticle));
kbAdminRouter.get("/articles/:id/versions", asyncHandler(listVersions));
kbAdminRouter.post("/articles/:id/restore", asyncHandler(restore));
kbAdminRouter.get("/articles/:id/feedback", asyncHandler(listArticleFeedback));

/* Public router — mounted at /api/public/kb, no auth required. */
export const kbPublicRouter = Router();
kbPublicRouter.use(attachUser); // optional user, so feedback can be attributed if signed in

kbPublicRouter.get("/categories", asyncHandler(publicCategories));
kbPublicRouter.get("/articles", asyncHandler(publicArticles));
kbPublicRouter.get("/articles/:id", asyncHandler(publicArticle));
kbPublicRouter.post("/articles/:id/feedback", asyncHandler(publicFeedback));
