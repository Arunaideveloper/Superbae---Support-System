"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { publicCategories, publicArticles } from "@/lib/api";
import type { KbCategory, KbArticle } from "@/lib/types";
import { SearchBox } from "@/components/help/search-box";
import { CategoryCard } from "@/components/help/category-card";
import { ArticleListItem } from "@/components/help/article-list-item";

export default function HelpLandingPage() {
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [popular, setPopular] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([publicCategories(), publicArticles()])
      .then(([cats, arts]) => { if (!cancelled) { setCategories(cats); setPopular(arts.slice(0, 6)); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <section className="sb-page-gradient">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center px-5 py-16 text-center">
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">How can we help?</h1>
          <p className="mt-3 text-[15px] text-muted-foreground">Search our guides, or browse the topics below.</p>
          <div className="mt-7 flex w-full justify-center"><SearchBox size="lg" placeholder="Search for help… e.g. upload, outfits, billing" /></div>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-5">
        <Link href="/help/guided" className="mt-8 flex flex-col items-start gap-3 rounded-2xl sb-brand-gradient p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-foreground">Not sure where to start?</div>
            <div className="mt-1 text-sm text-[#5b4b57]">Answer a couple of quick questions and we’ll help you fix it — or reach a person if you still need one.</div>
          </div>
          <span className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-foreground shadow-[0_8px_20px_rgba(43,43,43,0.12)]">Get help with a problem →</span>
        </Link>
      </div>

      <div className="mx-auto max-w-[1100px] px-5 py-12">
        <h2 className="mb-5 text-xl font-semibold text-foreground">Browse by topic</h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-[#efe6ee] bg-[#f7f1f5]" />)}</div>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl border border-[#efe6ee] bg-card p-8 text-center text-muted-foreground">No help topics are available yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((c) => <CategoryCard key={c.id} category={c} />)}</div>
        )}

        {popular.length > 0 && (
          <>
            <h2 className="mb-5 mt-12 text-xl font-semibold text-foreground">Popular articles</h2>
            <div className="flex flex-col gap-3">{popular.map((a) => <ArticleListItem key={a.id} article={a} showCategory />)}</div>
          </>
        )}
      </div>
    </>
  );
}
