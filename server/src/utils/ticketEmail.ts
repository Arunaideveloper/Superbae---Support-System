import { env } from "../config/env.js";

export interface TicketEmailData {
  reference: string;
  subject: string;
  status: string;
  name?: string;
  description?: string;
}

/** Branded HTML "support ticket" email (table-based for email-client compatibility). */
export function ticketEmailHtml(d: TicketEmailData): string {
  const name = d.name || "there";
  const created = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return `<!doctype html><html><body style="margin:0;background:#fff5f9;padding:24px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#3a2b33;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:linear-gradient(160deg,#fde7f1,#f9c9de);border-radius:20px;overflow:hidden;box-shadow:0 12px 30px -12px rgba(217,85,123,.35);">
      <tr><td style="padding:0;">
        <img src="cid:ticketBanner" alt="Superbae Support Ticket" width="520" style="display:block;width:100%;max-width:520px;border:0;" />
      </td></tr>
      <tr><td style="padding:6px 32px 0;">
        <div style="border-top:2px dashed #f3aac6;margin:16px 0;"></div>
      </td></tr>
      <tr><td style="padding:0 32px 8px;">
        <p style="font-size:15px;margin:0 0 14px;">Hi ${escapeHtml(name)}, your request has been received. Keep this reference to track it.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffffcc;border-radius:14px;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:11px;letter-spacing:2px;color:#b26b8e;">REFERENCE</div>
            <div style="font-size:26px;font-weight:800;color:#d9557b;letter-spacing:2px;margin-top:2px;">${escapeHtml(d.reference)}</div>
            <div style="margin-top:14px;font-size:11px;letter-spacing:2px;color:#b26b8e;">SUBJECT</div>
            <div style="font-size:15px;font-weight:600;color:#2b2b2b;margin-top:2px;">${escapeHtml(d.subject)}</div>
            <div style="margin-top:14px;font-size:11px;letter-spacing:2px;color:#b26b8e;">STATUS</div>
            <div style="display:inline-block;margin-top:4px;background:#fbe3ea;color:#b23a5e;font-weight:700;font-size:12px;padding:4px 12px;border-radius:999px;text-transform:capitalize;">${escapeHtml(d.status)}</div>
            <div style="margin-top:14px;font-size:12px;color:#7a6b72;">Opened ${escapeHtml(created)}</div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 30px;text-align:center;">
        <a href="${escapeAttr(env.APP_URL)}/help" style="display:inline-block;background:#e8459a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:12px;">Visit the Help Center</a>
        <p style="font-size:11.5px;color:#a98ba0;margin:16px 0 0;">Superbae Support · Please don't reply to this automated message.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function ticketEmailText(d: TicketEmailData): string {
  return `Superbae Support Ticket\n\nReference: ${d.reference}\nSubject: ${d.subject}\nStatus: ${d.status}\n\nKeep this reference to track your request. Visit ${env.APP_URL}/help for help.`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function escapeAttr(s: string): string { return escapeHtml(s); }
