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
import type { OfferComponent, PointsProgramId, Product, RedemptionMode } from "../types.ts";
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
  /**
   * CÙNG offer, nhưng welcome bonus quy ra TIỀN MẶT — xem `offerFacts(mode)`.
   *
   * Dựng cạnh `offer` vì lý do y hệt `earnCash`: §11 là 25% bảng điểm của mục
   * tiêu `cash`, và để nó đọc giá đổi vé thì một bonus Aeroplan® ăn điểm bằng
   * một khoản tiền người dùng không bao giờ thấy.
   */
  offerCash: OfferFacts;
  earn: EarnFit;
  /**
   * CÙNG phép tính tích điểm, nhưng quy ra TIỀN MẶT (`redemption: "cash"`).
   *
   * Dựng sẵn cạnh `earn` chứ không tính trong vòng lặp chấm điểm, cùng lý do
   * với cả file này: một hàm chấm điểm tự tính lấy sẽ quét lại `ratesByProduct`
   * cho mỗi thẻ, và — tệ hơn — hai chỗ sẽ trả lời hơi khác nhau về cùng một
   * con số. Mọi mục tiêu đều mang nó; chỉ mục tiêu `cash` đọc tới.
   */
  earnCash: EarnFit;
  benefits: BenefitFit;
  eligibility: EligibilityVerdict;
  suitability: SuitabilityVerdict;
  /** Giá trị (cent) của các quyền lợi đi lại thẻ này THÊM vào — §10.2 dành 5%. */
  travelBenefitCount: number;
}

export interface ScoringScale {
  maxEarnAnnualCents: number;
  /** Mẫu số của `long_term_earn_fit` khi mục tiêu hỏi bằng tiền mặt. Thang
   *  RIÊNG: dùng chung mẫu số với `best` thì mọi thẻ đều tụt xuống gần 0 và
   *  thành phần này thôi xếp hạng được — trong khi câu hỏi vẫn là "thẻ nào
   *  rút ra nhiều tiền nhất", một câu vẫn trả lời được. */
  maxEarnCashCents: number;
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
  /** Thị trường offer đo bằng TIỀN MẶT — mẫu số của §11 khi mục tiêu là `cash`.
   *  Thang riêng, cùng lý do với `maxEarnCashCents`. */
  climateCash: OfferClimate;
  scale: ScoringScale;
}

/**
 * Mục tiêu này hỏi giá trị theo kiểu đổi nào.
 *
 * MỘT hàm cho cả `scoring/*` lẫn `rank.ts`: ứng viên `NO_NEW_CARD` được chấm
 * trên một bảng khác, và nếu nó đo ví hiện tại bằng giá đổi vé trong khi các
 * thẻ được đo bằng giá rút tiền thì hai bên thôi so sánh được — mà điểm vẫn ra
 * một con số trông bình thường.
 */
export function valuationModeFor(goal: GoalContext): RedemptionMode {
  return goal.goal.type === "cash" ? "cash" : "best";
}

export function buildScale(
  candidates: readonly CandidateFacts[],
  /**
   * Lượt chạy này có mục tiêu nào hỏi tới tiền mặt không.
   *
   * `false` thì `maxEarnCashCents` để 0 — KHÔNG phải vì nó bằng 0, mà vì
   * không ai đọc nó. Tính rồi cất vào `derived` một con số dựng từ những dòng
   * định giá mà lượt chạy không dùng sẽ làm §29 phải đếm chúng vào độ tươi,
   * và một tỷ lệ rút-tiền cũ hạ độ tin cậy của một chuyến đi (vòng Codex 4).
   */
  readsCash: boolean,
): ScoringScale {
  let maxEarnAnnualCents = 0;
  let maxEarnCashCents = 0;
  let maxBenefitCashCents = 0;
  let maxBenefitCount = 0;
  let maxTravelBenefitCount = 0;
  for (const candidate of candidates) {
    maxEarnAnnualCents = Math.max(maxEarnAnnualCents, candidate.earn.annualValueCents);
    if (readsCash) {
      maxEarnCashCents = Math.max(maxEarnCashCents, candidate.earnCash.annualValueCents);
    }
    maxBenefitCashCents = Math.max(maxBenefitCashCents, candidate.benefits.incrementalCashCents);
    maxBenefitCount = Math.max(maxBenefitCount, candidate.benefits.incrementalCount);
    maxTravelBenefitCount = Math.max(maxTravelBenefitCount, candidate.travelBenefitCount);
  }
  return {
    maxEarnAnnualCents,
    maxEarnCashCents,
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
 * Mọi chương trình ví HIỆN TẠI đã chạm tới: chương trình có số dư (đã biết
 * và > 0, hoặc chưa biết), chương trình thẻ đang giữ kiếm ra, và mọi đích mở
 * cho ai cũng được mà chúng chuyển thẳng tới.
 *
 * Số dư ĐÃ BIẾT bằng 0 không tính: tài khoản trống không chuyển đi đâu được,
 * trừ khi một thẻ đang giữ vẫn đổ điểm vào nó — và vế đó đã nằm trong
 * `earnedPrograms`.
 */
export function walletReach(ctx: ScoringContext): Set<string> {
  const held = new Set<string>(ctx.portfolio.earnedPrograms as Set<string>);
  for (const [programId, knowledge] of ctx.portfolio.direct) {
    if (knowledge.kind === "unknown" || (knowledge.kind === "known" && knowledge.points > 0)) {
      held.add(programId as string);
    }
  }
  const reach = new Set(held);
  for (const programId of held) {
    const program = ctx.ix.programById.get(programId as PointsProgramId);
    if (program === undefined || !program.transferable) continue;
    for (const path of activeAt(ctx.ix.pathsBySource.get(programId as PointsProgramId) ?? [], ctx.asOf)) {
      if (path.requiresTier === null) reach.add(path.destinationProgramId as string);
    }
  }
  return reach;
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
  /**
   * Chỉ đếm những phần này, mỗi phần bao nhiêu chu kỳ. Vắng thì đếm MỌI thành
   * phần của offer, trọn số chu kỳ — mức tối đa, dù mất bao lâu. Chuyến đi
   * truyền vào đúng phần người dùng VỚI TỚI và KỊP NHẬN trước ngày bay (xem
   * `tripBonusParts`): 0 phần nào thì là 0 điểm, KHÔNG rơi về cả offer.
   */
  parts?: readonly { component: OfferComponent; repeats: number }[],
): number | null {
  const active = candidate.offer.active;
  if (active === null) return null;
  const source = active.offer.bonusCurrencyId;
  if (source === null) return null;
  if (candidate.eligibility.welcomeOfferBlocked) return 0;

  const counted =
    parts ??
    active.components.map((component) => ({
      component,
      repeats: component.componentType === "monthly_spend" ? (component.repeatCount ?? 1) : 1,
    }));
  const anyPoints = active.components.some((part) => (part.pointsAmount ?? 0) > 0);
  const points = counted.reduce((sum, part) => sum + (part.component.pointsAmount ?? 0) * part.repeats, 0);
  // Offer không có phần điểm nào thì "không áp dụng" (`null`); có mà chưa kịp
  // nhận phần nào thì "áp dụng, bằng không" (0) — cùng phân biệt với nhánh bị chặn.
  if (!anyPoints) return null;

  if (source === target) return points;

  const paths = activeAt(ix.pathsBySource.get(source) ?? [], asOf).filter(
    (path) => path.destinationProgramId === target && path.requiresTier === null,
  );
  if (paths.length === 0) return null;
  const ratio = Math.max(...paths.map((path) => path.ratioTo / path.ratioFrom));
  return Math.floor(points * ratio);
}
