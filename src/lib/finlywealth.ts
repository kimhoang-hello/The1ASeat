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
 * cả vòng lặp: mọi thẻ đứng sau nó không được đối chiếu.
 *
 * Từ 09/09/2026 hạn giờ này quan trọng hơn trước chứ không kém đi: job không
 * còn gọi qua `curl --max-time 300` nữa mà chạy thẳng trong runner (xem
 * `scripts/check-rebates.mts`). Vẫn còn lớp cắt khác — mặc định của undici và
 * hạn 360 phút của Actions — nhưng chúng tính bằng phút tới hàng giờ, còn đây
 * là lớp DUY NHẤT cắt ở thang giây, tức lớp duy nhất giữ được lượt chạy trong
 * khoảng thời gian còn có ích. Hết giờ thì ném, và `check-rebates` đã có sẵn đường ghi lỗi theo từng
 * thẻ — nay còn đánh dấu `retryable` để lượt sau thử lại đúng loại lỗi này.
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

/**
 * Con số rebate trong `<title>`, hoặc `null` khi tiêu đề KHÔNG nói rõ được một
 * con số duy nhất.
 *
 * Bản cũ đọc `\$([\d,]+)\s+.*Rebate from FinlyWealth` và lấy con số `$` ĐẦU
 * TIÊN nó gặp. Cả hai đường đọc rebate (thẻ tín dụng ở file này, tài khoản
 * ngân hàng ở `scripts/check-bank-rebates.mts`) đều dùng đúng dòng đó, và cả
 * hai đều tự ghi con số đọc được lên site: `check-rebates` sửa `rebateVi` cộng
 * câu HOT TIP rồi publish, script kia sửa thẳng `bank-accounts.ts` rồi commit.
 * Nên một tiêu đề có HAI con số — `"$700 in welcome value plus $200 … Rebate
 * from FinlyWealth"` — được đọc thành `$700`, và site hứa dư $500 cho người
 * đọc mà không gate nào đỏ. `"$2,00 … Rebate"` (dấu phẩy sai chỗ) cũng qua.
 *
 * Cả 39 trang đang dùng (10 thẻ + 29 tài khoản, đo 19/09/2026) đều là dạng
 * `"$NNN <tên sản phẩm> Rebate from FinlyWealth"` — đúng MỘT con số. Nên luật
 * mới là: thấy nhiều hơn một con số `$`, hoặc con số không đúng dạng số tiền,
 * thì KHÔNG đoán — trả `null` để nơi gọi ném. Cùng nguyên tắc fail-closed mà
 * file này đã áp cho `<title>` rỗng và cho phép so host chính xác: rebate là
 * tiền hiện cho người đọc, đoán sai tốn hơn đỏ một lượt job.
 *
 * KHÔNG neo `^\$`: tiêu đề dạng `"Up to $75 … Rebate from FinlyWealth"` vẫn
 * đọc được, đúng như `check-bank-rebates.mts` đã ghi là hợp lệ. Cũng không neo
 * cuối chuỗi, để FinlyWealth thêm hậu tố SEO không làm đỏ cả 39 trang.
 *
 * Ba ràng buộc dưới đây đều do một vòng phản biện bắt được — bản vá đầu bỏ cả
 * ba và mở ra lỗ mới ở chỗ khác, xem ghi chú ngày 19/09/2026 trong AGENTS.md:
 *
 * 1. Con số phải đứng TRƯỚC cụm "Rebate from FinlyWealth". Bỏ ràng buộc này
 *    thì `"Rebate from FinlyWealth | Annual fee $120"` đọc ra `$120` — hậu tố
 *    SEO trở thành con số rebate.
 * 2. Cụm `$…` được lấy TRỌN tới khoảng trắng rồi mới soi, chứ không chỉ lấy
 *    phần chữ số ăn được. `"$75abc"` phải bị từ chối, không được đọc thành
 *    `$75`.
 * 3. Ngay sau con số không được là khoảng trắng rồi chữ số: `"$2 000 …"`
 *    (cách ngăn nghìn kiểu Pháp) đọc thành `$2` là hụt 998 đô.
 */
export function rebateAmountInTitle(title: string): string | null {
  const phrase = title.search(/Rebate from FinlyWealth/i);
  if (phrase === -1) return null;

  // Chỉ xét phần ĐỨNG TRƯỚC cụm nhận diện, và quét MỌI cụm `$` trong đó chứ
  // không dừng ở cụm đầu: đếm được bao nhiêu con số mới biết tiêu đề có mơ hồ
  // hay không.
  const before = title.slice(0, phrase);
  const figures = [...before.matchAll(/\$\s?\S*/g)];
  if (figures.length !== 1) return null;

  const [figure] = figures;
  const amount = figure[0].match(/^\$\s?(\d{1,3}(?:,\d{3})*|\d+)$/)?.[1];
  if (!amount) return null;

  const rest = before.slice(figure.index + figure[0].length);
  if (/^\s+\d/.test(rest)) return null;

  return `$${amount}`;
}

function rebateFromTitle(html: string): string {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  if (!title) throw new Error("no <title> on the page");

  const amount = rebateAmountInTitle(title);
  if (!amount) throw new Error(`no rebate in title: ${title.trim().slice(0, 80)}`);

  return amount;
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
