"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { createPublicTicket, type PublicTicketResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TicketStub, printTicket } from "@/components/help/ticket-stub";

/**
 * Contact support entry point.
 * - Signed-in customer  → prefilled New Ticket form
 * - Staff              → admin dashboard
 * - Guest (not signed in) → a quick ticket dialog (no login required)
 */
export function ContactSupport({
  topic,
  variant = "brand",
  className,
  children,
}: {
  topic?: string;
  variant?: "brand" | "outline";
  className?: string;
  children?: React.ReactNode;
}) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);

  if (me) {
    const target = `/tickets?new=1${topic ? `&topic=${encodeURIComponent(topic)}` : ""}`;
    const href = me.is_staff ? "/admin" : target;
    return (
      <Link href={href}>
        <Button variant={variant} className={className}>{children ?? "Contact support"}</Button>
      </Link>
    );
  }

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        {children ?? "Contact support"}
      </Button>
      {open && <GuestTicketModal topic={topic} onClose={() => setOpen(false)} />}
    </>
  );
}

function GuestTicketModal({ topic, onClose }: { topic?: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(topic ? `Need help with: ${topic}` : "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<PublicTicketResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !subject.trim() || !message.trim()) {
      setErr("Please add your email, a subject, and a short message.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await createPublicTicket({
        name: name.trim() || undefined,
        email: email.trim(),
        subject: subject.trim(),
        description: message.trim(),
      });
      setDone(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[480px]">
        {done ? (
          <div className="py-1">
            <DialogHeader><DialogTitle className="text-center">You&apos;re all set 🎉</DialogTitle></DialogHeader>
            <p className="mb-3 mt-1 text-center text-[13px] text-muted-foreground">
              Here&apos;s your support ticket — keep the reference to track your request.
            </p>

            <TicketStub reference={done.reference} subject={done.subject} status={done.status} createdAt={done.createdAt} />

            <p className="mt-3 text-center text-[12.5px] text-muted-foreground">
              {done.emailed
                ? <>A copy has been emailed to <span className="font-medium text-foreground">{done.email}</span>.</>
                : <>Save your reference <span className="font-semibold text-foreground">{done.reference}</span> — email delivery isn&apos;t set up yet.</>}
            </p>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => printTicket(done)}>Print / Save</Button>
              <Button variant="brand" className="flex-1" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Contact support</DialogTitle>
            </DialogHeader>
            <p className="-mt-1 text-[13px] text-muted-foreground">
              Tell us what you need help with and we&apos;ll get back to you by email. No account needed.
            </p>
            <form onSubmit={submit} className="mt-1 flex flex-col gap-3.5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cs-name">Name</Label>
                <Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cs-email">Email *</Label>
                <Input id="cs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoFocus />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cs-subject">Subject *</Label>
                <Input id="cs-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your issue" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cs-msg">How can we help? *</Label>
                <Textarea id="cs-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your question or problem…" rows={4} />
              </div>
              {err && <p className="text-[12.5px] text-destructive">{err}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" variant="brand" disabled={saving}>{saving ? "Submitting…" : "Submit request"}</Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
