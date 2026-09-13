/**
 * Dây chuyền của Phase 3, và KHÔNG có gì khác.
 *
 * ```
 * User State → Goal → Portfolio → Strategies → Needs → Eligibility/Suitability
 *            → Candidates → Intent Scoring → Rules → Ranking → Recommendation
 * ```
 *
 * §26 nói "đừng dựng một `recommendation.ts` khổng lồ", và file này giữ đúng
 * lời đó bằng cách KHÔNG chứa một quyết định nào: mọi phép đo, mọi ngưỡng, mọi
 * trọng số đều ở module của nó. Việc duy nhất ở đây là thứ tự — và thứ tự
 * chính là thứ spec đòi. Một dòng logic lọt vào đây là một dòng không có test
 * riêng và không có chỗ để giải thích.
 *
 * TẤT ĐỊNH. Cùng đầu vào + cùng version = cùng đầu ra (§35). Ba chỗ giữ lời
 * hứa đó: mọi phép sắp xếp đều có khoá phá hoà tường minh, `asOf` được truyền
 * xuống chứ không ai gọi `new Date()`, và không có `Math.random`, không có
 * `Date.now`, không có LLM.
 */

import { analyzePortfolio, topEcosystemShare } from "./portfolio.ts";
import { normalize } from "./normalize.ts";
import { buildReadSet, goalReadsEarn, oldestVerified, scopeDataGaps } from "./read-set.ts";
import { generateStrategies, tripCoverage } from "./strategies.ts";
import { computeNeeds } from "./needs.ts";
import { evaluateEligibility } from "./eligibility.ts";
import { evaluateSuitability } from "./suitability.ts";
import { earnFitFor } from "./earn-fit.ts";
import { benefitFitFor, heldBenefitKeys } from "./benefit-fit.ts";
import { offerClimate, offerFacts } from "./offer-quality.ts";
import { activeAt } from "./temporal.ts";
import { assembleScore } from "./scoring/weights.ts";
import { buildScale } from "./scoring/context.ts";
import { scoreNextCard } from "./scoring/next-card.ts";
import { scoreTrip } from "./scoring/trip.ts";
import { scoreDiversify } from "./scoring/diversify.ts";
import { scoreEarning } from "./scoring/earning.ts";
import { RULE_VERSION, applyRules } from "./rules.ts";
import { buildNoNewCardCandidate, finalScore, rankCandidates } from "./rank.ts";
import { computeConfidence, scoresNearlyTied } from "./confidence.ts";
import { mergeReasonCodes, mergeWarnings, nextQuestion } from "./explain.ts";
import { probeGap, type GapProbe } from "./sensitivity.ts";
import { validateUserState } from "./user-validate.ts";
import {
  excludedProducts,
  rankingTrace,
  snapshotFacts,
  snapshotNeeds,
  snapshotPortfolio,
} from "./trace.ts";
import type { DatasetIndex } from "./indexes.ts";
import type {
  BenefitId,
  DataGap,
  ProductId,
  RecommendationDataset,
} from "./types.ts";
import type { UserDataGap, UserState } from "./user-types.ts";
import type { RecommendationDataSource } from "./source.ts";
import type { OfferHistoryPoint } from "./offer-history.ts";
import type { CandidateFacts, ScoringContext } from "./scoring/context.ts";
import type {
  Candidate,
  GoalContext,
  GoalTrace,
  Recommendation,
  RecommendationRun,
  ScoreComponent,
} from "./engine-types.ts";
import type { ReasonCode, WarningCode } from "./reason-codes.ts";

/**
 * Version của engine, đi vào mọi lượt chạy.
 *
 * §20 (`recommendation_runs`) và tiêu chí "cùng đầu vào + CÙNG VERSION = cùng
 * đầu ra" đều dựa vào nó. Đổi bất kỳ trọng số, ngưỡng hay luật nào thì tăng
 * số này — nếu không, hai lượt chạy cho hai kết quả khác nhau sẽ trông như
 * một lỗi tất định thay vì như một lần đổi mô hình.
 *
 * 3.1.0 — vòng review đầu: lọc thẻ không đủ điều kiện, phủ điểm theo từng
 * chương trình, `rateAfterCap`, trần chi tiêu đúng đơn vị, miễn phí năm đầu
 * thôi đếm hai lần.
 * 3.2.0 — vòng ba và bốn: "chưa biết" thôi bị xuất thành 0, phạm vi chỗ trống
 * dữ liệu, `portfolio_already_covers` đọc thẳng chương trình của chuyến đi.
 * 3.3.0 — rà đối kháng: dòng số dư TRÙNG thôi cộng lại, số dư âm và số người
 * không hợp lệ thành CHƯA BIẾT, operator lạ thôi bị đọc như `gte`, độ tin cậy
 * không còn CAO khi chỉ có một ứng viên, và chương trình có điểm mà chỉ biết
 * mức sàn thôi sinh ra khoảng cách chính xác giả.
 *
 * 3.4.0 — rà đối kháng vòng hai: "chưa biết" nay LAN tới chỗ trống, độ tin
 * cậy và cảnh báo, chứ không dừng ở bên trong engine; thiếu nước ở thôi bị
 * đọc thành trượt điều kiện.
 * 3.5.0 — thiếu nước ở nay là một chỗ trống có tên (`country_unknown`), và là
 * câu hỏi ưu tiên thứ hai sau mục tiêu.
 * 4.0.0 — rà theo góc nhìn CHƠI ĐIỂM. Đổi THỨ HẠNG trên diện rộng, nên tăng
 * số lớn: linh hoạt thành một thang thay vì có/không; ngưỡng phí chưa khai
 * thôi được coi là vô hạn; điều khoản offer chưa biết thôi được chấm là vừa
 * sức; và `NO_NEW_CARD` thôi được chấm bằng một chương trình chọn bừa.
 *
 * 4.0.1 — Phase 4: hạng mục chi tiêu cộng theo thứ tự CỐ ĐỊNH thay vì thứ tự
 * khoá của object. Kết quả 15 nhân vật không đổi ở chữ số thứ tư, nhưng
 * `earn_fit` lệch ở chữ số thứ 16 giữa hai thứ tự khoá — và một lượt chạy lưu
 * qua JSON (khoá đã sắp) không tái lập được bản chạy trên object gốc.
 *
 * 4.1.0 — Phase 4, lỗi đầu tiên debugger bới ra trên Test C: `points_gap_
 * reduction` chấm theo phần KHOẢNG CÁCH được lấp, nên thiếu 5,000 trên chuyến
 * 205,000 thì mọi thẻ nhận trọn 20% — và điểm nhảy từ 1 xuống 0 ở đúng mép đủ
 * điểm. Nay chấm theo phần CHUYẾN ĐI, liền mạch. `FOCUS_ON_AVAILABILITY` bật
 * từ lúc số điểm phủ được giá ĐIỂN HÌNH, không đợi tới cận trên. Đổi người
 * thắng của `japanTripFunded` sang `NO_NEW_CARD`.
 *
 * 4.2.0 — §30 chọn câu hỏi tiếp theo bằng THỰC NGHIỆM: câu nào lấp vào đổi
 * được người thắng thì lên trước bảng ưu tiên tĩnh. Đổi `followUp` của nhiều
 * nhân vật, không đổi thứ hạng nào.
 *
 * 4.2.1 — vòng Codex 2: câu trả lời thử làm hồ sơ mâu thuẫn (hạng mục vượt
 * tổng tháng, thu nhập hộ dưới thu nhập cá nhân) bị loại khỏi phép đo §30.
 *
 * 4.3.0 — vòng Codex 3 + 4: tỷ lệ phủ dựng trên số dư CHƯA BIẾT mà chưa tới
 * 100% là điểm giữa của [cận dưới, 1] — không phải cận dưới (chấm như 0
 * điểm), cũng không phải `null` (mượn nghĩa "chặng chưa có giá" và làm
 * `NO_NEW_CARD` mất thành phần đủ-điểm). `FOCUS_ON_AVAILABILITY` đo giá điển
 * hình trên TỪNG chương trình.
 *
 * 4.4.0 — `points_gap_reduction` đo bằng CHÍNH `tripCoverage` chạy hai lần
 * (không bonus / có bonus), thay vì một phép đo riêng trên `bestProgram`: với
 * người chưa có điểm nào, `bestProgram` là chương trình đầu theo id và mọi
 * thẻ Aeroplan® được 0 điểm thu hẹp khoảng cách.
 *
 * 4.5.0 — vòng Codex 5: chương trình chỉ biết giá SÀN phủ trong
 * [0, min(1, điểm/sàn)] chứ không phải [cận dưới, 1] (1 điểm từng được 50%);
 * `bestProgram`/`accessible` là chương trình QUYẾT ĐỊNH tỷ lệ phủ.
 *
 * 4.6.0 — vòng Codex 6: `tripCoverage` viết lại thành MỘT phép đánh giá
 * (mỗi chương trình một khoảng phủ [lo, hi], lấy điểm giữa) và MỘT phép
 * chọn — sau ba bản vá nhánh-riêng liên tiếp mà nhánh nào cũng quên một giá
 * trị. `directPoints` theo đúng chương trình được chọn; `pointsGapTypical`
 * chỉ nói khi tỷ lệ phủ chắc chắn; độ tươi §29 bỏ chặng đòi hạng thành viên.
 *
 * 4.7.0 — vòng Codex 7: sàn ĐỘNG của một chương trình có cả bảng giá cố định
 * mở rộng cận trên của khoảng phủ (`TripNeedByProgram.floor`), và tỷ lệ phủ
 * là số đo khi cực đại các cận dưới đã bằng cực đại các cận trên.
 *
 * 4.8.0 — vòng Codex 8: hai mục tiêu hoà nhau — độ tin cậy mỗi mục tiêu chỉ
 * đọc chỗ trống CỦA NÓ; phép đo §30 nhìn người thắng của MỌI mục tiêu.
 *
 * 4.9.0 — vòng Codex 9: chỗ trống `trip_*` của mục tiêu KHÔNG chạy trong lượt
 * này bị bỏ; `goal_priority_ambiguous` không trừ độ tin cậy từng mục tiêu;
 * tỷ lệ tích điểm chưa biết chỉ tính khi một mục tiêu thật sự đọc nó; §30
 * lọc câu hỏi theo bảng của MỌI mục tiêu.
 *
 * 4.10.0 — vòng Codex 10: độ tươi §29 chỉ quét tỷ lệ tích điểm khi mục tiêu
 * thật sự đọc chúng (`goalReadsEarn`, cùng hàm với chỗ trống dữ liệu).
 *
 * 4.11.0 — vòng Codex 11: thẻ ĐANG GIỮ vào độ tươi (quyền lợi, và tỷ lệ tích
 * điểm khi mục tiêu đọc chúng) và vào chỗ trống `base_earn_rate_unknown` —
 * `NO_NEW_CARD` đọc chúng qua `walletEarnCoverage`.
 *
 * 4.12.0 — vòng Codex 12: độ tươi và chỗ trống theo sản phẩm đo trên ĐÚNG
 * những dòng lượt chạy đọc (`read-set.ts`): thêm trần tích điểm, bỏ định giá
 * của chương trình vắng mặt, bỏ offer/phí của thẻ không chọn được.
 *
 * 4.13.0 — vòng Codex 13: mỗi luật của `read-set.ts` gắn với MỘT phép tính
 * thật — phí của mọi thẻ (trung vị), luật điều kiện trừ thẻ đã từ chối, tỷ
 * lệ/trần chỉ khi có hồ sơ chi tiêu, định giá chỉ khi một phép nhân dùng,
 * mọi chặng không đòi hạng (mẫu số tầm với).
 *
 * 4.14.0 — vòng Codex 14: `SCORES_NEARLY_TIED` phát khi hai ứng viên đầu THẬT
 * SỰ cách nhau < 0.05, không phải mỗi khi độ tin cậy `low` (dữ liệu cũ từng
 * in ra "sát nhau" cho khoảng cách 0.062). Phí của thẻ bị loại chỉ tính khi
 * trung vị phí được dùng; số dư chưa biết không kéo định giá vào độ tươi.
 *
 * 3.3.0 và 3.4.0 KHÔNG đổi kết quả của 15 nhân vật mẫu — chúng không chứa đầu
 * vào hỏng nào — nhưng chúng đổi kết quả cho những đầu vào đó, và §20 nói về
 * MỌI đầu vào chứ không chỉ về fixture.
 *
 * Cả hai lần đều ĐỔI THỨ HẠNG, nên ba bản không so sánh trực tiếp được — và
 * đó chính là việc trường này sinh ra để nói.
 *
 * QUÊN TĂNG SỐ NÀY LÀ MỘT LỖI IM LẶNG, nên nó không được canh bằng trí nhớ:
 * `engine.test.ts` giữ một bản chụp kết quả của cả 15 nhân vật, khoá theo
 * chính version này. Đổi hành vi mà không tăng version là test ĐỎ, và thông
 * báo lỗi nói thẳng phải làm gì.
 */
export const ENGINE_VERSION = "4.14.0";

export interface RecommendInput {
  state: UserState;
  data: RecommendationDataset;
  ix: DatasetIndex;
  asOf: string;
  /** Lịch sử offer theo `productId`. Rỗng thì §12 trả `null`, không trả 0. */
  offerHistory?: ReadonlyMap<string, OfferHistoryPoint[]>;
  /**
   * Đo giá trị câu hỏi §30 bằng cách chạy lại engine — mặc định BẬT.
   *
   * Chỉ tắt ở chính các lượt chạy thử bên trong phép đo: một phép đo tự đo
   * chính nó là đệ quy không đáy, và câu hỏi tiếp theo của một hồ sơ GIẢ ĐỊNH
   * không phải thứ ai cần.
   */
  probeFollowUps?: boolean;
}

/**
 * Khoá người thắng cho phép đo §30 — người thắng của MỌI mục tiêu, nối lại.
 *
 * Không chỉ mục tiêu đầu: hai mục tiêu hoà nhau chạy song song, và câu trả
 * lời "1 người" lật người thắng của CHUYẾN ĐI (mục tiêu thứ hai) mà phép đo
 * cũ vẫn ghi 0/3 vì chỉ nhìn "thẻ tiếp theo" (vòng Codex 8).
 */
function winnerKey(results: readonly Recommendation[]): string | null {
  if (results.length === 0) return null;
  return results
    .map((result) =>
      result.primaryAction.kind === "no_new_card"
        ? "NO_NEW_CARD"
        : (result.primaryAction.productId as string),
    )
    .join(" | ");
}

/**
 * Giữ lại HẠNG TỐT NHẤT của mỗi họ thẻ.
 *
 * Ba hạng CIBC® Aeroplan® là ba hạng của MỘT thẻ, không phải ba lựa chọn độc
 * lập — README của Phase 1 dựng `ProductFamily` đúng vì chuyện này. Không gom
 * lại thì một thẻ duy nhất chiếm nhiều suất trong danh sách gợi ý, và người
 * đọc nhận "bốn lựa chọn" mà thật ra là hai.
 *
 * Danh sách vào đã sắp theo điểm, nên phần tử đầu tiên của mỗi họ chính là
 * hạng tốt nhất cho người này. Thẻ không thuộc họ nào thì luôn giữ.
 */
function bestPerFamily(
  candidates: readonly Candidate[],
  ix: DatasetIndex,
  alreadyShown: readonly Candidate[] = [],
): { kept: Candidate[]; hidden: Map<Candidate, ProductId> } {
  /** Họ thẻ → sản phẩm đã giữ chỗ cho họ đó. */
  const claimedBy = new Map<string, ProductId>();
  // Gieo sẵn họ của những thẻ ĐÃ hiện ra — trước hết là thẻ thắng cuộc. Bỏ
  // bước này thì phép gom chỉ chặn trùng lặp GIỮA các gợi ý thay thế, còn
  // hạng thứ hai của chính thẻ đứng đầu vẫn đứng ngay dưới nó.
  for (const candidate of alreadyShown) {
    const product = candidate.productId === null ? undefined : ix.productById.get(candidate.productId);
    if (product?.familyId != null && !claimedBy.has(product.familyId as string)) {
      claimedBy.set(product.familyId as string, product.id);
    }
  }
  const kept: Candidate[] = [];
  // Thẻ bị gom đi, kèm thẻ đã chiếm chỗ của họ nó. Debugger §22 đọc thẳng từ
  // đây: "thẻ X hạng 3 mà không thấy đâu" phải trả lời được bằng chính phép
  // gom đã giấu nó, không phải bằng một phép gom thứ hai viết lại cho debugger.
  const hidden = new Map<Candidate, ProductId>();
  for (const candidate of candidates) {
    const product = candidate.productId === null ? undefined : ix.productById.get(candidate.productId);
    const family = product?.familyId ?? null;
    if (family !== null) {
      const holder = claimedBy.get(family as string);
      if (holder !== undefined) {
        hidden.set(candidate, holder);
        continue;
      }
      claimedBy.set(family as string, product!.id);
    }
    kept.push(candidate);
  }
  return { kept, hidden };
}

/** Quyền lợi đi lại thẻ này THÊM vào — §10.2 dành 5% cho chúng. */
function travelBenefitCount(
  productId: string,
  held: ReadonlySet<string>,
  ix: DatasetIndex,
  asOf: string,
): number {
  let count = 0;
  for (const row of activeAt(ix.benefitsByProduct.get(productId) ?? [], asOf)) {
    const benefit = ix.benefitById.get(row.benefitId as BenefitId);
    if (benefit === undefined) continue;
    if (benefit.category !== "airline" && benefit.category !== "airport") continue;
    const key = `${row.benefitId}|${row.provider ?? ""}`;
    if (held.has(key) && benefit.duplicatesAcrossCards) continue;
    count += 1;
  }
  return count;
}

function scoreFor(
  goal: GoalContext,
  candidate: CandidateFacts,
  ctx: ScoringContext,
): ScoreComponent[] {
  // §10: bốn ý định, BỐN hàm. Không có nhánh mặc định — thêm một `GoalType`
  // vào Phase 2 mà quên hàm chấm điểm ở đây là lỗi biên dịch, không phải một
  // khuyến nghị lặng lẽ chạy bằng bảng trọng số của ý định khác.
  switch (goal.goal.type) {
    case "trip":
      return scoreTrip(candidate, ctx);
    case "diversify":
      return scoreDiversify(candidate, ctx);
    case "earn_points":
      return scoreEarning(candidate, ctx);
    case "next_card":
      return scoreNextCard(candidate, ctx);
  }
}

/**
 * Chạy engine.
 *
 * `offerHistory` là tuỳ chọn vì nó bất đồng bộ và đến từ một file khác — xem
 * `recommendFromSource` bên dưới. Vắng nó thì §12 trả `null` (chưa biết
 * percentile), KHÔNG trả 0: "chưa theo dõi đủ lâu" và "mức thấp nhất từng
 * thấy" là hai câu khác nhau, và câu thứ hai thì sai.
 */
export function recommend(input: RecommendInput): RecommendationRun {
  const { state, data, ix, asOf } = input;
  const history = input.offerHistory ?? new Map<string, OfferHistoryPoint[]>();
  const normalized = normalize(state, data, ix, asOf);

  const runReasons: ReasonCode[] = [];
  const runWarnings: WarningCode[] = [];
  if (normalized.goalResolution === "none") runReasons.push("GOAL_MISSING");
  if (normalized.goalResolution === "ambiguous") runReasons.push("GOAL_AMBIGUOUS");

  const portfolio = analyzePortfolio(state, ix, asOf);
  if (portfolio.balancesUndeclared) runWarnings.push("BALANCES_UNDECLARED");
  if (portfolio.cardsUndeclared) runWarnings.push("CARDS_UNDECLARED");

  const capacity = state.spend?.minimumSpendCapacity3m ?? null;
  // Trung vị phí của TẬP ỨNG VIÊN — mốc so khi người dùng chưa khai ngưỡng phí.
  const feeList = normalized.universe
    .map((product) => activeAt(ix.feesByProduct.get(product.id) ?? [], asOf)[0]?.annualFee ?? 0)
    .sort((a, b) => a - b);
  const medianFeeCents =
    feeList.length === 0 ? 0 : Math.round(feeList[Math.floor(feeList.length / 2)] * 100);
  const heldKeys = heldBenefitKeys(portfolio.heldProducts, ix, asOf);
  // Chỗ trống của lớp dữ liệu đi THẲNG vào phán quyết điều kiện — xem
  // `evaluateEligibility`.
  const unknownRequirements = new Set(
    data.gaps.filter((gap) => gap.kind === "eligibility_unknown").map((gap) => gap.subjectId),
  );

  /* ---- Dữ kiện từng ứng viên (không phụ thuộc mục tiêu) ------------ */
  const facts: CandidateFacts[] = normalized.universe.map((product) => {
    const offer = offerFacts(product, ix, asOf, capacity, history.get(product.id) ?? []);
    return {
      product,
      offer,
      earn: earnFitFor(product.id, state.spend, ix, asOf),
      benefits: benefitFitFor(product.id, heldKeys, ix, asOf),
      eligibility: evaluateEligibility(product.id, state, ix, asOf, unknownRequirements),
      suitability: evaluateSuitability({
        product,
        state,
        facts: offer,
        capacity,
        ix,
        asOf,
        heldProducts: portfolio.heldProducts,
        medianFeeCents,
      }),
      travelBenefitCount: travelBenefitCount(product.id, heldKeys, ix, asOf),
    };
  });

  /**
   * Ứng viên thật sự chấm điểm được.
   *
   * HAI phép lọc, hai lý do khác nhau (§14):
   *
   *   `suitability.excluded`      — NGƯỜI DÙNG đã nói không với loại thẻ này.
   *   `eligibility === ineligible` — NGÂN HÀNG sẽ từ chối.
   *
   * Vế thứ hai TỪNG THIẾU, và hậu quả không nhẹ: một hồ sơ khai thu nhập 0
   * vẫn nhận RBC® Avion® Visa Infinite làm khuyến nghị chính, kèm nguyên
   * `eligibility.status === "ineligible"` trong chính đầu ra. Phạt điểm không
   * cứu được ca này — luật CỨNG là luật cứng, và §14 tách hai khái niệm ra
   * đúng để chỗ này không phải chọn một hình phạt cho một cánh cửa đóng.
   *
   * `unknown` thì KHÔNG lọc: khoảng thu nhập bắc qua ngưỡng bao trùm đúng
   * những người vế hộ gia đình sinh ra để nhận. Nó bị phạt ở `rules.ts`.
   */
  const selectable = facts.filter(
    (row) => !row.suitability.excluded && row.eligibility.status !== "ineligible",
  );

  // Thang đo dựng trên ỨNG VIÊN CHỌN ĐƯỢC, không trên cả tập. Một thẻ doanh
  // nghiệp người dùng đã từ chối, hoặc một thẻ ngân hàng sẽ từ chối họ, không
  // được kéo tụt điểm tương đối của mọi thẻ còn lại — và qua đó đổi luôn kết
  // quả thẻ-hay-không-thẻ.
  const climate = offerClimate(selectable.map((row) => row.offer));
  const scale = buildScale(selectable);

  const goalTraces: GoalTrace[] = [];
  const goalDataGapSets: DataGap[][] = [];
  const declined = facts.filter((row) => row.suitability.excluded).map((row) => row.product);
  // Số dư được NHÂN với định giá: chỉ số dư biết và khác 0 — `analyzePortfolio`
  // và ba bảng điểm đều thoát trước phép nhân khi số dư chưa biết.
  const valuedBalancePrograms = [...portfolio.direct]
    .filter(([, knowledge]) => knowledge.kind === "known" && knowledge.points !== 0)
    .map(([programId]) => programId as string);
  const feeToleranceKnown = state.profile?.annualFeeTolerancePerCard != null;
  const results: Recommendation[] = normalized.goals.map((goal, goalIndex) => {
    const strategies = generateStrategies({ state, ix, asOf, portfolio, goal, climate });
    const needs = computeNeeds({ state, data, ix, asOf, portfolio, goal, strategies });
    const ctx: ScoringContext = { state, ix, asOf, needs, portfolio, goal, climate, scale };

    const cardCandidates: Candidate[] = selectable.map((candidate) => {
      const components = scoreFor(goal, candidate, ctx);
      const baseScore = assembleScore(components);
      const ruled = applyRules({ candidate, ctx, baseScore });
      return {
        kind: "open_card" as const,
        productId: candidate.product.id,
        productSlug: candidate.product.slug,
        productName: candidate.product.name,
        score: finalScore(baseScore, ruled.adjustments),
        baseScore,
        components,
        adjustments: ruled.adjustments,
        reasonCodes: mergeReasonCodes(
          ruled.reasonCodes,
          candidate.eligibility.reasonCodes,
          candidate.suitability.reasonCodes,
          candidate.offer.reasonCodes,
          candidate.benefits.reasonCodes,
        ),
        warnings: mergeWarnings(
          ruled.warnings,
          candidate.eligibility.warnings,
          candidate.suitability.warnings,
          candidate.offer.warnings,
        ),
        eligibility: candidate.eligibility,
        suitability: candidate.suitability,
      };
    });

    // §16 Rule 8 — MỌI lượt chạy, không phải chỉ khi không còn thẻ nào.
    // Truyền TẬP ĐẦY ĐỦ: thành phần `no_reachable_candidate` đo đúng phần ứng
    // viên bị chặn, nên nó phải nhìn thấy cả những thẻ vừa bị lọc ra.
    const noAction = buildNoNewCardCandidate(facts, ctx);
    const ranked = rankCandidates([...cardCandidates, noAction]);

    // Đúng những dòng lượt chạy ĐÃ ĐỌC cho mục tiêu này — một câu trả lời cho
    // cả độ tươi lẫn chỗ trống theo sản phẩm. Xem `read-set.ts`.
    const read = buildReadSet({
      universe: normalized.universe,
      declined,
      scored: selectable.map((row) => row.product),
      held: portfolio.heldProducts,
      goalReadsEarn: goalReadsEarn(goal, state, ix, asOf),
      spendKnown: state.spend != null,
      feeToleranceKnown,
      valuedBalancePrograms,
      awardStrategies: goal.tripNeed?.strategies ?? [],
    });
    const oldest = oldestVerified(read, data, ix, asOf);
    const goalDataGaps = scopeDataGaps(normalized.goalGaps[goalIndex].dataGaps, read);
    goalDataGapSets.push(goalDataGaps);
    const confidence = computeConfidence({
      ranked,
      goal,
      userGaps: normalized.goalGaps[goalIndex].userGaps,
      dataGaps: goalDataGaps,
      oldestVerifiedAt: oldest?.verifiedAt ?? null,
      asOf,
    });

    const need = goal.tripNeed;
    // Số điểm và khoảng cách đều đo trên CHƯƠNG TRÌNH PHỦ TỐT NHẤT, không trên
    // khoảng gộp — xem `tripCoverage`. Báo khoảng cách bằng một con số và kết
    // luận phủ bằng một con số khác là cách engine tự mâu thuẫn với chính nó
    // trong cùng một đầu ra.
    const covered = need === null ? null : tripCoverage(state, ix, asOf, need);
    const bestRow =
      need === null || covered === null
        ? undefined
        : need.byProgram.find((row) => row.programId === covered.bestProgram);
    const accessible = covered?.accessible ?? null;
    const winner = ranked[0];
    // Chỉ các thẻ, và `NO_NEW_CARD` luôn có chỗ riêng ở `noAction` — kể cả
    // khi nó đang đứng đầu. Trộn nó vào `alternatives` là để nó biến mất
    // khỏi đầu ra đúng lúc nó thắng.
    const grouped = bestPerFamily(
      ranked.filter((row) => row !== winner && row.kind === "open_card"),
      ix,
      [winner],
    );
    const alternatives = grouped.kept.slice(0, 4);

    goalTraces.push({
      goalId: goal.goal.id,
      goalType: goal.goal.type,
      goal,
      tripCoverage: covered,
      needs: snapshotNeeds(needs),
      ranking: rankingTrace(ranked, winner, alternatives, grouped.hidden),
      confidenceInputs: {
        topScore: ranked[0]?.score ?? null,
        secondScore: ranked[1]?.score ?? null,
        rivalCount: Math.max(0, ranked.length - 1),
        oldestVerifiedAt: oldest?.verifiedAt ?? null,
        oldestVerifiedRow: oldest === null ? null : { table: oldest.table, id: oldest.id },
      },
      userGaps: normalized.goalGaps[goalIndex].userGaps,
      dataGaps: goalDataGaps,
    });

    return {
      goalId: goal.goal.id,
      goalType: goal.goal.type,
      strategy: strategies[0] ?? { strategy: "OPEN_CARD", score: 0, reasonCodes: [] },
      strategies,
      primaryAction: winner,
      alternatives,
      noAction,
      reasonCodes: mergeReasonCodes(
        winner.reasonCodes,
        // Mã của MỌI chiến lược đạt ngưỡng, không chỉ chiến lược đứng đầu.
        // `PORTFOLIO_CONCENTRATED` thuộc về DANH MỤC, không thuộc về hành động
        // thắng cuộc — và nếu nó chỉ đi kèm `DIVERSIFY`, thì một người dồn
        // 89% vào Aeroplan® sẽ không bao giờ nghe thấy điều đó chỉ vì
        // `EARN_FLEXIBLE_POINTS` hơn `DIVERSIFY` đúng vài phần trăm.
        ...strategies.filter((row) => row.score >= 0.5).map((row) => row.reasonCodes),
        need?.reasonCodes ?? [],
        scoresNearlyTied(ranked) ? (["SCORES_NEARLY_TIED"] as ReasonCode[]) : [],
        (covered?.unpricedHeldPrograms.length ?? 0) > 0
          ? (["AWARD_PRICE_IS_FLOOR_ONLY"] as ReasonCode[])
          : [],
      ),
      warnings: mergeWarnings(
        winner.warnings,
        need?.warnings ?? [],
        // Người dùng có điểm ở một chương trình engine chỉ biết mức SÀN. Con
        // số phủ và khoảng cách đều là cận dưới, và điều đó phải nói ra chứ
        // không nằm im trong một trường boolean.
        (covered?.unpricedHeldPrograms.length ?? 0) > 0
          ? (["AWARD_PRICE_FLOOR_ONLY"] as WarningCode[])
          : [],
      ),
      numbers: {
        tripNeedLow: need?.low ?? null,
        tripNeedTypical: need?.typical ?? null,
        tripNeedHigh: need?.high ?? null,
        // `null` = CHƯA BIẾT. Cả ba con số dưới đây đi thẳng vào lời giải
        // thích của người đọc, nên một số 0 bịa ở đây là một câu sai về TIỀN.
        // Điểm nằm SẴN trong CHÍNH chương trình quyết định tỷ lệ phủ — cùng
        // lựa chọn với `accessiblePoints` và `pointsGapTypical`. Bản trước lấy
        // cực đại qua mọi chương trình, nên in ra "có sẵn 190,400 (Asia
        // Miles®) · tiếp cận 130,200 (AAdvantage®) · thiếu 9,800" — ba con số
        // về hai chương trình khác nhau trong một câu (vòng Codex 6).
        directPoints: (() => {
          const programId = covered?.bestProgram ?? null;
          if (programId === null) return null;
          const entry = portfolio.direct.get(programId);
          if (entry?.kind === "known") return entry.points;
          // Không có dòng số dư nào: 0 nếu người dùng ĐÃ khai hết số dư, chưa
          // biết nếu chưa khai — mảng rỗng chưa khai không phải "không có điểm".
          if (entry === undefined) return portfolio.balancesUndeclared ? null : 0;
          return null;
        })(),
        accessiblePoints: accessible,
        accessiblePointsIsLowerBound: covered?.accessibleIsLowerBound ?? false,
        // Khoảng cách chỉ nói được khi TỶ LỆ PHỦ là con số chắc chắn — không
        // số dư nào chưa biết, không chương trình nào chỉ biết giá sàn. "Còn
        // thiếu 140,000" dựng trên một ước lượng là một con số chính xác giả.
        pointsGapTypical:
          bestRow?.typical == null || accessible === null || covered?.coverageKnown !== true
            ? null
            : Math.max(0, bestRow.typical - accessible),
        topEcosystemShare: topEcosystemShare(portfolio),
        flexibilityScore: portfolio.flexibilityScore,
      },
      confidence,
    };
  });

  const selectableIds = new Set(selectable.map((row) => row.product.id as string));

  // §30 đo bằng thực nghiệm — xem `sensitivity.ts`. Lười: chỉ đo những câu
  // `nextQuestion` đã cho qua bộ lọc, và mỗi phép đo được ghi lại vào
  // `derived` để admin thấy §30 đã cân những gì.
  const followUpProbes: GapProbe[] = [];
  const current = winnerKey(results);
  const measure =
    input.probeFollowUps === false || results.length === 0
      ? undefined
      : (gap: UserDataGap) => {
          const probe = probeGap(
            gap,
            state,
            current,
            (probed) => winnerKey(recommend({ ...input, state: probed, probeFollowUps: false }).results),
            (probed) =>
              new Set(
                validateUserState(probed, data)
                  .filter((issue) => issue.level === "error")
                  .map((issue) => `${issue.entity}|${issue.message}`),
              ),
          );
          if (probe === null) return null;
          followUpProbes.push(probe);
          return probe.flips / probe.valid;
        };
  const followUp = nextQuestion({
    gaps: normalized.userGaps,
    ranked:
      results[0]?.primaryAction === undefined
        ? []
        : [results[0].primaryAction, ...results[0].alternatives],
    rankings: results.map((result) => [result.primaryAction, ...result.alternatives]),
    // Câu hỏi "có xét thẻ doanh nghiệp không" chỉ đáng hỏi khi một thẻ
    // DOANH NGHIỆP đang thật sự trong bảng. Suy nó từ mã `ELIGIBILITY_UNCERTAIN`
    // là suy sai cả hai chiều: hỏi khi một thẻ thường có thu nhập chưa rõ,
    // và KHÔNG hỏi khi một thẻ doanh nghiệp đủ điều kiện đang đứng đầu.
    businessProductIds: new Set(
      normalized.universe
        .filter((product) => product.personalOrBusiness === "business")
        .map((product) => product.id as string),
    ),
    measure,
  });

  return {
    engineVersion: ENGINE_VERSION,
    ruleVersion: RULE_VERSION,
    asOf,
    goalResolution: normalized.goalResolution,
    results,
    followUp,
    reasonCodes: mergeReasonCodes(runReasons),
    warnings: mergeWarnings(runWarnings),
    // Hợp chỗ trống của các mục tiêu, giữ thứ tự của `normalize`. Không có
    // mục tiêu nào thì không có gì được chấm — lọc theo tập ứng viên chọn được.
    dataGaps:
      goalDataGapSets.length === 0
        ? scopeDataGaps(
            normalized.dataGaps,
            // Không mục tiêu nào: chỉ thang đo chung được dựng (trên thẻ chọn
            // được) — `walletEarnCoverage` của thẻ đang giữ chạy theo mục tiêu,
            // nên không có thẻ đang giữ nào ở đây.
            buildReadSet({
              universe: normalized.universe,
              declined,
              scored: selectable.map((row) => row.product),
              held: [],
              goalReadsEarn: true,
              spendKnown: state.spend != null,
              feeToleranceKnown,
              valuedBalancePrograms,
              awardStrategies: [],
            }),
          )
        : normalized.dataGaps.filter((gap) => goalDataGapSets.some((set) => set.includes(gap))),
    userGaps: normalized.userGaps,
    derived: {
      universe: normalized.universe.map((product) => product.id),
      excluded: excludedProducts(normalized.universeExclusions, facts),
      portfolio: snapshotPortfolio(portfolio),
      medianFeeCents,
      climate: { ...climate },
      scale: { ...scale },
      candidates: facts.map((row) =>
snapshotFacts(row, selectableIds.has(row.product.id as string)),
      ),
      goals: goalTraces,
      followUpProbes,
    },
  };
}

/**
 * Chạy engine với lịch sử offer nạp sẵn từ nguồn dữ liệu.
 *
 * Tách khỏi `recommend` để hàm kia THUẦN và đồng bộ: test dựng được một lượt
 * chạy đầy đủ mà không cần I/O, và §20 (dựng lại một lượt chạy cũ từ bản chụp)
 * không phải đi qua một lớp bất đồng bộ để làm việc đó.
 */
export async function recommendFromSource(
  source: RecommendationDataSource,
  state: UserState,
  data: RecommendationDataset,
  ix: DatasetIndex,
  asOf: string,
  knownAt?: string,
): Promise<RecommendationRun> {
  return recommend({ state, data, ix, asOf, offerHistory: await loadOfferHistory(source, data, asOf, knownAt) });
}

/**
 * Lịch sử offer của MỌI sản phẩm trong bộ dữ liệu, cắt đúng ngày chạy.
 *
 * Mọi sản phẩm, không chỉ tập ứng viên: engine chỉ ĐỌC lịch sử của tập ứng
 * viên, nhưng bản ghi §20 phải chạy lại được cả những lượt "nếu như" — người
 * dùng thôi giữ một thẻ, đổi nước ở — mà tập ứng viên của chúng khác. Chỉ lưu
 * lịch sử của tập cũ thì thẻ mới vào tập nhận lịch sử RỖNG trong phép thử,
 * và percentile của nó sai theo đúng cách mà bản ghi sinh ra để tránh.
 */
export async function loadOfferHistory(
  source: RecommendationDataSource,
  data: RecommendationDataset,
  asOf: string,
  knownAt?: string,
): Promise<Map<string, OfferHistoryPoint[]>> {
  const query = knownAt === undefined ? { asOf } : { asOf, knownAt };
  const entries = await Promise.all(
    [...data.products]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map(async (product) => [product.id as string, await source.getOfferHistory(product.id, query)] as const),
  );
  return new Map(entries);
}
