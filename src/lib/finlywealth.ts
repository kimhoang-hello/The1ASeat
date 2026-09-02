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
export function finlyWealthRebateUrl(applyUrl: string | undefined): string | null {
  if (!applyUrl) return null; // Thẻ có applyUrl bị loại — không có trang rebate nào để đọc.
  let parsed: URL;
  try {
    parsed = new URL(applyUrl);
  } catch {
    return null;
  }

  // `endsWith` trần cũng nhận "notfinlywealth.com" — cùng cái bẫy mà
  // `isReferralUrl` trong `lib/affiliate-links` đã vá. Một host lạ lọt qua đây
  // thì `check-rebates` đi đọc trang FinlyWealth của một đường dẫn không thuộc
  // về nó và báo một con số rebate sai, mà rebate là tiền hiện cho người đọc.
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname !== "finlywealth.com" && !hostname.endsWith(".finlywealth.com")) return null;

  const destination = parsed.searchParams.get("url");
  if (!destination || !destination.startsWith("/rebates/")) return null;

  return `https://www.finlywealth.com${destination}`;
}

/**
 * Hạn giờ cho một lượt đọc FinlyWealth.
 *
 * `check-rebates` duyệt thẻ TUẦN TỰ, nên một trang mở kết nối rồi im giữ luôn
 * cả vòng lặp: mọi thẻ đứng sau nó không được đối chiếu. Job gọi bằng
 * `curl --max-time 300 --retry 3 --retry-all-errors`, nên chuyện đó không đỏ
 * một lần rồi thôi — curl cắt, chạy lại, và ba lượt như vậy là 15 phút không
 * kiểm được gì. Hết giờ thì ném, và `check-rebates` đã có sẵn đường ghi lỗi
 * theo từng thẻ để lượt sau tìm lại được nó.
 */
const FETCH_TIMEOUT_MS = 15_000;

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Ghe1A-RebateCheck/1.0 (+https://ghe1a.com)" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

function rebateFromTitle(html: string): string {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  if (!title) throw new Error("no <title> on the page");

  const amount = title.match(/\$([\d,]+)\s+.*Rebate from FinlyWealth/i)?.[1];
  if (!amount) throw new Error(`no rebate in title: ${title.trim().slice(0, 80)}`);

  return `$${amount}`;
}

/** The dollar figure FinlyWealth currently advertises, formatted as "$120". */
export async function fetchFinlyWealthRebate(url: string): Promise<string> {
  return rebateFromTitle(await fetchPage(url));
}

export interface FinlyWealthOffer {
  rebate: string;
  /** The page's own prose about the current welcome bonus, earn rates and fees. */
  details: string;
}

/**
 * Everything a card's offer copy is written from: the rebate plus the page's
 * "How to earn the welcome bonus", "Earns rewards on" and "Fees & rates"
 * sections. The markup wraps every figure in its own element, so a naive
 * tag-strip shatters each sentence into fragments — join on spaces and let the
 * whitespace collapse put them back together.
 */
export async function fetchFinlyWealthOffer(url: string): Promise<FinlyWealthOffer> {
  const html = await fetchPage(url);
  const text = htmlToText(html);

  const start = text.search(/How to earn the welcome bonus/i);
  const end = text.search(/Built-in perks|Ready when you are|Legal & disclosures/i);
  const details = start === -1 ? "" : text.slice(start, end === -1 ? start + 4000 : end).trim();
  if (!details) throw new Error("no welcome-bonus section on the page");

  return { rebate: rebateFromTitle(html), details: details.slice(0, 4000) };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    // Block-level tags become newlines so sections stay apart; inline tags
    // become spaces so a sentence split across <span>s rejoins as one.
    .replace(/<\/(p|div|li|h[1-6]|section|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
