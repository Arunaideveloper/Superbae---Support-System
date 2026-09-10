/**
 * Verify email is configured and can send.
 *   npm run mail:test your@email.com
 * Prints the SMTP config it sees, then attempts a send.
 */
import { env } from "../config/env.js";
import { sendMail, mailerConfigured } from "../utils/mailer.js";

async function main() {
  console.log("SMTP host :", env.SMTP_HOST || "(empty)");
  console.log("SMTP user :", env.SMTP_USER || "(empty)");
  console.log("From      :", env.EMAIL_FROM || env.SMTP_USER || "(empty)");
  console.log("Configured:", mailerConfigured());
  const to = process.argv[2] || env.SMTP_USER;
  if (!to) {
    console.error("\nUsage: npm run mail:test you@email.com");
    process.exit(1);
  }
  console.log(`\nSending test email to ${to} ...`);
  const result = await sendMail({
    to,
    subject: "Superbae email test ✅",
    html: "<b>It works!</b> Your Superbae SMTP settings are correct.",
    text: "It works! Your Superbae SMTP settings are correct.",
  });
  if (result.sent && result.previewUrl) {
    console.log(`\n✅ Sent to the Ethereal test inbox. Preview it here:\n   ${result.previewUrl}`);
    console.log("   (This is a test inbox — set SMTP_* in server/.env to deliver to real inboxes.)");
  } else if (result.sent) {
    console.log(`\n✅ Sent to ${to} — check inbox and spam.`);
  } else {
    console.log("\n❌ Not sent — see the error above.");
  }
  process.exit(result.sent ? 0 : 1);
}
main();
