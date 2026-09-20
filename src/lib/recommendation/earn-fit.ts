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
    fromStatedCategories: statedCategories(spend).length > 0,
    programs,
  };
}
