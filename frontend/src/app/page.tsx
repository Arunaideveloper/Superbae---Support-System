"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace("/help");
    else router.replace(me.is_staff ? "/admin" : "/tickets");
  }, [me, loading, router]);

  return <div className="flex min-h-screen items-center justify-center text-[#7a7a7a]">Loading…</div>;
}
