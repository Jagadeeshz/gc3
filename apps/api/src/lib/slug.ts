/**
 * Turn a display name into a URL-safe slug: "Cloud Migration & Ops" becomes
 * "cloud-migration-ops". Names are arbitrary tenant input, so a value that
 * slugifies to nothing (or to a single character) falls back to a prefixed
 * timestamp rather than producing an unusable unique key.
 */
export function slugify(name: string, prefix = 'item'): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug.length >= 2 ? slug : `${prefix}-${Date.now().toString(36)}`;
}
