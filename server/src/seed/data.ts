/**
 * Seed content for Superbae — the same knowledge base, assistant Q&A and demo
 * accounts the app ships with. Kept in one place so seeding is easy to review.
 */

export const CATEGORIES = [
  { name: "Getting Started", slug: "getting-started", icon: "sparkles", color: "#7C3AED", order: 1,
    description: "Set up Superbae and take your first styled photo." },
  { name: "Your Closet", slug: "your-closet", icon: "shirt", color: "#EC4899", order: 2,
    description: "Add, organise and tag the clothes you own." },
  { name: "Outfits & Ara", slug: "outfits-ara", icon: "wand", color: "#F59E0B", order: 3,
    description: "Get outfit ideas from Ara, your AI stylist." },
  { name: "Account & Billing", slug: "account-billing", icon: "credit-card", color: "#10B981", order: 4,
    description: "Manage your plan, profile and subscription." },
  { name: "Troubleshooting", slug: "troubleshooting", icon: "life-buoy", color: "#EF4444", order: 5,
    description: "Fix common problems with photos, sync and login." },
];

export const ARTICLES = [
  {
    categorySlug: "getting-started",
    title: "Welcome to Superbae",
    body: `# Welcome to Superbae 💜

Superbae is your personal AI wardrobe. Snap your clothes, build your digital closet, and let **Ara** — your AI stylist — put together outfits for any occasion.

## What you can do
- Build a digital closet from photos of clothes you already own
- Ask Ara for outfit ideas based on weather, occasion and your style
- Save favourite looks and plan outfits ahead of time

## Your first 5 minutes
1. Create your account and set your style preferences.
2. Add 5–10 items to your closet (see *Add your first items*).
3. Open **Outfits** and tap *Ask Ara* for your first look.

Welcome to the family — let's get you styled.`,
  },
  {
    categorySlug: "getting-started",
    title: "Add your first items",
    body: `# Add your first items

The magic starts once Ara can see what you own.

## Add an item
1. Tap the **+** button on the Closet tab.
2. Take a photo, or pick one from your gallery.
3. Superbae auto-detects the item type and colour — adjust if needed.
4. Add tags like *work*, *summer* or *favourite* and save.

## Tips for great photos
- Lay the item flat on a plain background.
- Use natural light where possible.
- One item per photo works best for auto-detection.

The more you add, the better Ara's outfit suggestions become.`,
  },
  {
    categorySlug: "your-closet",
    title: "Organise your closet with tags",
    body: `# Organise your closet with tags

Tags help you (and Ara) find the right piece fast.

## How tagging works
Every item can have multiple tags — season, occasion, colour or your own labels. Filter your closet by any tag from the search bar.

## Suggested tag sets
- **Season:** spring, summer, autumn, winter
- **Occasion:** work, casual, party, gym
- **Status:** favourite, needs-repair, to-donate

Consistent tags make Ara's suggestions sharper.`,
  },
  {
    categorySlug: "your-closet",
    title: "Edit or remove an item",
    body: `# Edit or remove an item

## Edit
Open any item, tap **Edit**, and update its photo, type, colour or tags. Changes sync across your devices instantly.

## Remove
Tap **Edit → Remove item**. Removed items disappear from future outfit suggestions but any saved looks that used them are kept for reference.

## Archive instead of delete
Not wearing something this season? Use **Archive** to hide it from suggestions without losing it.`,
  },
  {
    categorySlug: "outfits-ara",
    title: "Ask Ara for an outfit",
    body: `# Ask Ara for an outfit

Ara is your AI stylist. Tell her the occasion and she'll build a look from your closet.

## How to ask
1. Open the **Outfits** tab and tap *Ask Ara*.
2. Describe the moment — "brunch with friends", "rainy work day", "first date".
3. Ara suggests a full look. Swipe to see alternatives.

## Make it yours
- Tap any piece to swap it for a similar item you own.
- Save the look to your **Lookbook** to wear later.
- Rate suggestions so Ara learns your taste.`,
  },
  {
    categorySlug: "outfits-ara",
    title: "Plan outfits ahead of time",
    body: `# Plan outfits ahead of time

Never stare at your closet on a busy morning again.

## Plan a look
1. In **Lookbook**, tap the calendar icon.
2. Pick a date and attach a saved outfit.
3. Superbae reminds you the night before.

## Travel packing
Create a trip, add the looks you'll wear, and Superbae generates a packing list from the items involved.`,
  },
  {
    categorySlug: "account-billing",
    title: "Manage your subscription",
    body: `# Manage your subscription

## Plans
Superbae offers a free tier (limited closet size) and **Superbae Plus** (unlimited items, advanced Ara styling, outfit planning).

## Change or cancel
1. Go to **Profile → Subscription**.
2. Tap *Change plan* to upgrade or downgrade.
3. Cancel anytime — you keep Plus features until the end of the billing period.

Billing is handled securely through your app store. Refund requests follow your app store's policy.`,
  },
  {
    categorySlug: "troubleshooting",
    title: "Photos not uploading or syncing",
    body: `# Photos not uploading or syncing

Try these steps in order:

1. **Check your connection** — sync needs internet.
2. **Update the app** to the latest version.
3. **Grant photo & camera permissions** in your device settings.
4. **Sign out and back in** to refresh your session.
5. Still stuck? Open a support ticket with your device model and app version — we'll help fast.

Your closet is backed up to your account, so reinstalling the app never loses your items.`,
  },
];

export const ASSISTANT_QA = [
  { question: "How do I add clothes to my closet?",
    answer: "Tap the + button on the Closet tab, take or pick a photo, confirm the auto-detected type and colour, add tags, and save. One item per photo works best.",
    keywords: "add,item,closet,photo,upload,clothes", order: 1 },
  { question: "How does Ara suggest outfits?",
    answer: "Open the Outfits tab and tap 'Ask Ara'. Describe the occasion — like 'rainy work day' — and Ara builds a full look from items you own. Swipe for alternatives and tap any piece to swap it.",
    keywords: "ara,outfit,suggest,style,look,stylist", order: 2 },
  { question: "How do I plan outfits for the week?",
    answer: "In your Lookbook, tap the calendar icon, pick a date and attach a saved outfit. Superbae reminds you the night before.",
    keywords: "plan,calendar,week,schedule,lookbook", order: 3 },
  { question: "How do I upgrade to Superbae Plus?",
    answer: "Go to Profile → Subscription and tap 'Change plan'. Superbae Plus gives you an unlimited closet, advanced Ara styling and outfit planning.",
    keywords: "upgrade,plus,subscription,plan,billing,premium", order: 4 },
  { question: "My photos won't sync — what do I do?",
    answer: "Check your internet connection, update the app, make sure camera and photo permissions are granted, then sign out and back in. If it still fails, open a support ticket with your device model and app version.",
    keywords: "sync,upload,photo,error,not working,problem", order: 5 },
  { question: "Will I lose my closet if I reinstall the app?",
    answer: "No — your closet is backed up to your account. Just sign back in after reinstalling and everything returns.",
    keywords: "reinstall,lose,backup,account,restore", order: 6 },
];

export const SUGGESTED_QUESTIONS = [
  "How do I add clothes to my closet?",
  "How does Ara suggest outfits?",
  "How do I upgrade to Superbae Plus?",
  "My photos won't sync — what do I do?",
];

export const DEMO_USERS = [
  { username: "admin", email: "admin@superbae.app", password: "admin123", role: "admin" },
  { username: "agent", email: "agent@superbae.app", password: "agent123", role: "agent" },
  { username: "priya", email: "priya@example.com", password: "priya123", role: "customer" },
];

export const DEMO_TICKETS = [
  { by: "priya", subject: "Ara isn't suggesting outfits", description: "I added 12 items but Ask Ara shows nothing.",
    priority: "high", category: "Outfits & Ara" },
  { by: "priya", subject: "Photo upload keeps failing", description: "Uploads spin forever on my iPhone.",
    priority: "medium", category: "Troubleshooting", source: "ios_app" },
];
