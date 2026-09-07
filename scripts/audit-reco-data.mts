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
import { offlineDataset } from "../src/lib/recommendation/data/index.ts";
import { validateDataset } from "../src/lib/recommendation/validate.ts";
import { OFFERS } from "../src/lib/recommendation/data/offers.ts";
import { PRODUCT_FEES } from "../src/lib/recommendation/data/products.ts";
import { isActiveAt, isAvailableAt, oneActiveAt } from "../src/lib/recommendation/temporal.ts";
import {
  POINTS_PROGRAMS as RECO_PROGRAMS,
  PROGRAM_VALUATIONS,
} from "../src/lib/recommendation/data/points-programs.ts";
import { TRANSFER_PATHS } from "../src/lib/recommendation/data/transfer-paths.ts";
import { AWARD_STRATEGIES } from "../src/lib/recommendation/data/award-strategies.ts";
import { POINTS_PROGRAMS as CALCULATOR_PROGRAMS } from "../src/lib/points-programs.ts";
import { TRANSFER_PARTNERS } from "../src/lib/transfer-partners.ts";
import { PROGRAMS as AWARD_CHART_PROGRAMS } from "../src/lib/award-charts.ts";
import { todayInSiteZone } from "../src/lib/format-date.ts";

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

  // PHÂN TRANG. Contentful trả tối đa 1000 mỗi lượt và mặc định 100; bản trước
  // xin `limit=200` rồi coi đó là toàn bộ. Ở 31 thẻ thì đúng, ở 100+ thẻ thì
  // audit lặng lẽ chỉ soi 200 thẻ đầu và báo mọi thẻ còn lại là "có trong seed
  // nhưng không có entry Contentful" — hoặc tệ hơn, bỏ qua chúng.
  const cards: ContentfulCard[] = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const res = await fetch(
      `https://cdn.contentful.com/spaces/${space}/environments/master/entries` +
        `?content_type=creditCardOffer&limit=${pageSize}&skip=${skip}&order=sys.id`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`Contentful trả ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { items: { fields: ContentfulCard }[]; total: number };
    cards.push(...body.items.map((item) => item.fields));
    if (cards.length >= body.total || body.items.length === 0) break;
  }
  return cards;
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

// Ngày theo giờ TORONTO, không phải UTC. `toISOString()` nhảy sang ngày mới
// lúc 19:00 hoặc 20:00 giờ Toronto, nên trong mấy tiếng cuối ngày cuối cùng
// của một offer, audit sẽ chọn offer của ngày mai — hoặc không chọn được cái
// nào — trong khi site vẫn phục vụ offer hôm nay. Kết quả là đỏ vì lệch
// rebate, mà dữ liệu không có gì sai. Cùng quy ước với `hasExpired()`; xem
// mục `expiresAt` trong AGENTS.md.
const TODAY = todayInSiteZone();

/** Offer đang có hiệu lực hôm nay của một sản phẩm. `oneActiveAt` trả
 *  `undefined` khi có NHIỀU hơn một thay vì im lặng chọn cái đầu — validator
 *  đã chặn tình huống đó, đây là lưới thứ hai. */
function liveOfferFor(productId: string) {
  return oneActiveAt(
    OFFERS.filter((row) => (row.productId as string) === productId),
    TODAY,
  );
}

/** Phí thường niên đang có hiệu lực hôm nay. Phí nay nằm ở `product_fees` chứ
 *  không trên chính sản phẩm — xem chú thích `ProductFee` trong types.ts. */
function liveFeeFor(productId: string) {
  return oneActiveAt(
    PRODUCT_FEES.filter((row) => (row.productId as string) === productId),
    TODAY,
  );
}

const dataset = offlineDataset();
// Truyền ngày TORONTO vào. Mặc định của `validateDataset` là UTC, và UTC nhảy
// sang ngày mới lúc 19:00–20:00 giờ Toronto — quanh một lần đổi phí hay đổi
// tỷ lệ, kiểm theo ngày mai sẽ nhận dòng của ngày mai và báo thiếu dòng hôm nay.
for (const issue of validateDataset(dataset, TODAY)) {
  const line = `[${issue.entity}] ${issue.message}`;
  (issue.level === "error" ? errors : warnings).push(line);
}

// ---------------------------------------------------------------------------
// Đối chiếu với các nguồn CÙNG REPO mà bộ seed chép lại.
//
// Ba module dưới đây đã tồn tại trước engine và vẫn là nguồn của chính chúng:
// `points-programs.ts` (định giá của calculator), `transfer-partners.ts` (tỷ lệ
// chuyển của trang Transfer Partners) và `award-charts.ts` (bảng giá của Award
// Flight Finder). Bộ seed chép số từ đó — và một bản chép không ai canh thì
// đứng yên trong khi bản gốc đi tiếp. Hậu quả không phải là engine đỏ, mà là
// engine XANH trong khi nói một con số mà chính trang bên cạnh đã sửa.
// ---------------------------------------------------------------------------

for (const program of RECO_PROGRAMS) {
  if (!program.calculatorProgramId) continue;
  const upstream = CALCULATOR_PROGRAMS.find((row) => row.id === program.calculatorProgramId);
  if (!upstream) {
    errors.push(
      `[points-programs] ${program.slug}: calculatorProgramId "${program.calculatorProgramId}" ` +
        `không có trong lib/points-programs.ts`,
    );
    continue;
  }
  // Định giá nay nằm ở `program_valuations` và có hiệu lực theo thời gian, nên
  // so bản CÒN HIỆU LỰC HÔM NAY với con số của trang calculator.
  const valuation = oneActiveAt(
    PROGRAM_VALUATIONS.filter((row) => (row.programId as string) === (program.id as string)),
    TODAY,
  );
  if (valuation === undefined) {
    errors.push(
      `[points-programs] ${program.slug}: không có đúng một định giá còn hiệu lực hôm nay`,
    );
  } else if (upstream.centsPerPoint !== valuation.centsPerPoint) {
    errors.push(
      `[points-programs] ${program.slug}: định giá ${valuation.centsPerPoint} lệch ` +
        `centsPerPoint ${upstream.centsPerPoint} trong lib/points-programs.ts`,
    );
  }
}

for (const program of RECO_PROGRAMS) {
  if (!program.awardChartProgramId) continue;
  if (!AWARD_CHART_PROGRAMS.some((row) => row.id === program.awardChartProgramId)) {
    errors.push(
      `[points-programs] ${program.slug}: awardChartProgramId "${program.awardChartProgramId}" ` +
        `không có trong lib/award-charts.ts`,
    );
  }
}

// Tỷ lệ chuyển: `transfer-partners.ts` viết dạng "1,000 : 750" cho từng cột
// Amex/RBC. Đọc ra hai số rồi so với chặng tương ứng.
function ratioOf(text: string): [number, number] | null {
  const match = text.replace(/,/g, "").match(/^(\d+)\s*:\s*(\d+)$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

const PARTNER_KEY_BY_PROGRAM: Record<string, string> = {
  aeroplan: "Air Canada® Aeroplan®",
  avios: "British Airways® Club",
  "flying-blue": "Air France KLM® Flying Blue®",
  "asia-miles": "Cathay Pacific® Asia Miles®",
  bonvoy: "Marriott Bonvoy®",
  aadvantage: "American Airlines® AAdvantage®",
  westjet: "WestJet® Rewards",
};

// CHỈ đối chiếu bản CÒN HIỆU LỰC. `TRANSFER_PATHS` là nhật ký chỉ-thêm, nên
// sau lần đổi tỷ lệ đầu tiên nó sẽ chứa cả bản cũ — và so bản cũ với tỷ lệ hôm
// nay của nguồn thì audit đỏ VĨNH VIỄN, cho một dữ liệu hoàn toàn đúng. Một
// audit đỏ mãi là một audit người ta học cách bỏ qua.
const livePaths = TRANSFER_PATHS.filter((path) => isActiveAt(path, TODAY));

for (const path of livePaths) {
  const source = path.sourceProgramId as string;
  const partnerKey = PARTNER_KEY_BY_PROGRAM[path.destinationProgramId as string];
  if (!partnerKey) {
    warnings.push(
      `[transfer-paths] ${path.id}: đích không có trong bảng tra sang transfer-partners.ts, không đối chiếu được`,
    );
    continue;
  }
  const row = TRANSFER_PARTNERS.find((partner) => partner.program === partnerKey);
  const leg = source === "amex-mr" ? row?.amex : source === "avion" ? row?.rbc : undefined;
  if (!row || !leg) {
    errors.push(
      `[transfer-paths] ${path.id}: lib/transfer-partners.ts không có chặng này — ` +
        `một trong hai chỗ đã đổi mà chỗ kia chưa`,
    );
    continue;
  }
  const ratio = ratioOf(leg.ratio);
  if (!ratio) {
    warnings.push(`[transfer-paths] ${path.id}: không đọc được tỷ lệ "${leg.ratio}"`);
    continue;
  }
  if (ratio[0] !== path.ratioFrom || ratio[1] !== path.ratioTo) {
    errors.push(
      `[transfer-paths] ${path.id}: tỷ lệ ${path.ratioFrom}:${path.ratioTo} lệch ` +
        `"${leg.ratio}" trong lib/transfer-partners.ts`,
    );
  }
}

// LƯỢT NGƯỢC. Vòng trên chỉ đi từ seed sang nguồn, nên nó bắt được chặng biến
// mất khỏi nguồn mà KHÔNG bắt được chặng mới xuất hiện ở nguồn — mà đó mới là
// chiều hay xảy ra: Amex® thêm một đối tác, `transfer-partners.ts` được cập
// nhật cho trang Transfer Partners, còn engine thì vĩnh viễn không biết. Im
// lặng hoàn toàn, và đúng loại im lặng làm engine bỏ sót phương án tốt nhất.
//
// Chỉ soi những chương trình NẰM TRONG phạm vi V1 (bảng tra ở trên). Hilton®,
// Delta® và Accor® có trong nguồn nhưng cố ý ngoài phạm vi — xem chú thích đầu
// `data/transfer-paths.ts` — nên vắng mặt ở seed không phải lỗi.
for (const [programId, partnerKey] of Object.entries(PARTNER_KEY_BY_PROGRAM)) {
  const row = TRANSFER_PARTNERS.find((partner) => partner.program === partnerKey);
  if (!row) {
    errors.push(
      `[transfer-paths] bảng tra trỏ tới "${partnerKey}" không có trong lib/transfer-partners.ts`,
    );
    continue;
  }
  for (const [source, leg] of [
    ["amex-mr", row.amex],
    ["avion", row.rbc],
  ] as const) {
    if (!leg) continue;
    // Phải có chặng ĐANG CÒN HIỆU LỰC, không chỉ "có một dòng nào đó".
    // `Temporal` là hợp đồng chỉ-thêm, nên một chặng đã đóng bằng `effectiveTo`
    // vẫn nằm lại trong file mãi mãi. Chỉ kiểm sự tồn tại thì một chặng đóng
    // hôm qua mà chưa ai thêm bản thay thế vẫn cho audit xanh — trong khi engine
    // hỏi "hôm nay chuyển được đi đâu" thì không thấy đường nào.
    const seeded = livePaths.some(
      (path) =>
        (path.sourceProgramId as string) === source &&
        (path.destinationProgramId as string) === programId,
    );
    if (!seeded) {
      errors.push(
        `[transfer-paths] ${source} → ${programId}: có trong lib/transfer-partners.ts ` +
          `("${leg.ratio}") nhưng seed không có chặng nào còn hiệu lực hôm nay — ` +
          `engine không thấy đường chuyển này`,
      );
    }
  }
}

// Award strategy chép số từ `award-charts.ts`. Không so từng ô — bảng giá ở
// đó chia theo band khoảng cách và vùng, còn ở đây là khoảng cho cả một vùng,
// nên hai bên KHÔNG cùng hình dạng. Cái so được, và cũng là cái thật sự nói
// lên vấn đề, là NGÀY KIỂM: nguồn được kiểm lại mà bản chép thì không nghĩa là
// bản chép đã cũ.
for (const strategy of AWARD_STRATEGIES) {
  const chartId = RECO_PROGRAMS.find((row) => row.id === strategy.programId)?.awardChartProgramId;
  if (!chartId) continue;
  const upstream = AWARD_CHART_PROGRAMS.find((row) => row.id === chartId);
  if (!upstream) continue;
  if (upstream.verifiedOn > strategy.verifiedAt) {
    warnings.push(
      `[award-strategies] ${strategy.id}: lib/award-charts.ts kiểm lại ngày ${upstream.verifiedOn}, ` +
        `bản chép này vẫn ghi ${strategy.verifiedAt} — kiểm lại khoảng điểm`,
    );
  }
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
    if (contentfulBySlug.has(product.slug)) continue;
    // Entry biến mất khỏi Contentful. Nói RÕ cách sửa, vì cách sửa tự nhiên
    // nhất — xoá dòng sản phẩm cho hết đỏ — là cách phá lịch sử: offer, tỷ lệ
    // tích điểm và quyền lợi của nó đều trỏ vào `productId`, và Phase 4 sẽ
    // không giải thích nổi một khuyến nghị cũ từng chọn thẻ nào.
    errors.push(
      `[contentful] ${product.slug}: có trong seed nhưng không còn entry Contentful. ` +
        `Nếu thẻ đã ngừng thì ĐÓNG nó — đặt availableTo, ` +
        `contentfulLinked: false — ĐỪNG xoá dòng sản phẩm.`,
    );
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
    // Thẻ đã đóng: Contentful có thể vẫn còn entry một thời gian, nhưng số
    // trong seed đã đông cứng ở ngày đóng. So tiếp là đòi bản ghi lịch sử phải
    // đuổi theo hiện tại — đúng thứ `effectiveTo` sinh ra để khỏi phải làm.
    // Thẻ đã ngừng nhận đơn: số trong seed đông cứng ở ngày đóng, so tiếp là
    // đòi bản ghi lịch sử phải đuổi theo hiện tại.
    //
    // ĐÂY TỪNG LÀ `product.isActive` — một trường KHÔNG CÒN TỒN TẠI sau khi
    // tách `availableFrom/To`. `undefined` là falsy nên `!undefined` luôn đúng
    // và MỌI thẻ bị bỏ qua: cả 31 phép so phí và rebate chết lặng suốt, trong
    // khi audit vẫn in "✓ Không lỗi". `scripts/` bị loại khỏi tsconfig nên
    // trình biên dịch không thấy. Đó là lý do `include` bên dưới nay có nó.
    if (!isAvailableAt(dataset.productAvailability.filter((a) => a.productId === product.id), TODAY)) continue;

    const fee = feeIn(card.annualFeeVi);
    const seedFee = liveFeeFor(product.id);
    if (fee === undefined) {
      warnings.push(
        `[contentful] ${card.slug}: annualFeeVi không mở đầu bằng một con số, không đối chiếu được`,
      );
    } else if (seedFee === undefined) {
      errors.push(
        `[contentful] ${card.slug}: không có đúng một dòng product_fees còn hiệu lực hôm nay`,
      );
    } else if (fee !== seedFee.annualFee) {
      errors.push(
        `[contentful] ${card.slug}: annualFee seed là ${seedFee.annualFee}, ` +
          `Contentful nói ${fee} ("${card.annualFeeVi}")`,
      );
    }

    // Rebate nằm trên OFFER, không nằm trên sản phẩm — nó đổi khi FinlyWealth
    // đổi, còn thẻ thì không.
    //
    // Phải lấy offer ĐANG CHẠY, không phải offer đầu tiên tìm thấy. `OFFERS`
    // là nhật ký chỉ-thêm: khi thẻ này có offer thứ hai, `find` sẽ trả về bản
    // CŨ (khai trước trong file) và audit đem số rebate đã hết hạn ra so với
    // Contentful — đỏ mãi trong khi dữ liệu hiện tại đúng, tức một audit dạy
    // người đọc nó bỏ qua chính nó.
    const offer = liveOfferFor(product.id);
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
  `${dataset.products.length} sản phẩm (${dataset.productFamilies.length} họ), ` +
  `${dataset.productFees.length} mức phí, ${dataset.programValuations.length} định giá, ` +
  `${dataset.offers.length} offer, ` +
  `${dataset.offerComponents.length} component, ${dataset.earningRates.length} tỷ lệ tích điểm, ` +
  `${dataset.productBenefits.length} quyền lợi, ${dataset.eligibilityRules.length} điều kiện, ` +
  `${dataset.transferPaths.length} chặng chuyển, ${dataset.awardStrategies.length} award strategy.`;

if (errors.length > 0) {
  console.error(`\n${errors.length} lỗi, ${warnings.length} cảnh báo. ${summary}`);
  process.exit(1);
}
console.log(`✓  Không lỗi, ${warnings.length} cảnh báo. ${summary}`);
