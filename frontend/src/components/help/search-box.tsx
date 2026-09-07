"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchBox({ size = "md", initial = "", placeholder = "Search for help…", className }: { size?: "md" | "lg"; initial?: string; placeholder?: string; className?: string }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();
  const big = size === "lg";
  return (
    <form onSubmit={(e) => { e.preventDefault(); const v = q.trim(); if (v) router.push(`/help/search?q=${encodeURIComponent(v)}`); }}
      className={cn("relative w-full", big ? "max-w-[620px]" : "max-w-[420px]", className)}>
      <Search className={cn("pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#a0a0a0]", big ? "size-5" : "size-4")} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
        className={cn(
          "w-full rounded-full border border-input bg-white text-foreground outline-none transition-shadow placeholder:text-[#b9b1b7] focus-visible:border-[#d8c6f7] focus-visible:ring-[3px] focus-visible:ring-[#d8c6f7]/35",
          big ? "py-4 pl-12 pr-5 text-base sb-card-shadow" : "py-2.5 pl-10 pr-4 text-sm"
        )} />
    </form>
  );
}
