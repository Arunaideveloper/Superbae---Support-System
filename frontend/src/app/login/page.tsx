import { Suspense } from "react";
import { LoginClient } from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-[#7a7a7a]">Loading…</div>}>
      <LoginClient />
    </Suspense>
  );
}
