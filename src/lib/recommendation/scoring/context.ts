/**
 * Dữ kiện đã tính sẵn cho MỘT ứng viên, và thang đo dùng chung của cả lượt
 * chạy.
 *
 * VÌ SAO TÁCH RA. Bốn hàm chấm điểm của §10 dùng chung phần lớn dữ kiện —
 * offer, tích điểm, quyền lợi, điều kiện — nhưng tổ hợp chúng khác nhau. Để
 * mỗi hàm tự tính là quét lại `benefitsByProduct` và `ratesByProduct` bốn lần
 * cho mỗi thẻ, và tệ hơn: bốn cách tính hơi khác nhau cho cùng một dữ kiện,
 * rồi hai ý định trả lời khác nhau về CÙNG một sự thật.
 *
 * `ScoringScale` phải được dựng MỘT LẦN trên cả tập ứng viên. Tính nó bên
 * trong vòng lặp thì mỗi thẻ được chuẩn hoá theo một thang riêng, và điểm số
 * thôi so sánh được với nhau trong khi vẫn trông hoàn toàn bình thường.
 */

import { activeAt } from "../temporal.ts";
import type { DatasetIndex } from "../indexes.ts";
import type { PointsProgramId, Product } from "../types.ts";
import type { UserState } from "../user-types.ts";
import type { BenefitFit } from "../benefit-fit.ts";
import type { EarnFit } from "../earn-fit.ts";
import type { OfferClimate, OfferFacts } from "../offer-quality.ts";
import type {
  EligibilityVerdict,
  GoalContext,
  Needs,
  PortfolioAnalysis,
  SuitabilityVerdict,
} from "../engine-types.ts";

export interface CandidateFacts {
  product: Product;
  offer: OfferFacts;
  earn: EarnFit;
  benefits: BenefitFit;
  eligibility: EligibilityVerdict;
  suitability: SuitabilityVerdict;
  /** Giá trị (cent) của các quyền lợi đi lại thẻ này THÊM vào — §10.2 dành 5%. */
  travelBenefitCount: number;
}

export interface ScoringScale {
  maxEarnAnnualCents: number;
  maxBenefitCashCents: number;
  maxBenefitCount: number;
  maxTravelBenefitCount: number;
  maxTransferDestinations: number;
}

export interface ScoringContext {
  state: UserState;
  ix: DatasetIndex;
  asOf: string;
  needs: Needs;
  portfolio: PortfolioAnalysis;
  goal: GoalContext;
  climate: OfferClimate;
  scale: ScoringScale;
}

export function buildScale(candidates: readonly CandidateFacts[]): ScoringScale {
  let maxEarnAnnualCents = 0;
  let maxBenefitCashCents = 0;
  let maxBenefitCount = 0;
  let maxTravelBenefitCount = 0;
  for (const candidate of candidates) {
    maxEarnAnnualCents = Math.max(maxEarnAnnualCents, candidate.earn.annualValueCents);
    maxBenefitCashCents = Math.max(maxBenefitCashCents, candidate.benefits.incrementalCashCents);
    maxBenefitCount = Math.max(maxBenefitCount, candidate.benefits.incrementalCount);
    maxTravelBenefitCount = Math.max(maxTravelBenefitCount, candidate.travelBenefitCount);
  }
  return {
    maxEarnAnnualCents,
    maxBenefitCashCents,
    maxBenefitCount,
    maxTravelBenefitCount,
    // Không phụ thuộc ứng viên, nhưng ở cùng chỗ với các thang khác để không
    // ai đi tính lại nó trong vòng lặp.
    maxTransferDestinations: 1,
  };
}

/** Số chương trình một đồng tiền chuyển thẳng tới được, không đòi hạng thành viên. */
export function transferDestinationCount(
  ix: DatasetIndex,
  programId: PointsProgramId | null,
  asOf: string,
): number {
  if (programId === null) return 0;
  const program = ix.programById.get(programId);
  if (program === undefined || !program.transferable) return 0;
  return new Set(
    activeAt(ix.pathsBySource.get(programId) ?? [], asOf)
      .filter((path) => path.requiresTier === null)
      .map((path) => path.destinationProgramId as string),
  ).size;
}

/**
 * Điểm welcome bonus của thẻ này quy về MỘT chương trình đích.
 *
 * `null` khi offer thưởng tiền mặt, khi chưa biết mốc chi, hoặc khi đồng tiền
 * của nó không với tới được đích. `0` thì khác: nó nghĩa là có với tới nhưng
 * không còn bonus (Amex® once-in-a-lifetime chẳng hạn), và phân biệt đó là
 * chênh lệch giữa "không áp dụng" và "áp dụng, bằng không".
 */
export function bonusPointsToward(
  candidate: CandidateFacts,
  target: PointsProgramId,
  ix: DatasetIndex,
  asOf: string,
): number | null {
  const active = candidate.offer.active;
  if (active === null) return null;
  const source = active.offer.bonusCurrencyId;
  if (source === null) return null;
  if (candidate.eligibility.welcomeOfferBlocked) return 0;

  const points = active.components.reduce((sum, part) => {
    const repeats = part.componentType === "monthly_spend" ? (part.repeatCount ?? 1) : 1;
    return sum + (part.pointsAmount ?? 0) * repeats;
  }, 0);
  if (points <= 0) return null;

  if (source === target) return points;

  const paths = activeAt(ix.pathsBySource.get(source) ?? [], asOf).filter(
    (path) => path.destinationProgramId === target && path.requiresTier === null,
  );
  if (paths.length === 0) return null;
  const ratio = Math.max(...paths.map((path) => path.ratioTo / path.ratioFrom));
  return Math.floor(points * ratio);
}
