import { rebateFiguresIn, withRebateFigure } from "./rebate-prose.ts";

/**
 * Copy của offer THƯỜNG cho một thẻ vừa hết offer nâng, lấy lại từ lịch sử
 * publish của chính entry đó. Không mô hình nào viết chữ.
 *
 * Tới 05/11/2026 `expire-offers` nhờ Claude dịch prose tiếng Anh của
 * FinlyWealth thành copy mới. Đường đó chưa từng chạy được trên production:
 * 01/11 server thiếu key, 05/11 có key thì tài khoản hết credit, và cả hai lần
 * job tắt cờ elevated rồi để nguyên copy của offer đã chết. Tác giả chốt 05/11:
 * bỏ hẳn Anthropic API.
 *
 * Thay vào đó: mỗi lần publish, Contentful lưu một snapshot của entry. Offer
 * nâng hết thì ngân hàng gần như luôn quay về đúng offer thường đã chạy trước
 * đợt nâng, và bản copy viết cho offer đó (do người viết, đã qua kiểm) nằm sẵn
 * trong snapshot cuối cùng trước khi cờ `elevatedBonus` được bật. Lượt kiểm
 * toàn diện 05/11 sửa tay bốn thẻ Amex® đúng bằng cách này.
 *
 * Bản khôi phục KHÔNG được tin mù: ngân hàng có thể đổi luôn offer thường
 * trong lúc offer nâng chạy. `standingCopyProblems` đối chiếu nó với trang
 * FinlyWealth hiện hành trước khi ghi. Không qua thì job giữ `expiresAt`, đỏ,
 * và một người (hoặc một phiên Claude Code) sửa tay — đúng như lúc chưa có gì.
 */

export interface OfferCopy {
  /** Con số lớn trong ô số liệu (`OfferStats`). Rỗng = thẻ không có welcome bonus. */
  welcomeBonusVi: string;
  headlineVi: string;
  keyBenefitsVi: string[];
  editorsTakeVi: string;
}

/** Một lần publish của entry, đọc từ `/entries/{id}/snapshots` của CMA. */
export interface PublishSnapshot {
  /** `sys.createdAt` của snapshot = lúc publish. ISO, so được bằng chuỗi. */
  publishedAt: string;
  fields: Record<string, Record<string, unknown> | undefined>;
}

const LOCALE = "en-US";

function valueIn(fields: PublishSnapshot["fields"], name: string): unknown {
  return fields[name]?.[LOCALE];
}

/** Bốn trường copy của một bộ `fields`, hoặc `null` khi thiếu/sai kiểu. */
export function copyOf(fields: PublishSnapshot["fields"]): OfferCopy | null {
  const label = valueIn(fields, "welcomeBonusVi");
  const headline = valueIn(fields, "headlineVi");
  const benefits = valueIn(fields, "keyBenefitsVi");
  const take = valueIn(fields, "editorsTakeVi");

  if (label !== undefined && typeof label !== "string") return null;
  if (typeof headline !== "string" || !headline.trim()) return null;
  if (typeof take !== "string" || !take.trim()) return null;
  if (!Array.isArray(benefits) || benefits.length === 0) return null;
  if (benefits.some((item) => typeof item !== "string")) return null;

  return { welcomeBonusVi: label ?? "", headlineVi: headline, keyBenefitsVi: benefits as string[], editorsTakeVi: take };
}

/** So nội dung, bỏ qua khác biệt khoảng trắng. */
function copyKey(copy: OfferCopy): string {
  const squash = (text: string) => text.replace(/\s+/g, " ").trim();
  return JSON.stringify([
    squash(copy.welcomeBonusVi),
    squash(copy.headlineVi),
    copy.keyBenefitsVi.map(squash),
    squash(copy.editorsTakeVi),
  ]);
}

export type StandingCopy =
  /** Khôi phục từ snapshot trước đợt nâng. */
  | { ok: true; source: "snapshot"; copy: OfferCopy; publishedAt: string }
  /** Copy hiện tại chưa từng đi cùng cờ elevated: đã có người viết lại rồi. */
  | { ok: true; source: "current"; copy: OfferCopy }
  | { ok: false; reason: string };

/**
 * Copy của offer thường mà thẻ nên quay về.
 *
 * "Copy elevated" = bất kỳ bộ bốn trường nào từng được publish cùng
 * `elevatedBonus: true`. Theo NỘI DUNG chứ không chỉ theo cờ, vì cờ có lúc nói
 * dối: lượt `expire-offers` 05/11 hỏng publish 5 lần WestJet RBC® với cờ TẮT và
 * nguyên copy của offer nâng.
 *
 * - Copy hiện tại KHÔNG phải copy elevated → đã có người viết lại cho offer
 *   thường (sửa tay mà quên xoá `expiresAt`). Giữ nguyên, đừng đè bằng bản cũ.
 * - Ngược lại → bản publish cờ tắt ĐẦU TIÊN tính ngược từ lần publish elevated
 *   cuối. Nếu chữ của nó trùng một bản elevated nào đó thì DỪNG, không lùi
 *   tiếp: "tắt cờ, giữ nguyên chữ" vừa có thể là lượt job hỏng, vừa có thể là
 *   tác giả chốt rằng offer nâng cũ đã thành offer thường — và lùi qua nó là
 *   khôi phục một offer còn cũ hơn nữa (Codex 05/11/2026: thường 30,000 →
 *   nâng 50,000 → thường 50,000 → nâng 70,000 thì bản 30,000 bị chọn).
 *
 * Snapshot cũ hơn `MAX_SNAPSHOT_AGE_DAYS` bị từ chối dù số liệu còn khớp:
 * khôi phục nó là xoá mọi lần sửa chữ sau đó (lượt rà copy 17/10/2026, thêm
 * ®/™). Đo 05/11/2026: Scotiabank® Gold Amex® chỉ còn bản trước đợt nâng từ
 * 02/08, viết lúc thẻ chưa có welcome bonus.
 */
export const MAX_SNAPSHOT_AGE_DAYS = 120;

export function standingCopy(history: PublishSnapshot[], current: OfferCopy, today: string): StandingCopy {
  const published = [...history].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const isElevated = (snapshot: PublishSnapshot) => valueIn(snapshot.fields, "elevatedBonus") === true;

  const elevatedCopies = new Set<string>();
  for (const snapshot of published) {
    if (!isElevated(snapshot)) continue;
    const copy = copyOf(snapshot.fields);
    if (copy) elevatedCopies.add(copyKey(copy));
  }

  if (!elevatedCopies.has(copyKey(current))) return { ok: true, source: "current", copy: current };

  const lastElevated = published.find(isElevated)!;
  for (const snapshot of published) {
    if (snapshot.publishedAt >= lastElevated.publishedAt || isElevated(snapshot)) continue;
    const copy = copyOf(snapshot.fields);
    const at = snapshot.publishedAt.slice(0, 10);
    if (!copy) return { ok: false, reason: `bản publish ${at} trước đợt nâng thiếu trường copy` };
    if (elevatedCopies.has(copyKey(copy))) {
      return {
        ok: false,
        reason: `bản publish ${at} tắt cờ elevated nhưng giữ nguyên chữ của một bản elevated — không chắc đó là offer thường`,
      };
    }
    const ageDays = (Date.parse(today) - Date.parse(snapshot.publishedAt.slice(0, 10))) / 86_400_000;
    if (ageDays > MAX_SNAPSHOT_AGE_DAYS) {
      return {
        ok: false,
        reason: `bản offer thường gần nhất publish ${snapshot.publishedAt.slice(0, 10)}, cũ hơn ${MAX_SNAPSHOT_AGE_DAYS} ngày — khôi phục sẽ xoá các lần sửa chữ sau đó`,
      };
    }
    return { ok: true, source: "snapshot", copy, publishedAt: snapshot.publishedAt };
  }

  return {
    ok: false,
    reason: `không có snapshot nào trước đợt nâng mang copy offer thường (đọc ${published.length} lần publish)`,
  };
}

/**
 * Bản copy với mọi con số "$X rebate" đổi thành rebate hiện hành.
 *
 * Snapshot trước đợt nâng ghi rebate CỦA LÚC ĐÓ. `rebateVi` và câu HOT TIP phải
 * khớp nhau trong cùng một lần ghi, cùng lý do `check-rebates` gộp
 * `rebateProsePatch` với `rebateVi`.
 */
export function withRebate(copy: OfferCopy, rebate: string | undefined): OfferCopy {
  if (!rebate) return copy;
  return {
    welcomeBonusVi: copy.welcomeBonusVi,
    headlineVi: withRebateFigure(copy.headlineVi, rebate),
    keyBenefitsVi: copy.keyBenefitsVi.map((item) => withRebateFigure(item, rebate)),
    editorsTakeVi: withRebateFigure(copy.editorsTakeVi, rebate),
  };
}

export interface OfferSource {
  name: string;
  annualFee: string;
  /** Rebate FinlyWealth hiện hành; `undefined` = không có hoặc đang pause. */
  rebate?: string;
  /** Prose tiếng Anh của FinlyWealth về offer đang chạy. */
  offerDetails: string;
}

/**
 * Lý do KHÔNG được ghi bản copy này lên site, hoặc `[]`.
 *
 * Ba cửa, mỗi cửa chặn một cách bản khôi phục có thể sai:
 *
 * 1. Nhãn số lớn phải có con số, và MỌI con số của nó phải có trên trang
 *    FinlyWealth: nhãn rỗng là copy viết lúc thẻ chưa có welcome bonus.
 *    Con số ngân hàng đặt ra (điểm, mức chi tiêu từ $1,000, phần trăm) ở chỗ
 *    nói về welcome bonus (nhãn số lớn, headline, dòng đầu key benefits) phải
 *    có trên trang FinlyWealth hiện hành. Bắt ca ngân hàng đổi luôn offer
 *    thường trong lúc offer nâng chạy. Bỏ qua số tiền dưới $1,000 ("giá trị
 *    $700 tiền vé", "voucher từ $119", "5 điểm/$1"): phần lớn là giá trị site tự
 *    quy đổi, và đo trên dữ liệu thật 05/11/2026 thì đòi chúng làm đỏ oan 6/10
 *    thẻ đang đúng. Editor's take và các dòng key benefits sau không bị đòi, vì
 *    cùng lý do. KHÔNG tự cộng các nấc điểm thành tổng: BMO® ghi 20,000 +
 *    20,000 + 30,000 mà không in 70,000, nhưng mọi luật "khi nào được cộng"
 *    thử 05/11/2026 đều cấp phép nhầm cho một con số không ai viết ("up to
 *    50,000" + 30,000 thành 80,000 — Codex vòng 1, 2). Thẻ kiểu đó sửa tay.
 * 2. Không còn ngày nào đã qua, trừ ngày mở đầu một khoảng còn hiệu lực ("mở
 *    từ 02/11/2026 đến 03/01/2027"). Copy có "promo đến 4/11/2026" là copy của
 *    một offer có hạn, và hạn đó đã hết.
 * 3. Rebate: thẻ không còn rebate thì không được hứa rebate; có câu HOT TIP thì
 *    phải đọc ra được con số trong đó.
 */
export function standingCopyProblems(copy: OfferCopy, source: OfferSource, today: string): string[] {
  const problems: string[] = [];

  const sourceText = [source.offerDetails, source.annualFee, source.rebate ?? "", source.name].join(" ");
  const sourced = new Set<number | string>([
    ...moneyAndPointsIn(sourceText),
    ...percentsIn(sourceText).map((p) => `${p}%`),
  ]);

  // Nhãn là con số to nhất trên trang thẻ, nên đòi MỌI con số trong nó, kể cả
  // tiền dưới $1,000 ("Cashback 10% (tối đa $200)").
  const labelFigures = [...moneyAndPointsIn(copy.welcomeBonusVi), ...percentsIn(copy.welcomeBonusVi).map((p) => `${p}%`)];
  if (labelFigures.length === 0) {
    problems.push(`nhãn welcome bonus không có con số ("${copy.welcomeBonusVi}")`);
  }

  const offerText = [copy.headlineVi, copy.keyBenefitsVi[0] ?? ""].join(" ");
  const bankFigures = [
    ...labelFigures,
    ...moneyAndPointsIn(offerText).filter((value) => value >= 1000),
    ...percentsIn(offerText).map((p) => `${p}%`),
  ];
  const unsourced = [...new Set(bankFigures)].filter((value) => !sourced.has(value));
  if (unsourced.length > 0) {
    problems.push(`con số welcome bonus không có trên trang FinlyWealth hiện hành: ${unsourced.join(", ")}`);
  }

  const texts = [copy.welcomeBonusVi, copy.headlineVi, ...copy.keyBenefitsVi, copy.editorsTakeVi];
  const everything = texts.join("\n");
  const malformed = [...new Set(malformedMoneyIn(everything))];
  if (malformed.length > 0) problems.push(`số tiền viết sai định dạng: ${malformed.join(", ")}`);

  const past = new Set<string>();
  for (const text of texts) {
    const dates = datesIn(text);
    dates.forEach((date, i) => {
      if (date.iso >= today) return;
      // Ngày đã qua chỉ được tha khi nó MỞ một khoảng còn hiệu lực: "từ
      // 02/11/2026 đến 03/01/2027". Một ngày tương lai ở mệnh đề khác ("promo
      // tới 4/11/2026; phí mới từ 12/01/2027") không che được nó (Codex 05/11).
      const next = dates[i + 1];
      const between = next ? text.slice(date.end, next.index) : "";
      if (next && next.iso >= today && RANGE_JOIN.test(between)) return;
      past.add(date.text);
    });
  }
  if (past.size > 0) problems.push(`còn nhắc ngày đã qua: ${[...past].join(", ")}`);

  const promised = rebateFiguresIn(everything);
  const hotTip = /HOT TIP/i.test(everything);
  if (!source.rebate && (promised.length > 0 || hotTip)) {
    problems.push(`thẻ không còn rebate FinlyWealth nhưng copy vẫn hứa ${promised[0] ?? "HOT TIP"}`);
  } else if (source.rebate && hotTip && promised.length === 0) {
    problems.push(`có câu HOT TIP nhưng không đọc ra con số "$X rebate" (rebate hiện hành ${source.rebate})`);
  }

  return problems;
}

/**
 * Mọi ngày viết đủ năm trong một đoạn chữ: "4/11/2026", "04/11/2026",
 * "4 tháng 11, 2026", "4 tháng 11 năm 2026".
 *
 * Ngày thiếu năm ("đến 4/11") không đọc: "4/11" cũng có thể là một tỷ số, và
 * đoán năm là đoán. Copy của site viết hạn offer kèm năm.
 */
const DATE_PATTERNS = [
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
  /\b(\d{1,2}) tháng (\d{1,2})(?:,| năm)? (\d{4})\b/g,
];

export function datesIn(text: string): { text: string; iso: string; index: number; end: number }[] {
  const out: { text: string; iso: string; index: number; end: number }[] = [];
  for (const pattern of DATE_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      if (day < 1 || day > 31 || month < 1 || month > 12) continue;
      out.push({
        text: m[0],
        iso: `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        index: m.index,
        end: m.index + m[0].length,
      });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Chữ nối hai đầu một khoảng ngày: " đến ", " tới ", " – ", " - ", " đến hết ngày ". */
const RANGE_JOIN = /^\s*(?:đến|tới|–|—|-)\s*(?:hết\s+)?(?:ngày\s+)?$/i;

/**
 * Bỏ ngày và năm trần ("2026", "năm 2027") trước khi đọc số: năm là số có
 * bốn chữ số không dấu phẩy, nên nếu để nguyên thì "đến 31/01/2027" sinh ra
 * một "con số" 2027 mà nguồn không có. Số điểm thật viết có dấu phẩy ngăn
 * nghìn theo luật của site.
 */
function withoutDates(text: string): string {
  let out = text;
  for (const pattern of DATE_PATTERNS) out = out.replace(pattern, " ");
  return out.replace(/(?<![\d,.$])\b20\d\d\b(?!\d|[,.]\d)/g, " ");
}

/** Phần trăm: "10%", "1.5 %". */
function percentsIn(text: string): number[] {
  return [...withoutDates(text).matchAll(/(\d+(?:\.\d+)?)\s?%/g)].map((m) => Number(m[1]));
}

/*
 * Đọc số tiền/điểm. Chuyển nguyên từ `rewrite-offer.ts` (đã xoá 05/11/2026)
 * cùng các bài học đã trả giá ở đó.
 */

/**
 * Giá trị SỐ của một con số viết ra, theo quy ước Anh (phẩy ngăn nghìn, chấm
 * thập phân), cũng là luật viết số của site. So bằng số chứ không bằng chuỗi
 * chữ số: `replace(/\D/g, "")` đọc `$1.25` và `$125` cùng ra "125".
 */
function valueOf(figure: string): number | null {
  const n = Number(figure.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Một con số viết đúng: nhóm nghìn chuẩn ("70,000") hoặc không phẩy ("70000"),
 * kèm phần thập phân tuỳ ý. `(?!\d|[,.]\d)` ở cuối là BẮT BUỘC: thiếu nó thì
 * "$100,00" khớp được đoạn "100" rồi bỏ lại ",00". Chỉ chặn khi phần dư là chữ
 * số hoặc dấu phẩy/chấm CÓ chữ số theo sau, để "US$1,000, when you…" vẫn đọc ra
 * 1,000.
 */
const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?!\d|[,.]\d)`;

/**
 * Số tiền có `$` và số từ 1,000 trở lên. KHÔNG lấy số nhỏ trần ("6 tháng",
 * "1.25x"), số viết bằng chữ, viết tắt ("70K"), phần trăm. Đây là lưới bắt con
 * số SAI THÔ, không phải bằng chứng mọi con số đều đúng.
 */
function moneyAndPointsIn(raw: string): number[] {
  const text = withoutDates(raw);
  const found: number[] = [];
  for (const m of text.matchAll(new RegExp(`\\$\\s?(${NUMBER})`, "g"))) {
    const value = valueOf(m[1]!);
    if (value !== null) found.push(value);
  }
  for (const m of text.matchAll(new RegExp(`\\b(${NUMBER})\\b`, "g"))) {
    const value = valueOf(m[1]!);
    if (value !== null && value >= 1000) found.push(value);
  }
  return found;
}

const STRICT_NUMBER = new RegExp(`^(?:${NUMBER})$`);

/** "$1,00", "$100,00", "$-500": trông như tiền nhưng không phải con số hợp lệ. */
function malformedMoneyIn(text: string): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(/\$\s?([\d.,-]+)/g)) {
    const token = m[1]!.replace(/[.,]+$/, "");
    if (!STRICT_NUMBER.test(token)) bad.push(`$${m[1]}`);
  }
  return bad;
}
