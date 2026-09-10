import { createRequire } from "node:module";
import { env } from "../config/env.js";

// nodemailer is an OPTIONAL dependency loaded at runtime via require, so the
// project compiles and runs even before `npm install nodemailer`.
const nodeRequire = createRequire(import.meta.url);

let nodemailerMod: any = null;
let cachedTransport: any = null;
let mode: "smtp" | "ethereal" | "none" = "none";

function loadNodemailer(): any | null {
  if (nodemailerMod) return nodemailerMod;
  try {
    nodemailerMod = nodeRequire("nodemailer");
  } catch {
    console.error("[mail] nodemailer is not installed — run `npm install` in server/. Skipping email.");
    return null;
  }
  return nodemailerMod;
}

async function getTransport(): Promise<any | null> {
  if (cachedTransport) return cachedTransport;
  const nodemailer = loadNodemailer();
  if (!nodemailer) return null;

  // 1) Real SMTP when configured — delivers to real inboxes.
  if (env.SMTP_HOST && env.SMTP_USER) {
    cachedTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    mode = "smtp";
    return cachedTransport;
  }

  // 2) Zero-config fallback: an Ethereal test inbox (no signup, no credentials).
  //    Emails are NOT delivered to real inboxes — instead a preview URL is logged
  //    so you can SEE the exact email. Add real SMTP to deliver for real.
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    mode = "ethereal";
    console.log("[mail] No SMTP configured — using an Ethereal test inbox. Emails are previewable (see the preview link on each send), not delivered to real inboxes. Set SMTP_* in server/.env for real delivery.");
    return cachedTransport;
  } catch (err) {
    console.error("[mail] Could not set up the Ethereal test inbox (offline?). Skipping email.", err);
    return null;
  }
}

/** True only when REAL SMTP is configured (drives the user-facing "emailed" message). */
export function mailerConfigured(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_USER);
}

export interface SendResult {
  sent: boolean;
  previewUrl?: string; // set in Ethereal mode
}

/** Send an email. Never throws. Returns whether it sent and (in test mode) a preview URL. */
export async function sendMail(opts: { to: string; subject: string; html: string; text?: string; attachments?: any[] }): Promise<SendResult> {
  const transport = await getTransport();
  if (!transport) {
    console.log(`[mail] skipped: "${opts.subject}" -> ${opts.to}`);
    return { sent: false };
  }
  try {
    const info = await transport.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER || "Superbae Support <no-reply@superbae.app>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    });
    let previewUrl: string | undefined;
    if (mode === "ethereal" && nodemailerMod?.getTestMessageUrl) {
      previewUrl = nodemailerMod.getTestMessageUrl(info) || undefined;
      if (previewUrl) console.log(`[mail] Preview the email here: ${previewUrl}`);
    } else {
      console.log(`[mail] sent "${opts.subject}" -> ${opts.to}`);
    }
    return { sent: true, previewUrl };
  } catch (err) {
    console.error("[mail] send failed:", err);
    return { sent: false };
  }
}
