"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { publicArticle, NotFoundError } from "@/lib/api";
import type { KbArticle } from "@/lib/types";
import { Markdown } from "@/components/help/markdown";
import { HelpfulVote } from "@/components/help/helpful-vote";
import { ContactSupport } from "@/components/help/contact-support";

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [article, setArticle] = useState<KbArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true); setNotFound(false);
    publicArticle(slug)
      .then((a) => { if (!cancelled) setArticle(a); })
      .catch((e) => { if (!cancelled && e instanceof NotFoundError) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return <div className="mx-auto max-w-[760px] px-5 py-10"><div className="h-8 w-2/3 animate-pulse rounded bg-[#f0e6ec]" /><div className="mt-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 animate-pulse rounded bg-[#f4eef6]" />)}</div></div>;
  }
  if (notFound || !article) {
    return (
      <div className="mx-auto max-w-[760px] px-5 py-16 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Article not found</h1>
        <p className="mt-2 text-muted-foreground">This article may have moved or been unpublished.</p>
        <Link href="/help" className="mt-5 inline-block font-semibold text-[#8a6c92]">← Back to Help Center</Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-[760px] px-5 py-10">
      <div className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
        <Link href="/help" className="inline-flex items-center gap-1 font-medium text-[#8a6c92]"><ArrowLeft className="size-3.5" /> Help</Link>
        {article.category && <><span>/</span><Link href={`/help/category/${article.category.slug}`} className="font-medium text-[#8a6c92]">{article.category.name}</Link></>}
      </div>

      <h1 className="text-[28px] font-semibold leading-tight text-foreground">{article.title}</h1>
      {article.updated_at && <div className="mt-2 text-xs text-[#a0a0a0]">Updated {new Date(article.updated_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>}

      <div className="mt-7"><Markdown>{article.body}</Markdown></div>

      <div className="mt-10"><HelpfulVote slug={article.slug} title={article.title} /></div>

      <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-[#efe6ee] bg-card p-6 text-center">
        <div className="text-sm font-semibold text-foreground">Still need help?</div>
        <p className="text-[13px] text-muted-foreground">Our support team can pick it up with the context from this article.</p>
        <ContactSupport topic={article.title} />
      </div>
    </article>
  );
}
