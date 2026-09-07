import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition-[color,box-shadow]",
        "placeholder:text-[#b9b1b7] focus-visible:border-[#d8c6f7] focus-visible:ring-[3px] focus-visible:ring-[#d8c6f7]/35",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
export { Textarea };
