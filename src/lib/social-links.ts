/**
 * The canonical social profiles for Ghế 1A. These end up in several places that
 * have to agree — the footer icons, the About page, and the `sameAs` arrays in
 * JSON-LD — so they live here rather than being retyped at each call site.
 *
 * `personal` marks a profile that identifies Hoàng himself rather than the
 * publication. schema.org reads `sameAs` on a Person as "these are the same
 * person", so a community group belongs on the Organization only.
 */
export const SOCIAL_LINKS = [
  { name: "YouTube", url: "https://youtube.com/@hoangleca", personal: true },
  {
    name: "Facebook",
    url: "https://www.facebook.com/groups/2252639114946104",
    personal: false,
  },
] as const;

/** `sameAs` for the Organization entity — every profile the site runs. */
export const ORGANIZATION_SAME_AS = SOCIAL_LINKS.map((link) => link.url);

/** `sameAs` for the author Person entity — only profiles that are him. */
export const PERSON_SAME_AS = SOCIAL_LINKS.filter((link) => link.personal).map(
  (link) => link.url,
);
