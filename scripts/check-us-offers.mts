// Canh welcome offer của THẺ MỸ — việc mà `check-rebates` làm cho thẻ Canada.
//
//   npm run audit:us-offers             # đủ cả phần đọc trang ngân hàng
//   npm run audit:us-offers -- --offline  # chỉ phần không cần mạng
//
// Chạy hằng ngày bởi .github/workflows/check-us-offers.yml. Job CHỈ BÁO, không
// tự sửa: số liệu thẻ Mỹ nằm trong `src/lib/us-credit-cards.ts` cùng với
// headline và editor's take viết tay, nên một con số đổi là cả đoạn văn phải
// viết lại — không phải thứ một script nên tự làm. Job đỏ = có thẻ cần rà; việc
// rà và sửa do task cục bộ `ghe-1a-canh-offer-the-my` làm bằng browser thật.
//
// BA PHÉP KIỂM, theo độ chắc giảm dần:
//
// 1. HẾT HẠN (không cần mạng). Thẻ có `expiresAt` đã qua: thẻ tự rời mục
//    Elevated, nhưng con số welcome bonus vẫn là mức cũ cho tới khi sửa tay.
// 2. QUÁ HẠN RÀ (không cần mạng). `verifiedOn` cũ hơn `STALE_DAYS` ngày — tức
//    task cục bộ đã lâu không chạy được, và không ai biết số còn đúng không.
// 3. LỆCH TRANG NGÂN HÀNG (cần mạng). Chỉ làm được với ngân hàng in offer
//    thẳng vào HTML — đo 30/09/2026: Chase® và Bilt. American Express®,
//    Capital One®, Bank of America® và Citi® dựng offer bằng JavaScript, `fetch`
//    trần không thấy con số nào; các thẻ đó chỉ có phép 1 và 2, phần còn lại
//    thuộc về task cục bộ.
//
// Phép 3 là phép tìm "dấu vết", không phải parser: nó hỏi "con số site đang
// ghi CÒN xuất hiện trên trang ngân hàng không", và bonus phải đứng gần mức chi
// tiêu trong cùng một câu. Nó bắt được offer đổi số; nó KHÔNG đọc ra số mới.

import { ALL_US_CARDS, type UsCreditCardOffer } from "../src/lib/us-credit-cards.ts";

const OFFLINE = process.argv.includes("--offline");

/** Quá chừng này ngày không ai đối chiếu lại thì coi như không còn ai canh. */
const STALE_DAYS = 21;

/** Ngân hàng in offer vào HTML trả về cho `fetch` — xem đầu file. */
const FETCHABLE = new Set(["chase", "bilt"]);

/** Bonus và mức chi tiêu phải nằm trong cùng một câu quảng cáo. */
const NEAR = 300;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** Ngày hôm nay ở Toronto, "YYYY-MM-DD" — cùng múi giờ mà site dùng để tính hạn offer. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&nbsp;": " ",
  "&#36;": "$",
  "&dollar;": "$",
  "&#44;": ",",
  "&reg;": "®",
};

/** Chữ người đọc thấy: bỏ script/style/thẻ, gộp khoảng trắng. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ");
}

/** "75,000" cũng có thể được viết "75K"; "$4,000" thành "$4K". */
function numberForms(value: number, dollar: boolean): string[] {
  const forms = [value.toLocaleString("en-US")];
  if (value >= 1000 && value % 1000 === 0) forms.push(`${value / 1000}K`);
  return forms.map((form) => (dollar ? `$${form}` : form));
}

/** Vị trí mọi lần một trong các dạng viết xuất hiện, không dính vào số khác. */
function positions(text: string, forms: string[]): number[] {
  const found: number[] = [];
  for (const form of forms) {
    const escaped = form.replace(/[$.]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\d,.$])${escaped}(?![\\d,]|\\.\\d)`, "gi");
    for (const match of text.matchAll(pattern)) found.push(match.index);
  }
  return found;
}

/**
 * Các con số trong `welcomeBonus` đáng đi tìm: từ 100 trở lên. "3 Free Night
 * Awards" không cho con số nào đủ đặc trưng — thẻ đó chỉ kiểm mức chi và phí.
 */
function bonusNumbers(card: UsCreditCardOffer): { value: number; dollar: boolean }[] {
  const numbers: { value: number; dollar: boolean }[] = [];
  for (const match of (card.welcomeBonus ?? "").matchAll(/(\$?)(\d[\d,]*)/g)) {
    const value = Number(match[2].replace(/,/g, ""));
    if (value >= 100) numbers.push({ value, dollar: match[1] === "$" });
  }
  return numbers;
}

function feeFound(text: string, fee: number): boolean {
  if (fee === 0) return /no annual fee|\$0 annual fee/i.test(text);
  const amount = `\\$${fee.toLocaleString("en-US")}`;
  return new RegExp(`${amount}\\s*annual fee|annual fee[^.]{0,40}${amount}(?![\\d,])`, "i").test(text);
}

/** Mức chi đứng ngay sau một vị trí: "… after you spend $5,000 …". */
function spendAfter(text: string, at: number): number | undefined {
  const match = text.slice(at, at + NEAR).match(/spend(?:ing)?\s+\$\s?([\d,]+)(K?)/i);
  if (!match) return undefined;
  return Number(match[1].replace(/,/g, "")) * (match[2] ? 1000 : 1);
}

/** Những con số site đang ghi mà trang ngân hàng không còn in. Rỗng = khớp. */
function mismatches(card: UsCreditCardOffer, text: string): string[] {
  const missing: string[] = [];
  const spend = card.us.minimumSpendUsd;
  const money = (value: number) => `$${value.toLocaleString("en-US")}`;

  if (spend !== undefined) {
    // Phải là "spend $X", không phải "$X" trần: con số trần còn xuất hiện ở
    // thẻ quảng cáo chéo. Đây cũng là phép kiểm DUY NHẤT về mức chi của thẻ có
    // bonus không phải con số ("3 Free Night Awards").
    const phrases = [...text.matchAll(/spend(?:ing)?\s+\$\s?[\d,]+K?/gi)].map((match) => spendAfter(match[0], 0));
    if (!phrases.includes(spend)) missing.push(`mức chi ${money(spend)}`);
  }

  for (const [index, { value, dollar }] of bonusNumbers(card).entries()) {
    const at = positions(text, numberForms(value, dollar));
    const label = dollar ? money(value) : value.toLocaleString("en-US");
    if (at.length === 0) {
      missing.push(`bonus ${label}`);
      continue;
    }
    // Chỉ con số ĐẦU (bonus chính) phải đi liền với mức chi. Trang thẻ nào
    // cũng quảng cáo chéo thẻ anh em, nên "có con số đó trên trang" chưa nói
    // được gì: phải là "X … after you spend $Y" với đúng Y của thẻ này.
    if (index > 0 || spend === undefined) continue;
    const following = at.map((position) => spendAfter(text, position));
    if (!following.includes(spend)) {
      const seen = following.filter((amount) => amount !== undefined);
      missing.push(
        seen.length > 0
          ? `bonus ${label} giờ đi cùng mức chi ${seen.map((amount) => money(amount)).join(" / ")}, không phải ${money(spend)}`
          : `bonus ${label} (có trên trang nhưng không đi cùng mức chi)`,
      );
    }
  }

  if (!feeFound(text, card.us.annualFeeUsd)) {
    missing.push(`annual fee ${money(card.us.annualFeeUsd)}`);
  }
  return missing;
}

/** Ba lượt, giãn dần — một trang chập chờn không được thành một lượt báo động. */
async function readPage(url: string): Promise<string> {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        last = `HTTP ${res.status}`;
        continue;
      }
      const text = visibleText(await res.text());
      // Trang chặn bot thường vẫn trả 200 kèm vài dòng chữ.
      if (text.length < 2_000 || !/annual fee/i.test(text)) {
        last = `trang trả về không giống trang thẻ (${text.length} ký tự)`;
        continue;
      }
      return text;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(last);
}

// Thẻ đang tạm ẩn (`hidden`) không ai đọc, nên số của nó lệch cũng không hại
// ai — và job đỏ vì một thẻ không có trên site là báo động giả. Lúc hiện lại,
// phép "quá hạn đối chiếu" sẽ tự nhắc rà nếu đã ẩn lâu.
const WATCHED = ALL_US_CARDS.filter((card) => !card.us.hidden);

const now = today();
const expired: string[] = [];
const stale: string[] = [];
const changed: string[] = [];
const unreadable: string[] = [];
let readOk = 0;
let browserOnly = 0;

for (const card of WATCHED) {
  if (card.expiresAt && card.expiresAt.slice(0, 10) < now) {
    expired.push(`${card.slug} — offer ghi hết hạn ${card.expiresAt.slice(0, 10)}, welcome bonus trên site vẫn là mức cũ`);
  }

  const verifiedOn = card.us.verifiedOn;
  if (!verifiedOn || daysBetween(verifiedOn, now) > STALE_DAYS) {
    stale.push(`${card.slug} — đối chiếu lần cuối ${verifiedOn ?? "chưa bao giờ"}`);
  }

  if (!FETCHABLE.has(card.us.issuerId)) {
    browserOnly += 1;
    continue;
  }
  if (OFFLINE) continue;

  const url = card.us.sourceUrl ?? card.applyUrl;
  if (!url) continue;

  try {
    const missing = mismatches(card, await readPage(url));
    if (missing.length > 0) changed.push(`${card.slug} — trang ngân hàng không còn: ${missing.join("; ")}\n      ${url}`);
    else readOk += 1;
  } catch (error) {
    unreadable.push(`${card.slug} — ${error instanceof Error ? error.message : error}\n      ${url}`);
  }
}

function section(title: string, lines: string[]) {
  if (lines.length === 0) return;
  console.log(`\n${title} (${lines.length}):`);
  for (const line of lines) console.log(`  - ${line}`);
}

console.log(
  `Canh offer thẻ Mỹ — ${now}. ${WATCHED.length} thẻ (${ALL_US_CARDS.length - WATCHED.length} thẻ đang ẩn, bỏ qua).`,
);
if (!OFFLINE) console.log(`Đọc trang ngân hàng: ${readOk} thẻ khớp.`);
console.log(`${browserOnly} thẻ chỉ rà được bằng browser (task cục bộ).`);

section("OFFER ĐÃ HẾT HẠN — cần rà số mới", expired);
section("LỆCH TRANG NGÂN HÀNG — cần rà", changed);
section(`QUÁ ${STALE_DAYS} NGÀY CHƯA ĐỐI CHIẾU`, stale);
section("KHÔNG ĐỌC ĐƯỢC TRANG", unreadable);

const problems = expired.length + changed.length + stale.length + unreadable.length;
if (problems === 0) console.log("\nKhông có gì cần rà.");
process.exit(problems === 0 ? 0 : 1);
