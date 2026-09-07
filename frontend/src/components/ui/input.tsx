import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm text-foreground shadow-none transition-[color,box-shadow] outline-none",
        "placeholder:text-[#b9b1b7] file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "focus-visible:border-[#d8c6f7] focus-visible:ring-[3px] focus-visible:ring-[#d8c6f7]/35",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
export { Input };
