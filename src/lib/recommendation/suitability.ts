/**
 * §14 — vế PHÙ HỢP: thẻ này có hợp lý với người này không.
 *
 * Khác `eligibility.ts` ở chỗ ai là người từ chối. Đủ điều kiện là câu về ngân
 * hàng; phù hợp là câu về người dùng. Và hệ quả của phân biệt đó là một quy
 * tắc cụ thể: **không phù hợp thì PHẠT ĐIỂM, không LOẠI** — trừ đúng một
 * trường hợp, khi người dùng đã nói thẳng là không muốn xét loại thẻ đó.
 *
 * Ba thứ được đo ở đây:
 *
 *  1. **Phí thường niên** — so với phí THỰC TRẢ NĂM ĐẦU, không phải phí niêm
 *     yết. Thẻ $699 miễn năm đầu không phải thứ nên giấu khỏi người đặt ngưỡng
 *     $200. Nhưng năm thứ hai thì phí tới thật, nên nó là một CẢNH BÁO chứ
 *     không phải một điều im lặng.
 *  2. **Mốc chi** (§13) — KHÔNG phải pass/fail. Thẻ đòi $10,000 với người dồn
 *     được $6,000 vẫn là ứng viên, chỉ bị phạt nặng kèm cảnh báo.
 *  3. **Hạng trong họ thẻ** — người đang giữ hạng Infinite được khuyên hạng
 *     Platinum của cùng họ là một khuyến nghị đi lùi.
 */

import { compareToThreshold } from "./user.ts";
import { typicalAmount } from "./user-types.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { Product } from "./types.ts";
import type { EstimatedAmount, UserState } from "./user-types.ts";
import type { OfferFacts } from "./offer-quality.ts";
import type { SuitabilityVerdict } from "./engine-types.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";

/**
 * §13 — mốc chi thành một con số 0..1, không thành một cánh cửa.
 *
 * Neo vào chính hai ví dụ spec đưa ra, để đường cong không phải là ý thích của
 * ai:
 *
 *   cần $3,000 / dồn được $9,000  (tỷ lệ 0.33) → 1.00
 *   cần $6,000 / dồn được $7,000  (tỷ lệ 0.86) → 0.75
 *
 * Nối tuyến tính giữa hai mốc đó, giữ 1.0 ở dưới, rồi tụt nhanh về 0 khi tỷ lệ
 * vượt 1 và chạm 0 ở gấp đôi sức dồn. Trên 1 là vùng §13 gọi là "strong
 * penalty" — thẻ còn trong bảng, nhưng phải rất nổi trội ở chỗ khác mới thắng.
 */
export function minimumSpendFit(required: number, capacity: number): number {
  if (capacity <= 0) return 0;
  const ratio = required / capacity;
  if (ratio <= 1 / 3) return 1;
  const slope = (1 - 0.75) / (6 / 7 - 1 / 3);
  if (ratio <= 1) return Math.max(0, 1 - slope * (ratio - 1 / 3));
  const atOne = Math.max(0, 1 - slope * (1 - 1 / 3));
  return Math.max(0, atOne * (2 - ratio));
}

export interface SuitabilityInput {
  product: Product;
  state: UserState;
  facts: OfferFacts;
  capacity: EstimatedAmount | null;
  ix: DatasetIndex;
  asOf: string;
  /** Sản phẩm người dùng đang giữ — dùng cho phép so hạng trong họ thẻ. */
  heldProducts: readonly Product[];
}

export function evaluateSuitability(input: SuitabilityInput): SuitabilityVerdict {
  const { product, state, facts, capacity, heldProducts } = input;
  const reasonCodes: ReasonCode[] = [];
  const warnings: WarningCode[] = [];
  let penalty = 1;

  /* ---- Thẻ doanh nghiệp: LỌC, không phạt ------------------------- */
  // Đây là ngoại lệ duy nhất của "phạt chứ không loại", và nó không phải một
  // phép đo — nó là một câu trả lời. Người đã nói "không xét thẻ doanh nghiệp"
  // mà vẫn thấy thẻ doanh nghiệp đứng đầu bảng thì công cụ hỏng, dù điểm số
  // của nó có đúng đến đâu. `null` (chưa hỏi) thì KHÔNG lọc — nó thành một câu
  // hỏi của §30 nếu thẻ đó còn là ứng viên.
  if (product.personalOrBusiness === "business" && state.profile?.businessCardsAllowed === false) {
    return {
      excluded: true,
      excludedReason: "business_cards_declined",
      penalty: 0,
      minSpendFit: null,
      firstYearFee: facts.firstYearFeeCents / 100,
      ongoingFee: facts.ongoingFeeCents / 100,
      reasonCodes,
      warnings,
    };
  }

  /* ---- Phí thường niên ------------------------------------------- */
  const tolerance = state.profile?.annualFeeTolerancePerCard ?? null;
  const firstYearFee = facts.firstYearFeeCents / 100;
  const ongoingFee = facts.ongoingFeeCents / 100;

  if (firstYearFee < ongoingFee) reasonCodes.push("ANNUAL_FEE_WAIVED_FIRST_YEAR");

  if (tolerance !== null) {
    if (firstYearFee > tolerance) {
      reasonCodes.push("ANNUAL_FEE_ABOVE_TOLERANCE");
      warnings.push("ANNUAL_FEE_ABOVE_STATED_TOLERANCE");
      // Mẫu số `max(tolerance, 100)` để ngưỡng $0 ("chỉ thẻ miễn phí") không
      // chia cho 0 — người đó vẫn thấy thẻ có phí, chỉ ở cuối bảng.
      const excess = (firstYearFee - tolerance) / Math.max(tolerance, 100);
      penalty *= Math.max(0.5, 1 - 0.5 * Math.min(1, excess));
    } else if (ongoingFee > tolerance) {
      // Miễn năm đầu kéo phí xuống dưới ngưỡng, nhưng năm sau thì không. Không
      // phạt — người dùng có thể đóng thẻ trước hạn — nhưng phải nói ra.
      warnings.push("SECOND_YEAR_FEE_APPLIES");
    }
  }

  /* ---- Mốc chi (§13) --------------------------------------------- */
  let minSpendFit: number | null = null;
  const required = facts.fullRequiredPerNinetyDays;
  if (required === null) {
    // Không có mốc nào để đạt. Đó là mức phù hợp TỐI ĐA, không phải thiếu dữ
    // liệu — và phân biệt đó quyết định thẻ này bị phạt hay không.
    minSpendFit = 1;
  } else if (capacity === null) {
    reasonCodes.push("MIN_SPEND_CAPACITY_UNKNOWN");
  } else {
    minSpendFit = minimumSpendFit(required, typicalAmount(capacity));
    const verdict = compareToThreshold(capacity, required);
    if (verdict === "below") {
      reasonCodes.push("MIN_SPEND_TOO_HIGH");
      warnings.push("SPEND_REQUIREMENT_LIKELY_UNSUITABLE");
    } else if (verdict === "straddles") {
      reasonCodes.push("MIN_SPEND_TIGHT");
    } else if (minSpendFit >= 0.9) {
      reasonCodes.push("MIN_SPEND_GOOD_FIT");
    } else {
      reasonCodes.push("MIN_SPEND_TIGHT");
    }
  }

  /* ---- Hạng trong họ thẻ ----------------------------------------- */
  if (product.familyId !== null && product.tierRank !== null) {
    const sameFamily = heldProducts.filter((held) => held.familyId === product.familyId);
    if (sameFamily.length > 0) {
      reasonCodes.push("UPGRADE_WITHIN_HELD_FAMILY");
      const highestHeld = Math.max(...sameFamily.map((held) => held.tierRank ?? 0));
      // Khuyên một hạng THẤP HƠN hạng đang giữ là khuyên đi lùi. Không loại —
      // có người thật sự muốn hạ hạng để bớt phí — nhưng nó không được đứng
      // trên một thẻ mới.
      if (product.tierRank < highestHeld) penalty *= 0.5;
    }
  }

  return {
    excluded: false,
    excludedReason: null,
    penalty,
    minSpendFit,
    firstYearFee,
    ongoingFee,
    reasonCodes,
    warnings,
  };
}
