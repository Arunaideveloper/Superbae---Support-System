"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogOut, X } from "lucide-react";

export interface NavItem { key: string; label: string; icon: string; href?: string; }
export interface NavGroup { title?: string; items: NavItem[]; }

interface Props {
  roleLabel: string;
  roleTitle?: string;
  username: string;
  groups: NavGroup[];
  active: string;
  onSelect?: (key: string) => void;
  onLogout: () => void;
  /** mobile slide-over drawer control */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ roleLabel, roleTitle, username, groups, active, onSelect, onLogout, mobileOpen, onMobileClose }: Props) {
  const inner = (
    <>
      <div className="px-5 pt-5 pb-3.5">
        <div className="sb-script text-3xl leading-none text-foreground">Superbae</div>
        <div className="mt-1 text-[10px] font-medium tracking-[4px] text-[#9a9a9a]">{roleLabel}</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
        {groups.map((g, gi) => (
          <div key={gi} className="mb-3">
            {g.title && <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-bold tracking-wide text-[#b4aeba]">{g.title}</div>}
            {g.items.map((it) => {
              const isActive = it.key === active;
              const cls = cn(
                "mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors cursor-pointer",
                isActive ? "sb-nav-active font-semibold text-foreground" : "font-medium text-[#6b6b6b] hover:bg-muted"
              );
              const inner2 = (<><span className="w-[18px] text-center text-[15px]">{it.icon}</span>{it.label}</>);
              return it.href ? (
                <Link key={it.key} href={it.href} className={cls} onClick={onMobileClose}>{inner2}</Link>
              ) : (
                <button key={it.key} onClick={() => { onSelect?.(it.key); onMobileClose?.(); }} className={cls}>{inner2}</button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-[#f0e6ec] p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full sb-brand-gradient font-bold text-foreground">
          {username.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{username}</div>
          {roleTitle && <div className="text-xs text-[#9a9a9a]">{roleTitle}</div>}
        </div>
        <button onClick={onLogout} title="Log out" className="rounded-lg border border-border bg-card p-2 text-foreground hover:bg-muted cursor-pointer">
          <LogOut className="size-4" />
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop / large tablet — persistent */}
      <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col border-r border-[#f0e6ec] bg-card lg:flex">
        {inner}
      </aside>

      {/* Mobile / small tablet — slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={onMobileClose} />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col border-r border-[#f0e6ec] bg-card shadow-2xl">
            <button onClick={onMobileClose} aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg border border-border bg-card p-1.5 text-foreground hover:bg-muted cursor-pointer">
              <X className="size-4" />
            </button>
            {inner}
          </aside>
        </div>
      )}
    </>
  );
}
