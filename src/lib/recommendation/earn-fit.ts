/**
 * Thẻ này kiếm được bao nhiêu MỘT NĂM trên đúng chi tiêu người dùng đã khai.
 *
 * Đây là vế "long-term earn fit" của §10.1 và "earn fit" của §10.3 — thứ phân
 * biệt một thẻ đáng giữ lâu với một thẻ chỉ đáng mở lấy bonus rồi đóng.
 *
 * BỐN CHỖ DỄ SAI — ba chỗ đầu đã ghi trong README của Phase 1, chỗ thứ tư là
 * một lỗi có thật đã chạy suốt từ Phase 1:
 *
 *  1. **Trần dùng chung.** `EarningRate.capId` TRỎ vào một `EarningCap`, và
 *     nhiều dòng tỷ lệ dùng chung một trần. TD® Cash Back có một trần
 *     $450/năm cho bốn hạng mục và một trần $450 khác cho hai hạng mục nữa;
 *     áp trần cho từng dòng riêng thì sáu dòng thành sáu trần độc lập và
 *     engine cấp $2,700 thay vì $900.
 *  2. **`restrictedTo` là chuỗi tự do.** Nó không phân tích được, nên chỉ dùng
 *     dòng KHÔNG giới hạn. Validator của Phase 1 cưỡng chế mỗi hạng mục có
 *     đúng một dòng như vậy, nên phép lọc này không đánh rơi gì.
 *  3. **Chi tiêu chưa phân bổ ≠ 0.** Người khai tổng $2,000 và siêu thị $800
 *     chưa nói gì về mười sáu hạng mục còn lại. Phần dôi ra được tính theo tỷ
 *     lệ `everything_else` — cận DƯỚI của giá trị thật, chứ không phải bỏ đi.
 *  4. **Hạng mục không có dòng riêng cũng rơi về `everything_else`.** Đây là
 *     cùng một luật với chỗ 3, chỉ ở phía bên kia: chỗ 3 nói về hạng mục
 *     người dùng CHƯA khai, chỗ này nói về hạng mục thẻ KHÔNG có tỷ lệ riêng.
 *     Bỏ qua chúng làm thẻ chỉ có tỷ lệ nền (RBC Avion® Visa Platinum®, Amex®
 *     Green) mất trắng phần chi tiêu đã khai theo hạng mục — $336/năm thay vì
 *     $480 trên hồ sơ $1,200 siêu thị + $2,800 còn lại.
 */

import { activeAt } from "./temporal.ts";
import { centsPerPoint } from "./portfolio.ts";
import { statedCategories, unallocatedMonthly } from "./user.ts";
import { typicalAmount } from "./user-types.ts";
import type { DatasetIndex } from "./indexes.ts";
import type {
  EarningRate,
  PointsProgramId,
  RedemptionMode,
  SpendCategory,
} from "./types.ts";
import type { UserSpendProfile } from "./user-types.ts";

export interface EarnFit {
  /** Giá trị tích điểm một năm, tính bằng cent — của RIÊNG thẻ này, như thể mọi
   *  chi tiêu đã khai đều đặt lên nó. Con số để TRÌNH BÀY dữ kiện của thẻ. */
  annualValueCents: number;
  /**
   * Phần thẻ này THÊM VÀO ví đang giữ mỗi năm, tính bằng cent — xem
   * `addedEarnFor`. Con số để CHẤM ĐIỂM (`long_term_earn_fit`, `fee_drag`).
   * Bằng `annualValueCents` khi không giữ thẻ nào: ví trống thì cả phần tích
   * điểm của thẻ đều là phần thêm vào.
   */
  addedValueCents: number;
  /** Người dùng đã khai hạng mục nào chưa — `false` thì con số trên chạy hoàn
   *  toàn trên phần chưa phân bổ, và độ tin cậy phải hạ theo. */
  fromStatedCategories: boolean;
  /** Chương trình thẻ này kiếm ra, đã sắp. */
  programs: PointsProgramId[];
}

/** Tỷ lệ nền của một hạng mục — dòng KHÔNG giới hạn, đang hiệu lực. */
function baseRateFor(
  rates: readonly EarningRate[],
  category: SpendCategory,
): EarningRate | null {
  const candidates = rates.filter(
    (rate) => rate.category === category && rate.restrictedTo === null,
  );
  if (candidates.length === 0) return null;
  // Validator hứa đúng một dòng. Nếu dữ liệu tương lai phá lời hứa đó thì lấy
  // tỷ lệ THẤP nhất — ước lượng thiếu, không phải hứa thừa.
  return candidates.reduce((low, rate) => (rate.multiplier < low.multiplier ? rate : low));
}

/**
 * Một hạng mục chi tiêu đặt lên một thẻ — đủ để tính phần nó kiếm được, kể cả
 * khi nó chung trần với hạng mục khác.
 *
 * Phải giữ CẢ điểm LẪN chi tiêu, và đó là một lỗi ĐƠN VỊ đã có thật ở bản
 * trước: trần `kind: "spend"` đo bằng ĐÔ (BMO® VIPorter® giới hạn $20,000 chi
 * tiêu Porter® mỗi năm), còn trần `kind: "points"` đo bằng ĐIỂM. Bản trước gom
 * mỗi điểm rồi đem trần chi tiêu chia cho tổng điểm — chia đô cho điểm — nên
 * với một tỷ lệ 3x nó bắt đầu cắt ở đúng một phần ba mức thật, và cắt cả những
 * người chưa hề chạm trần.
 */
interface EarnEntry {
  /** Nhóm trần — `null` = không trần. */
  capKey: string | null;
  /** Chi tiêu năm. */
  spend: number;
  /** Điểm năm ở tỷ lệ thưởng, chưa áp trần. */
  points: number;
  rateAfterCap: number | null;
  /** `null` = chương trình chưa định giá ở thước này — kiếm điểm, đóng góp 0. */
  cpp: number | null;
}

function earnEntryFor(
  rates: readonly EarningRate[],
  fallbackRate: EarningRate | null,
  category: SpendCategory,
  annualSpend: number,
  ix: DatasetIndex,
  asOf: string,
  mode: RedemptionMode,
): EarnEntry | null {
  // Thẻ không có dòng riêng cho hạng mục này thì chi tiêu đó vẫn kiếm được
  // điểm — ở tỷ lệ nền. BỎ nó đi là một lỗi đã có thật: thẻ CHỈ có tỷ lệ nền
  // (RBC Avion® Visa Platinum®, Amex® Green) mất trắng phần chi tiêu người
  // dùng đã khai theo hạng mục, nên hồ sơ $1,200 siêu thị + $2,800 còn lại
  // ra $336/năm thay vì $480 — và mọi mục tiêu đọc `earn_fit` đều lệch theo.
  //
  // `restrictedTo !== null` cũng rơi vào đây: dòng giới hạn không phân tích
  // được (xem chú thích 2 đầu file), và tỷ lệ nền là cận DƯỚI đúng của nó.
  const rate = baseRateFor(rates, category) ?? fallbackRate;
  if (rate === null) return null;
  return {
    capKey: rate.capId === null ? null : (rate.capId as string),
    spend: annualSpend,
    points: annualSpend * rate.multiplier,
    rateAfterCap: rate.rateAfterCap,
    cpp: centsPerPoint(ix, rate.pointsProgramId, asOf, mode),
  };
}

/** Phần của một nhóm trần được hưởng tỷ lệ thưởng — so trần với đại lượng CÙNG ĐƠN VỊ với nó. */
function capScale(capKey: string | null, rawPoints: number, rawSpend: number, ix: DatasetIndex): number {
  const cap = capKey === null ? undefined : ix.capById.get(capKey);
  if (cap === undefined) return 1;
  const perYear =
    cap.period === "monthly" ? cap.amount * 12 : cap.period === "quarterly" ? cap.amount * 4 : cap.amount;
  if (cap.kind === "points") return rawPoints === 0 ? 0 : Math.min(1, perYear / rawPoints);
  // Trần theo CHI TIÊU: phần chi vượt trần vẫn kiếm được, chỉ ở tỷ lệ nền —
  // xem `entryValue`.
  return rawSpend === 0 ? 0 : Math.min(1, perYear / rawSpend);
}

/** Cent một hạng mục kiếm được khi nhóm trần của nó hưởng tỷ lệ thưởng trên phần `scale`. */
function entryValue(entry: EarnEntry, scale: number): number {
  if (entry.cpp === null) return 0;
  // Phần TRONG trần, ở tỷ lệ thưởng.
  let points = entry.points * scale;
  // Phần VƯỢT trần vẫn kiếm được, chỉ ở tỷ lệ nền — và `rateAfterCap` là dòng
  // dữ liệu nói tỷ lệ đó. Cắt thẳng về 0 làm người chi nhiều bị đánh giá thấp
  // hẳn: chi tiêu Amex® Cobalt® vượt trần 5x vẫn ăn 1x, và với một người chi
  // $2,000/tháng thì phần "vẫn ăn 1x" đó không hề nhỏ. Không có `rateAfterCap`
  // thì cắt về 0 — ước lượng THIẾU, hướng an toàn.
  if (scale < 1 && entry.rateAfterCap !== null) {
    const cappedSpend = entry.spend * scale;
    points += (entry.spend - cappedSpend) * entry.rateAfterCap;
  }
  return points * entry.cpp;
}

/**
 * Cent một năm của một tập hạng mục trên CÙNG một thẻ. Trần áp theo NHÓM
 * (`capKey`), sau khi cộng hết các hạng mục dùng chung trần đó — xem chú thích
 * đầu file.
 */
function valueOfEntries(entries: readonly EarnEntry[], ix: DatasetIndex): number {
  const byCap = new Map<string | null, EarnEntry[]>();
  for (const entry of entries) {
    const group = byCap.get(entry.capKey);
    if (group === undefined) byCap.set(entry.capKey, [entry]);
    else group.push(entry);
  }
  let total = 0;
  for (const [capKey, group] of byCap) {
    const rawPoints = group.reduce((sum, entry) => sum + entry.points, 0);
    const rawSpend = group.reduce((sum, entry) => sum + entry.spend, 0);
    const scale = capScale(capKey, rawPoints, rawSpend, ix);
    for (const entry of group) total += entryValue(entry, scale);
  }
  return total;
}

/**
 * Giá trị tích điểm một năm.
 *
 * Trần được áp theo NHÓM (`capId`), sau khi cộng hết các hạng mục dùng chung
 * trần đó — xem chú thích đầu file.
 */
export function earnFitFor(
  productId: string,
  spend: UserSpendProfile | null,
  ix: DatasetIndex,
  asOf: string,
  /**
   * Quy điểm tích được ra tiền theo KIỂU ĐỔI nào — xem `RedemptionMode`.
   *
   * `"cash"` làm mọi đồng điểm không rút ra tiền được đóng góp 0, và đó là
   * đúng: với mục tiêu "quy điểm ra tiền", 5x Membership Rewards® trên tiền ăn
   * uống không phải là $X mỗi năm cho tới khi biết rút ra được bao nhiêu.
   */
  mode: RedemptionMode = "best",
): EarnFit {
  const rates = activeAt(ix.ratesByProduct.get(productId) ?? [], asOf);
  const programs = [...new Set(rates.map((rate) => rate.pointsProgramId))].sort() as PointsProgramId[];

  if (spend === null || rates.length === 0) {
    return { annualValueCents: 0, addedValueCents: 0, fromStatedCategories: false, programs };
  }

  /** Chi tiêu năm theo từng hạng mục người dùng đã khai. */
  const annualByCategory = new Map<SpendCategory, number>();
  for (const category of statedCategories(spend)) {
    const amount = spend.byCategory[category];
    if (amount == null) continue;
    annualByCategory.set(category, typicalAmount(amount) * 12);
  }

  // Phần chưa phân bổ đi vào `everything_else`. Không cộng dồn nếu người dùng
  // đã khai `everything_else` riêng — `unallocatedMonthly` đã trừ nó ra rồi.
  const unallocated = unallocatedMonthly(spend);
  if (unallocated !== null) {
    const extra = typicalAmount(unallocated) * 12;
    if (extra > 0) {
      annualByCategory.set(
        "everything_else",
        (annualByCategory.get("everything_else") ?? 0) + extra,
      );
    }
  }

  // Tỷ lệ nền của chính thẻ này — chỗ mọi hạng mục KHÔNG có dòng riêng rơi về.
  const fallbackRate = baseRateFor(rates, "everything_else");

  const entries: EarnEntry[] = [];
  for (const [category, annualSpend] of annualByCategory) {
    const entry = earnEntryFor(rates, fallbackRate, category, annualSpend, ix, asOf, mode);
    if (entry !== null) entries.push(entry);
  }
  const annualValueCents = valueOfEntries(entries, ix);

  return {
    annualValueCents,
    addedValueCents: annualValueCents,
    fromStatedCategories: statedCategories(spend).length > 0,
    programs,
  };
}

/** Một hạng mục chi tiêu của hồ sơ, theo tháng, đã gộp phần chưa phân bổ vào `everything_else` — đúng như `earnFitFor` đọc. */
function spendUnits(spend: UserSpendProfile): { category: SpendCategory; monthly: number }[] {
  const units = new Map<SpendCategory, number>();
  for (const category of statedCategories(spend)) {
    const amount = spend.byCategory[category];
    if (amount != null) units.set(category, typicalAmount(amount));
  }
  const unallocated = unallocatedMonthly(spend);
  if (unallocated !== null) {
    const extra = typicalAmount(unallocated);
    if (extra > 0) units.set("everything_else", (units.get("everything_else") ?? 0) + extra);
  }
  return [...units]
    .filter(([, monthly]) => monthly > 0)
    .map(([category, monthly]) => ({ category, monthly }))
    .sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
}

/**
 * Một thẻ trên đúng các hạng mục của hồ sơ — dựng MỘT lần cho mỗi thẻ trong một
 * lượt `addedEarnFor`, rồi đọc giá trị của bất kỳ tập hạng mục nào mà không gọi
 * lại `earnFitFor`. Cùng phép chọn tỷ lệ, cùng phép áp trần (`earnEntryFor`,
 * `valueOfEntries`), nên `valueOn` của nó ra ĐÚNG con số `earnFitFor` ra trên
 * hồ sơ con chỉ gồm các hạng mục đó.
 */
interface CardOnUnits {
  /** Theo chỉ số trong `units`; `null` = thẻ không kiếm gì ở hạng mục đó. */
  entries: (EarnEntry | null)[];
  /** Giá trị từng hạng mục khi nó đứng MỘT MÌNH trên thẻ. */
  single: number[];
  /** Hạng mục CÙNG TRẦN với ít nhất một hạng mục khác của hồ sơ, đã sắp — `[]` = thẻ cộng thẳng được. */
  linked: number[];
}

function cardOnUnits(
  productId: string,
  units: readonly { category: SpendCategory; monthly: number }[],
  ix: DatasetIndex,
  asOf: string,
  mode: RedemptionMode,
): CardOnUnits {
  const rates = activeAt(ix.ratesByProduct.get(productId) ?? [], asOf);
  const fallbackRate = baseRateFor(rates, "everything_else");
  // Tháng × 12: đúng phép `earnFitFor` làm trên hồ sơ con `{ low: m, high: m }`.
  const entries = units.map((unit) =>
    earnEntryFor(rates, fallbackRate, unit.category, unit.monthly * 12, ix, asOf, mode),
  );
  const members = new Map<string, number[]>();
  entries.forEach((entry, index) => {
    if (entry?.capKey == null) return;
    const list = members.get(entry.capKey);
    if (list === undefined) members.set(entry.capKey, [index]);
    else list.push(index);
  });
  return {
    entries,
    single: entries.map((entry) => (entry === null ? 0 : valueOfEntries([entry], ix))),
    linked: sortedUnique([...members.values()].filter((indexes) => indexes.length >= 2).flat()),
  };
}

/**
 * Giá trị của thẻ trên MỌI tập con của `indexes`: `table[mask]` = giá trị khi
 * thẻ nhận đúng các hạng mục `indexes[bit]` có bit trong `mask` — cùng con số
 * `valueOfEntries` ra, chỉ khác thứ tự cộng.
 *
 * Dựng cả 2^n ô trong O(2^n × số nhóm trần + n × 2^k cho mỗi nhóm k hạng mục),
 * không phải 2^n lượt `earnFitFor`:
 * giá trị một thẻ TÁCH được theo nhóm trần — hạng mục không chung trần với ai
 * cộng thẳng, mỗi nhóm trần chỉ phụ thuộc phần của nó trong `mask`. Bản trước gọi
 * `earnFitFor` cho từng ô của từng thẻ ứng viên, và đó là ~95% thời gian của một
 * lượt chạy khi nhóm dính trần lên 10 hạng mục (đo 16/10/2026).
 */
function subsetTable(card: CardOnUnits, indexes: readonly number[], ix: DatasetIndex): Float64Array {
  const size = 1 << indexes.length;
  const table = new Float64Array(size);
  const linked = new Set(card.linked);
  const groupBits = new Map<string, number>();
  const solo = indexes.map((index, bit) => {
    const entry = card.entries[index];
    if (entry === null) return 0;
    if (entry.capKey !== null && linked.has(index)) {
      groupBits.set(entry.capKey, (groupBits.get(entry.capKey) ?? 0) | (1 << bit));
      return 0;
    }
    return card.single[index];
  });
  for (let mask = 1; mask < size; mask += 1) {
    const low = mask & -mask;
    table[mask] = table[mask ^ low] + solo[31 - Math.clz32(low)];
  }
  for (const [capKey, bits] of groupBits) {
    const part = new Float64Array(size);
    for (let sub = bits; sub > 0; sub = (sub - 1) & bits) {
      const group: EarnEntry[] = [];
      for (let bit = 0; bit < indexes.length; bit += 1) {
        if ((sub & (1 << bit)) !== 0) group.push(card.entries[indexes[bit]]!);
      }
      const scale = capScale(
        capKey,
        group.reduce((sum, entry) => sum + entry.points, 0),
        group.reduce((sum, entry) => sum + entry.spend, 0),
        ix,
      );
      part[sub] = group.reduce((sum, entry) => sum + entryValue(entry, scale), 0);
    }
    for (let mask = 1; mask < size; mask += 1) table[mask] += part[mask & bits];
  }
  return table;
}

/**
 * Phần tích điểm mỗi thẻ ứng viên THÊM VÀO ví đang giữ, mỗi năm (cent).
 *
 * Vì sao cần: `annualValueCents` là của riêng thẻ, như thể ví trống. Người giữ
 * Amex® Cobalt® + Platinum được chấm trọn tỷ lệ tích điểm của Amex® Gold dù ví
 * đã kiếm bằng hoặc hơn ở mọi hạng mục đã khai — và engine khuyên mở lại Gold
 * (không bonus, phí $250) trên "chưa mở thẻ nào" (vòng Codex 09/10/2026; tác giả
 * chốt cùng ngày chuyển sang phần tăng thêm).
 *
 * Phần thêm = V(ví + thẻ mới) − V(ví). V của một tập thẻ = cách tốt nhất đặt
 * TRỌN từng hạng mục chi tiêu lên một thẻ, mỗi thẻ đo bằng `earnFitFor` trên đúng
 * tập nó nhận — tức trần CHUNG áp đúng ở cả hai phía.
 *
 * V tính CHÍNH XÁC: hạng mục không cùng trần chung với hạng mục nào khác trên
 * bất kỳ thẻ nào trong tập thì giá trị của nó cộng thẳng — đặt lên thẻ tốt nhất
 * cho riêng nó; mọi thẻ không có trần chung gộp thành một thẻ ảo (mỗi hạng mục
 * lấy thẻ tốt nhất trong số chúng); chỉ nhóm hạng mục DÍNH trần chung (Cobalt®:
 * ăn uống, giao đồ ăn, siêu thị; TD® Cash Back: xăng + sạc, hoá đơn + streaming;
 * Scotiabank® Gold: tám hạng mục chung một trần) chia cho các thẻ có trần chung
 * bằng quy hoạch động trên tập con (`assignAmong`). Nhóm đó quá lớn
 * (> `EXACT_LINKED_LIMIT` hạng mục) thì lui về leo đồi (`bestAllocation`) — gần
 * đúng, đã ghi ở HANDOFF §9.
 *
 * Phía ví KHÔNG đổi theo ứng viên, nên bảng của nó dựng một lần cho cả tập:
 * `walletTable[mask]` = cách tốt nhất ví nhận đúng tập `mask` của nhóm dính trần.
 * Mỗi ứng viên chỉ còn dựng bảng của CHÍNH nó (`subsetTable`) rồi thử mọi tập nó
 * có thể nhận — 2^n phép cộng, không phải 3^n cho mỗi thẻ của ví như bản trước.
 *
 * Bốn bản trước, cả bốn đổi con số và đều do phép vét cạn bắt được: phía ví đo
 * từng hạng mục riêng lẻ (mỗi hạng mục hưởng trọn trần Cobalt® → Gold "thêm $0"
 * thay vì $864); một lượt "thử bỏ từng hạng mục" kẹt ($864 thay vì $1,152); leo
 * đồi theo nước chuyển MỘT hạng mục kẹt ở phân bổ cần đổi chéo hai hạng mục (ví
 * Cobalt® + TD® Cash Back: Scotiabank® Gold thêm $967 thay vì $1,956); và thẻ ảo
 * nhận hạng mục với giá $0 cả khi ví KHÔNG có thẻ cộng thẳng nào — tức cho phép
 * bỏ một hạng mục "không đặt lên đâu" khi nó làm loãng trần chi tiêu (ví chỉ
 * Scotiabank® Gold, $4,500 siêu thị + $800 streaming một tháng: Amex® Green thêm
 * $172.80 thay vì $227.74, sửa 16/10/2026).
 *
 * Giới hạn: không tách MỘT hạng mục cho hai thẻ (phần vượt trần của siêu thị
 * không sang được thẻ khác); thẻ doanh nghiệp đang giữ tính như mọi thẻ.
 *
 * Không giữ thẻ nào (kể cả CHƯA KHAI thẻ — ví không biết thì không trừ được
 * gì) hoặc chưa khai chi tiêu → phần thêm bằng `annualValueCents`, y như trước.
 */
export function addedEarnFor(
  candidateIds: readonly string[],
  heldIds: readonly string[],
  spend: UserSpendProfile | null,
  ix: DatasetIndex,
  asOf: string,
  mode: RedemptionMode = "best",
  /**
   * Trần cỡ nhóm dính trần cho lời giải chính xác — test hạ trần về 0 để nhánh
   * leo đồi không thành code chưa ai chạy. Xem `EXACT_LINKED_LIMIT`.
   */
  exactLinkedLimit: number = EXACT_LINKED_LIMIT,
): Map<string, number> {
  const added = new Map<string, number>();
  const held = [...new Set(heldIds)].sort();
  if (spend === null || held.length === 0) {
    for (const productId of candidateIds) {
      added.set(productId, earnFitFor(productId, spend, ix, asOf, mode).annualValueCents);
    }
    return added;
  }
  const units = spendUnits(spend);
  const cards = new Map<string, CardOnUnits>();
  const cardOf = (productId: string) => {
    let card = cards.get(productId);
    if (card === undefined) {
      card = cardOnUnits(productId, units, ix, asOf, mode);
      cards.set(productId, card);
    }
    return card;
  };
  const cache = new Map<string, number>();
  /** Giá trị một thẻ trên đúng tập hạng mục (chỉ số trong `units`, đã sắp) — cho đường lui leo đồi. */
  const valueOn = (productId: string, indexes: readonly number[]): number => {
    if (indexes.length === 0) return 0;
    const key = `${productId}|${indexes.join(",")}`;
    let value = cache.get(key);
    if (value === undefined) {
      const card = cardOf(productId);
      value = valueOfEntries(
        indexes.flatMap((index) => card.entries[index] ?? []),
        ix,
      );
      cache.set(key, value);
    }
    return value;
  };

  const heldCapped = held.filter((card) => cardOf(card).linked.length > 0);
  const heldAdditive = held.filter((card) => cardOf(card).linked.length === 0);
  const linkedHeld = sortedUnique(heldCapped.flatMap((card) => cardOf(card).linked));
  // Mọi thẻ đang giữ CỘNG THẲNG được gộp thành một thẻ ảo: trên một hạng mục, nó
  // kiếm bằng thẻ tốt nhất trong số chúng — vì giữa các thẻ đó không có gì ràng
  // buộc. Ví không có thẻ cộng thẳng nào thì KHÔNG có thẻ ảo (−∞): mỗi hạng mục
  // vẫn phải nằm trên một thẻ thật, kể cả khi nó làm loãng trần của thẻ đó.
  const additiveBest = units.map((_, index) =>
    Math.max(-Infinity, ...heldAdditive.map((card) => cardOf(card).single[index])),
  );
  /** Ví kiếm bao nhiêu ở một hạng mục KHÔNG dính trần chung trên thẻ nào của ví — thẻ tốt nhất cho riêng nó. */
  const heldBest = units.map((_, index) =>
    Math.max(additiveBest[index], ...heldCapped.map((card) => cardOf(card).single[index])),
  );

  /** Cách tốt nhất các thẻ có trần chung của ví nhận đúng tập `mask` của `linkedHeld` (chưa có thẻ ảo). */
  const heldTable =
    linkedHeld.length > exactLinkedLimit
      ? null
      : assignAmong(heldCapped.map((card) => subsetTable(cardOf(card), linkedHeld, ix)), linkedHeld.length);
  /** Như trên, cộng thẻ ảo. */
  const walletTable =
    heldTable === null ? null : withAdditive(heldTable, linkedHeld.map((index) => additiveBest[index]));
  const heldFull = (1 << linkedHeld.length) - 1;

  // Đường lui gần đúng chỉ dựng khi cần — xem `EXACT_LINKED_LIMIT`.
  let heuristic: { owner: string[]; total: number; marginal: number[] } | null = null;
  const heuristicWallet = () => {
    if (heuristic === null) {
      const wallet = bestAllocation(units.length, held, valueOn, null);
      const setOf = (card: string) => wallet.owner.flatMap((who, index) => (who === card ? [index] : []));
      heuristic = {
        ...wallet,
        marginal: wallet.owner.map((who, index) => {
          const set = setOf(who);
          return valueOn(who, set) - valueOn(who, set.filter((other) => other !== index));
        }),
      };
    }
    return heuristic;
  };

  for (const productId of candidateIds) {
    const card = cardOf(productId);
    const linked = sortedUnique([...linkedHeld, ...card.linked]);
    if (heldTable !== null && walletTable !== null && linked.length <= exactLinkedLimit) {
      // Phần thêm = phần thêm NGOÀI nhóm dính trần (từng hạng mục độc lập: thẻ
      // mới chỉ thêm phần nó hơn ví) + phần thêm TRONG nhóm. Cộng phần thêm thay
      // vì trừ hai tổng để "không thêm gì" ra đúng 0, không phải 1e-12.
      const inGroup = new Set(linked);
      let gain = 0;
      units.forEach((_, index) => {
        if (!inGroup.has(index)) gain += Math.max(0, card.single[index] - heldBest[index]);
      });
      if (card.linked.length === 0) {
        // Thẻ mới cộng thẳng được: nó nhập vào thẻ ảo, nhóm dính trần không đổi.
        const boosted = linkedHeld.map((index) => Math.max(additiveBest[index], card.single[index]));
        if (boosted.some((value, bit) => value > additiveBest[linkedHeld[bit]])) {
          gain += Math.max(0, withAdditive(heldTable, boosted)[heldFull] - walletTable[heldFull]);
        }
      } else {
        gain += linkedGain(walletTable, linkedHeld, linked, heldBest, subsetTable(card, linked, ix));
      }
      added.set(productId, gain);
      continue;
    }
    const wallet = heuristicWallet();
    const cardsWith = [...held, productId];
    // Nước đầu tiên của thẻ mới phải hơn phần đóng góp biên của hạng mục đó
    // cho chủ hiện tại — không thì leo đồi dừng ngay (cắt sớm, chính xác so với
    // chính leo đồi).
    if (!units.some((_, index) => valueOn(productId, [index]) > wallet.marginal[index] + EPSILON)) {
      added.set(productId, 0);
      continue;
    }
    const best = bestAllocation(units.length, cardsWith, valueOn, { start: wallet.owner, pivot: productId });
    added.set(productId, Math.max(0, best.total - wallet.total));
  }
  return added;
}

/**
 * Nhóm hạng mục DÍNH trần chung lớn hơn chừng này thì lui về leo đồi.
 *
 * Vì sao là 10: dữ liệu hôm nay dính tối đa 10 hạng mục — tám hạng mục chung
 * trần của Scotiabank® Gold (từ 16/10/2026) cộng sạc xe và hoá đơn định kỳ của
 * TD® Cash Back — nên MỌI hồ sơ chạy lời giải chính xác. Chi phí lớn nhất là
 * quy hoạch động phía ví, 3^n mỗi thẻ có trần chung đang giữ, dựng một lần mỗi
 * lượt; đo 16/10/2026 trên hồ sơ 11 hạng mục giữ Cobalt®, Scotiabank® Gold, TD®
 * Cash Back: lượt gợi ý đầy đủ (cả §30) 89 ms ở trần 7 (leo đồi) → 2.2 s ở trần
 * 10 với bản trước → xem commit nâng trần cho số đo bản này. Leo đồi lệch thật
 * (hồ sơ 10 hạng mục giữ Gold: phần thêm của RBC® Avion® $328 thay vì $451).
 */
export const EXACT_LINKED_LIMIT = 10;

function sortedUnique(indexes: readonly number[]): number[] {
  return [...new Set(indexes)].sort((a, b) => a - b);
}

/**
 * Cách tốt nhất chia nhóm hạng mục DÍNH trần cho các thẻ có trần chung —
 * `best[mask]` = giá trị lớn nhất khi đặt đúng tập `mask` lên các thẻ đó, mỗi
 * hạng mục một thẻ. `tables[i]` là `subsetTable` của thẻ thứ i trên CÙNG nhóm.
 * Quy hoạch động theo thẻ trên tập con, 3^n phép thử mỗi thẻ sau thẻ đầu: thử
 * MỌI cách chia, nên không bỏ sót đổi chéo như leo đồi.
 */
function assignAmong(tables: readonly Float64Array[], bits: number): Float64Array {
  const size = 1 << bits;
  if (tables.length === 0) {
    const none = new Float64Array(size).fill(-Infinity);
    none[0] = 0;
    return none;
  }
  let best = tables[0];
  for (const own of tables.slice(1)) {
    const next = new Float64Array(size).fill(-Infinity);
    for (let mask = 0; mask < size; mask += 1) {
      let top = -Infinity;
      for (let sub = mask; ; sub = (sub - 1) & mask) {
        const value = best[mask ^ sub] + own[sub];
        if (value > top) top = value;
        if (sub === 0) break;
      }
      next[mask] = top;
    }
    best = next;
  }
  return best;
}

/**
 * Thêm thẻ ảo (cộng thẳng) vào bảng: `out[mask]` = tốt nhất khi mỗi hạng mục của
 * `mask` hoặc theo `table`, hoặc sang thẻ ảo với giá `values[bit]`. −∞ = không
 * có thẻ ảo cho hạng mục đó. n × 2^n phép thử.
 */
function withAdditive(table: Float64Array, values: readonly number[]): Float64Array {
  if (values.every((value) => value === -Infinity)) return table;
  const out = table.slice();
  values.forEach((value, bit) => {
    if (value === -Infinity) return;
    const flag = 1 << bit;
    for (let mask = flag; mask < out.length; mask += 1) {
      if ((mask & flag) === 0) continue;
      const moved = out[mask ^ flag] + value;
      if (moved > out[mask]) out[mask] = moved;
    }
  });
  return out;
}

/**
 * Phần một thẻ có trần chung THÊM VÀO ví trên nhóm dính trần `linked` (⊇
 * `linkedHeld`): thử mọi tập nó nhận, phần còn lại ví nhận theo cách tốt nhất.
 * Hạng mục chỉ dính trần trên thẻ MỚI thì phía ví độc lập — `heldBest`.
 */
function linkedGain(
  walletTable: Float64Array,
  linkedHeld: readonly number[],
  linked: readonly number[],
  heldBest: readonly number[],
  own: Float64Array,
): number {
  const size = 1 << linked.length;
  let wallet = walletTable;
  if (linked.length !== linkedHeld.length) {
    wallet = new Float64Array(size);
    const project = new Int32Array(size);
    const extra = new Float64Array(size);
    const heldBit = linked.map((index) => {
      const position = linkedHeld.indexOf(index);
      return position < 0 ? 0 : 1 << position;
    });
    for (let mask = 1; mask < size; mask += 1) {
      const low = mask & -mask;
      const bit = 31 - Math.clz32(low);
      project[mask] = project[mask ^ low] | heldBit[bit];
      extra[mask] = extra[mask ^ low] + (heldBit[bit] === 0 ? heldBest[linked[bit]] : 0);
      wallet[mask] = walletTable[project[mask]] + extra[mask];
    }
    wallet[0] = walletTable[0];
  }
  const full = size - 1;
  let best = wallet[full];
  for (let sub = 1; sub < size; sub += 1) {
    const value = wallet[full ^ sub] + own[sub];
    if (value > best) best = value;
  }
  return best - wallet[full];
}

const EPSILON = 1e-6;

/**
 * ĐƯỜNG LUI gần đúng của lời giải chính xác khi nhóm dính trần quá lớn: phân bổ trọn
 * từng hạng mục cho một thẻ trong `cards`, leo đồi theo nước chuyển MỘT hạng mục
 * tăng tổng nhiều nhất. Kẹt được ở phân bổ cần đổi chéo hai hạng mục. `pivot`
 * giới hạn nước đi vào/ra khỏi đúng thẻ đó (thẻ mới), xuất phát từ `start`.
 */
function bestAllocation(
  unitCount: number,
  cards: readonly string[],
  valueOn: (productId: string, indexes: readonly number[]) => number,
  from: { start: readonly string[]; pivot: string } | null,
): { owner: string[]; total: number } {
  const owner: string[] =
    from?.start.slice() ??
    Array.from({ length: unitCount }, (_, index) => {
      let bestCard = cards[0];
      for (const card of cards) if (valueOn(card, [index]) > valueOn(bestCard, [index]) + EPSILON) bestCard = card;
      return bestCard;
    });
  const setOf = (card: string) => owner.flatMap((who, index) => (who === card ? [index] : []));
  const totalOf = () => cards.reduce((sum, card) => sum + valueOn(card, setOf(card)), 0);
  let total = totalOf();
  // Mỗi nước tăng tổng một lượng dương nên không lặp; trần số bước chỉ để chắc chắn.
  for (let step = 0; step < unitCount * cards.length + 1; step += 1) {
    let bestDelta = EPSILON;
    let move: { index: number; to: string } | null = null;
    for (let index = 0; index < unitCount; index += 1) {
      const current = owner[index];
      for (const to of cards) {
        if (to === current) continue;
        if (from !== null && to !== from.pivot && current !== from.pivot) continue;
        const fromSet = setOf(current);
        const toSet = setOf(to);
        const delta =
          valueOn(current, fromSet.filter((other) => other !== index)) +
          valueOn(to, [...toSet, index].sort((a, b) => a - b)) -
          valueOn(current, fromSet) -
          valueOn(to, toSet);
        if (delta > bestDelta) {
          bestDelta = delta;
          move = { index, to };
        }
      }
    }
    if (move === null) break;
    owner[move.index] = move.to;
    total = totalOf();
  }
  return { owner, total };
}
