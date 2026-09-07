"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/help/search-box";

export function HelpHeader({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#f0e6ec] bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1100px] items-center gap-4 px-5 py-3">
        <Link href="/help" className="shrink-0 leading-none">
          <span className="sb-script text-[28px] text-foreground">Superbae</span>
          <span className="ml-2 align-middle text-[10px] font-medium tracking-[3px] text-[#9a9a9a]">HELP CENTER</span>
        </Link>
        {showSearch && <div className="hidden flex-1 justify-center md:flex"><SearchBox size="md" /></div>}
        <div className="ml-auto shrink-0">
          <Link href="/login"><Button variant="outline" size="sm">Log in</Button></Link>
        </div>
      </div>
    </header>
  );
}
