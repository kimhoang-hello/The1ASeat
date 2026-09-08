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
import { applyRules } from "./rules.ts";
import { buildNoNewCardCandidate, finalScore, rankCandidates } from "./rank.ts";
import { computeConfidence } from "./confidence.ts";
import { mergeReasonCodes, mergeWarnings, nextQuestion } from "./explain.ts";
import type { DatasetIndex } from "./indexes.ts";
import type {
  AwardStrategy,
  BenefitId,
  Product,
  RecommendationDataset,
} from "./types.ts";
import type { UserState } from "./user-types.ts";
import type { RecommendationDataSource } from "./source.ts";
import type { OfferHistoryPoint } from "./offer-history.ts";
import type { CandidateFacts, ScoringContext } from "./scoring/context.ts";
import type {
  Candidate,
  GoalContext,
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
export const ENGINE_VERSION = "3.4.0";

export interface RecommendInput {
  state: UserState;
  data: RecommendationDataset;
  ix: DatasetIndex;
  asOf: string;
  /** Lịch sử offer theo `productId`. Rỗng thì §12 trả `null`, không trả 0. */
  offerHistory?: ReadonlyMap<string, OfferHistoryPoint[]>;
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
): Candidate[] {
  const seen = new Set<string>();
  // Gieo sẵn họ của những thẻ ĐÃ hiện ra — trước hết là thẻ thắng cuộc. Bỏ
  // bước này thì phép gom chỉ chặn trùng lặp GIỮA các gợi ý thay thế, còn
  // hạng thứ hai của chính thẻ đứng đầu vẫn đứng ngay dưới nó.
  for (const candidate of alreadyShown) {
    const product = candidate.productId === null ? undefined : ix.productById.get(candidate.productId);
    if (product?.familyId != null) seen.add(product.familyId as string);
  }
  const kept: Candidate[] = [];
  for (const candidate of candidates) {
    const product = candidate.productId === null ? undefined : ix.productById.get(candidate.productId);
    const family = product?.familyId ?? null;
    if (family !== null) {
      if (seen.has(family as string)) continue;
      seen.add(family as string);
    }
    kept.push(candidate);
  }
  return kept;
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

/**
 * Ngày kiểm lại cũ nhất trong các bản ghi lượt chạy này dựa vào (§29 độ tươi).
 *
 * Phải quét MỌI loại bản ghi thứ hạng phụ thuộc vào, không chỉ offer và phí.
 * Định giá điểm nhân vào mọi điểm số, tỷ lệ tích điểm quyết định `earn_fit`,
 * chặng chuyển quyết định điểm tiếp cận được, award strategy quyết định số
 * điểm chuyến đi cần. Chỉ nhìn offer thì một bộ định giá cũ hai năm vẫn cho
 * `dataFreshness = 1`, và độ tin cậy "cao" được cấp cho một khuyến nghị dựng
 * trên số cũ.
 */
function oldestVerifiedAt(
  products: readonly Product[],
  data: RecommendationDataset,
  ix: DatasetIndex,
  asOf: string,
  goalStrategies: readonly AwardStrategy[],
): string | null {
  let oldest: string | null = null;
  const consider = (day: string | undefined) => {
    if (day === undefined) return;
    if (oldest === null || day < oldest) oldest = day;
  };
  for (const product of products) {
    for (const row of activeAt(ix.offersByProduct.get(product.id) ?? [], asOf)) consider(row.verifiedAt);
    for (const row of activeAt(ix.feesByProduct.get(product.id) ?? [], asOf)) consider(row.verifiedAt);
    for (const row of activeAt(ix.ratesByProduct.get(product.id) ?? [], asOf)) consider(row.verifiedAt);
    for (const row of activeAt(ix.benefitsByProduct.get(product.id) ?? [], asOf)) consider(row.verifiedAt);
    for (const row of activeAt(ix.rulesByProduct.get(product.id) ?? [], asOf)) consider(row.verifiedAt);
  }
  for (const row of activeAt(data.programValuations, asOf)) consider(row.verifiedAt);
  for (const row of activeAt(data.transferPaths, asOf)) consider(row.verifiedAt);
  // Award strategy CHỈ của chặng đang hỏi. Quét cả bảng thì một chiến lược cũ
  // cho một vùng chẳng liên quan cũng kéo `dataFreshness` xuống, và một khuyến
  // nghị hoàn toàn tươi bị hạ độ tin cậy vì dữ liệu nó không hề đọc.
  for (const strategy of goalStrategies) consider(strategy.verifiedAt);
  return oldest;
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

  const results: Recommendation[] = normalized.goals.map((goal) => {
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

    const confidence = computeConfidence({
      ranked,
      goal,
      userGaps: normalized.userGaps,
      dataGaps: normalized.dataGaps,
      oldestVerifiedAt: oldestVerifiedAt(
        normalized.universe,
        data,
        ix,
        asOf,
        goal.tripNeed?.strategies ?? [],
      ),
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

    return {
      goalId: goal.goal.id,
      goalType: goal.goal.type,
      strategy: strategies[0] ?? { strategy: "OPEN_CARD", score: 0, reasonCodes: [] },
      strategies,
      primaryAction: winner,
      // Chỉ các thẻ, và `NO_NEW_CARD` luôn có chỗ riêng ở `noAction` — kể cả
      // khi nó đang đứng đầu. Trộn nó vào `alternatives` là để nó biến mất
      // khỏi đầu ra đúng lúc nó thắng.
      alternatives: bestPerFamily(
        ranked.filter((row) => row !== winner && row.kind === "open_card"),
        ix,
        [winner],
      ).slice(0, 4),
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
        confidence.level === "low" && ranked.length > 1
          ? (["SCORES_NEARLY_TIED"] as ReasonCode[])
          : [],
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
        directPoints:
          need === null || need.programs.length === 0
            ? null
            : need.programs.reduce<number | null>((best, programId) => {
                const entry = portfolio.direct.get(programId);
                if (entry?.kind !== "known") return best;
                return best === null ? entry.points : Math.max(best, entry.points);
              }, null),
        accessiblePoints: accessible,
        accessiblePointsIsLowerBound: covered?.accessibleIsLowerBound ?? false,
        // Khoảng cách chỉ nói được khi số điểm là con số CHẮC CHẮN. Có một số
        // dư `null` góp vào thì `accessible` là cận dưới, và "còn thiếu
        // 140,000" dựng trên một cận dưới là một con số chính xác giả.
        pointsGapTypical:
          bestRow?.typical == null || accessible === null || covered?.accessibleIsLowerBound === true
            ? null
            : Math.max(0, bestRow.typical - accessible),
        topEcosystemShare: topEcosystemShare(portfolio),
        flexibilityScore: portfolio.flexibilityScore,
      },
      confidence,
    };
  });

  return {
    engineVersion: ENGINE_VERSION,
    asOf,
    goalResolution: normalized.goalResolution,
    results,
    followUp: nextQuestion({
      gaps: normalized.userGaps,
      ranked:
        results[0]?.primaryAction === undefined
          ? []
          : [results[0].primaryAction, ...results[0].alternatives],
      // Câu hỏi "có xét thẻ doanh nghiệp không" chỉ đáng hỏi khi một thẻ
      // DOANH NGHIỆP đang thật sự trong bảng. Suy nó từ mã `ELIGIBILITY_UNCERTAIN`
      // là suy sai cả hai chiều: hỏi khi một thẻ thường có thu nhập chưa rõ,
      // và KHÔNG hỏi khi một thẻ doanh nghiệp đủ điều kiện đang đứng đầu.
      businessProductIds: new Set(
        normalized.universe
          .filter((product) => product.personalOrBusiness === "business")
          .map((product) => product.id as string),
      ),
    }),
    reasonCodes: mergeReasonCodes(runReasons),
    warnings: mergeWarnings(runWarnings),
    dataGaps: normalized.dataGaps,
    userGaps: normalized.userGaps,
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
): Promise<RecommendationRun> {
  const universe = normalize(state, data, ix, asOf).universe;
  const entries = await Promise.all(
    universe.map(
      async (product) => [product.id as string, await source.getOfferHistory(product.id)] as const,
    ),
  );
  return recommend({ state, data, ix, asOf, offerHistory: new Map(entries) });
}
