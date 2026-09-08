/**
 * Thẻ này kiếm được bao nhiêu MỘT NĂM trên đúng chi tiêu người dùng đã khai.
 *
 * Đây là vế "long-term earn fit" của §10.1 và "earn fit" của §10.3 — thứ phân
 * biệt một thẻ đáng giữ lâu với một thẻ chỉ đáng mở lấy bonus rồi đóng.
 *
 * BA CHỖ DỄ SAI, cả ba đã ghi trong README của Phase 1:
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
 */

import { activeAt } from "./temporal.ts";
import { centsPerPoint } from "./portfolio.ts";
import { statedCategories, unallocatedMonthly } from "./user.ts";
import { typicalAmount } from "./user-types.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { EarningRate, PointsProgramId, SpendCategory } from "./types.ts";
import type { UserSpendProfile } from "./user-types.ts";

export interface EarnFit {
  /** Giá trị tích điểm một năm, tính bằng cent. */
  annualValueCents: number;
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
): EarnFit {
  const rates = activeAt(ix.ratesByProduct.get(productId) ?? [], asOf);
  const programs = [...new Set(rates.map((rate) => rate.pointsProgramId))].sort() as PointsProgramId[];

  if (spend === null || rates.length === 0) {
    return { annualValueCents: 0, fromStatedCategories: false, programs };
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

  /** Điểm (hoặc đô cashback) kiếm được, gom theo nhóm trần. `null` = không trần. */
  const byCap = new Map<string | null, { points: number; programId: PointsProgramId }[]>();

  for (const [category, annualSpend] of annualByCategory) {
    const rate = baseRateFor(rates, category);
    if (rate === null) continue;
    const key = rate.capId === null ? null : (rate.capId as string);
    const list = byCap.get(key) ?? [];
    list.push({ points: annualSpend * rate.multiplier, programId: rate.pointsProgramId });
    byCap.set(key, list);
  }

  let annualValueCents = 0;
  for (const [capId, entries] of byCap) {
    const cap = capId === null ? null : ix.capById.get(capId);
    const rawTotal = entries.reduce((sum, entry) => sum + entry.points, 0);

    let allowed = rawTotal;
    if (cap !== undefined && cap !== null) {
      const perYear =
        cap.period === "monthly" ? cap.amount * 12 : cap.period === "quarterly" ? cap.amount * 4 : cap.amount;
      if (cap.kind === "points") {
        allowed = Math.min(rawTotal, perYear);
      } else {
        // Trần theo CHI TIÊU: cắt chi tiêu chứ không cắt điểm, nên phần vượt
        // vẫn kiếm được ở tỷ lệ nền. Không mô hình hoá `rateAfterCap` ở đây —
        // nó là dòng riêng của dữ liệu, và cắt thẳng về 0 là ước lượng thiếu,
        // hướng an toàn.
        const cappedShare = rawTotal === 0 ? 0 : Math.min(1, perYear / (rawTotal || 1));
        allowed = rawTotal * cappedShare;
      }
    }

    const scale = rawTotal === 0 ? 0 : allowed / rawTotal;
    for (const entry of entries) {
      const cpp = centsPerPoint(ix, entry.programId, asOf);
      if (cpp === null) continue;
      annualValueCents += entry.points * scale * cpp;
    }
  }

  return {
    annualValueCents,
    fromStatedCategories: statedCategories(spend).length > 0,
    programs,
  };
}
