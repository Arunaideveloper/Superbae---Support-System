export function slugify(input: string): string {
  return (input || "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

// Ensure uniqueness against an async existence check.
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base);
  let slug = root;
  let i = 2;
  while (await exists(slug)) { slug = `${root}-${i}`; i++; }
  return slug;
}
