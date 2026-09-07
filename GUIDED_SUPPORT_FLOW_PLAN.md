# Plan — Instagram-Style Guided Support Flow (User Front Door)

_A public, guided "help me first, file a ticket only if needed" flow — the new front door for users. The existing user dashboard is kept exactly as-is and reused for tracking replies. Nothing built yet; this is the plan. Backend logic is untouched throughout._

---

## The decisions this plan is built on

- **Public flow.** Anyone can troubleshoot without logging in. Sign-in is asked for **only** at the "Create Support Request" step (so support can reply and the user can track it).
- **Existing user dashboard: no changes.** The current customer Tickets page stays as it is. It becomes the place where a user sees their request and reads the human reply. We do not rebuild it.
- **Backend untouched.** Everything below runs against endpoints that already exist.

---

## The flow (your diagram, mapped to screens)

```
User → Help Center (public)                     ← existing HelpCenter page (front door)
   ↓
"What problem are you facing?"  → category picker   ← NEW screen
   ↓
System asks relevant questions  → guided Q&A        ← NEW (per-category steps)
   ↓
Collect required information     → dynamic fields    ← NEW
   ↓
AI / rules identify the issue    → match KB + Ara    ← existing assistant + KB
   ↓
Give solution                                       ← existing KB articles / curated answers
   ↓
Problem solved?
   ├── YES → Done 🎉
   └── NO  → Create Support Request  → SIGN IN here  ← existing login + POST /api/tickets
                 ↓
             Human support / specialist              ← existing admin/agent ticket tools
                 ↓
             Reply to user → user reads it in the existing dashboard  ← UNCHANGED
```

So: **new public front-of-funnel**, feeding into the **existing, unchanged** ticket + dashboard system at the very end.

---

## Screen-by-screen

1. **Help Center home (front door).** Already exists at `#/help`. Add a prominent entry point: "Get help with a problem →" that starts the guided flow. Keep the existing search and topic browsing.

2. **Category picker — "What problem are you facing?"** (NEW). A grid of tappable cards. Proposed Superbae set (editable):
   - 👗 Outfit suggestions / styling
   - 📷 Closet & photos (uploads, sync)
   - 🔐 Account & login
   - 💳 Subscription & payment
   - 🛡️ Report something / safety
   - ❓ Something else

3. **Guided questions** (NEW). Each category has a short, ordered set of follow-up questions (a simple decision tree defined in a content file, like the existing `helpTopics.ts`). Example — "Account & login": *Can you receive the reset email? → yes/no*, *Is the account showing "locked"? → yes/no*, etc. Branches lead to a matching solution.

4. **Collect required info** (NEW). Based on the branch, show only the fields support would need (e.g. account email, order id, screenshot note). Kept minimal.

5. **Solution** (existing content). Show the best-matching answer, drawn from: published **Knowledge Base articles** (`/api/public/kb`), the **admin Q&A / Ara matcher** (already built), and — if the AI layer is running — its answer. Ends with **"Did this solve it?" Yes / No**.

6. **Yes → Done.** Friendly confirmation; offer to browse more help.

7. **No → Create Support Request.** Here (and only here) the user **signs in or signs up** (existing login). On submit, a ticket is created via the existing `POST /api/tickets` with everything already collected pre-filled:
   - `category` / `subcategory` = the picked category / branch
   - `description` = the guided answers + collected info, formatted
   - `subject` = a generated summary (e.g. "Account & login — can't receive reset email")
   - `tags` = the flow path (for triage)

8. **Tracking the reply.** The user lands in the **existing dashboard** (unchanged), where the new ticket appears and the human reply shows in the message thread — exactly as today.

---

## What's reused vs. new

| Piece | Status |
|---|---|
| Help Center page (`HelpCenter.tsx`) | **Reuse**, add an entry point |
| Assistant / Ara matcher + curated Q&A | **Reuse** for the "solution" step |
| Knowledge Base content (`/api/public/kb`) | **Reuse** as solution source |
| Login / sign-up | **Reuse**, invoked at the submit step |
| `POST /api/tickets` (create) | **Reuse**, pre-filled from the flow |
| Existing user dashboard (Tickets page) | **Unchanged**, used for tracking |
| Category picker, guided Q&A, dynamic fields | **New** (frontend only) |
| Flow content (categories → questions → solutions) | **New** content file, like `helpTopics.ts` |

---

## Backend: nothing changes

Every step maps to an existing endpoint: public assistant config/ask, public KB, login, and ticket creation. The guided flow is entirely new **frontend** screens plus one new **content file** describing the categories, questions, and solutions. No routes, models, or logic in `server/` are touched.

---

## What I still need from you before building

1. **Confirm the category list** (the six proposed above, or your own).
2. **The guided questions + solutions per category** — this is the real content of the flow. I can draft a first version from your existing knowledge-base docs (`Superbae Design/Superbae_Knowledge_Base*.docx`) and the help topics already in the app, then you refine.
3. Whether the guided flow should be the **default landing** for the Help Center, or a clearly-labeled button alongside the current browse view.

---

## Rough effort

| Step | Scope | Est. |
|---|---|---|
| Flow content file (categories → questions → solutions) | drafted from your KB, you refine | ~1 day |
| Category picker + guided Q&A engine (frontend) | reusable step/decision-tree component | ~1–1.5 days |
| Solution step wired to KB + Ara | reuse existing matchers | ~0.5 day |
| "Create request" step: sign-in gate + pre-filled ticket | reuse login + create endpoint | ~0.5 day |
| Polish, mobile layout, hooking into Help Center | | ~0.5 day |

A clickable end-to-end flow for **one** category (proving the whole path into a ticket) is reachable in ~1–1.5 days; all categories once the content is set.

---

## Recommended first move

Build the full path for **one** category — "Account & login" — end to end: picker → 2–3 questions → a KB-backed solution → "No" → sign in → pre-filled ticket in the existing dashboard. That proves the entire funnel with the least content, and every other category is then just more entries in the content file.
