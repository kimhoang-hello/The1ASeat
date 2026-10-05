import { PRODUCTS } from "./recommendation/data/products.ts";
import { EARNING_CAPS, EARNING_RATES } from "./recommendation/data/earning-rates.ts";
import { PRODUCT_BENEFITS } from "./recommendation/data/product-benefits.ts";
import { ELIGIBILITY_RULES } from "./recommendation/data/eligibility-rules.ts";
import { POINTS_PROGRAMS } from "./recommendation/data/points-programs.ts";
import { activeAt, isActiveAt } from "./recommendation/temporal.ts";
import { VERIFIED_NONE, type VerifiedNone } from "./card-facts-none.ts";
import type {
  EarningCap,
  EarningRate,
  EligibilityRule,
  PointsProgram,
  ProductBenefit,
  ProductSeed,
  Sourced,
  SpendCategory,
} from "./recommendation/types.ts";

/**
 * "Thông tin nhanh" của một thẻ Canada (03/10/2026, audit UX/UI đợt 3): vài dòng
 * dữ kiện có cấu trúc — tích điểm, điều kiện mở thẻ, phòng chờ, bảo hiểm — cho
 * trang thẻ và trang so sánh, thay vì bắt người đọc lục trong đoạn đánh giá.
 *
 * NGUỒN là dữ liệu của engine gợi ý (`recommendation/data/`), vốn được seed từ
 * chính `keyBenefitsVi` của Contentful và có `audit:reco-data` canh. Audit đó
 * nay đòi MỌI con số in ra ở đây (dòng seed từ nội dung site) phải có mặt trong
 * nội dung Contentful của đúng thẻ đó — bảng này không được nói một con số mà
 * đoạn văn ngay bên dưới nói khác.
 *
 * CHỈ dữ kiện lưu theo TỪNG THẺ. Không có dòng "chuyển điểm": chặng chuyển điểm
 * lưu theo CHƯƠNG TRÌNH, nên không tách được thẻ Cobalt (chỉ chuyển sang
 * Aeroplan® và Avios®) với các thẻ Membership Rewards® khác — in danh sách
 * chung là hứa những chặng thẻ đó không có.
 *
 * Thiếu dữ liệu thì dòng RỖNG và trang ghi "Chưa kiểm" — không suy từ hiểu biết
 * chung về thẻ. Bản ghi `stale`/`editorial` không phải dữ kiện đã kiểm nên bị
 * bỏ (kể cả trần tích điểm); dòng nào dựng từ một bản ghi `estimated` thì in kèm
 * "(ước tính)".
 *
 * Chữ tiếng Việt viết ngay trong file, như `card-tags.ts`: script audit và test
 * import file này trần, không qua `@/lib/t`.
 */

export type CardFactKey = "earn" | "eligibility" | "lounge" | "insurance";

/** Một ý của một dòng, kèm các bản ghi nó được dựng từ — `audit:reco-data`
 *  dựa vào `sourceKind` của chúng để biết phải đối chiếu với cái gì. */
export interface CardFactLine {
  text: string;
  sources: Sourced[];
  /** Ý có một phần "chưa kiểm" ngay trong chữ (trần, tỷ lệ nền, số lượt phòng
   *  chờ) — xem `hasUnchecked`. */
  unchecked?: true;
}

export interface CardFact {
  key: CardFactKey;
  /** Mỗi phần tử là một ý, in thành một dòng. Rỗng = chưa kiểm. */
  lines: CardFactLine[];
}

export interface CardFacts {
  /** Thẻ cashback: dòng tích điểm đổi nhãn thành "Hoàn tiền", tỷ lệ in bằng %. */
  cashBack: boolean;
  facts: CardFact[];
}

/** Bộ dữ liệu đọc vào — tách ra để test dựng được ca hiếm (trần `stale`, bản
 *  ghi `estimated`) mà không phải sửa dữ liệu thật. */
export interface CardFactsData {
  products: readonly ProductSeed[];
  programs: readonly PointsProgram[];
  rates: readonly EarningRate[];
  caps: readonly EarningCap[];
  benefits: readonly ProductBenefit[];
  rules: readonly EligibilityRule[];
  /** Dòng ĐÃ KIỂM là không có (phòng chờ, bảo hiểm) — xem `card-facts-none.ts`. */
  none: readonly VerifiedNone[];
}

const SITE_DATA: CardFactsData = {
  products: PRODUCTS,
  programs: POINTS_PROGRAMS,
  rates: EARNING_RATES,
  caps: EARNING_CAPS,
  benefits: PRODUCT_BENEFITS,
  rules: ELIGIBILITY_RULES,
  none: VERIFIED_NONE,
};

/** Nhãn ngắn của hạng mục chi tiêu — ngắn hơn bản ở `recommender/questions.ts`,
 *  vốn viết cho câu hỏi ("đặt đồ ăn giao tận nơi"). */
const CATEGORY_SHORT: Record<SpendCategory, string> = {
  grocery: "siêu thị",
  dining: "ăn uống",
  food_delivery: "giao đồ ăn",
  gas: "xăng",
  ev_charging: "sạc xe điện",
  travel: "du lịch",
  airline_direct: "vé mua thẳng từ hãng",
  hotel: "khách sạn",
  car_rental: "thuê xe",
  drugstore: "nhà thuốc",
  recurring: "hoá đơn định kỳ",
  streaming: "streaming",
  transit: "phương tiện công cộng",
  rideshare: "rideshare",
  entertainment: "giải trí",
  foreign_currency: "chi tiêu ngoại tệ",
  everything_else: "mọi chi tiêu khác",
};

/** `airline_direct` là vé của hãng GẮN VỚI chương trình của thẻ — gọi đúng tên. */
const AIRLINE_BY_PROGRAM: Record<string, string> = {
  aeroplan: "vé Air Canada®",
  westjet: "vé WestJet®",
  viporter: "vé Porter®",
  mileageplus: "vé United®",
};

/**
 * Bảo hiểm: nhãn khi không có số, và nhãn khi có số. `trip-cancellation` gộp
 * huỷ VÀ gián đoạn chuyến, nhưng con số trang thẻ nêu là hạn mức HUỶ — TD®
 * Aeroplan® Privilege: huỷ $2,500, gián đoạn $5,000. "Huỷ/gián đoạn tới $2,500"
 * là gán số của vế này cho vế kia (Codex bắt, 03/10/2026).
 */
const INSURANCE: [benefitId: string, label: string, labelWithAmount: string][] = [
  ["travel-medical-insurance", "Y tế du lịch", "Y tế du lịch"],
  ["trip-cancellation-insurance", "Huỷ/gián đoạn chuyến", "Huỷ chuyến"],
  ["flight-delay-insurance", "Trễ chuyến bay", "Trễ chuyến bay"],
  ["baggage-insurance", "Hành lý", "Hành lý"],
  ["mobile-device-insurance", "Thiết bị di động", "Thiết bị di động"],
  ["rental-car-insurance", "Thuê xe", "Thuê xe"],
];

/** Chữ của dòng đã kiểm là không có. Bảo hiểm nói rõ PHẠM VI: thẻ vẫn có thể
 *  có bảo vệ mua sắm, chỉ không có loại nào trong sáu loại bảng này theo dõi. */
const NONE_TEXT: Record<VerifiedNone["key"], string> = {
  lounge: "Không có",
  insurance: "Không có bảo hiểm du lịch hay thiết bị",
};

/** Cùng mẫu với `card-tags.ts`: `null` lượt mà chữ nói không giới hạn. */
const UNLIMITED_LOUNGE = /không giới hạn|Global Lounge Collection/i;

const money = (value: number) =>
  `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** Dữ kiện đã kiểm mới vào bảng. */
function usable<T extends Sourced>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.confidence === "verified" || row.confidence === "estimated");
}

/** Một chỗ duy nhất gắn "(ước tính)", tính từ MỌI bản ghi dựng nên dòng — cả
 *  trần, cả nhánh không có số — thay vì từng nhánh tự nhớ. */
function markEstimated(line: CardFactLine): CardFactLine {
  return line.sources.some((source) => source.confidence === "estimated")
    ? { ...line, text: `${line.text} (ước tính)` }
    : line;
}

/**
 * "5x", "1.25x", "3%". Hệ số lẻ vô hạn (2/3 điểm mỗi $1) viết lại thành "1
 * điểm/$1.50" — đúng cách trang thẻ viết, và "0.67x" thì không ai đọc ra.
 */
function rateText(multiplier: number, cashBack: boolean): string {
  if (cashBack) return `${multiplier}%`;
  const hundredths = multiplier * 100;
  if (Math.abs(hundredths - Math.round(hundredths)) < 1e-9) return `${multiplier}x`;
  const perPoint = Math.round((1 / multiplier) * 100) / 100;
  return `1 điểm/$${perPoint.toFixed(2)}`;
}

/** Trần "điểm" của thẻ cashback là CENT hoàn lại: 45,000 = $450. */
function capText(cap: EarningCap, cashBack: boolean): string {
  const period = { monthly: "tháng", quarterly: "quý", annual: "năm" }[cap.period];
  if (cap.kind === "spend") return `tối đa ${money(cap.amount)} chi tiêu/${period}`;
  if (cashBack) return `tối đa ${money(cap.amount / 100)} hoàn tiền/${period}`;
  return `tối đa ${cap.amount.toLocaleString("en-US")} điểm/${period}`;
}

function earnLines(
  data: CardFactsData,
  productId: string,
  programSlug: string | undefined,
  cashBack: boolean,
  asOf: string,
): CardFactLine[] {
  const rates = usable(activeAt(data.rates.filter((rate) => rate.productId === productId), asOf));
  if (rates.length === 0) return [];

  const caps = usable(activeAt(data.caps.filter((cap) => cap.productId === productId), asOf));
  const label = (category: SpendCategory) =>
    (category === "airline_direct" && programSlug && AIRLINE_BY_PROGRAM[programSlug]) ||
    CATEGORY_SHORT[category];

  const base = rates.find((rate) => rate.category === "everything_else" && rate.restrictedTo === null);

  // Một ý cho mỗi (hệ số, trần, hệ số sau trần) — hai nhóm 3% của TD® Cash Back
  // (xăng + sạc; hoá đơn + streaming) có hai trần RIÊNG, gộp làm một là nói sai
  // cả hai. Hạng mục trùng tỷ lệ nền
  // không in: "1x du lịch" cạnh "1x mọi chi tiêu khác" không thêm gì.
  const groups = new Map<string, { multiplier: number; rows: EarningRate[] }>();
  const restricted = new Map<string, { multiplier: number; rows: EarningRate[] }>();
  for (const rate of rates) {
    if (rate === base) continue;
    if (rate.restrictedTo !== null) {
      // Cùng hệ số và cùng điều kiện thì chung một ý: "5x siêu thị, ăn uống —
      // …" chứ không phải hai dòng lặp lại điều kiện.
      const key = `${rate.multiplier}|${rate.restrictedTo}|${rate.capId ?? ""}|${rate.rateAfterCap ?? ""}`;
      const group = restricted.get(key) ?? { multiplier: rate.multiplier, rows: [] };
      group.rows.push(rate);
      restricted.set(key, group);
      continue;
    }
    if (base && rate.multiplier === base.multiplier && rate.capId === null) continue;
    const key = `${rate.multiplier}|${rate.capId ?? ""}|${rate.rateAfterCap ?? ""}`;
    const group = groups.get(key) ?? { multiplier: rate.multiplier, rows: [] };
    group.rows.push(rate);
    groups.set(key, group);
  }

  /**
   * Gắn trần vào một ý — MỌI nhánh đi qua đây (nhóm thường, nhóm merchant, tỷ
   * lệ nền), vì validator không cấm trần ở nhánh nào. Tỷ lệ CÓ trần mà trần hết
   * hiệu lực hoặc chưa kiểm thì nói ra, không để dòng trông như không giới hạn.
   * `perCategory`: ý gộp từ nhiều hạng mục, mỗi hạng mục một trần y hệt nhau.
   */
  const withCap = (text: string, rows: EarningRate[], perCategory = false): CardFactLine => {
    const first = rows[0];
    if (first.capId === null) return { text, sources: rows };
    const cap = caps.find((row) => row.id === first.capId);
    if (!cap) return { text: `${text} — trần: chưa kiểm`, sources: rows, unchecked: true };
    const rowCaps = perCategory ? caps.filter((row) => rows.some((rate) => rate.capId === row.id)) : [cap];
    const each = perCategory ? " cho mỗi hạng mục" : "";
    const after = first.rateAfterCap !== null ? `, sau đó ${rateText(first.rateAfterCap, cashBack)}` : "";
    return { text: `${text} — ${capText(cap, cashBack)}${each}${after}`, sources: [...rows, ...rowCaps] };
  };

  // Hạng mục mỗi cái một trần RIÊNG mà các trần y hệt nhau (TD® First Class:
  // siêu thị, ăn uống, phương tiện công cộng, mỗi nhóm $25,000/năm) gộp thành
  // một ý "… cho mỗi hạng mục". CHỈ gộp nhóm một hạng mục: nhóm nhiều hạng mục
  // dùng chung một trần (xăng + sạc của TD® Cash Back) mà gộp thì không còn
  // biết hạng mục nào chung trần với hạng mục nào.
  const capSignature = (rows: EarningRate[]): string | null => {
    if (rows.length !== 1 || rows[0].capId === null) return null;
    const cap = caps.find((row) => row.id === rows[0].capId);
    return cap ? `${rows[0].multiplier}|${cap.kind}|${cap.amount}|${cap.period}|${rows[0].rateAfterCap ?? ""}` : null;
  };
  const merged: { multiplier: number; rows: EarningRate[]; perCategory: boolean }[] = [];
  const bySignature = new Map<string, (typeof merged)[number]>();
  for (const group of groups.values()) {
    const signature = capSignature(group.rows);
    const existing = signature === null ? undefined : bySignature.get(signature);
    if (existing) {
      existing.rows.push(...group.rows);
      existing.perCategory = true;
      continue;
    }
    const entry = { multiplier: group.multiplier, rows: [...group.rows], perCategory: false };
    merged.push(entry);
    if (signature !== null) bySignature.set(signature, entry);
  }

  const items: { multiplier: number; line: CardFactLine }[] = [];
  for (const { multiplier, rows, perCategory } of merged) {
    const text = `${rateText(multiplier, cashBack)} ${rows.map((row) => label(row.category)).join(", ")}`;
    items.push({ multiplier, line: withCap(text, rows, perCategory) });
  }
  // Tỷ lệ chỉ áp ở một nhóm merchant: in kèm đúng nhóm đó, không thì "6x siêu
  // thị" đọc như mọi siêu thị. `restrictedTo` vì vậy là chữ cho NGƯỜI ĐỌC.
  for (const { multiplier, rows } of restricted.values()) {
    const text = `${rateText(multiplier, cashBack)} ${rows.map((row) => label(row.category)).join(", ")} — ${rows[0].restrictedTo}`;
    items.push({ multiplier, line: withCap(text, rows) });
  }
  // Sort của JS ổn định: cùng hệ số thì giữ thứ tự của file dữ liệu, vốn theo
  // thứ tự trang thẻ liệt kê.
  items.sort((a, b) => b.multiplier - a.multiplier);

  const lines = items.map((item) => item.line);
  lines.push(
    base
      ? // Tỷ lệ nền đứng một mình (Wealthsimple® 2%) là "mọi chi tiêu", không
        // phải "mọi chi tiêu KHÁC" — khác cái gì?
        withCap(
          `${rateText(base.multiplier, cashBack)} ${lines.length === 0 ? "mọi chi tiêu" : CATEGORY_SHORT.everything_else}`,
          [base],
        )
      : // Không có tỷ lệ nền thì danh sách trên CHƯA ĐỦ — nói ra, đừng để bảng
        // trông như đã liệt kê hết.
        { text: "Mọi chi tiêu khác: chưa kiểm", sources: [], unchecked: true },
  );
  return lines;
}

function eligibilityLines(data: CardFactsData, productId: string, asOf: string): CardFactLine[] {
  const rules = usable(
    activeAt(
      data.rules.filter(
        (rule) => rule.productId === productId && rule.scope === "application" && rule.severity === "hard",
      ),
      asOf,
    ),
  );

  // Luật thu nhập đi theo nhóm HOẶC ("$60,000 cá nhân HOẶC $100,000 hộ gia
  // đình") — xem `EligibilityRule.ruleGroup`.
  const incomeGroups = new Map<string, EligibilityRule[]>();
  for (const rule of rules) {
    if (rule.ruleType !== "minimum_personal_income" && rule.ruleType !== "minimum_household_income") continue;
    const key = rule.ruleGroup ?? rule.id;
    incomeGroups.set(key, [...(incomeGroups.get(key) ?? []), rule]);
  }

  const lines: CardFactLine[] = [];
  const push = (text: string, sources: Sourced[]) => lines.push({ text, sources });
  for (const group of incomeGroups.values()) {
    const personal = group.find((rule) => rule.ruleType === "minimum_personal_income");
    const household = group.find((rule) => rule.ruleType === "minimum_household_income");
    const p = typeof personal?.value === "number" ? personal.value : undefined;
    const h = typeof household?.value === "number" ? household.value : undefined;
    if (p !== undefined && h !== undefined && (p > 0 || h > 0)) {
      push(`Thu nhập từ ${money(p)} cá nhân hoặc ${money(h)} hộ gia đình`, group);
    } else if (p !== undefined && p > 0) {
      push(`Thu nhập cá nhân từ ${money(p)}`, group);
    } else if (h !== undefined && h > 0) {
      push(`Thu nhập hộ gia đình từ ${money(h)}`, group);
    } else if (p === 0 || h === 0) {
      push("Không yêu cầu thu nhập tối thiểu", group);
    }
  }
  const business = rules.filter((rule) => rule.ruleType === "business_required");
  if (business.length > 0) push("Cần có doanh nghiệp", business);
  const student = rules.filter((rule) => rule.ruleType === "student_status_required");
  if (student.length > 0) push("Chỉ dành cho sinh viên", student);
  return lines;
}

function loungeLines(benefits: ProductBenefit[]): CardFactLine[] {
  const lines: CardFactLine[] = [];
  for (const row of benefits) {
    if (row.benefitId === "maple-leaf-lounge") {
      lines.push({ text: `Maple Leaf Lounge®${row.textValue ? `: ${row.textValue}` : ""}`, sources: [row] });
    }
  }
  for (const row of benefits) {
    if (row.benefitId !== "airport-lounge-passes") continue;
    const text = row.textValue ?? "";
    if (row.numericValue !== null && row.numericValue > 0) {
      lines.push({ text: `${row.numericValue} lượt miễn phí mỗi năm${text ? ` (${text})` : ""}`, sources: [row] });
    } else if (row.numericValue === 0) {
      // ĐÃ KIỂM là không có lượt miễn phí: thẻ chỉ cho (hoặc giảm giá) thẻ hội
      // viên, mỗi lượt vào vẫn trả tiền — Priority Pass của Amex® Aeroplan®*
      // Reserve, DragonPass của WestJet RBC® và BMO® VIPorter® (US$32/lượt).
      lines.push({ text: `${text.split(" — ")[0]} (mỗi lượt vào trả phí)`, sources: [row] });
    } else if (UNLIMITED_LOUNGE.test(text)) {
      lines.push({ text, sources: [row] });
    } else if (text) {
      // `null` lượt = site không nêu số lượt (xem đầu `product-benefits.ts`):
      // có thẻ hội viên, nhưng mấy lượt miễn phí thì chưa ai kiểm. Phần sau
      // dấu " — " là ghi chú nội bộ của file dữ liệu, không in.
      lines.push({
        text: `${text.split(" — ")[0]} (số lượt miễn phí chưa kiểm)`,
        sources: [row],
        unchecked: true,
      });
    }
  }
  return lines;
}

function insuranceLines(benefits: ProductBenefit[]): CardFactLine[] {
  const lines: CardFactLine[] = [];
  for (const [benefitId, label, labelWithAmount] of INSURANCE) {
    const row = benefits.find((benefit) => benefit.benefitId === benefitId);
    if (!row) continue;
    const amount = row.numericValue !== null ? money(row.numericValue) : null;
    // "Y tế du lịch (Y tế khẩn cấp ngoài tỉnh)" → "(khẩn cấp ngoài tỉnh)".
    let text = row.textValue?.replace(/^Y tế\s+/, "") ?? null;
    // Số của bảo hiểm thuê xe là giá trị XE được bảo hiểm (MSRP), không phải
    // hạn mức bồi thường — "Thuê xe tới $85,000" đọc như được bồi tới $85,000.
    if (benefitId === "rental-car-insurance" && amount !== null && text === null) text = `xe tới ${amount}`;
    // Chữ đã chứa con số ("31 ngày, xe đến $65,000") thì không in số hai lần —
    // nhưng vẫn là nhãn CÓ SỐ: con số nằm trong ngoặc vẫn là hạn mức huỷ.
    const lead = amount === null ? label : text?.includes(amount) ? labelWithAmount : `${labelWithAmount} tới ${amount}`;
    lines.push({ text: `${lead}${text ? ` (${text})` : ""}`, sources: [row] });
  }
  return lines;
}

/** Như `cardFactsFor`, trên một bộ dữ liệu cho trước — cho test. */
export function cardFactsFrom(data: CardFactsData, slug: string, asOf: string): CardFacts | null {
  const product = data.products.find(
    (row) => (row.slug === slug || row.previousSlugs.includes(slug)) && isActiveAt(row, asOf),
  );
  if (!product) return null;

  const program = data.programs.find((row) => row.id === product.pointsProgramId);
  const cashBack = program?.programType === "cash_back";
  const benefits = usable(activeAt(data.benefits.filter((row) => row.productId === product.id), asOf));

  /** Không có dữ kiện nào mà ĐÃ KIỂM là không có → một dòng "Không có" thay
   *  cho "Chưa kiểm". Có dữ kiện thì dữ kiện thắng (`audit:reco-data` báo lỗi
   *  khi hai bên chọi nhau). */
  const orNone = (key: VerifiedNone["key"], lines: CardFactLine[]): CardFactLine[] => {
    if (lines.length > 0) return lines;
    // `recordedAt <= asOf`: dựng lại một ngày TRƯỚC lần kiểm thì chưa ai biết
    // là "không có" — trang của ngày đó ghi "Chưa kiểm", như lúc ấy.
    const entry = data.none.find(
      (row) =>
        row.key === key &&
        row.recordedAt <= asOf &&
        (row.slug === product.slug || product.previousSlugs.includes(row.slug)),
    );
    return entry ? [{ text: NONE_TEXT[key], sources: [entry] }] : lines;
  };

  const facts: CardFact[] = [
    { key: "earn", lines: earnLines(data, product.id, program?.slug, cashBack, asOf) },
    { key: "eligibility", lines: eligibilityLines(data, product.id, asOf) },
    { key: "lounge", lines: orNone("lounge", loungeLines(benefits)) },
    { key: "insurance", lines: orNone("insurance", insuranceLines(benefits)) },
  ];
  return {
    cashBack,
    facts: facts.map((fact) => ({ ...fact, lines: fact.lines.map(markEstimated) })),
  };
}

/**
 * Khối có chỗ nào "chưa kiểm" không — dòng rỗng, hoặc một ý chưa kiểm một phần
 * ("trần: chưa kiểm", "Mọi chi tiêu khác: chưa kiểm", "số lượt miễn phí chưa
 * kiểm"). Câu giải thích chữ "Chưa kiểm" dưới khối chỉ in khi có: từ 04/10/2026
 * 35/35 thẻ không còn ô nào như thế, mà câu đó vẫn nằm dưới mọi trang thẻ.
 */
export function hasUnchecked(data: CardFacts): boolean {
  return data.facts.some((fact) => fact.lines.length === 0 || fact.lines.some((line) => line.unchecked));
}

/**
 * Thông tin nhanh của một thẻ, theo slug entry Contentful; `null` khi engine
 * không biết thẻ này (thẻ Mỹ, thẻ vừa thêm mà chưa seed). `asOf` là
 * `YYYY-MM-DD` — phía site là `todayInSiteZone()`.
 */
export function cardFactsFor(slug: string, asOf: string): CardFacts | null {
  return cardFactsFrom(SITE_DATA, slug, asOf);
}

/* ------------------------------------------------------------------ *
 * Đọc số — dùng chung cho hai phía của phép so trong `audit:reco-data`
 * ------------------------------------------------------------------ */

/**
 * Mọi con số trong một chuỗi, đã chuẩn hoá: "$2,500" → 2500, "1.25x" → 1.25,
 * "$5 triệu" và "$2M" → 5,000,000 và 2,000,000. Bảng và nội dung Contentful đọc
 * số qua CÙNG hàm này, để hai bên chắc chắn hiểu số theo cùng một luật.
 */
export function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)].map((match) => {
    const value = Number(match[0].replace(/,/g, ""));
    const after = text.slice((match.index ?? 0) + match[0].length);
    // "$5 triệu", "$2M" — trang thẻ viết triệu theo cả hai kiểu.
    return /^(\s*triệu|M\b)/.test(after) ? value * 1_000_000 : value;
  });
}

/**
 * Một tỷ lệ trong dòng Thông tin nhanh: hệ số kèm đơn vị ("5x", "1.25x", "3%")
 * hoặc dạng điểm trên số đô ("1 điểm/$1.50"). `audit:reco-data` đòi mỗi tỷ lệ
 * có BẰNG CHỨNG cùng dạng trong nội dung — so số trần thì yếu với số nhỏ: đổi
 * "Hoàn 3%" thành "Hoàn 2%" mà nội dung còn "3 tháng đầu" thì số 3 vẫn "có mặt"
 * (Codex bắt, 03/10/2026).
 */
export type RateClaim =
  | { kind: "multiplier"; value: number; unit: "x" | "%" }
  | { kind: "perDollar"; points: number; dollars: number };

const MULTIPLIER_TOKEN = /(?<![\d.,])(\d+(?:\.\d+)?)(x|%)(?![\p{L}\d])/gu;
const PER_DOLLAR_TOKEN = /(?<![\d.,])(\d+(?:\.\d+)?) điểm\/\$(\d+(?:\.\d+)?)/gu;
const UNIT_WORD = "(?:điểm|dặm|miles?|points?)";
/**
 * Mẫu số của CHÍNH tỷ lệ vừa khớp: "/$3", "mỗi $3", "cho mỗi $3", "Avion®/$1".
 * Giữa đơn vị và mẫu số chỉ được có vài CHỮ — không số, không dấu phẩy. Bản
 * trước cho qua mọi thứ trừ dấu chấm, nên "2 điểm cho siêu thị, 1 điểm/$1.50"
 * gán $1.50 của vế sau cho vế đầu (Codex bắt, 03/10/2026). Số chữ có trần để
 * regex không phải thử lại vô hạn trên một đoạn văn dài.
 */
const DENOMINATOR = /^(?:\s+[\p{L}®™*+&'’-]+){0,4}?\s*(?:\/|mỗi|per)\s*\$\s*(\d+(?:\.\d+)?)/iu;

export function rateClaimsIn(text: string): RateClaim[] {
  return [
    ...[...text.matchAll(PER_DOLLAR_TOKEN)].map(
      (match): RateClaim => ({ kind: "perDollar", points: Number(match[1]), dollars: Number(match[2]) }),
    ),
    ...[...text.matchAll(MULTIPLIER_TOKEN)].map(
      (match): RateClaim => ({ kind: "multiplier", value: Number(match[1]), unit: match[2] as "x" | "%" }),
    ),
  ];
}

/** Dòng đã bỏ các tỷ lệ — số còn lại (trần, thu nhập, hạn mức) so theo giá trị. */
export function withoutRateClaims(text: string): string {
  return text.replace(PER_DOLLAR_TOKEN, " ").replace(MULTIPLIER_TOKEN, " ");
}

/** Mẫu regex của một con số, nhận cả số 0 thừa ở đuôi: 2 ↔ "2.00", 1.5 ↔ "1.50". */
function numberPattern(value: number): string {
  const [int, dec] = String(value).split(".");
  return dec ? `${int}\\.${dec}0*` : `${int}(?:\\.0+)?`;
}

/** Mẫu số, không dính vào chữ số đứng trước hay sau nó. */
function bare(value: number): string {
  return `(?<![\\d.,])${numberPattern(value)}(?![\\d]|[.,]\\d)`;
}

/** Có ít nhất một chỗ khớp `pattern` mà mẫu số theo sau (nếu có) đúng là `dollars`. */
function matchesWithDenominator(content: string, pattern: string, dollars: number): boolean {
  for (const match of content.matchAll(new RegExp(pattern, "giu"))) {
    const start = (match.index ?? 0) + match[0].length;
    const rest = content.slice(start, start + 60);
    const denominator = DENOMINATOR.exec(rest);
    if (denominator === null ? dollars === 1 : Number(denominator[1]) === dollars) return true;
  }
  return false;
}

export function hasRateEvidence(content: string, claim: RateClaim): boolean {
  if (claim.kind === "perDollar") {
    return matchesWithDenominator(content, `${bare(claim.points)}\\s+${UNIT_WORD}`, claim.dollars);
  }
  const n = bare(claim.value);
  if (claim.unit === "%") return new RegExp(`${n}\\s*%`, "iu").test(content);
  return (
    new RegExp(`${n}\\s*x(?![\\p{L}\\d])`, "iu").test(content) ||
    new RegExp(`(?<![\\p{L}\\d])x\\s*${numberPattern(claim.value)}(?![\\d]|[.,]\\d)`, "iu").test(content) ||
    // "2 điểm/$1", "1.25 điểm Avion®/$1" — nhưng KHÔNG "2 điểm cho mỗi $3".
    matchesWithDenominator(content, `${n}\\s+${UNIT_WORD}`, 1)
  );
}
