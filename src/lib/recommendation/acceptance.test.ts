/**
 * §32 — bộ test bắt buộc, Test A tới Test J, mỗi test một khối.
 *
 * Phase 3 đã có phần lớn các phép kiểm này rải theo từng luật (§16, §14, §6…).
 * File này gom lại theo ĐÚNG câu chữ "Expected" của spec, để câu hỏi "Test A–J
 * có tồn tại và xanh không" (tiêu chí nghiệm thu Phase 4) trả lời được bằng
 * một lệnh, và để mỗi kỳ vọng mơ hồ của spec ("competitive", "strongly
 * penalized", "explainable") được viết ra thành một con số có thể đỏ.
 *
 * Chỗ nào kỳ vọng nói "giải thích được", bài test dùng CHÍNH debugger Phase 4
 * để giải thích — nếu debugger không chỉ ra được lý do thì kỳ vọng đó trượt.
 *
 * KHÔNG import `./index.ts` — xem đầu `engine.test.ts`.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { offlineDataset } from "./data/index.ts";
import { datasetAt } from "./temporal.ts";
import { executeRun, type RecommendationRunRecord } from "./runs.ts";
import { candidateKey, explainChange } from "./run-diff.ts";
import { compareCandidates, explainProduct, findRanked } from "./debug.ts";
import { renderRunReport } from "./debug-render.ts";
import { STRATEGY_TYPES } from "./reason-codes.ts";
import { productIdFor } from "./data/products.ts";
import {
  aeroplanHeavy,
  beginnerNoCards,
  duplicateBagBenefit,
  flexiblePointsSufficient,
  japanTripFunded,
  japanTripShortfall,
  lowSpendCapacity,
  nearlyEmpty,
  vietnamTripFunded,
  vietnamTripShortfall,
} from "./data/user-fixtures.ts";
import type { OfferHistoryPoint } from "./offer-history.ts";
import type { RecommendationDataset } from "./types.ts";
import type { UserState } from "./user-types.ts";
import type { Candidate } from "./engine-types.ts";

const ASOF = "2026-09-08";
const DATA = datasetAt(offlineDataset(), ASOF);

function execute(
  state: UserState,
  extra: { data?: RecommendationDataset; offerHistory?: Map<string, OfferHistoryPoint[]> } = {},
) {
  return executeRun(
    { state, data: extra.data ?? DATA, asOf: ASOF, offerHistory: extra.offerHistory },
    { id: "run_acceptance", createdAt: "2026-09-12T00:00:00.000Z" },
  );
}

const ranking = (record: RecommendationRunRecord, goal = 0) => record.derivedState.goals[goal].ranking;
const winner = (record: RecommendationRunRecord) => record.outputSnapshot.results[0].primaryAction;
const facts = (record: RecommendationRunRecord, productId: string | null) =>
  record.derivedState.candidates.find((row) => row.productId === productId);

/** Phí hằng năm từ mức này trở lên là thẻ CAO CẤP ở Canada ($399 Avion® Privilege … $799 Platinum). */
const PREMIUM_FEE = 399;

/* ------------------------------------------------------------------ */

test("Test A — người mới: thẻ khởi đầu mạnh, KHÔNG nghiêng về thẻ cao cấp", () => {
  const { record } = execute(beginnerNoCards);
  const result = record.outputSnapshot.results[0];
  const top = result.primaryAction;
  assert.equal(top.kind, "open_card", "người chưa có gì phải được khuyên một thẻ");
  // "simple": năm đầu không vượt ngưỡng phí người dùng khai ($120).
  assert.ok(top.suitability!.firstYearFee! <= beginnerNoCards.profile.annualFeeTolerancePerCard!);
  // "no premium-card bias": không thẻ cao cấp nào trong những gì hiện ra.
  for (const candidate of [top, ...result.alternatives]) {
    assert.ok(
      (candidate.suitability?.ongoingFee ?? 0) < PREMIUM_FEE,
      `${candidate.productSlug} phí $${candidate.suitability?.ongoingFee} hiện ra cho người mới`,
    );
  }
  // "strong": offer thật, không phải thẻ không có welcome bonus.
  assert.ok((facts(record, top.productId)?.offer.headlineBonus ?? 0) > 0);
  assert.equal(result.strategy.strategy, "BUILD_POINTS");
});

test("Test B — dồn vào Aeroplan®: đa dạng hoá được thưởng, thẻ Aeroplan® thứ ba bị phạt nặng", () => {
  const { record } = execute(aeroplanHeavy);
  const result = record.outputSnapshot.results[0];
  const top = result.primaryAction;
  const aeroplanEarner = (c: Candidate) =>
    (facts(record, c.productId)?.earn.programs as string[] | undefined)?.includes("aeroplan") ?? false;

  // "diversification rewarded": người thắng KHÔNG kiếm Aeroplan®, và danh mục
  // bị gọi tên là tập trung.
  assert.ok(!aeroplanEarner(top), `${top.productSlug} là thẻ Aeroplan® thứ ba`);
  assert.ok(result.reasonCodes.includes("PORTFOLIO_CONCENTRATED"));
  assert.ok((result.strategies.find((s) => s.strategy === "DIVERSIFY")?.score ?? 0) >= 0.5);

  // "third Aeroplan card strongly penalized": mọi thẻ đồng thương hiệu
  // Aeroplan® ăn TRỌN hình phạt Rule 3 (không chia cho đích khác), nặng gấp
  // năm lần một đồng tiền linh hoạt chỉ một phần đổ về Aeroplan®, và không
  // thẻ nào lọt vào những gì hiện ra.
  const rows = ranking(record).filter((row) => row.candidate.kind === "open_card");
  const r3 = (c: Candidate) => c.adjustments.find((a) => a.rule === "R3_portfolio_concentration")?.delta ?? 0;
  const cobrand = rows.filter((row) => aeroplanEarner(row.candidate));
  assert.ok(cobrand.length >= 5, "cần đủ thẻ Aeroplan® để bài này có nghĩa");
  const flexible = rows.find((row) => !aeroplanEarner(row.candidate) && r3(row.candidate) < 0)!;
  for (const row of cobrand) {
    assert.ok(r3(row.candidate) <= 5 * r3(flexible.candidate) + 1e-12, `${row.candidate.productSlug} không bị phạt trọn`);
    assert.ok(row.visibility !== "primary" && row.visibility !== "alternative", `${row.candidate.productSlug} vẫn hiện ra`);
  }
});

test("Test C — chuyến Nhật, ĐỦ điểm: NO_NEW_CARD thắng, và lời khuyên là đi tìm chỗ ngồi", () => {
  const { record } = execute(japanTripFunded);
  const result = record.outputSnapshot.results[0];
  // "NO_NEW_CARD competitive or winner" — ở đây là THẮNG.
  assert.equal(result.primaryAction.kind, "no_new_card");
  // "focus on availability".
  assert.ok(result.reasonCodes.includes("FOCUS_ON_AWARD_AVAILABILITY"));
  assert.ok((result.strategies.find((s) => s.strategy === "FOCUS_ON_AVAILABILITY")?.score ?? 0) >= 0.5);
  assert.equal(result.strategy.strategy, "USE_EXISTING_POINTS");

  // Và lý do truy được — chính lỗi debugger bới ra ở Phase 4: một khoảng thiếu
  // 5,000 điểm trên chuyến 205,000 KHÔNG được lấp "trọn" bởi mọi thẻ.
  const bestCard = ranking(record).find((row) => row.candidate.kind === "open_card")!.candidate;
  const gap = bestCard.components.find((c) => c.key === "points_gap_reduction")!;
  assert.ok(gap.raw < 0.1, `points_gap_reduction ${gap.raw} cho một khoảng cách 2% chuyến đi`);
});

test("Test C — gần đủ điểm KHÔNG gãy bậc: phần thưởng thu hẹp khoảng cách đi về 0 liền mạch", () => {
  // Quét số dư qua mép đủ điểm. Bản trước nhảy từ 1.0 xuống 0 ở đúng mép.
  let previous = Infinity;
  for (const balance of [120_000, 160_000, 190_000, 200_000, 204_000, 205_000, 230_000]) {
    const state = structuredClone(japanTripFunded);
    state.balances = state.balances.map((row) => ({ ...row, balance }));
    const { record } = execute(state);
    const card = ranking(record).find((row) => row.candidate.productSlug === "td-aeroplan-visa-infinite")!;
    const raw = card.candidate.components.find((c) => c.key === "points_gap_reduction")!.raw;
    assert.ok(raw <= previous + 1e-12, `tăng lên ở ${balance}`);
    if (balance >= 204_000) assert.ok(raw < 0.01, `${balance}: ${raw}`);
    previous = raw;
  }
});

test("Test D — chuyến Nhật, THIẾU nhiều: chiến lược tích điểm, và welcome bonus mạnh, ĐÚNG đồng tiền", () => {
  const { record } = execute(japanTripShortfall);
  const result = record.outputSnapshot.results[0];
  const top = result.primaryAction;
  assert.equal(top.kind, "open_card");
  assert.ok(
    ["BUILD_POINTS", "EARN_FLEXIBLE_POINTS", "EARN_SPECIFIC_CURRENCY"].includes(result.strategy.strategy),
    `chiến lược ${result.strategy.strategy} không phải tích điểm`,
  );
  // "relevant": đồng tiền của người thắng đặt được (hoặc chuyển được sang
  // chương trình đặt được) chặng này.
  const utility = top.components.find((c) => c.key === "trip_currency_utility")!;
  assert.ok(utility.raw >= 0.85, `trip_currency_utility ${utility.raw}`);
  // "strong welcome bonus": bonus quy về chương trình đặt vé thuộc nhóm đầu
  // của cả bảng.
  const gaps = ranking(record)
    .filter((row) => row.candidate.kind === "open_card")
    .map((row) => row.candidate.components.find((c) => c.key === "points_gap_reduction")!.raw)
    .sort((a, b) => b - a);
  const mine = top.components.find((c) => c.key === "points_gap_reduction")!.raw;
  assert.ok(mine >= gaps[Math.floor(gaps.length / 4)], "bonus của người thắng không nằm trong nhóm 25% đầu");
  assert.ok(result.noAction.score < top.score - 0.2, "NO_NEW_CARD không được sát nút khi còn thiếu nhiều");
});

test("Test E — mốc chi KHÔNG với tới: thẻ đòi $10,000 không đứng đầu, nhưng vẫn là ứng viên", () => {
  const { record } = execute(lowSpendCapacity);
  const capacity = lowSpendCapacity.spend!.minimumSpendCapacity3m!.high!;
  const rows = ranking(record).filter((row) => row.candidate.kind === "open_card");
  const impossible = rows.filter(
    (row) => (facts(record, row.candidate.productId)?.offer.fullRequiredPerNinetyDays ?? 0) >= 3 * capacity,
  );
  assert.ok(impossible.length > 0, "cần một thẻ đòi ≥ 3 lần sức dồn để bài này có nghĩa");
  for (const row of impossible) {
    assert.notEqual(row.rank, 1);
    // §13: phạt nặng + cảnh báo, KHÔNG loại.
    assert.ok(row.candidate.adjustments.some((a) => a.rule === "R4_minimum_spend_pressure"));
    assert.ok(row.candidate.warnings.includes("SPEND_REQUIREMENT_LIKELY_UNSUITABLE"));
  }
  // Và người thắng thì với tới được.
  const top = winner(record);
  assert.ok((top.suitability?.minSpendFit ?? 1) >= 0.5);
});

test("Test F — thẻ không phù hợp mà có affiliate: thứ hạng KHÔNG đổi một chữ số", () => {
  const base = execute(aeroplanHeavy).record;
  // Thẻ bị phạt phù hợp nặng nhất — đúng loại thẻ một trang affiliate muốn đẩy.
  const unsuitable = [...ranking(base)]
    .filter((row) => row.candidate.adjustments.some((a) => a.layer === "suitability"))
    .sort((a, b) => b.rank - a.rank)[0].candidate;
  for (const flagAll of [false, true]) {
    const data: RecommendationDataset = {
      ...DATA,
      products: DATA.products.map((p) => ({
        ...p,
        affiliateAvailable: p.id === unsuitable.productId ? true : flagAll,
      })),
    };
    const flipped = execute(aeroplanHeavy, { data }).record;
    assert.notEqual(flipped.inputSnapshot.datasetFingerprint, base.inputSnapshot.datasetFingerprint, "dữ liệu phải thật sự khác");
    // Không chỉ người thắng: TOÀN BỘ đầu ra và derived state.
    assert.deepEqual(flipped.outputSnapshot, base.outputSnapshot);
    assert.deepEqual(flipped.derivedState, base.derivedState);
  }
});

test("Test G — quyền lợi trùng: miễn hành lý thứ hai (cùng hãng) gần như không có giá trị tăng thêm", () => {
  const { record } = execute(duplicateBagBenefit);
  const bag = "free-checked-bag|Air Canada®";
  const sameBag = record.derivedState.candidates.filter((row) =>
    row.benefits.duplicatedKeys.includes(bag),
  );
  assert.ok(sameBag.length >= 3, "cần vài thẻ cùng miễn hành lý Air Canada® để bài này có nghĩa");
  for (const row of sameBag) {
    // Quyền lợi trùng bị TRỪ khỏi phần tăng thêm, không chỉ được đếm.
    assert.equal(row.benefits.incrementalCount, row.benefits.totalCount - row.benefits.duplicatedCount);
    assert.ok(row.benefits.reasonCodes.includes("EXISTING_BENEFIT_DUPLICATION"));
  }
  // Phản chứng: CÙNG hồ sơ nhưng không giữ thẻ TD® — miễn hành lý thành giá
  // trị mới, nên phần tăng thêm của đúng những thẻ đó tăng lên.
  const without = execute({ ...duplicateBagBenefit, cards: [] }).record;
  for (const row of sameBag) {
    const fresh = facts(without, row.productId)!;
    assert.ok(!fresh.benefits.duplicatedKeys.includes(bag));
    assert.ok(fresh.benefits.incrementalCount > row.benefits.incrementalCount, row.productSlug);
  }
  // Và CÙNG quyền lợi của HÃNG KHÁC không bị coi là trùng (§16 Rule 6).
  const united = facts(record, productIdFor("united-mileageplus-neo-world-elite-mastercard") as string);
  if (united !== undefined) assert.ok(!united.benefits.duplicatedKeys.some((key) => key.startsWith("free-checked-bag|")));
});

test("Test H — đủ điểm LINH HOẠT: không khuyên chuyển điểm sớm", () => {
  // Bản nhân vật trong fixture bay châu Âu — chặng CHƯA có giá, nên "đủ" không
  // đo được. Engine phải nói ra điều đó, không kết luận đủ bằng phỏng đoán.
  const unpriced = execute(flexiblePointsSufficient).record.outputSnapshot.results[0];
  assert.ok(!unpriced.reasonCodes.includes("POINTS_ALREADY_SUFFICIENT"));
  assert.ok(unpriced.strategies.some((s) => s.reasonCodes.includes("TRIP_ROUTE_NOT_PRICED")));
  assert.notEqual(unpriced.confidence.level, "high");

  // Cùng tình huống trên chặng CÓ giá: 300,000 Membership Rewards®, Nhật
  // business, chưa có ngày đi.
  const state = structuredClone(japanTripFunded);
  state.balances = state.balances.map((row) => ({ ...row, balance: 300_000 }));
  const { record } = execute(state);
  const result = record.outputSnapshot.results[0];
  assert.equal(result.primaryAction.kind, "no_new_card");
  assert.ok(result.reasonCodes.includes("POINTS_ALREADY_SUFFICIENT"));
  // "Do not prematurely recommend a transfer": engine KHÔNG có hành động
  // chuyển điểm nào để khuyên — và lời khuyên đứng đầu là giữ điểm, đi tìm
  // chỗ ngồi.
  assert.ok(!STRATEGY_TYPES.some((type) => type.includes("TRANSFER")));
  assert.ok(["USE_EXISTING_POINTS", "FOCUS_ON_AVAILABILITY"].includes(result.strategy.strategy));
  assert.ok(result.warnings.includes("POINTS_EXPIRY_NOT_MODELLED"));

  // §16 Rule 2: chưa định đặt NGAY thì đồng tiền linh hoạt được thưởng vì giữ
  // lựa chọn; đã có ngày và không linh hoạt thì phần thưởng đó biến mất.
  const r2 = (r: RecommendationRunRecord) =>
    ranking(r).filter((row) => row.candidate.adjustments.some((a) => a.rule === "R2_keep_points_flexible")).length;
  assert.ok(r2(record) > 0);
  const bookNow = structuredClone(state);
  bookNow.goals = bookNow.goals.map((goal) =>
    goal.type === "trip" ? { ...goal, travelStart: "2026-11-01", travelEnd: "2026-11-15", flexibility: "low" } : goal,
  );
  assert.equal(r2(execute(bookNow).record), 0);
});

/** Nhật ký offer tổng hợp: mức cuối là mức hiện tại. */
function history(headline: number, relative: number[]): OfferHistoryPoint[] {
  return relative.map((factor, i) => ({
    at: `2026-0${i + 1}-01`,
    until: i === relative.length - 1 ? null : `2026-0${i + 2}-01`,
    startCensored: i === 0,
    endCensored: i === relative.length - 1,
    label: String(Math.round(headline * factor)),
    amount: Math.round(headline * factor),
    unit: "points" as const,
  }));
}

test("Test I — offer đổi từ YẾU sang GẦN ĐỈNH lịch sử: thứ hạng đổi, và vì một lý do truy được", () => {
  // Cùng hồ sơ; chỉ lịch sử offer của thẻ A khác. A = hạng nhì của người mới.
  const base = execute(beginnerNoCards).record;
  const cardA = ranking(base)[1].candidate;
  const headline = facts(base, cardA.productId)!.offer.headlineBonus!;
  const id = cardA.productId as string;
  // Bốn đợt: mức hiện tại là thấp nhất (percentile 25 ≤ 30 = YẾU) hoặc cao
  // nhất (100). Ba đợt thì "thấp nhất" là 33 — chưa tới ngưỡng yếu của §12.
  const weak = execute(beginnerNoCards, { offerHistory: new Map([[id, history(headline, [1.6, 1.4, 1.2, 1])]]) });
  const strong = execute(beginnerNoCards, { offerHistory: new Map([[id, history(headline, [0.5, 0.7, 0.85, 1])]]) });
  const at = (r: RecommendationRunRecord) => ranking(r).find((row) => row.candidate.productId === id)!;

  assert.ok(facts(weak.record, id)!.offer.reasonCodes.includes("CURRENT_OFFER_WEAK"));
  assert.ok(facts(strong.record, id)!.offer.reasonCodes.includes("CURRENT_OFFER_STRONG"));
  assert.ok(at(strong.record).candidate.score > at(weak.record).candidate.score);
  assert.ok(at(strong.record).rank < at(weak.record).rank, "thứ hạng phải đổi theo offer");

  // "for an explainable reason": debugger quy thay đổi về ĐÚNG yếu tố và đúng
  // thành phần — không ai phải đoán.
  const change = explainChange(weak.record, strong.record, { before: weak.dataset, after: strong.dataset });
  const swaps = new Map(change.swaps!.map((row) => [row.factor, row]));
  assert.equal(swaps.get("user_input")!.differs, false);
  assert.equal(swaps.get("source_data")!.differs, false);
  assert.equal(swaps.get("offer_history")!.differs, true);
  assert.equal(swaps.get("offer_history")!.firstDivergence, "candidate_facts");
  assert.equal(swaps.get("offer_history")!.winnerAlone, change.winner.after);
  const why = compareCandidates(at(strong.record).candidate, at(weak.record).candidate);
  assert.equal(why.lines[0].key, "offer_quality", "thành phần đổi nhiều nhất phải là chất lượng offer");
});

test("Test J — thiếu dữ liệu, hai thẻ gần hoà: độ tin cậy THẤP, và câu hỏi tiếp theo ĐỔI ĐƯỢC kết quả", () => {
  for (const state of [beginnerNoCards, nearlyEmpty]) {
    const { record, dataset } = execute(state);
    const rows = ranking(record);
    const gap = rows[0].candidate.score - rows[1].candidate.score;
    assert.ok(gap < 0.05, `${state.profile.id}: hai thẻ đầu cách ${gap} — không phải ca gần hoà`);
    assert.equal(record.outputSnapshot.results[0].confidence.level, "low");

    const followUp = record.outputSnapshot.followUp;
    assert.ok(followUp !== null, "phải có câu hỏi tiếp theo");
    // "highest-value": §30 đã đo từng câu bằng câu trả lời thử, và câu được
    // chọn phải đổi được người thắng NHIỀU NHẤT trong số các câu đo được.
    const probes = record.derivedState.followUpProbes;
    const chosen = probes.find((p) => p.gapKind === followUp.gapKind && p.subject === followUp.subject);
    assert.ok(chosen !== undefined && chosen.flips > 0, `${state.profile.id}: câu ${followUp.gapKind} không đổi được gì`);
    const best = Math.max(...probes.map((p) => p.flips / p.valid));
    assert.equal(chosen.flips / chosen.valid, best);
    // Không câu trả lời thử nào được tính mà làm hồ sơ mâu thuẫn với chính nó.
    for (const probe of probes) {
      for (const outcome of probe.outcomes) if (outcome.invalid) assert.equal(outcome.flipsWinner, false);
    }

    // Và phép đo đó là THẬT: trả lời đúng câu đã chọn bằng câu trả lời thử
    // làm lật kết quả, chạy lại, người thắng đổi.
    const flip = chosen.outcomes.find((o) => o.flipsWinner)!;
    assert.notEqual(flip.winner, candidateKey(winner(record)) === "NO_NEW_CARD" ? "NO_NEW_CARD" : winner(record).productId);
    void dataset;
  }
});

test("Test J — câu hỏi về một chặng CHƯA có giá không được chọn khi có câu đổi được kết quả", () => {
  // Ca thật debugger bắt được: hỏi "khứ hồi hay một chiều" cho chuyến châu Âu,
  // trong khi chặng đó chưa có bảng giá nào — trả lời thế nào cũng không tính
  // được. Bảng ưu tiên tĩnh xếp câu đó thứ 5; phép đo xếp nó xuống cuối.
  const { record } = execute(flexiblePointsSufficient);
  const probes = record.derivedState.followUpProbes;
  const roundTrip = probes.find((p) => p.gapKind === "trip_round_trip_unknown");
  assert.ok(roundTrip !== undefined && roundTrip.flips === 0);
  if (probes.some((p) => p.flips > 0)) {
    assert.notEqual(record.outputSnapshot.followUp?.gapKind, "trip_round_trip_unknown");
  }
  // Và debugger giải thích được người thắng hiện tại đứng đó vì đâu.
  const top = explainProduct(record, candidateKey(winner(record)));
  assert.equal(top.outcome, "primary");
});

test("§30 — câu trả lời thử làm hồ sơ MÂU THUẪN thì bị loại, không được tính là lật kết quả", () => {
  // Vòng Codex 2: các hạng mục của người mới đã cộng đủ $2,000 tổng tháng, nên
  // "$1,200/tháng cho một hạng mục nữa" là một hồ sơ không thể có — và bản
  // trước vẫn đếm nó là lật người thắng.
  const { record } = execute(beginnerNoCards);
  const category = record.derivedState.followUpProbes.filter((p) => p.gapKind === "spend_category_unknown");
  assert.ok(category.length > 0);
  for (const probe of category) {
    const big = probe.outcomes.find((o) => o.label.endsWith("$1,200/tháng"))!;
    assert.equal(big.invalid, true, `${probe.subject}: $1,200 vượt tổng tháng mà không bị loại`);
    assert.equal(big.flipsWinner, false);
    const zero = probe.outcomes.find((o) => o.label.endsWith("$0/tháng"))!;
    assert.equal(zero.invalid, false, "$0 là câu trả lời hợp lệ");
  }
  assert.notEqual(record.outputSnapshot.followUp?.gapKind, "spend_category_unknown");
});

/* ================================================================== *
 * Vòng Codex 3
 * ================================================================== */

test("số dư CHƯA BIẾT không được chấm như số dư 0 — ở quyết định, không chỉ ở trình bày", () => {
  const withBalance = (balance: number | null) => {
    const state = structuredClone(japanTripFunded);
    state.balances = state.balances.map((row) => ({ ...row, balance }));
    return execute(state).record;
  };
  const unknown = withBalance(null);
  const zero = withBalance(0);
  const strategy = (r: RecommendationRunRecord, type: string) =>
    r.outputSnapshot.results[0].strategies.find((s) => s.strategy === type)!;
  // 0 điểm: thiếu thật, xây từ đầu.
  assert.equal(strategy(zero, "BUILD_POINTS").score, 1);
  // Chưa biết: KHÔNG phải thiếu 100% — điểm giữa của [0, 1] — và nói ra vì sao.
  const cover = unknown.derivedState.goals[0].tripCoverage!;
  assert.equal(cover.coverageKnown, false);
  assert.equal(cover.coverageLowerBound, 0);
  assert.equal(cover.coverage, 0.5);
  assert.equal(strategy(unknown, "BUILD_POINTS").score, 0.5);
  assert.ok(strategy(unknown, "USE_EXISTING_POINTS").reasonCodes.includes("POINTS_COVERAGE_UNKNOWN"));
  assert.ok(!unknown.outputSnapshot.results[0].reasonCodes.includes("POINTS_ALREADY_SUFFICIENT"));
  // Thẻ được thưởng "lấp khoảng cách" ÍT hơn hẳn so với người có 0 điểm.
  const gapOf = (r: RecommendationRunRecord) =>
    ranking(r).find((row) => row.candidate.productSlug === "td-aeroplan-visa-infinite")!
      .candidate.components.find((c) => c.key === "points_gap_reduction")!.raw;
  assert.ok(gapOf(unknown) < gapOf(zero));
  // Và câu hỏi tiếp theo là CHÍNH số dư đó — nó lật được người thắng.
  assert.equal(unknown.outputSnapshot.followUp?.gapKind, "point_balance_amount_unknown");
});

test("thêm một số dư CHƯA BIẾT không được làm yếu đi thứ đã đủ (vòng Codex 4)", () => {
  // 170,000 Aeroplan® đúng bằng giá điển hình chuyến Nhật. Thêm một tài khoản
  // AAdvantage® không nhớ số dư chỉ có thể làm người này GIÀU hơn — bản vá
  // hỏng của vòng 3 lại làm NO_NEW_CARD tụt 0.598 → 0.392 và khuyên mở thẻ.
  const base = structuredClone(japanTripFunded);
  base.balances = [{ ...base.balances[0], programId: "aeroplan" as never, balance: 170_000 }];
  const plus = structuredClone(base);
  plus.balances = [...plus.balances, { ...plus.balances[0], programId: "aadvantage" as never, balance: null }];
  const a = execute(base).record;
  const b = execute(plus).record;
  const noAction = (r: RecommendationRunRecord) => r.outputSnapshot.results[0].noAction.score;
  assert.ok(noAction(b) >= noAction(a) - 1e-9, `${noAction(a)} → ${noAction(b)}`);
  assert.equal(candidateKey(winner(b)), candidateKey(winner(a)));
  const focus = (r: RecommendationRunRecord) =>
    r.outputSnapshot.results[0].strategies.find((s) => s.strategy === "FOCUS_ON_AVAILABILITY")!.score;
  assert.ok(focus(b) > 0);
});

test("FOCUS_ON_AVAILABILITY đo giá điển hình trên TỪNG chương trình, không trên chương trình phủ tốt nhất", () => {
  // 100,000 AAdvantage® phủ 83% cận trên; 170,000 Aeroplan® đã đúng bằng giá
  // điển hình của chính nó. Chọn chung một `bestProgram` thì Aeroplan® bị
  // bỏ qua và lời khuyên "đi tìm chỗ ngồi" biến mất.
  const state = structuredClone(japanTripFunded);
  state.balances = [
    { ...state.balances[0], programId: "aadvantage" as never, balance: 100_000 },
    { ...state.balances[0], programId: "aeroplan" as never, balance: 170_000 },
  ];
  const { record } = execute(state);
  const need = record.derivedState.goals[0].goal.tripNeed!;
  const aeroplan = need.byProgram.find((row) => row.programId === "aeroplan")!;
  assert.equal(aeroplan.typical, 170_000, "bài này dựa trên giá điển hình Aeroplan® 170,000");
  const focus = record.outputSnapshot.results[0].strategies.find((s) => s.strategy === "FOCUS_ON_AVAILABILITY")!;
  assert.ok(focus.score > 0);
});

test("người CHƯA có điểm nào: thẻ Aeroplan® không mất điểm thu hẹp khoảng cách vì 'aa' đứng trước 'ae'", () => {
  // Mọi chương trình cùng phủ 0% ⇒ `bestProgram` là cái đầu theo id
  // (`aadvantage`). Phép đo cũ chỉ tính bonus quy về chương trình đó.
  const state = structuredClone(japanTripFunded);
  state.balances = [];
  const { record } = execute(state);
  const td = ranking(record).find((row) => row.candidate.productSlug === "td-aeroplan-visa-infinite")!;
  const gap = td.candidate.components.find((c) => c.key === "points_gap_reduction")!;
  assert.ok(gap.raw > 0, gap.note);
});

test("chỉ biết giá SÀN: 1 điểm không phủ được 50% chuyến đi (vòng Codex 5)", () => {
  // Canada → Việt Nam phổ thông đặc biệt: Aeroplan® chỉ có sàn, không có trần.
  const state = structuredClone(vietnamTripFunded);
  state.goals = state.goals.map((goal) => (goal.type === "trip" ? { ...goal, cabin: "premium_economy" } : goal));
  const withBalance = (balance: number) => {
    const copy = structuredClone(state);
    copy.balances = copy.balances.map((row) => ({ ...row, balance }));
    return execute(copy).record;
  };
  const one = withBalance(1).derivedState.goals[0].tripCoverage!;
  assert.ok(one.coverage !== null && one.coverage < 0.01, `1 điểm phủ ${one.coverage}`);
  assert.equal(one.coverageKnown, false);
  // Nhiều điểm hơn giá sàn thì mới lên tới điểm giữa — không bao giờ quá 50%
  // khi chưa ai biết trần.
  const many = withBalance(260_000).derivedState.goals[0].tripCoverage!;
  assert.ok(many.coverage! > one.coverage! && many.coverage! <= 0.5);
});

test("chương trình đi kèm tỷ lệ phủ là chương trình QUYẾT ĐỊNH nó (vòng Codex 5)", () => {
  const state = structuredClone(japanTripFunded);
  state.balances = state.balances.map((row) => ({ ...row, balance: null }));
  const cover = execute(state).record.derivedState.goals[0].tripCoverage!;
  // MR chuyển được sang Aeroplan® / Asia Miles®, KHÔNG sang AAdvantage®.
  assert.notEqual(cover.bestProgram, "aadvantage");
  assert.equal(cover.coverage, 0.5);
});

/* ================================================================== *
 * Vòng Codex 6 — mọi giá trị của tỷ lệ phủ ra từ CÙNG một lựa chọn
 * ================================================================== */

function premiumVietnam(balances: { programId: string; balance: number | null }[]) {
  const state = structuredClone(vietnamTripFunded);
  state.goals = state.goals.map((goal) => (goal.type === "trip" ? { ...goal, cabin: "premium_economy" } : goal));
  state.balances = balances.map((row) => ({ ...state.balances[0], programId: row.programId as never, balance: row.balance }));
  return execute(state).record;
}

test("giá SÀN: welcome bonus vẫn được tính cho người chưa có điểm nào", () => {
  // Nhân vật này đang giữ thẻ TD® Aeroplan®, nên thử trên CIBC® Aeroplan®.
  const record = premiumVietnam([]);
  const card = ranking(record).find((row) => row.candidate.productSlug === "cibc-aeroplan-visa-infinite")!;
  const gap = card.candidate.components.find((c) => c.key === "points_gap_reduction")!;
  assert.ok(gap.raw > 0, `${gap.raw} — ${gap.note}`);
  // Giá sàn: bonus B trên sàn S góp tối đa nửa phần B/S — không bao giờ hơn.
  assert.ok(gap.raw <= 0.5, gap.note);
});

test("giá SÀN: chương trình quyết định đi kèm ĐÚNG số điểm của nó, và cờ cận dưới chỉ nói về số dư", () => {
  const record = premiumVietnam([{ programId: "aeroplan", balance: 260_000 }]);
  const cover = record.derivedState.goals[0].tripCoverage!;
  assert.equal(cover.bestProgram, "aeroplan");
  assert.equal(cover.accessible, 260_000);
  assert.equal(cover.coverageKnown, false, "giá chỉ biết sàn ⇒ tỷ lệ phủ là ước lượng");
  assert.equal(cover.accessibleIsLowerBound, false, "260,000 là số dư ĐÃ BIẾT");
  const numbers = record.outputSnapshot.results[0].numbers;
  assert.equal(numbers.directPoints, 260_000);
  assert.equal(numbers.accessiblePoints, 260_000);
  assert.equal(numbers.pointsGapTypical, null);
});

test("ba con số in ra nói về CÙNG một chương trình", () => {
  // 130,200 AAdvantage® phủ 93% chuyến Việt Nam business; 190,400 Asia Miles®
  // phủ 80%. Bản trước in "có sẵn 190,400 · tiếp cận 130,200 · thiếu 9,800".
  const state = structuredClone(vietnamTripFunded);
  state.balances = [
    { ...state.balances[0], programId: "aadvantage" as never, balance: 130_200 },
    { ...state.balances[0], programId: "asia-miles" as never, balance: 190_400 },
  ];
  const record = execute(state).record;
  const cover = record.derivedState.goals[0].tripCoverage!;
  const numbers = record.outputSnapshot.results[0].numbers;
  assert.equal(numbers.accessiblePoints, cover.accessible);
  assert.equal(numbers.directPoints, cover.accessible, `${cover.bestProgram}: có sẵn ≠ tiếp cận`);
});

test("độ tươi §29 nói ra DÒNG cũ nhất, và bỏ qua chặng engine không dùng", () => {
  const tier = DATA.transferPaths.find((path) => path.requiresTier !== null)!;
  const open = DATA.transferPaths.find((path) => path.requiresTier === null)!;
  const age = (id: string): RecommendationDataset => ({
    ...DATA,
    transferPaths: DATA.transferPaths.map((path) => (path.id === id ? { ...path, verifiedAt: "2020-01-01" } : path)),
  });
  const base = execute(vietnamTripFunded).record;
  const staleTier = execute(vietnamTripFunded, { data: age(tier.id) }).record;
  const staleOpen = execute(vietnamTripFunded, { data: age(open.id) }).record;
  const fresh = (r: RecommendationRunRecord) => r.outputSnapshot.results[0].confidence.dataFreshness;
  assert.equal(fresh(staleTier), fresh(base), "chặng Elite cũ không được làm khuyến nghị kém tươi");
  assert.equal(fresh(staleOpen), 0);
  assert.deepEqual(staleOpen.derivedState.goals[0].confidenceInputs.oldestVerifiedRow, {
    table: "transfer_paths",
    id: open.id,
  });
});

/* ================================================================== *
 * Vòng Codex 7
 * ================================================================== */

test("chương trình có CẢ bảng giá cố định LẪN sàn động: sàn mở rộng cận trên", () => {
  // Aeroplan® Canada → Việt Nam business: thêm một chiến lược định giá động
  // sàn 25,000/chiều. 100,000 điểm phủ CHẮC 100/230 = 43% (trần cố định), và
  // CÓ THỂ tới 100% (sàn 50,000 khứ hồi) — điểm giữa 72%, không phải 43%.
  const fixed = DATA.awardStrategies.find(
    (row) =>
      row.programId === ("aeroplan" as never) &&
      row.destinationRegion === "SEA_VIETNAM" &&
      row.cabin === "business" &&
      row.pricingModel === "fixed",
  )!;
  const data: RecommendationDataset = {
    ...DATA,
    awardStrategies: [
      ...DATA.awardStrategies,
      {
        ...fixed,
        id: `${fixed.id}-dynamic-test` as never,
        pricingModel: "dynamic_floor",
        pointsLow: 25_000,
        pointsTypical: null,
        pointsHigh: null,
      },
    ],
  };
  const state = structuredClone(vietnamTripFunded);
  state.balances = state.balances.map((row) => ({ ...row, balance: 100_000 }));
  const record = execute(state, { data }).record;
  const cover = record.derivedState.goals[0].tripCoverage!;
  const high = record.derivedState.goals[0].goal.tripNeed!.byProgram.find((r) => r.programId === "aeroplan")!.high!;
  assert.equal(cover.coverageLowerBound, Math.min(1, 100_000 / high));
  assert.equal(cover.coverageKnown, false, "sàn động mở cận trên — tỷ lệ phủ là ước lượng");
  assert.ok(Math.abs(cover.coverage! - (100_000 / high + 1) / 2) < 1e-12, String(cover.coverage));
  assert.equal(record.outputSnapshot.results[0].numbers.pointsGapTypical, null);
});

test("phần CHẮC CHẮN đã bằng phần CÓ THỂ thì tỷ lệ phủ là số đo, không phải ước lượng", () => {
  // 80,000 AAdvantage® phủ chắc 80% chuyến phổ thông đặc biệt; 17,000
  // Aeroplan® trên sàn 170,000 phủ tối đa 10%. Không chương trình nào CÓ THỂ
  // vượt 80% ⇒ 80% là con số chắc chắn.
  const state = structuredClone(vietnamTripFunded);
  state.goals = state.goals.map((goal) => (goal.type === "trip" ? { ...goal, cabin: "premium_economy" } : goal));
  state.balances = [
    { ...state.balances[0], programId: "aadvantage" as never, balance: 80_000 },
    { ...state.balances[0], programId: "aeroplan" as never, balance: 17_000 },
  ];
  const record = execute(state).record;
  const cover = record.derivedState.goals[0].tripCoverage!;
  const aa = record.derivedState.goals[0].goal.tripNeed!.byProgram.find((r) => r.programId === "aadvantage")!;
  assert.equal(cover.bestProgram, "aadvantage");
  assert.equal(cover.coverage, 80_000 / aa.high!);
  assert.equal(cover.coverageKnown, true);
  const numbers = record.outputSnapshot.results[0].numbers;
  assert.equal(numbers.pointsGapTypical, Math.max(0, aa.typical! - 80_000));
  assert.ok(!record.outputSnapshot.results[0].strategies.some((s) => s.reasonCodes.includes("POINTS_COVERAGE_UNKNOWN")));
});

/* ================================================================== *
 * Vòng Codex 8 — hai mục tiêu hoà nhau chạy song song
 * ================================================================== */

/** "Thẻ tiếp theo" hoà ưu tiên với chuyến Việt Nam; `tripPatch` sửa chuyến đi. */
function tiedGoals(tripPatch: Record<string, unknown> = {}): UserState {
  const state = structuredClone(vietnamTripFunded);
  const trip = state.goals.find((goal) => goal.type === "trip")!;
  state.goals = [
    { ...trip, ...tripPatch, priority: null } as never,
    { type: "next_card", id: "goal_a_next" as never, userId: state.profile.id, priority: null, createdAt: ASOF },
  ];
  return state;
}

test("chỗ trống của CHUYẾN ĐI không kéo độ tin cậy của mục tiêu 'thẻ tiếp theo'", () => {
  const full = execute(tiedGoals()).record;
  const vague = execute(tiedGoals({ passengers: null, roundTrip: null })).record;
  const nextCard = (r: RecommendationRunRecord) =>
    r.outputSnapshot.results.find((result) => result.goalType === "next_card")!;
  assert.equal(full.outputSnapshot.goalResolution, "ambiguous");
  assert.equal(nextCard(vague).primaryAction.productSlug, nextCard(full).primaryAction.productSlug);
  assert.equal(nextCard(vague).confidence.dataCompleteness, nextCard(full).confidence.dataCompleteness);
  // Còn chuyến đi thì PHẢI kém chắc chắn hơn.
  const trip = (r: RecommendationRunRecord) => r.outputSnapshot.results.find((result) => result.goalType === "trip")!;
  assert.ok(trip(vague).confidence.goalSpecificity < trip(full).confidence.goalSpecificity);
});

test("phép đo §30 và phép so lượt chạy nhìn người thắng của MỌI mục tiêu", () => {
  const vague = execute(tiedGoals({ passengers: null })).record;
  const full = execute(tiedGoals({ passengers: 1 })).record;
  const tripWinner = (r: RecommendationRunRecord) =>
    candidateKey(r.outputSnapshot.results.find((result) => result.goalType === "trip")!.primaryAction);
  // Ca của vòng Codex 8: điền "1 người" lật người thắng của CHUYẾN ĐI. Không
  // lật thì bài này không kiểm gì — nên đòi nó lật, không `if`.
  assert.notEqual(tripWinner(vague), tripWinner(full), "tiền đề của bài test không còn đúng");
  const probe = vague.derivedState.followUpProbes.find((p) => p.gapKind === "trip_passengers_unknown");
  assert.ok(probe !== undefined && probe.flips > 0, "phép đo chỉ nhìn mục tiêu đầu");
  const change = explainChange(vague, full);
  assert.notEqual(change.winner.before, change.winner.after);
  // Và khoá người thắng mang đủ HAI mục tiêu.
  assert.equal(explainChange(vague, vague).winner.before?.split(" | ").length, 2);
});

test("hỏi một mục tiêu KHÔNG tồn tại là lỗi, không phải 'lượt chạy chưa có mục tiêu'", () => {
  const { record } = execute(beginnerNoCards);
  assert.throws(() => explainProduct(record, "amex-green", { goalIndex: 99 }), /không có/);
  assert.throws(() => findRanked(record, "amex-green", 99), /không có/);
  assert.match(renderRunReport(record, { goalIndex: 99 }), /không có/);
  const noGoal = execute({ ...beginnerNoCards, goals: [] }).record;
  assert.equal(explainProduct(noGoal, "amex-green").outcome, "not_ranked_no_goal");
  // Lượt chạy KHÔNG có mục tiêu chỉ nhận số 0 — số 99 vẫn là lỗi (vòng Codex 9).
  assert.throws(() => explainProduct(noGoal, "amex-green", { goalIndex: 99 }), /không có/);
});

/* ================================================================== *
 * Vòng Codex 9 — chỗ trống thuộc về ĐÚNG mục tiêu đang chạy
 * ================================================================== */

test("chuyến đi ưu tiên THẤP hơn không được làm nhiễm độ tin cậy lẫn câu hỏi §30", () => {
  const base = structuredClone(vietnamTripFunded);
  const trip = base.goals.find((goal) => goal.type === "trip")!;
  const withTrip = (patch: Record<string, unknown>): UserState => ({
    ...base,
    goals: [
      { type: "next_card", id: "goal_a_next" as never, userId: base.profile.id, priority: 1, createdAt: ASOF },
      { ...trip, ...patch, priority: 2 } as never,
    ],
  });
  const a = execute(withTrip({})).record;
  const b = execute(withTrip({ passengers: null })).record;
  assert.equal(b.outputSnapshot.goalResolution, "resolved");
  assert.equal(b.outputSnapshot.results[0].goalType, "next_card");
  assert.equal(b.outputSnapshot.results[0].confidence.dataCompleteness, a.outputSnapshot.results[0].confidence.dataCompleteness);
  assert.ok(!b.outputSnapshot.userGaps.some((gap) => gap.kind.startsWith("trip_")));
  assert.notEqual(b.outputSnapshot.followUp?.gapKind, "trip_passengers_unknown");
});

test("tỷ lệ tích điểm chưa biết không trừ độ tin cậy của một chuyến đi ĐÃ định giá", () => {
  const record = execute(vietnamTripFunded).record;
  const goal = record.derivedState.goals[0];
  assert.ok(goal.tripCoverage?.coverage !== null, "tiền đề: chặng đã định giá");
  assert.ok(!record.outputSnapshot.dataGaps.some((gap) => gap.kind === "base_earn_rate_unknown"));
  // Còn "thẻ tiếp theo" thì CÓ đọc tỷ lệ tích điểm — chỗ trống phải ở đó.
  const nextCard = execute(beginnerNoCards).record;
  assert.ok(nextCard.outputSnapshot.dataGaps.some((gap) => gap.kind === "base_earn_rate_unknown"));
});

test("§30 xét thẻ doanh nghiệp đang thắng ở mục tiêu THỨ HAI", () => {
  // "Thẻ tiếp theo" (đứng trước theo id) không có thẻ doanh nghiệp nào trong
  // top 5; chuyến Việt Nam còn thiếu điểm thì Amex® Business Gold đứng đầu.
  // Bộ lọc cũ chỉ nhìn bảng của mục tiêu đầu nên không xét câu hỏi đó.
  const state = structuredClone(vietnamTripShortfall);
  const trip = state.goals.find((goal) => goal.type === "trip")!;
  state.goals = [
    { ...trip, priority: null },
    { type: "next_card", id: "goal_a_next" as never, userId: state.profile.id, priority: null, createdAt: ASOF },
  ];
  state.profile.businessCardsAllowed = null;
  state.profile.hasBusiness = null;
  const record = execute(state).record;
  const top5 = (goalType: string) =>
    record.derivedState.goals
      .find((goal) => goal.goalType === goalType)!
      .ranking.filter((row) => row.visibility !== "no_action")
      .slice(0, 5)
      .some((row) => row.candidate.productSlug?.includes("business") ?? false);
  assert.equal(record.derivedState.goals[0].goalType, "next_card");
  assert.equal(top5("next_card"), false, "tiền đề: mục tiêu đầu không có thẻ doanh nghiệp");
  assert.equal(top5("trip"), true, "tiền đề: mục tiêu thứ hai có");
  assert.ok(
    record.derivedState.followUpProbes.some((p) => p.gapKind === "business_cards_preference_unknown"),
    "§30 không xét câu hỏi thẻ doanh nghiệp",
  );
});

test("lượt chạy HAI mục tiêu lưu, chạy lại ra đúng từng chữ số", async () => {
  const { record, dataset } = execute(tiedGoals({ passengers: null }));
  const { replayRun } = await import("./runs.ts");
  const back = JSON.parse(JSON.stringify(record)) as RecommendationRunRecord;
  const replay = replayRun(back, dataset);
  assert.equal(replay.identical, true);
  assert.equal(back.outputSnapshot.results.length, 2);
});

/* ================================================================== *
 * Vòng Codex 10 — "mục tiêu có đọc tỷ lệ tích điểm không" là MỘT câu hỏi
 * ================================================================== */

test("tỷ lệ tích điểm CŨ mà chuyến đi đã định giá không đọc thì không làm nó kém tươi", () => {
  const green = productIdFor("amex-green");
  const rate = DATA.earningRates.find((row) => row.productId === green)!;
  const data: RecommendationDataset = {
    ...DATA,
    earningRates: DATA.earningRates.map((row) => (row.id === rate.id ? { ...row, verifiedAt: "2020-01-01" } : row)),
  };
  const base = execute(vietnamTripFunded).record.outputSnapshot.results[0];
  const stale = execute(vietnamTripFunded, { data }).record.outputSnapshot.results[0];
  assert.equal(stale.primaryAction.score, base.primaryAction.score, "tiền đề: điểm không đổi");
  assert.equal(stale.confidence.dataFreshness, base.confidence.dataFreshness);
  assert.equal(stale.confidence.level, base.confidence.level);
  // Còn "thẻ tiếp theo" thì CÓ đọc tỷ lệ đó — nó phải kém tươi đi.
  const nextCardBase = execute(beginnerNoCards).record.outputSnapshot.results[0].confidence.dataFreshness;
  const nextCardStale = execute(beginnerNoCards, { data }).record.outputSnapshot.results[0].confidence.dataFreshness;
  assert.ok(nextCardStale < nextCardBase);
});

test("'vì sao thẻ X' chỉ kể chỗ trống mà mục tiêu đó ĐÃ tính, không phải bộ thô", () => {
  const { record, dataset } = execute(vietnamTripFunded);
  const e = explainProduct(record, "td-first-class-travel-visa-infinite", { dataset });
  assert.ok(dataset.gaps.some((gap) => gap.kind === "base_earn_rate_unknown" && gap.subjectId === e.productId), "tiền đề: bộ thô có chỗ trống này");
  assert.ok(!e.dataGaps.some((gap) => gap.kind === "base_earn_rate_unknown"));
});

test("tỷ lệ tích điểm của THẺ ĐANG GIỮ cũng là thứ engine đọc (vòng Codex 11)", () => {
  // `NO_NEW_CARD` so tích điểm của VÍ với thẻ mới. Chuyến đi thiếu số người
  // (chưa định giá được) thì mục tiêu đọc tỷ lệ tích điểm — kể cả của thẻ
  // TD® Aeroplan® người này đang giữ.
  const state = structuredClone(vietnamTripFunded);
  state.goals = state.goals.map((goal) => (goal.type === "trip" ? { ...goal, passengers: null } : goal));
  const held = productIdFor("td-aeroplan-visa-infinite");
  const rate = DATA.earningRates.find((row) => row.productId === held)!;
  const data: RecommendationDataset = {
    ...DATA,
    earningRates: DATA.earningRates.map((row) => (row.id === rate.id ? { ...row, verifiedAt: "2020-01-01" } : row)),
  };
  const stale = execute(state, { data }).record.derivedState.goals[0].confidenceInputs;
  assert.deepEqual(stale.oldestVerifiedRow, { table: "earning_rates", id: rate.id });

  // Và tỷ lệ nền CHƯA BIẾT của thẻ đang giữ là một chỗ trống của lượt chạy.
  const holder = structuredClone(beginnerNoCards);
  const unknownRate = DATA.gaps.find((gap) => gap.kind === "base_earn_rate_unknown")!;
  const product = DATA.products.find((row) => row.id === unknownRate.subjectId)!;
  holder.cards = [{ ...vietnamTripFunded.cards[0], userId: holder.profile.id, productId: product.id, status: "active" }];
  holder.declared = { ...holder.declared, cards: true };
  const record = execute(holder).record;
  assert.ok(record.derivedState.excluded.some((row) => row.productId === product.id && row.reason === "already_held"));
  assert.ok(record.outputSnapshot.dataGaps.some((gap) => gap.subjectId === product.id && gap.kind === "base_earn_rate_unknown"));
});
