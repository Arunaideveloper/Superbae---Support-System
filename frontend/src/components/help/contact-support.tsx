"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/** Routes to the prefilled new-ticket form, sending through login if needed. */
export function ContactSupport({ topic, variant = "brand", className, children }: { topic?: string; variant?: "brand" | "outline"; className?: string; children?: React.ReactNode }) {
  const { me } = useAuth();
  const target = `/tickets?new=1${topic ? `&topic=${encodeURIComponent(topic)}` : ""}`;
  const href = !me ? `/login?next=${encodeURIComponent(target)}` : me.is_staff ? "/admin" : target;
  return (
    <Link href={href}><Button variant={variant} className={className}>{children ?? "Contact support"}</Button></Link>
  );
}
