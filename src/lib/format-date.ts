/**
 * Dates are written dd/MM/yyyy, the way the card copy in Contentful already
 * writes them. The previous "d MMM yyyy" with the Vietnamese locale rendered
 * "1 thg 11 2026" directly above copy that said "01/11/2026" — the same date in
 * two shapes, a few lines apart, on every card with an expiry.
 *
 * The day comes from the wall clock written in the string, not from the machine
 * rendering it. Contentful stores every date here with the offer's own offset
 * ("2026-11-04T23:59-05:00" = 4 November, 23:59 Toronto time), and going through
 * `new Date()` + a local-time formatter re-reads that instant in the *server's*
 * timezone instead. Hostinger runs in UTC, so that turned the WestJet card's
 * "hết hạn 04/11/2026" into 05/11/2026 on the live site — a day of offer the
 * reader does not actually have — while it looked right on a laptop in Toronto.
 * Cutting the date straight out of the string is the same trick, and the same
 * reason, as `formatIsoDate` in lib/bank-accounts.ts.
 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export function formatDate(dateStr: string): string {
  const match = ISO_DATE.exec(dateStr.trim());
  if (!match) return dateStr;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
