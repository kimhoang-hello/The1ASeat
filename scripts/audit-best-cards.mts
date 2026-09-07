// Đối chiếu bốn trang "Các thẻ tốt nhất" với dữ liệu thẻ đang phục vụ.
//
//   npm run audit:best-cards
//
// VÌ SAO CẦN: `src/lib/best-cards.ts` là đoạn văn viết tay nói về mười thẻ
// khác, mà số liệu của mười thẻ đó sống trong Contentful và đổi hằng tuần.
// Tiêu đề mỗi mục đã lấy tên và welcome bonus trực tiếp từ entry nên không
// lệch được, nhưng THÂN ĐOẠN VĂN thì không có cách nào tự cập nhật: câu "welcome
// bonus lên đến 70,000 điểm Avion®" sẽ nằm nguyên ở đó vào đúng cái ngày RBC®
// hạ offer xuống. `lint`, `tsc` và `build` đều xanh trong suốt thời gian đó.
//
// Cùng loại lỗi, cùng cách chữa như `audit:rebate-prose` bên editor's take:
// một con số nằm ở hai chỗ thì phải có thứ canh hai chỗ đó khớp nhau.
//
// Script kiểm ba việc:
//
//   1. Mọi slug thẻ được nhắc tới có thật và đang publish. (Cửa này cũng chạy
//      lúc `next build` qua `assertBestCardPicksExist`, ở đây là để chạy tay.)
//   2. Mọi con số dạng `$X` hoặc `X,XXX` trong đoạn văn phải xuất hiện ở đâu
//      đó trong chính entry của thẻ mà mục đó nói tới — welcome bonus, annual
//      fee, rebate, headline, editor's take hoặc key benefits. Con số không
//      có trong Contentful phải khai ở `otherFiguresVi` kèm lý do.
//   3. Khai báo `otherFiguresVi` đã thừa (con số không còn trong đoạn văn) —
//      cảnh báo, không làm đỏ.
//
// Exit 1 khi có slug hỏng hoặc có con số chưa khớp và chưa khai.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { bestCardsProseDrift, type OfferFacts } from "../src/lib/best-cards.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const REQUEST_TIMEOUT_MS = 20_000;

const env = Object.fromEntries(
  readFileSync(join(REPO, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const SPACE = env.CONTENTFUL_SPACE_ID;
const CDA = env.CONTENTFUL_ACCESS_TOKEN;

if (!SPACE || !CDA) {
  console.error("Thiếu CONTENTFUL_SPACE_ID hoặc CONTENTFUL_ACCESS_TOKEN trong .env.local.");
  process.exit(1);
}

interface CdaEntry {
  fields: Record<string, unknown>;
}

/**
 * Đọc qua CDA chứ không qua CMA, cố ý: câu hỏi ở đây là "hôm nay người đọc
 * đang thấy con số nào", nên bản ĐANG PHỤC VỤ mới là bản đúng để so. Một tác
 * giả đang sửa dở một thẻ trong Contentful không được làm audit này đỏ. Cùng
 * lựa chọn và cùng lý do với `audit:health`.
 *
 * CON TRỎ MỜ chứ không phải `skip`, cùng lý do đã ghi ở `audit:rebate-prose`:
 * một entry rơi khỏi tập kết quả giữa hai lượt lấy làm vài entry sau bị nhảy
 * qua trong im lặng — mà ở đây một thẻ bị nhảy qua sẽ bị báo là "không tìm
 * thấy trên Contentful", tức audit đỏ vì lý do sai.
 */
async function listOffers(): Promise<OfferFacts[]> {
  const out: CdaEntry[] = [];
  let url =
    `https://cdn.contentful.com/spaces/${SPACE}/environments/master/entries` +
    `?content_type=creditCardOffer&limit=100&cursor=true&access_token=${CDA}`;

  for (;;) {
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Contentful ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as { items: CdaEntry[]; pages?: { next?: string } };
    out.push(...page.items);
    const next = page.pages?.next;
    if (!next) break;
    url = `https://cdn.contentful.com${next}&access_token=${CDA}`;
  }

  // Chỉ những field mà `offerHaystack` đọc tới, và trả về `OfferFacts` chứ
  // KHÔNG ép kiểu thành `CreditCardOffer`: không đi qua `lib/content` được (nó
  // kéo theo `next/cache`), nhưng đó không phải lý do để tắt TypeScript — xem
  // chú thích của `OfferFacts`.
  return out.map((entry) => {
    const f = entry.fields as Record<string, string | string[] | undefined>;
    return {
      slug: (f.slug as string) ?? "",
      name: (f.name as string) ?? "",
      welcomeBonus: f.welcomeBonusVi as string | undefined,
      annualFee: (f.annualFeeVi as string) ?? "",
      rebate: f.rebateVi as string | undefined,
      headline: (f.headlineVi as string) ?? "",
      editorsTake: (f.editorsTakeVi as string) ?? "",
      keyBenefits: (f.keyBenefitsVi as string[]) ?? [],
    } satisfies OfferFacts;
  });
}

const offers = await listOffers();
console.log(`đọc ${offers.length} thẻ từ Contentful\n`);

const { errors, warnings } = bestCardsProseDrift(offers);

for (const warning of warnings) console.log(`⚠︎  ${warning}`);
if (warnings.length) console.log("");

if (errors.length === 0) {
  console.log("✓ bốn trang khớp Contentful");
  process.exit(0);
}

for (const error of errors) console.error(`✗ ${error}`);
console.error(`\n${errors.length} chỗ lệch.`);
process.exit(1);
