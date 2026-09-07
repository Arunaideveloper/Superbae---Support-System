"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { assets } from "@/lib/theme";

export function LoginClient() {
  const { signIn, signOut } = useAuth();

  // Start every visit to the login page from a clean slate so a leftover
  // session (e.g. a previous admin login) never routes the next user wrongly.
  useEffect(() => { signOut(); }, [signOut]);
  const router = useRouter();
  const sp = useSearchParams();
  const nextParam = sp.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Logging in…");
    setOk(false);
    try {
      const me = await signIn(username, password);
      setOk(true);
      setMessage("Logged in! Redirecting…");
      router.replace(me.is_staff ? "/admin" : (safeNext ?? "/tickets"));
    } catch (err: any) {
      setMessage(
        err?.message === "invalid"
          ? "Invalid username or password."
          : "Could not reach the server. Is the backend running on 8001?"
      );
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(252,238,243,0.86), rgba(216,198,247,0.80), rgba(200,230,214,0.86)), url(${assets.heroTeam})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="flex w-[min(980px,100%)] min-h-[750px] overflow-hidden rounded-[44px] bg-white shadow-[0_30px_80px_rgba(43,43,43,0.18)]">
        <div className="relative hidden flex-1 flex-col p-11 md:flex" style={{ background: "linear-gradient(160deg, #FCEEF3 0%, #F3E4F5 42%, #E6F2EA 100%)" }}>
          <div className="sb-script text-[54px] leading-none text-foreground">Superbae</div>
          <div className="mt-1.5 text-xs font-medium tracking-[6px] text-[#8a8a8a]">HELP CENTER</div>
          <p className="mt-5 max-w-[300px] text-[15px] leading-relaxed text-[#5b5b5b]">
            Support. Guidance. Solutions.<br />We&rsquo;re with you every step.
          </p>
          <img src={assets.heroHelp} alt="We're here to help" className="absolute bottom-0 left-0 block w-full" />
          <div className="absolute bottom-[120px] left-[46%] w-full -translate-x-[60%] pt-5 pb-2.5 text-center">
            <img src={assets.statue} alt="Superbae support" className="block w-[300%] max-w-[650px]" style={{ filter: "drop-shadow(0 22px 40px rgba(150,120,190,0.35))" }} />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center px-[46px] py-[52px]">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex size-[34px] items-center justify-center rounded-[10px] sb-brand-gradient font-bold text-foreground">S</span>
            <strong className="text-base">Superbae Help Center</strong>
          </div>

          <h1 className="mb-1.5 text-2xl font-semibold">Welcome back</h1>
          <p className="mb-7 text-[15px] text-[#7a7a7a]">Log in to manage your support tickets.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your username" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
            </div>
            <Button type="submit" variant="brand" className="mt-1 w-full">Log in</Button>
          </form>

          {message && <p className="mt-4 text-sm font-medium" style={{ color: ok ? "#3E8E5A" : "#D9557B" }}>{message}</p>}
        </div>
      </div>
    </div>
  );
}
