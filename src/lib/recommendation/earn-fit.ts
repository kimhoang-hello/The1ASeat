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

  /**
   * Điểm kiếm được VÀ chi tiêu đã bỏ ra, gom theo nhóm trần. `null` = không
   * trần.
   *
   * Phải giữ CẢ HAI, và đó là một lỗi ĐƠN VỊ đã có thật ở bản trước: trần
   * `kind: "spend"` đo bằng ĐÔ (BMO® VIPorter® giới hạn $20,000 chi tiêu
   * Porter® mỗi năm), còn trần `kind: "points"` đo bằng ĐIỂM. Bản trước gom
   * mỗi điểm rồi đem trần chi tiêu chia cho tổng điểm — chia đô cho điểm — nên
   * với một tỷ lệ 3x nó bắt đầu cắt ở đúng một phần ba mức thật, và cắt cả
   * những người chưa hề chạm trần.
   */
  const byCap = new Map<
    string | null,
    {
      points: number;
      spend: number;
      multiplier: number;
      rateAfterCap: number | null;
      programId: PointsProgramId;
    }[]
  >();

  // Tỷ lệ nền của chính thẻ này — chỗ mọi hạng mục KHÔNG có dòng riêng rơi về.
  const fallbackRate = baseRateFor(rates, "everything_else");

  for (const [category, annualSpend] of annualByCategory) {
    // Thẻ không có dòng riêng cho hạng mục này thì chi tiêu đó vẫn kiếm được
    // điểm — ở tỷ lệ nền. BỎ nó đi là một lỗi đã có thật: thẻ CHỈ có tỷ lệ nền
    // (RBC Avion® Visa Platinum®, Amex® Green) mất trắng phần chi tiêu người
    // dùng đã khai theo hạng mục, nên hồ sơ $1,200 siêu thị + $2,800 còn lại
    // ra $336/năm thay vì $480 — và mọi mục tiêu đọc `earn_fit` đều lệch theo.
    //
    // `restrictedTo !== null` cũng rơi vào đây: dòng giới hạn không phân tích
    // được (xem chú thích 2 đầu file), và tỷ lệ nền là cận DƯỚI đúng của nó.
    const rate = baseRateFor(rates, category) ?? fallbackRate;
    if (rate === null) continue;
    const key = rate.capId === null ? null : (rate.capId as string);
    const list = byCap.get(key) ?? [];
    list.push({
      points: annualSpend * rate.multiplier,
      spend: annualSpend,
      multiplier: rate.multiplier,
      rateAfterCap: rate.rateAfterCap,
      programId: rate.pointsProgramId,
    });
    byCap.set(key, list);
  }

  let annualValueCents = 0;
  for (const [capId, entries] of byCap) {
    const cap = capId === null ? null : ix.capById.get(capId);
    const rawPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
    const rawSpend = entries.reduce((sum, entry) => sum + entry.spend, 0);

    let scale = 1;
    if (cap !== undefined && cap !== null) {
      const perYear =
        cap.period === "monthly"
          ? cap.amount * 12
          : cap.period === "quarterly"
            ? cap.amount * 4
            : cap.amount;
      // So trần với đại lượng CÙNG ĐƠN VỊ với nó, rồi quy thành một hệ số
      // chung cho cả nhóm.
      if (cap.kind === "points") {
        scale = rawPoints === 0 ? 0 : Math.min(1, perYear / rawPoints);
      } else {
        // Trần theo CHI TIÊU: phần chi vượt trần vẫn kiếm được, chỉ ở tỷ lệ
        // nền. Không mô hình hoá `rateAfterCap` ở đây — nó là dòng riêng của
        // dữ liệu, và cắt thẳng về 0 là ước lượng THIẾU, hướng an toàn.
        scale = rawSpend === 0 ? 0 : Math.min(1, perYear / rawSpend);
      }
    }

    for (const entry of entries) {
      const cpp = centsPerPoint(ix, entry.programId, asOf, mode);
      if (cpp === null) continue;
      // Phần TRONG trần, ở tỷ lệ thưởng.
      let points = entry.points * scale;
      // Phần VƯỢT trần vẫn kiếm được, chỉ ở tỷ lệ nền — và `rateAfterCap` là
      // dòng dữ liệu nói tỷ lệ đó. Cắt thẳng về 0 làm người chi nhiều bị đánh
      // giá thấp hẳn: chi tiêu Amex® Cobalt® vượt trần 5x vẫn ăn 1x, và với
      // một người chi $2,000/tháng thì phần "vẫn ăn 1x" đó không hề nhỏ.
      if (scale < 1 && entry.rateAfterCap !== null) {
        const cappedSpend = entry.spend * scale;
        points += (entry.spend - cappedSpend) * entry.rateAfterCap;
      }
      annualValueCents += points * cpp;
    }
  }

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

/** Hồ sơ chỉ gồm các hạng mục này — để `earnFitFor` áp trần CHUNG trên đúng phần chi đặt lên một thẻ. */
function subProfile(
  spend: UserSpendProfile,
  units: readonly { category: SpendCategory; monthly: number }[],
): UserSpendProfile {
  const byCategory: UserSpendProfile["byCategory"] = {};
  for (const unit of units) byCategory[unit.category] = { low: unit.monthly, high: unit.monthly };
  return { ...spend, monthlyTotal: null, byCategory };
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
 * ăn uống, giao đồ ăn, siêu thị; TD® Cash Back: xăng + sạc, hoá đơn + streaming)
 * chia cho các thẻ có trần chung bằng quy hoạch động trên tập con
 * (`assignAmong`). Nhóm đó quá lớn (> `EXACT_LINKED_LIMIT` hạng mục) thì lui về
 * leo đồi (`bestAllocation`) — gần đúng, đã ghi ở HANDOFF §9.
 *
 * Ba bản trước, cả ba đổi khuyến nghị và đều do vòng Codex bác bắt được: phía ví
 * đo từng hạng mục riêng lẻ (mỗi hạng mục hưởng trọn trần Cobalt® → Gold "thêm
 * $0" thay vì $864); một lượt "thử bỏ từng hạng mục" kẹt ($864 thay vì $1,152);
 * leo đồi theo nước chuyển MỘT hạng mục kẹt ở phân bổ cần đổi chéo hai hạng mục
 * (ví Cobalt® + TD® Cash Back: Scotiabank® Gold thêm $967 thay vì $1,956).
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
   * Trần cỡ nhóm dính trần cho lời giải chính xác. Dữ liệu hôm nay dính tối đa
   * 7 hạng mục (Cobalt® 3 + TD® Cash Back 4), tức đường lui leo đồi chưa với
   * tới được — test hạ trần về 0 để nhánh đó không thành code chưa ai chạy.
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
  const cache = new Map<string, number>();
  /** Giá trị một thẻ trên đúng tập hạng mục (chỉ số trong `units`, đã sắp). */
  const valueOn = (productId: string, indexes: readonly number[]): number => {
    if (indexes.length === 0) return 0;
    const key = `${productId}|${indexes.join(",")}`;
    let value = cache.get(key);
    if (value === undefined) {
      value = earnFitFor(productId, subProfile(spend, indexes.map((index) => units[index])), ix, asOf, mode)
        .annualValueCents;
      cache.set(key, value);
    }
    return value;
  };
  const capKeys = new Map<string, (string | null)[]>();
  const capKeysOf = (productId: string) => {
    let keys = capKeys.get(productId);
    if (keys === undefined) {
      keys = units.map((unit) => capKeyOf(productId, unit.category, ix, asOf));
      capKeys.set(productId, keys);
    }
    return keys;
  };

  /** Hạng mục của thẻ này CÙNG TRẦN với ít nhất một hạng mục khác — `[]` = thẻ cộng thẳng được. */
  const linkedBy = (productId: string): number[] => {
    const byCap = new Map<string, number[]>();
    capKeysOf(productId).forEach((key, index) => {
      if (key !== null) byCap.set(key, [...(byCap.get(key) ?? []), index]);
    });
    return [...byCap.values()].filter((indexes) => indexes.length >= 2).flat();
  };
  const single = (productId: string, index: number) => valueOn(productId, [index]);
  const heldCapped = held.filter((card) => linkedBy(card).length > 0);
  const heldAdditive = held.filter((card) => linkedBy(card).length === 0);
  const linkedHeld = sortedUnique(heldCapped.flatMap(linkedBy));
  // Mọi thẻ đang giữ CỘNG THẲNG được gộp thành một thẻ ảo: trên một hạng mục, nó
  // kiếm bằng thẻ tốt nhất trong số chúng — vì giữa các thẻ đó không có gì ràng buộc.
  const additiveBest = units.map((_, index) => Math.max(0, ...heldAdditive.map((card) => single(card, index))));
  const tables = new Map<string, Float64Array>();
  /** V chính xác của (thẻ có trần chung `capped`) + (thẻ ảo `virtual`) trên mọi hạng mục. */
  const exactTotal = (capped: readonly string[], linked: readonly number[], virtual: (index: number) => number) => {
    const inGroup = new Set(linked);
    let total = 0;
    for (let index = 0; index < units.length; index += 1) {
      if (!inGroup.has(index)) total += Math.max(virtual(index), ...capped.map((card) => single(card, index)));
    }
    const key = `${capped.join(",")}|${linked.join(",")}`;
    let best = tables.get(key);
    if (best === undefined) {
      best = assignAmong(capped, linked, valueOn);
      tables.set(key, best);
    }
    const full = (1 << linked.length) - 1;
    let linkedValue = -Infinity;
    for (let sub = 0; sub <= full; sub += 1) {
      const rest = best[full ^ sub];
      if (rest === -Infinity) continue;
      let value = rest;
      for (let bit = 0; bit < linked.length; bit += 1) if ((sub & (1 << bit)) !== 0) value += virtual(linked[bit]);
      if (value > linkedValue) linkedValue = value;
    }
    return total + linkedValue;
  };
  const walletExact =
    linkedHeld.length > exactLinkedLimit ? null : exactTotal(heldCapped, linkedHeld, (index) => additiveBest[index]);

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
    if (walletExact !== null) {
      const own = linkedBy(productId);
      if (own.length === 0) {
        // Thẻ mới cộng thẳng được: nó nhập vào thẻ ảo, nhóm dính trần không đổi.
        const total = exactTotal(heldCapped, linkedHeld, (index) => Math.max(additiveBest[index], single(productId, index)));
        added.set(productId, Math.max(0, total - walletExact));
        continue;
      }
      const linked = sortedUnique([...linkedHeld, ...own]);
      if (linked.length <= exactLinkedLimit) {
        const total = exactTotal([...heldCapped, productId], linked, (index) => additiveBest[index]);
        added.set(productId, Math.max(0, total - walletExact));
        continue;
      }
    }
    const wallet = heuristicWallet();
    const cards = [...held, productId];
    // Nước đầu tiên của thẻ mới phải hơn phần đóng góp biên của hạng mục đó
    // cho chủ hiện tại — không thì leo đồi dừng ngay (cắt sớm, chính xác so với
    // chính leo đồi).
    if (!units.some((_, index) => valueOn(productId, [index]) > wallet.marginal[index] + EPSILON)) {
      added.set(productId, 0);
      continue;
    }
    const best = bestAllocation(units.length, cards, valueOn, { start: wallet.owner, pivot: productId });
    added.set(productId, Math.max(0, best.total - wallet.total));
  }
  return added;
}

/** Nhóm hạng mục DÍNH trần chung lớn hơn chừng này thì lui về leo đồi: 3^n phép thử cho mỗi thẻ có trần chung. */
const EXACT_LINKED_LIMIT = 7;

/**
 * Trần mà chi tiêu của hạng mục này trên thẻ này rơi vào — ĐÚNG phép chọn tỷ lệ
 * của `earnFitFor` (dòng riêng không giới hạn, không có thì dòng `everything_else`).
 * `null` = không trần.
 */
function capKeyOf(productId: string, category: SpendCategory, ix: DatasetIndex, asOf: string): string | null {
  const rates = activeAt(ix.ratesByProduct.get(productId) ?? [], asOf);
  const rate = baseRateFor(rates, category) ?? baseRateFor(rates, "everything_else");
  return rate?.capId == null ? null : (rate.capId as string);
}

function sortedUnique(indexes: readonly number[]): number[] {
  return [...new Set(indexes)].sort((a, b) => a - b);
}

/**
 * Cách tốt nhất chia nhóm hạng mục DÍNH trần (`linked`) cho các thẻ có trần
 * chung — `best[mask]` = giá trị lớn nhất khi đặt đúng tập `mask` (bit theo thứ
 * tự trong `linked`) lên các thẻ đó, mỗi hạng mục một thẻ. Quy hoạch động theo
 * thẻ trên tập con, 3^n phép thử mỗi thẻ: thử MỌI cách chia, nên không bỏ sót
 * đổi chéo như leo đồi. Hạng mục không dính trần cộng thẳng nên không cần ở đây.
 */
function assignAmong(
  cards: readonly string[],
  linked: readonly number[],
  valueOn: (productId: string, indexes: readonly number[]) => number,
): Float64Array {
  const size = 1 << linked.length;
  let best = new Float64Array(size).fill(-Infinity);
  best[0] = 0;
  for (const card of cards) {
    const own = new Float64Array(size);
    for (let mask = 1; mask < size; mask += 1) {
      own[mask] = valueOn(card, linked.filter((_, bit) => (mask & (1 << bit)) !== 0));
    }
    const next = new Float64Array(size).fill(-Infinity);
    for (let mask = 0; mask < size; mask += 1) {
      for (let sub = mask; ; sub = (sub - 1) & mask) {
        const rest = best[mask ^ sub];
        if (rest > -Infinity && rest + own[sub] > next[mask]) next[mask] = rest + own[sub];
        if (sub === 0) break;
      }
    }
    best = next;
  }
  return best;
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
