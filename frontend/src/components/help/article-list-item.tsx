import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { KbArticle } from "@/lib/types";

function snippet(body: string, n = 120) {
  const plain = body.replace(/[#*_`>-]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > n ? plain.slice(0, n).trimEnd() + "…" : plain;
}

export function ArticleListItem({ article, showCategory = false }: { article: KbArticle; showCategory?: boolean }) {
  return (
    <Link href={`/help/article/${article.slug}`}
      className="group flex items-center gap-4 rounded-xl border border-[#efe6ee] bg-card p-4 transition-colors hover:bg-[#fbf6f9]">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-foreground group-hover:text-[#8a6c92]">{article.title}</div>
        <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{snippet(article.body)}</div>
        {showCategory && article.category && <div className="mt-1 inline-block rounded-full bg-[#f5eef9] px-2.5 py-0.5 text-[11px] font-medium text-[#8a6c92]">{article.category.name}</div>}
      </div>
      <ChevronRight className="size-5 shrink-0 text-[#c9bcd0] group-hover:text-[#8a6c92]" />
    </Link>
  );
}
