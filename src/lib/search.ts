import { slugifyVi } from "./blog-categories";

export type SearchKind = "card" | "account" | "post" | "page";

export interface SearchItem {
  title: string;
  href: string;
  kind: SearchKind;
  /** The issuer or the category — shown under the title, and matched on too. */
  meta?: string;
  /**
   * Vietnamese words a reader would type for this entry that appear nowhere in
   * its title. Four of the tools keep English names on purpose ("Points
   * Calculator", "Transfer Bonus", "Transfer Partners", "Award Flight Finder"),
   * so "tính điểm" and "chuyển điểm" used to find nothing at all.
   *
   * Not `meta`: meta is rendered under the title in the results list, and a
   * line of search bait under "Points Calculator" would read as noise. This is
   * matched and never shown.
   *
   * It belongs on the entry rather than in ALIASES below because every query
   * word has to match, so a word-for-word alias over-constrains: "chuyển điểm"
   * would demand an entry holding both "transfer" AND "points", which
   * "Transfer Bonus" is not. Putting both Vietnamese words on the entry lets
   * the plain matcher do the work.
   */
  keywords?: string;
}

/**
 * Vietnamese gets typed without its diacritics all the time — "the tin dung"
 * has to find "Thẻ tín dụng". slugifyVi already strips the accents and folds
 * everything that is not a letter or a digit into a hyphen, so running both
 * sides of the comparison through it makes the match blind to accents and to
 * punctuation at once: "American Express®" and "american express" come out as
 * the same string. Words end up hyphen-separated rather than space-separated,
 * which is why the query is split on "-" below.
 */
function normalize(text: string): string {
  return slugifyVi(text);
}

/**
 * Short names readers actually type that appear nowhere in the text they mean.
 * Everything else in the card names — "scotia", "td", "rbc" — is already a
 * prefix of the real thing, so a plain substring match finds it.
 */
const ALIASES: Record<string, string[]> = {
  amex: ["american", "express"],
};

/**
 * Every word of the query has to turn up somewhere in the entry, in any order,
 * so "aeroplan amex" still finds "American Express® Aeroplan®* Reserve Card".
 * Entries whose title opens with the first word come first, then the ones that
 * merely contain it, then the ones that only matched on their issuer/category
 * or their Vietnamese keywords — so a keyword match never outranks a title.
 */
export function searchItems(items: SearchItem[], query: string, limit = 8): SearchItem[] {
  const terms = normalize(query)
    .split("-")
    .filter(Boolean)
    .flatMap((term) => ALIASES[term] ?? [term]);
  if (terms.length === 0) return [];

  const matches: { item: SearchItem; rank: number }[] = [];

  for (const item of items) {
    const title = normalize(item.title);
    const haystack = `${title}-${normalize(item.meta ?? "")}-${normalize(item.keywords ?? "")}`;
    if (!terms.every((term) => haystack.includes(term))) continue;
    matches.push({
      item,
      rank: title.startsWith(terms[0]) ? 0 : title.includes(terms[0]) ? 1 : 2,
    });
  }

  return matches
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((match) => match.item);
}
