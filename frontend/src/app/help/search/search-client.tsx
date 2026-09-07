"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { publicArticles } from "@/lib/api";
import type { KbArticle } from "@/lib/types";
import { SearchBox } from "@/components/help/search-box";
import { ArticleListItem } from "@/components/help/article-list-item";
import { ContactSupport } from "@/components/help/contact-support";

export function SearchClient() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [results, setResults] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    publicArticles({ search: q })
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q]);

  return (
    <div className="mx-auto max-w-[820px] px-5 py-10">
      <div className="mb-6"><SearchBox size="lg" initial={q} /></div>
      <div className="mb-4 text-sm text-muted-foreground">
        {loading ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"} for “${q}”`}
      </div>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl border border-[#efe6ee] bg-[#f7f1f5]" />)}</div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#efe6ee] bg-card p-8 text-center">
          <div className="text-3xl">🤔</div>
          <div className="text-sm font-semibold text-foreground">No results for “{q}”</div>
          <p className="text-[13px] text-muted-foreground">Try different words, or reach out and we&rsquo;ll help.</p>
          <ContactSupport topic={q ? `Search: ${q}` : undefined} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">{results.map((a) => <ArticleListItem key={a.id} article={a} showCategory />)}</div>
      )}
    </div>
  );
}
