"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { publicCategories, publicArticles } from "@/lib/api";
import type { KbCategory, KbArticle } from "@/lib/types";
import { ArticleListItem } from "@/components/help/article-list-item";
import { CategoryIcon } from "@/lib/help-icons";

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [category, setCategory] = useState<KbCategory | null>(null);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    publicCategories()
      .then((cats) => {
        const cat = cats.find((c) => c.slug === slug) || null;
        if (cancelled) return;
        if (!cat) { setNotFound(true); return; }
        setCategory(cat);
        return publicArticles({ category: cat.id }).then((arts) => { if (!cancelled) setArticles(arts); });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="mx-auto max-w-[820px] px-5 py-10">
      <Link href="/help" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#8a6c92]"><ArrowLeft className="size-4" /> All topics</Link>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-[#efe6ee] bg-[#f7f1f5]" />)}</div>
      ) : notFound ? (
        <div className="rounded-2xl border border-[#efe6ee] bg-card p-8 text-center text-muted-foreground">That topic doesn&rsquo;t exist. <Link href="/help" className="font-semibold text-[#8a6c92]">Back to Help Center</Link></div>
      ) : (
        <>
          <div className="mb-6 flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl sb-brand-gradient text-foreground"><CategoryIcon name={category?.icon} className="size-6" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{category?.name}</h1>
              {category?.description && <p className="mt-1 text-[14px] text-muted-foreground">{category.description}</p>}
            </div>
          </div>
          {articles.length === 0 ? (
            <div className="rounded-2xl border border-[#efe6ee] bg-card p-8 text-center text-muted-foreground">No articles here yet.</div>
          ) : (
            <div className="flex flex-col gap-3">{articles.map((a) => <ArticleListItem key={a.id} article={a} />)}</div>
          )}
        </>
      )}
    </div>
  );
}
