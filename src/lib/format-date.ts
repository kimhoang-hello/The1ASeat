import { format } from "date-fns";

/**
 * Dates are written dd/MM/yyyy, the way the card copy in Contentful already
 * writes them. The previous "d MMM yyyy" with the Vietnamese locale rendered
 * "1 thg 11 2026" directly above copy that said "01/11/2026" — the same date in
 * two shapes, a few lines apart, on every card with an expiry.
 *
 * The offset in the string decides the day, so a value has to carry the right
 * one: "2026-11-25T00:00-04:00" is 24 November once DST has ended, and reads as
 * the 24th anywhere west of UTC even though the copy beside it says the 25th.
 */
export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "dd/MM/yyyy");
}
