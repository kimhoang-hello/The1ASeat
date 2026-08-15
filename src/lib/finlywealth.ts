/**
 * Reading the current rebate off FinlyWealth.
 *
 * The apply links stored on a card are affiliate redirects of the form
 * `https://www.finlywealth.com/r/<ref>?url=<encoded path>&utm_source=...`.
 * The `url` param is the real destination, and only the `/rebates/...` ones
 * are rebate products — a card linked to `/credit-cards/rewards-calculator/...`
 * has no rebate to read.
 *
 * The amount is in the page's <title>, e.g.
 *   "$200 BMO VIPorter World Elite Rebate from FinlyWealth"
 * which is stable, server-rendered, and needs no JavaScript. The body repeats
 * the figure but also carries a struck-through previous amount ("Get $125$200
 * rebate"), so the title is the one place it appears unambiguously.
 */

/** The FinlyWealth page an apply link points at, or null if it is not one. */
export function finlyWealthRebateUrl(applyUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(applyUrl);
  } catch {
    return null;
  }

  if (!parsed.hostname.endsWith("finlywealth.com")) return null;

  const destination = parsed.searchParams.get("url");
  if (!destination || !destination.startsWith("/rebates/")) return null;

  return `https://www.finlywealth.com${destination}`;
}

/** The dollar figure FinlyWealth currently advertises, formatted as "$120". */
export async function fetchFinlyWealthRebate(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Ghe1A-RebateCheck/1.0 (+https://ghe1a.com)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  if (!title) throw new Error("no <title> on the page");

  const amount = title.match(/\$([\d,]+)\s+.*Rebate from FinlyWealth/i)?.[1];
  if (!amount) throw new Error(`no rebate in title: ${title.trim().slice(0, 80)}`);

  return `$${amount}`;
}
