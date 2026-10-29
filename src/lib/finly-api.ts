/**
 * Đọc rebate từ FinlyWealth Affiliate API (v1, ra ngày 21/10/2026).
 *
 * Thay cho cách đọc `<title>` từng trang rebate trong `finlywealth.ts`, mà cả
 * hai job rebate dùng tới 29/10/2026. Đo ngày đó, API khớp số trên site ở mọi
 * sản phẩm còn rebate, và bắt được hai ca mà cách đọc tiêu đề KHÔNG BAO GIỜ
 * thấy: BMO® Premium Chequing ($75) và Scotiabank® Scene+™ Visa for Students
 * ($50). Thân cả hai trang đều ghi "Finly rebate paused on this offer" trong khi
 * `<title>` vẫn in con số cũ — đúng giới hạn mà `check-bank-rebates.mts` đã ghi
 * từ 31/08/2026 là không chữa được. API trả `rebate: null` cho ca thứ nhất và
 * không liệt kê ca thứ hai.
 *
 * Một request cho cả catalogue (127 offer ngày 29/10, tối đa 200 một trang)
 * thay cho 10 + 29 lượt đọc trang tuần tự. Giới hạn của Finly là 60 request
 * một phút và 5,000 một ngày, tính chung mọi key.
 *
 * Tài liệu: https://www.finlywealth.com/affiliate-hub/api-docs (cần đăng nhập),
 * spec công khai tại `${BASE}/openapi.json`.
 */

const BASE = "https://www.finlywealth.com/api/affiliate/v1";
const HOST = "www.finlywealth.com";

/** Cùng hạn giờ với `finlywealth.ts`: lớp duy nhất cắt ở thang giây. */
const TIMEOUT_MS = 15_000;
const ATTEMPTS = 3;
/** Chặn trên cho `Retry-After`, để một header lạ không treo job hàng giờ. */
const MAX_WAIT_MS = 60_000;
/** Catalogue 127 offer là MỘT trang; vòng lặp quá số này là phân trang hỏng. */
const MAX_PAGES = 10;

export interface FinlyOffer {
  /** `<category>:<slug>`, ví dụ `"credit_card:amex-cobalt"`. */
  id: string;
  slug: string;
  category: string;
  name: string;
  /** `null` khi offer không có rebate — kể cả lúc Finly PAUSE rebate. */
  rebate: { amount: number } | null;
  links: {
    affiliateUrl: string;
    landingPageUrl: string;
    productPageUrl: string | null;
    rebatePageUrl: string | null;
  };
}

/**
 * Mọi offer `credit_card` và `bank_account` của tài khoản affiliate.
 *
 * Ném khi không chắc dữ liệu đúng: status lỗi, JSON sai dạng, tiền không phải
 * CAD, hay một offer thiếu trường. Cùng nguyên tắc fail-closed với cách đọc
 * tiêu đề trước đây — con số đọc ra được GHI THẲNG lên site, nên đỏ một lượt rẻ
 * hơn hứa sai tiền với người đọc.
 *
 * Câu lỗi luôn mở bằng mã HTTP khi có, để `isTransient` phân loại được: 401
 * (key sai, bị revoke) và 403 (thiếu scope) là vĩnh viễn, 429 và 5xx thì không.
 */
export async function fetchFinlyOffers(apiKey: string): Promise<FinlyOffer[]> {
  const offers: FinlyOffer[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${BASE}/offers?category=credit_card,bank_account&pageSize=200&page=${page}`;
    const body = await getJson(url, apiKey);

    if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.pagination)) {
      throw new Error("Finly API: /offers trả dữ liệu sai dạng (thiếu data hoặc pagination)");
    }
    const currency = isRecord(body.meta) ? body.meta.currency : undefined;
    if (currency !== undefined && currency !== "CAD") {
      throw new Error(`Finly API: /offers trả tiền ${String(currency)}, không phải CAD`);
    }

    for (const raw of body.data) offers.push(parseOffer(raw));
    if (body.pagination.hasMore !== true) return offers;
  }

  throw new Error(`Finly API: /offers còn trang sau ${MAX_PAGES} trang — phân trang hỏng`);
}

async function getJson(url: string, apiKey: string): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": "Ghe1A-RebateCheck/2.0 (+https://ghe1a.com)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      lastError = err;
      await sleep(1000 * (attempt + 1));
      continue;
    }

    if (res.ok) return res.json();

    const message = await errorMessage(res);
    // 4xx trừ 429 là câu trả lời dứt khoát: key sai, thiếu scope, tham số sai.
    // Thử lại chỉ đốt quota.
    if (res.status !== 429 && res.status < 500) throw new Error(message);

    lastError = new Error(message);
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1);
    if (attempt < ATTEMPTS - 1) await sleep(Math.min(wait, MAX_WAIT_MS));
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** `"401 Finly API invalid_api_key: …"` — mã HTTP đứng đầu cho `isTransient`. */
async function errorMessage(res: Response): Promise<string> {
  let detail = res.statusText;
  try {
    const body: unknown = await res.json();
    if (isRecord(body) && isRecord(body.error)) {
      detail = `${String(body.error.code)}: ${String(body.error.message)}`;
    }
  } catch {
    // Thân không phải JSON (trang lỗi của CDN): giữ statusText.
  }
  return `${res.status} Finly API ${detail}`;
}

function parseOffer(raw: unknown): FinlyOffer {
  const id = isRecord(raw) && typeof raw.id === "string" ? raw.id : "(không có id)";
  const bad = (what: string) => new Error(`Finly API: offer ${id} sai dạng (${what})`);

  if (!isRecord(raw) || typeof raw.slug !== "string" || typeof raw.category !== "string") throw bad("slug/category");
  if (typeof raw.name !== "string") throw bad("name");

  const links = raw.links;
  if (!isRecord(links) || typeof links.affiliateUrl !== "string" || typeof links.landingPageUrl !== "string") {
    throw bad("links");
  }
  const optionalUrl = (value: unknown, name: string): string | null => {
    if (value === null) return null;
    if (typeof value === "string") return value;
    throw bad(`links.${name}`);
  };

  // `rebate` phải hoặc là `null` hoặc là một object có `amount` là số dương.
  // Thiếu hẳn trường (`undefined`) KHÔNG được hiểu là "không có rebate": tài
  // liệu nói mọi trường luôn có mặt, nên thiếu là dữ liệu hỏng, mà đọc nó thành
  // `null` là xoá một con số tiền đang đúng.
  let rebate: FinlyOffer["rebate"];
  if (raw.rebate === null) rebate = null;
  else if (isRecord(raw.rebate) && typeof raw.rebate.amount === "number" && raw.rebate.amount > 0) {
    rebate = { amount: raw.rebate.amount };
  } else throw bad("rebate");

  return {
    id,
    slug: raw.slug,
    category: raw.category,
    name: raw.name,
    rebate,
    links: {
      affiliateUrl: links.affiliateUrl,
      landingPageUrl: links.landingPageUrl,
      productPageUrl: optionalUrl(links.productPageUrl, "productPageUrl"),
      rebatePageUrl: optionalUrl(links.rebatePageUrl, "rebatePageUrl"),
    },
  };
}

/**
 * `125` → `"$125"`, `1500` → `"$1,500"` — đúng dạng site đang lưu trong
 * `rebateVi` và `bank-accounts.ts`. Ném với số lẻ xu: chưa offer nào như vậy,
 * và làm tròn là tự bịa ra một con số tiền.
 */
export function formatRebate(amount: number): string {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Finly API: rebate ${amount} không phải số đô chẵn`);
  }
  return `$${amount.toLocaleString("en-US")}`;
}

/** Đường dẫn trên www.finlywealth.com, bỏ `/` cuối; `null` nếu là host khác. */
function finlyPath(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, `https://${HOST}`);
    if (parsed.hostname.toLowerCase() !== HOST) return null;
    return parsed.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Trang đích của một link `/r/<mã>?url=…` (link apply trên site). */
export function affiliateDestinationPath(affiliateUrl: string | undefined): string | null {
  if (!affiliateUrl) return null;
  try {
    const parsed = new URL(affiliateUrl);
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (hostname !== "finlywealth.com" && !hostname.endsWith(".finlywealth.com")) return null;
    const destination = parsed.searchParams.get("url");
    return destination?.startsWith("/") ? finlyPath(destination) : null;
  } catch {
    return null;
  }
}

/**
 * Thứ API nói về MỘT trang đích:
 *
 * - `amount` — offer có rebate và đây đúng là trang rebate của nó.
 * - `paused` — offer còn trong chương trình nhưng `rebate: null` (Finly tắt
 *   hoặc pause rebate). Trang `/rebates/…` có thể vẫn sống và vẫn in số cũ
 *   trong `<title>`: BMO® Premium Chequing ngày 29/10/2026.
 * - `product` — đây là trang sản phẩm (link `/banking/…`, `/credit-cards/…`)
 *   của một offer còn promote được; `twinRebate` là rebate mà trang `/rebates/`
 *   cùng offer đang trả, nếu có.
 * - `missing` — không offer nào nhận trang này. Theo tài liệu của Finly, offer
 *   vắng khỏi lượt sync là offer KHÔNG CÒN promote được. Cũng có thể là bản
 *   đặc biệt API chưa liệt kê (Scene+™ Visa for Students ngày 29/10/2026,
 *   trang ghi đang pause).
 */
export type PageLookup =
  | { kind: "amount"; rebate: string; offer: FinlyOffer }
  | { kind: "paused"; offer: FinlyOffer }
  | { kind: "product"; offer: FinlyOffer; twinRebate: string | null }
  | { kind: "missing" };

const CATEGORY_BY_SECTION: Record<string, string> = {
  "credit-cards": "credit_card",
  "bank-accounts": "bank_account",
};

export class FinlyOfferIndex {
  private readonly byRebatePage = new Map<string, FinlyOffer>();
  private readonly byProductPage = new Map<string, FinlyOffer>();
  private readonly byId = new Map<string, FinlyOffer>();

  constructor(offers: FinlyOffer[]) {
    for (const offer of offers) {
      this.byId.set(offer.id, offer);
      const rebatePage = finlyPath(offer.links.rebatePageUrl);
      if (rebatePage) this.byRebatePage.set(rebatePage, offer);
      // `landingPageUrl` là trang sản phẩm khi offer không có rebate — và đó
      // là chỗ link cũ của offer vừa bị tắt rebate rơi vào.
      for (const url of [offer.links.productPageUrl, offer.links.landingPageUrl]) {
        const page = finlyPath(url);
        if (page && page !== rebatePage) this.byProductPage.set(page, offer);
      }
    }
  }

  lookup(path: string): PageLookup {
    const onRebatePage = this.byRebatePage.get(path);
    if (onRebatePage) {
      return onRebatePage.rebate
        ? { kind: "amount", rebate: formatRebate(onRebatePage.rebate.amount), offer: onRebatePage }
        : { kind: "paused", offer: onRebatePage };
    }

    // Trang `/rebates/<mục>/<slug>` mà offer không còn `rebatePageUrl`: tra
    // theo id. Offer còn đó mà hết rebate là `paused`; còn rebate nhưng trỏ
    // trang KHÁC thì link trên site đang dẫn vào một trang rebate không phải
    // của offer, coi như `missing` để người nhìn.
    const rebateMatch = path.match(/^\/rebates\/([^/]+)\/([^/]+)$/);
    if (rebateMatch) {
      const category = CATEGORY_BY_SECTION[rebateMatch[1]];
      const offer = category ? this.byId.get(`${category}:${rebateMatch[2]}`) : undefined;
      return offer && !offer.rebate ? { kind: "paused", offer } : { kind: "missing" };
    }

    const onProductPage = this.byProductPage.get(path);
    if (onProductPage) {
      const twinRebate = onProductPage.rebate ? formatRebate(onProductPage.rebate.amount) : null;
      return { kind: "product", offer: onProductPage, twinRebate };
    }
    return { kind: "missing" };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
