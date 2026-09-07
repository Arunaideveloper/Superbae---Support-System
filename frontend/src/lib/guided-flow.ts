/**
 * Guided support flow content — the "help me first, file a ticket only if
 * needed" decision tree that fronts the ticketing app.
 *
 * This is PURE CONTENT (no backend, no runtime logic): a set of categories,
 * each a small tree of question nodes leading to solution nodes. Solutions are
 * grounded in the Superbae knowledge base (the customer help guide + FAQ). Edit
 * freely — add options, questions or solutions without touching the engine.
 */

export interface CollectField {
  name: string;
  label: string;
  type?: "text" | "email" | "textarea";
  placeholder?: string;
}

export interface GuidedOption {
  label: string;
  /** id of the next node in this category's `nodes` map */
  to: string;
}

export interface QuestionNode {
  kind: "question";
  prompt: string;
  note?: string;
  options: GuidedOption[];
}

export interface SolutionNode {
  kind: "solution";
  title: string;
  /** the self-serve answer, as ordered steps */
  steps: string[];
  /** best-effort KB search to surface a related published article (optional) */
  articleQuery?: string;
  /** extra info to gather before creating a support request (optional) */
  collect?: CollectField[];
  /** safety / account-critical: always hand to a human, skip "did this solve it?" */
  escalate?: boolean;
  /** subject used to pre-fill the ticket if the user contacts support */
  ticketSubject: string;
}

export type GuidedNode = QuestionNode | SolutionNode;

export interface GuidedCategory {
  key: string;
  icon: string;
  title: string;
  blurb: string;
  /** id of the first node to show */
  start: string;
  nodes: Record<string, GuidedNode>;
}

export const GUIDED_CATEGORIES: GuidedCategory[] = [
  {
    key: "styling",
    icon: "👗",
    title: "Outfits & styling with Ara",
    blurb: "Recommendations, shuffling, building looks yourself",
    start: "s0",
    nodes: {
      s0: {
        kind: "question",
        prompt: "What do you need help with?",
        options: [
          { label: "My outfits don't feel like me", to: "sol_notme" },
          { label: "I want a completely different look", to: "sol_diff" },
          { label: "I'd rather build an outfit myself", to: "sol_manual" },
          { label: "Ara won't load or won't suggest", to: "sol_stuck" },
        ],
      },
      sol_notme: {
        kind: "solution",
        title: "Help Ara learn your taste",
        steps: [
          "Add more items to your closet and fill in each item's details — category, colour, style and season.",
          "Rate your favourite pieces with stars so Ara knows your go-tos.",
          "On any look, tap Love it / It's okay / Not for me — the more you react, the more personal your looks become.",
          "Re-run the styling flow (occasion + mood) whenever your taste changes.",
        ],
        articleQuery: "outfits feel like me",
        ticketSubject: "My outfits don't feel like me",
      },
      sol_diff: {
        kind: "solution",
        title: "Get a fresh set of looks",
        steps: [
          "Tap Shuffle again for a new set of suggestions.",
          "Open Chat with AI and describe the vibe you want — a different mood, a swap, or advice for an occasion.",
          "Change your occasion or mood at the top of the styling flow to steer the whole look.",
        ],
        articleQuery: "shuffle different look",
        ticketSubject: "I'd like different styling results",
      },
      sol_manual: {
        kind: "solution",
        title: "Build a look yourself",
        steps: [
          "Open Create Outfit and add items to each slot — Tops, Pants, Shoes and Bags.",
          "Or use the AI Drag Studio: drag pieces onto the figure, then tap AI Suggest to refine.",
          "Tap View Full Look / Create outfits to save it — saved looks live under My Outfits.",
        ],
        articleQuery: "create outfit drag studio",
        ticketSubject: "Building an outfit manually",
      },
      sol_stuck: {
        kind: "solution",
        title: "When Ara won't load",
        steps: [
          "Check your internet connection and try again.",
          "Close and reopen the app, then tap Try Ara! on the home banner.",
          "Make sure you have a few items in your closet — Ara styles from your own wardrobe.",
        ],
        collect: [{ name: "device", label: "Your phone / device", placeholder: "e.g. iPhone 14, Android" }],
        articleQuery: "ara not loading",
        ticketSubject: "Ara isn't loading suggestions",
      },
    },
  },
  {
    key: "closet",
    icon: "📸",
    title: "Closet & photos",
    blurb: "Uploads, background removal, finding items",
    start: "s0",
    nodes: {
      s0: {
        kind: "question",
        prompt: "What's happening with your closet?",
        options: [
          { label: "My photo upload failed", to: "sol_upload" },
          { label: "The background didn't remove cleanly", to: "sol_bg" },
          { label: "I can't find an item I added", to: "sol_find" },
          { label: "Bulk upload isn't working", to: "sol_bulk" },
        ],
      },
      sol_upload: {
        kind: "solution",
        title: "Fixing a failed upload",
        steps: [
          "Check your connection and try the upload again.",
          "For a single stubborn item, add it with Camera or Album instead of bulk upload.",
          "Use a clear, well-lit photo — very large images can time out.",
        ],
        collect: [{ name: "item", label: "What were you uploading?", placeholder: "e.g. a black dress" }],
        articleQuery: "upload failed",
        ticketSubject: "Photo upload failed",
      },
      sol_bg: {
        kind: "solution",
        title: "Getting a clean cut-out",
        steps: [
          "Use a well-lit photo against a plain background for the cleanest cut-out.",
          "Re-upload the item — you'll briefly see a 'Removing background' step while it processes.",
          "Avoid busy or dark backgrounds; they make the cut-out rough.",
        ],
        articleQuery: "background removal",
        ticketSubject: "Background removal isn't clean",
      },
      sol_find: {
        kind: "solution",
        title: "Finding an item in your closet",
        steps: [
          "Use the category tabs across the top of your closet (All, Top, Bottom, Pants, Jeans…).",
          "Open the filter panel to narrow by season, colour and category.",
          "Tap the favourites icon if you hearted the item.",
          "If you archived it, check Move to Bin.",
        ],
        articleQuery: "browse closet filter",
        ticketSubject: "Can't find an item in my closet",
      },
      sol_bulk: {
        kind: "solution",
        title: "Bulk uploading your wardrobe",
        steps: [
          "Tap Add More Images to select several photos at once, then Bulk Upload to add them together.",
          "Add photos in smaller batches if a large batch fails.",
          "Fill in each item's details after the bulk upload finishes.",
        ],
        articleQuery: "bulk upload",
        ticketSubject: "Bulk upload issue",
      },
    },
  },
  {
    key: "account",
    icon: "🔐",
    title: "Account & login",
    blurb: "Signing in, resets, profile, your data",
    start: "s0",
    nodes: {
      s0: {
        kind: "question",
        prompt: "What do you need?",
        options: [
          { label: "I can't log in", to: "q_login" },
          { label: "Update my profile or style preferences", to: "sol_profile" },
          { label: "Delete my account or data", to: "sol_delete" },
        ],
      },
      q_login: {
        kind: "question",
        prompt: "Can you receive the password-reset email?",
        note: "This helps us point you the fastest way in.",
        options: [
          { label: "Yes, the email arrives", to: "sol_reset_yes" },
          { label: "No email ever arrives", to: "sol_reset_no" },
        ],
      },
      sol_reset_yes: {
        kind: "solution",
        title: "Reset your password",
        steps: [
          "Open the reset email and follow the link to set a new password.",
          "Check spam / junk if it isn't in your inbox.",
          "If you requested more than one, use the newest email — older links expire.",
        ],
        ticketSubject: "Help logging in",
      },
      sol_reset_no: {
        kind: "solution",
        title: "When the reset email doesn't arrive",
        steps: [
          "Check your spam / junk folder and wait a couple of minutes.",
          "Make sure you're using the email you signed up with.",
          "If nothing arrives, our team can verify your account and get you back in.",
        ],
        collect: [{ name: "email", label: "Account email", type: "email", placeholder: "you@example.com" }],
        articleQuery: "reset password",
        ticketSubject: "Password reset email not arriving",
      },
      sol_profile: {
        kind: "solution",
        title: "Managing your profile",
        steps: [
          "Re-run the styling questions any time from the home banner to update your occasion and mood preferences.",
          "Add, edit or rate closet items to keep Ara in sync with your taste.",
          "Your style profile powers every recommendation, so keep it current.",
        ],
        articleQuery: "managing profile",
        ticketSubject: "Updating my profile",
      },
      sol_delete: {
        kind: "solution",
        title: "Account & data requests",
        steps: [
          "Account and data deletion are handled by our support team.",
          "Tell us the email on your account below and we'll take care of it.",
        ],
        collect: [{ name: "email", label: "Account email", type: "email", placeholder: "you@example.com" }],
        escalate: true,
        ticketSubject: "Account / data deletion request",
      },
    },
  },
  {
    key: "billing",
    icon: "💳",
    title: "Subscription & payment",
    blurb: "Plans, payments and billing questions",
    start: "s0",
    nodes: {
      s0: {
        kind: "question",
        prompt: "What's this about?",
        options: [
          { label: "A question about my plan", to: "sol_plan" },
          { label: "A payment or billing problem", to: "sol_payment" },
        ],
      },
      sol_plan: {
        kind: "solution",
        title: "Plan & subscription questions",
        steps: [
          "Your plan details live in the app's account area.",
          "If you can't find what you need there, our team can confirm the specifics for your account.",
        ],
        ticketSubject: "Question about my plan",
      },
      sol_payment: {
        kind: "solution",
        title: "Payment problems",
        steps: [
          "Double-check your payment method is valid and has funds.",
          "Try the payment again after a few minutes.",
          "If it keeps failing, send us the details below and we'll investigate.",
        ],
        collect: [
          { name: "email", label: "Account email", type: "email", placeholder: "you@example.com" },
          { name: "detail", label: "What happened?", type: "textarea", placeholder: "e.g. card declined at checkout" },
        ],
        ticketSubject: "Payment / billing problem",
      },
    },
  },
  {
    key: "safety",
    icon: "🛡️",
    title: "Report something / safety",
    blurb: "Report content or a safety concern",
    start: "sol_safety",
    nodes: {
      sol_safety: {
        kind: "solution",
        title: "We'll get a person on this right away",
        steps: [
          "Reports and safety concerns are always handled by our team — never a bot.",
          "Tell us what happened below and we'll prioritise it.",
          "If you or someone else is in immediate danger, contact your local emergency services.",
        ],
        collect: [{ name: "detail", label: "What would you like to report?", type: "textarea", placeholder: "Share as much as you're comfortable with" }],
        escalate: true,
        ticketSubject: "Report / safety concern",
      },
    },
  },
  {
    key: "other",
    icon: "❓",
    title: "Something else",
    blurb: "Anything not covered above",
    start: "sol_other",
    nodes: {
      sol_other: {
        kind: "solution",
        title: "Tell us what you need",
        steps: [
          "Describe your question below and we'll point you the right way.",
          "You can also search the Help Center or ask Ara for a quick answer.",
        ],
        collect: [{ name: "detail", label: "How can we help?", type: "textarea", placeholder: "Describe your question" }],
        articleQuery: "",
        ticketSubject: "Support request",
      },
    },
  },
];

export function getCategory(key: string): GuidedCategory | undefined {
  return GUIDED_CATEGORIES.find((c) => c.key === key);
}
