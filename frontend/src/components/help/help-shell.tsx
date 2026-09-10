"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X, LogIn } from "lucide-react";
import { HelpSidebar } from "@/components/help/help-sidebar";
import { HelpFooter } from "@/components/help/help-footer";
import { SearchBox } from "@/components/help/search-box";
import { Button } from "@/components/ui/button";
import { AraWidget } from "@/components/ara/ara-widget";

/** Professional two-column Help Center shell: fixed left sidebar + top bar. */
export function HelpShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — persistent on desktop */}
      <div className="hidden lg:block">
        <HelpSidebar />
      </div>

      {/* Sidebar — slide-over drawer on mobile */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 shadow-2xl lg:hidden">
            <HelpSidebar onNavigate={() => setOpen(false)} />
            <button onClick={() => setOpen(false)} aria-label="Close menu"
              className="absolute right-[-44px] top-3 rounded-lg bg-white p-2 text-foreground shadow-md">
              <X className="size-5" />
            </button>
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30">
          {/* Brand hairline accent */}
          <div className="h-[3px] w-full sb-brand-gradient" />
          <header className="flex items-center gap-3 border-b border-[#f0e6ec] bg-gradient-to-r from-white/85 via-white/80 to-[#fdf3f8]/80 px-4 py-3 shadow-[0_6px_20px_-12px_rgba(43,43,43,0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
            <button onClick={() => setOpen(true)} aria-label="Open menu"
              className="rounded-xl border border-border bg-card/80 p-2 text-foreground transition-colors hover:bg-muted lg:hidden">
              <Menu className="size-5" />
            </button>
            {/* Compact wordmark — shown only when the sidebar is hidden (mobile) */}
            <Link href="/help" className="shrink-0 leading-none lg:hidden">
              <span className="sb-script text-2xl text-foreground">Superbae</span>
            </Link>
            <div className="hidden min-w-0 flex-1 sm:block"><SearchBox size="md" className="max-w-full" /></div>
            <div className="ml-auto shrink-0">
              <Link href="/login">
                <Button variant="brand" size="sm"
                  className="rounded-full px-4 shadow-[0_6px_16px_-6px_rgba(216,198,247,0.9)] hover:shadow-[0_8px_20px_-6px_rgba(216,198,247,1)]">
                  <LogIn className="size-4" /> Log in
                </Button>
              </Link>
            </div>
          </header>
        </div>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1120px]">{children}</div>
        </main>
        <HelpFooter />
      </div>
      <AraWidget />
    </div>
  );
}
