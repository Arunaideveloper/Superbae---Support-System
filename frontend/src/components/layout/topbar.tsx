"use client";
import { Search, Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface TopbarNotification { id: string; text: string; tone?: "high" | "info"; meta?: string; }

interface Props {
  title: string;
  subtitle?: string;
  username: string;
  roleTitle?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  notifications?: TopbarNotification[];
  onLogout: () => void;
  onMenu?: () => void;
}

export function Topbar({ title, subtitle, username, roleTitle, searchValue, onSearchChange, searchPlaceholder = "Search…", notifications = [], onLogout, onMenu }: Props) {
  const unread = notifications.length;
  const initial = username.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[#f0e6ec] bg-white/85 px-4 py-3 backdrop-blur-md lg:gap-4 lg:px-7">
      {onMenu && (
        <button onClick={onMenu} aria-label="Open menu" className="rounded-lg border border-border bg-card p-2 text-foreground hover:bg-muted cursor-pointer lg:hidden">
          <Menu className="size-5" />
        </button>
      )}
      <div className="min-w-0 shrink-0">
        <div className="truncate text-lg font-semibold leading-tight text-foreground">{title}</div>
        {subtitle && <div className="text-xs text-[#a0a0a0]">{subtitle}</div>}
      </div>

      {onSearchChange ? (
        <div className="hidden flex-1 justify-center md:flex">
          <div className="relative w-full max-w-[440px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#a0a0a0]" />
            <Input value={searchValue ?? ""} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} className="rounded-full bg-[#fbf6f9] pl-10" />
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex shrink-0 items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Notifications" className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-card cursor-pointer hover:bg-muted">
              <Bell className="size-[18px]" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-destructive px-1 text-[11px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            {notifications.length === 0 ? (
              <div className="px-3 py-3.5 text-[13px] text-muted-foreground">You&rsquo;re all caught up. 🎉</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.tone === "high" ? "bg-destructive" : "bg-[#d8c6f7]")} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-foreground">{n.text}</div>
                    {n.meta && <div className="mt-0.5 text-[11px] text-[#a0a0a0]">{n.meta}</div>}
                  </div>
                </div>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 cursor-pointer hover:bg-muted">
              <span className="flex size-8 items-center justify-center rounded-full sb-brand-gradient text-sm font-bold text-foreground">{initial}</span>
              <span className="max-w-[120px] truncate text-[13px] font-semibold text-foreground">{username}</span>
              <ChevronDown className="size-3.5 text-[#a0a0a0]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[13rem]">
            <div className="px-3 py-2">
              <div className="text-[13px] font-semibold text-foreground">{username}</div>
              <div className="text-xs text-[#a0a0a0]">{roleTitle ?? "Signed in"}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="font-semibold text-destructive focus:text-destructive">
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
