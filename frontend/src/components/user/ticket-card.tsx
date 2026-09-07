"use client";
import type { Ticket } from "@/lib/types";
import { statusStyle, timeAgo } from "@/lib/theme";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TicketCard({ t, onClick }: { t: Ticket; onClick: () => void }) {
  const s = statusStyle(t.status);
  return (
    <Card onClick={onClick} className="cursor-pointer p-[18px] transition-shadow hover:shadow-[0_16px_36px_rgba(43,43,43,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-foreground">#{t.id} · {t.subject}</div>
          {t.description && <div className="mt-1 truncate text-sm text-muted-foreground">{t.description}</div>}
          <div className="mt-2 text-xs text-[#a0a0a0] capitalize">{t.priority} priority · {timeAgo(t.created_at)}</div>
        </div>
        <Badge className={cn(s.className)}>{s.label}</Badge>
      </div>
    </Card>
  );
}
