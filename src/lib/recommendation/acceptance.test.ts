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
import { compareCandidates, explainProduct } from "./debug.ts";
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
