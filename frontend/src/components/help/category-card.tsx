import Link from "next/link";
import type { KbCategory } from "@/lib/types";
import { CategoryIcon } from "@/lib/help-icons";

export function CategoryCard({ category }: { category: KbCategory }) {
  return (
    <Link href={`/help/category/${category.slug}`}
      className="group flex flex-col gap-2 rounded-2xl border border-[#efe6ee] bg-card p-5 transition-shadow hover:shadow-[0_16px_36px_rgba(43,43,43,0.10)]">
      <div className="flex size-11 items-center justify-center rounded-xl sb-brand-gradient text-foreground">
        <CategoryIcon name={category.icon} className="size-5" />
      </div>
      <div className="mt-1 text-base font-semibold text-foreground group-hover:text-[#8a6c92]">{category.name}</div>
      {category.description && <div className="text-[13px] leading-relaxed text-muted-foreground">{category.description}</div>}
      <div className="mt-1 text-xs text-[#a0a0a0]">{category.article_count ?? 0} article{(category.article_count ?? 0) === 1 ? "" : "s"}</div>
    </Link>
  );
}
