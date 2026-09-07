import { Suspense } from "react";
import { TicketsClient } from "./tickets-client";

export default function TicketsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>}>
      <TicketsClient />
    </Suspense>
  );
}
