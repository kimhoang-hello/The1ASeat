/**
 * The canonical social profiles for Ghế 1A. These end up in three places that
 * have to agree — the footer icons, the About page, and the `sameAs` arrays in
 * JSON-LD — so they live here rather than being retyped at each call site.
 */
export const SOCIAL_LINKS = [
  { name: "YouTube", url: "https://youtube.com/@hoangleca" },
  { name: "Facebook", url: "https://www.facebook.com/groups/2252639114946104" },
] as const;

/** `sameAs` for schema.org entities, in the order above. */
export const SOCIAL_SAME_AS = SOCIAL_LINKS.map((link) => link.url);
