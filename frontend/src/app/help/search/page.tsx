import { Suspense } from "react";
import { SearchClient } from "./search-client";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[820px] px-5 py-10 text-muted-foreground">Loading…</div>}>
      <SearchClient />
    </Suspense>
  );
}
