/**
 * Shared shell for /terms and /privacy.
 *
 * Both are long-form legal prose with the same needs: a narrow measure, a
 * visible "last updated" line so a reader can tell whether what they are
 * reading is current, and headings that sit far enough apart to scan. Keeping
 * one date constant means the two pages cannot disagree about when they were
 * last revised.
 */

/** Bump this whenever the wording on either legal page actually changes. */
export const LEGAL_UPDATED = "20/08/2026";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-balance font-display text-3xl font-extrabold text-foreground">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Cập nhật lần cuối: {updated}</p>
      <div className="prose prose-neutral mt-8 max-w-none prose-headings:font-display prose-headings:text-foreground prose-h2:mt-10 prose-h2:text-xl prose-a:text-primary">
        {children}
      </div>
    </article>
  );
}
