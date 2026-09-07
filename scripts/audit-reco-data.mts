// Kiểm bộ dữ liệu nền của recommendation engine (Phase 1).
//
//   npm run audit:reco-data
//
// Hai phần, và phần thứ hai mới là phần không thay thế được:
//
//   1. Toàn vẹn nội bộ — `validateDataset`. Tham chiếu gãy, id trùng, ngày
//      ngược, trần khai thiếu, hạng mục có hai tỷ lệ. Ở một database thì đây
//      là khoá ngoại; kho này nằm trong git nên phải chạy được.
//
//   2. Đối chiếu với Contentful. Đây là chỗ duy nhất bắt được lớp lỗi nguy
//      hiểm nhất của cả thiết kế: hai kho cùng nói về một thẻ và nói khác
//      nhau. Thêm thẻ trên Contentful mà quên thêm ở đây thì engine không
//      bao giờ khuyên nó — im lặng tuyệt đối. Sửa annual fee ở Contentful mà
//      quên sửa ở đây thì engine tính lợi ích trên một con số đã cũ.
//
// Repo đã trả giá đúng một lần cho lớp lỗi này: con số rebate nằm ở hai chỗ
// trên cùng một entry, và lúc rà tay 01/09/2026 thì 3 trong 10 thẻ đang lệch.
// `audit:rebate-prose` sinh ra từ đó; script này là cùng một bài học, áp cho
// chỗ nối mới.
//
// Chạy được KHÔNG CẦN Contentful: thiếu token thì phần 2 bỏ qua và script nói
// ra điều đó, thay vì đỏ vì một lý do chẳng liên quan gì tới dữ liệu.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { offlineDataset } from "../src/lib/recommendation/source.ts";
import { validateDataset } from "../src/lib/recommendation/validate.ts";
import { OFFERS } from "../src/lib/recommendation/data/offers.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const REQUEST_TIMEOUT_MS = 20_000;

function loadEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(`${REPO}.env.local`, "utf8")
        .split("\n")
        .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
        .map((line) => {
          const at = line.indexOf("=");
          return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

interface ContentfulCard {
  slug: string;
  name: string;
  annualFeeVi?: string;
  rebateVi?: string;
}

async function fetchContentfulCards(): Promise<ContentfulCard[] | null> {
  const env = { ...loadEnv(), ...process.env };
  const space = env.CONTENTFUL_SPACE_ID;
  const token = env.CONTENTFUL_ACCESS_TOKEN;
  if (!space || !token) return null;

  const res = await fetch(
    `https://cdn.contentful.com/spaces/${space}/environments/master/entries` +
      `?content_type=creditCardOffer&limit=200`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  );
  if (!res.ok) throw new Error(`Contentful trả ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { items: { fields: ContentfulCard }[] };
  return body.items.map((item) => item.fields);
}

/** Con số phí THƯỜNG NIÊN mở đầu chuỗi `annualFeeVi` ("$139/năm — miễn năm
 *  đầu…" → 139). `undefined` khi chuỗi không mở đầu bằng một con số — chuỗi
 *  đó là chữ tự do của biên tập viên, nên không đoán. */
function feeIn(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.match(/^\$([\d,]+(?:\.\d+)?)/);
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}

/** Số đô trong `rebateVi` ("$140" → 140). Cùng quy ước dấu phẩy ngăn nghìn
 *  với phần còn lại của site. */
function rebateIn(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.replace(/,/g, "").match(/\$?(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : undefined;
}

const errors: string[] = [];
const warnings: string[] = [];

const dataset = offlineDataset();
for (const issue of validateDataset(dataset)) {
  const line = `[${issue.entity}] ${issue.message}`;
  (issue.level === "error" ? errors : warnings).push(line);
}

let cards: ContentfulCard[] | null = null;
try {
  cards = await fetchContentfulCards();
} catch (error) {
  errors.push(`[contentful] ${error instanceof Error ? error.message : String(error)}`);
}

if (cards === null) {
  console.log(
    "⚠︎  Không có CONTENTFUL_SPACE_ID/ACCESS_TOKEN — bỏ qua phần đối chiếu.\n" +
      "   Toàn vẹn nội bộ vẫn được kiểm đầy đủ.\n",
  );
} else {
  const contentfulBySlug = new Map(cards.map((card) => [card.slug, card]));
  const seedBySlug = new Map(dataset.products.map((product) => [product.slug, product]));

  for (const product of dataset.products) {
    if (!product.contentfulLinked) continue;
    if (!contentfulBySlug.has(product.slug)) {
      errors.push(`[contentful] ${product.slug}: có trong seed nhưng không có entry Contentful`);
    }
  }
  for (const card of cards) {
    if (!seedBySlug.has(card.slug)) {
      errors.push(
        `[contentful] ${card.slug}: có entry Contentful nhưng chưa có trong seed — ` +
          `engine sẽ không bao giờ khuyên thẻ này`,
      );
    }
  }

  for (const card of cards) {
    const product = seedBySlug.get(card.slug);
    if (!product) continue;

    const fee = feeIn(card.annualFeeVi);
    if (fee === undefined) {
      warnings.push(
        `[contentful] ${card.slug}: annualFeeVi không mở đầu bằng một con số, không đối chiếu được`,
      );
    } else if (fee !== product.annualFee) {
      errors.push(
        `[contentful] ${card.slug}: annualFee seed là ${product.annualFee}, ` +
          `Contentful nói ${fee} ("${card.annualFeeVi}")`,
      );
    }

    // Rebate nằm trên OFFER, không nằm trên sản phẩm — nó đổi khi FinlyWealth
    // đổi, còn thẻ thì không.
    const offer = OFFERS.find((row) => (row.productId as string) === product.id);
    const seedRebate = offer?.annualFeeRebate ?? undefined;
    const liveRebate = rebateIn(card.rebateVi);
    if (seedRebate !== liveRebate) {
      errors.push(
        `[contentful] ${card.slug}: rebate seed là ${seedRebate ?? "(không có)"}, ` +
          `Contentful nói ${liveRebate ?? "(không có)"}`,
      );
    }
  }
}

for (const line of warnings) console.log(`⚠︎  ${line}`);
if (warnings.length > 0) console.log("");
for (const line of errors) console.error(`✗  ${line}`);

const summary =
  `${dataset.products.length} sản phẩm, ${dataset.offers.length} offer, ` +
  `${dataset.offerComponents.length} component, ${dataset.earningRates.length} tỷ lệ tích điểm, ` +
  `${dataset.productBenefits.length} quyền lợi, ${dataset.eligibilityRules.length} điều kiện, ` +
  `${dataset.transferPaths.length} chặng chuyển, ${dataset.awardStrategies.length} award strategy.`;

if (errors.length > 0) {
  console.error(`\n${errors.length} lỗi, ${warnings.length} cảnh báo. ${summary}`);
  process.exit(1);
}
console.log(`✓  Không lỗi, ${warnings.length} cảnh báo. ${summary}`);
