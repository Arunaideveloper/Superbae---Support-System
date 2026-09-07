"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, LifeBuoy } from "lucide-react";
import { publicCategories } from "@/lib/api";
import type { KbCategory } from "@/lib/types";
import { CategoryIcon } from "@/lib/help-icons";
import { ContactSupport } from "@/components/help/contact-support";
import { cn } from "@/lib/utils";

/** The persistent left navigation for every public Help Center page. */
export function HelpSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [cats, setCats] = useState<KbCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    publicCategories().then((x) => { if (!cancelled) setCats(x); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const linkCls = (active: boolean) =>
    cn(
      "mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
      active ? "sb-nav-active font-semibold text-foreground" : "font-medium text-[#6b6b6b] hover:bg-muted"
    );

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-[#f0e6ec] bg-card">
      {/* Brand hairline accent — matches the top header */}
      <div className="h-[3px] w-full shrink-0 sb-brand-gradient" />
      <div className="px-5 pt-5 pb-3.5">
        <Link href="/help" onClick={onNavigate} className="block leading-none">
          <span className="sb-script text-3xl text-foreground">Superbae</span>
          <div className="mt-1 text-[10px] font-medium tracking-[4px] text-[#9a9a9a]">HELP CENTER</div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
        <Link href="/help" onClick={onNavigate} className={linkCls(pathname === "/help")}>
          <Home className="size-[18px]" /> Home
        </Link>
        <Link href="/help/guided" onClick={onNavigate} className={linkCls(!!pathname?.startsWith("/help/guided"))}>
          <Compass className="size-[18px]" /> Get help
        </Link>

        <div className="px-3 pt-4 pb-1.5 text-[10px] font-bold tracking-wide text-[#b4aeba]">TOPICS</div>
        {cats.length === 0 ? (
          <div className="px-3 py-2 text-[13px] text-[#b4aeba]">Loading…</div>
        ) : (
          cats.map((c) => (
            <Link key={c.id} href={`/help/category/${c.slug}`} onClick={onNavigate}
              className={linkCls(pathname === `/help/category/${c.slug}`)}>
              <CategoryIcon name={c.icon} className="size-[18px] text-[#8a6c92]" /> {c.name}
            </Link>
          ))
        )}
      </nav>

      <div className="border-t border-[#f0e6ec] p-3">
        <div className="mb-2 flex items-center gap-1.5 px-2 text-[11px] font-medium text-[#a0a0a0]">
          <LifeBuoy className="size-3.5" /> Still stuck?
        </div>
        <ContactSupport className="w-full">Contact support</ContactSupport>
      </div>
    </aside>
  );
}
