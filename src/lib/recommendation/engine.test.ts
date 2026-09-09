/**
 * Phase 3 — bộ test của engine.
 *
 * KHÔNG import `./index.ts`: nó tái xuất `source.ts`, thứ import `@/lib/...`,
 * và alias đó chỉ tồn tại trong bundler của Next. `node --test` sẽ nổ
 * ERR_MODULE_NOT_FOUND. Import thẳng từng file — cùng lý do các test của Phase
 * 1 và 2 làm vậy.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { offlineDataset } from "./data/index.ts";
import { activeAt, datasetAt } from "./temporal.ts";
import { indexDataset } from "./indexes.ts";
import { ENGINE_VERSION, recommend } from "./engine.ts";
import {
  accessibleFor,
  analyzePortfolio,
  balanceKnowledge,
  centsPerPoint,
  flexibilityReach,
  isFlexibleInPractice,
} from "./portfolio.ts";
import { computeConfidence } from "./confidence.ts";
import { evaluateEligibility } from "./eligibility.ts";
import { evaluateSuitability, minimumSpendFit } from "./suitability.ts";
import { tripNeedFor } from "./trip-need.ts";
import { historicalPercentile, offerClimate, offerFacts, offerQualityScore } from "./offer-quality.ts";
import { earnFitFor } from "./earn-fit.ts";
import { tripCoverage } from "./strategies.ts";
import { candidateUniverse, normalize } from "./normalize.ts";
import { REASON_CODES, WARNING_CODES } from "./reason-codes.ts";
import { nextQuestion } from "./explain.ts";
import { SCORABLE_WEIGHT } from "./scoring/weights.ts";
import {
  resolveTripGoal,
  usableBalance,
  usablePassengers,
  usableRoundTrip,
} from "./user.ts";
import { userGaps } from "./user-gaps.ts";
import { id, type PointsProgramId, type ProductId, type TripRegion } from "./types.ts";
import { benefitFitFor, heldBenefitKeys } from "./benefit-fit.ts";
import { productIdFor } from "./data/products.ts";
import {
  USER_FIXTURES,
  aeroplanHeavy,
  advancedCollector,
  beginnerNoCards,
  duplicateBagBenefit,
  flexiblePointsSufficient,
  highSpendLowCapacity,
  japanTripFunded,
  japanTripShortfall,
  lowSpendCapacity,
  studentStarter,
  vagueEarner,
  vietnamTripFunded,
  vietnamTripShortfall,
} from "./data/user-fixtures.ts";
import type { UserCardId, UserState } from "./user-types.ts";
import type { RecommendationRun } from "./engine-types.ts";

const ASOF = "2026-09-08";
const RAW = offlineDataset();
const DATA = datasetAt(RAW, ASOF);
const IX = indexDataset(DATA);

const AEROPLAN = id<PointsProgramId>("aeroplan");
const AMEX_MR = id<PointsProgramId>("amex-mr");
const AVIOS = id<PointsProgramId>("avios");
const BONVOY = id<PointsProgramId>("bonvoy");

function run(state: UserState): RecommendationRun {
  return recommend({ state, data: DATA, ix: IX, asOf: ASOF });
}

/* ================================================================== *
 * §35 — tiêu chí nghiệm thu Phase 3
 * ================================================================== */

test("tất định: cùng đầu vào, cùng version → cùng đầu ra, tới từng trường", () => {
  for (const state of USER_FIXTURES) {
    assert.deepEqual(run(state), run(state), `khác nhau giữa hai lượt: ${state.profile.id}`);
  }
});

test("tất định: thứ tự mảng đầu vào KHÔNG đổi kết quả", () => {
  // Các mảng này tới từ một truy vấn database, và truy vấn không hứa thứ tự
  // nào. Nếu engine phụ thuộc thứ tự thì hai lượt chạy trên cùng một hồ sơ cho
  // hai khuyến nghị khác nhau, và không có lỗi nào nổ ra.
  const shuffled: UserState = {
    ...advancedCollector,
    cards: [...advancedCollector.cards].reverse(),
    balances: [...advancedCollector.balances].reverse(),
    goals: [...advancedCollector.goals].reverse(),
  };
  assert.deepEqual(run(shuffled), run(advancedCollector));
});

test("tất định: thứ tự SẢN PHẨM trong bộ dữ liệu không đổi kết quả", () => {
  const flipped = indexDataset({ ...DATA, products: [...DATA.products].reverse() });
  const a = recommend({ state: aeroplanHeavy, data: DATA, ix: IX, asOf: ASOF });
  const b = recommend({
    state: aeroplanHeavy,
    data: { ...DATA, products: [...DATA.products].reverse() },
    ix: flipped,
    asOf: ASOF,
  });
  assert.deepEqual(
    b.results[0].primaryAction.productSlug,
    a.results[0].primaryAction.productSlug,
  );
});

test("§16 Rule 7 — affiliate KHÔNG bao giờ đổi thứ hạng", () => {
  // Đảo cờ trên MỌI sản phẩm. Nếu bất kỳ đâu trong engine đọc nó, một trong
  // hai chiều sẽ lộ ra.
  for (const flag of [true, false]) {
    const data = { ...DATA, products: DATA.products.map((p) => ({ ...p, affiliateAvailable: flag })) };
    const ix = indexDataset(data);
    for (const state of USER_FIXTURES) {
      const flipped = recommend({ state, data, ix, asOf: ASOF });
      const base = run(state);
      assert.deepEqual(
        flipped.results.map((r) => [r.primaryAction.productSlug, r.primaryAction.score]),
        base.results.map((r) => [r.primaryAction.productSlug, r.primaryAction.score]),
        `affiliate=${flag} đổi kết quả của ${state.profile.id}`,
      );
    }
  }
});

test("§16 Rule 7 — mã nguồn engine không nhắc tới `affiliateAvailable`", async () => {
  // Test trên là phép thử hành vi; test này là phép thử cấu trúc. Một trường
  // được đọc rồi nhân với 0 sẽ qua được test kia, và sẽ thành một phép nhân
  // với 0.01 trong lần sửa sau.
  const { readFile, readdir } = await import("node:fs/promises");
  const dir = new URL("./", import.meta.url);
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === "scoring") {
      for (const sub of await readdir(new URL("./scoring/", import.meta.url))) {
        files.push(`scoring/${sub}`);
      }
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entry.name);
    }
  }
  const ENGINE_FILES = new Set([
    "engine.ts", "normalize.ts", "portfolio.ts", "strategies.ts", "needs.ts",
    "eligibility.ts", "suitability.ts", "rules.ts", "rank.ts", "confidence.ts",
    "explain.ts", "offer-quality.ts", "earn-fit.ts", "benefit-fit.ts", "trip-need.ts",
    "scoring/weights.ts", "scoring/context.ts", "scoring/next-card.ts",
    "scoring/trip.ts", "scoring/diversify.ts", "scoring/earning.ts",
  ]);
  for (const name of files) {
    if (!ENGINE_FILES.has(name)) continue;
    const text = await readFile(new URL(`./${name}`, import.meta.url), "utf8");
    // Bỏ chú thích trước khi tìm: file này có quyền GIẢI THÍCH luật.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(
      !code.includes("affiliateAvailable"),
      `${name} đọc affiliateAvailable — §16 Rule 7 cấm`,
    );
  }
});

test("§16 Rule 8 — NO_NEW_CARD có mặt trong MỌI lượt chạy", () => {
  for (const state of USER_FIXTURES) {
    for (const result of run(state).results) {
      assert.equal(result.noAction.kind, "no_new_card");
      assert.ok(result.noAction.components.length > 0, "phải có bảng điểm giải thích được");
    }
  }
});

test("§16 Rule 8 — NO_NEW_CARD THẮNG được, và vì lý do truy được", () => {
  const result = run(vietnamTripFunded).results[0];
  assert.equal(result.primaryAction.kind, "no_new_card");
  assert.ok(result.reasonCodes.includes("POINTS_ALREADY_SUFFICIENT"));
  // Và câu "bạn đã đủ điểm" phải đi kèm cảnh báo hạn điểm — mô hình V1 không
  // biết điểm hết hạn, nên nó không được nói như thể số dư là vĩnh viễn.
  assert.ok(result.warnings.includes("POINTS_EXPIRY_NOT_MODELLED"));
});

test("§10 — mỗi loại mục tiêu dùng bộ thành phần KHÁC NHAU", () => {
  const keysFor = (state: UserState) =>
    new Set(run(state).results[0].primaryAction.components.map((c) => c.key));

  const trip = keysFor(vietnamTripShortfall);
  const nextCard = keysFor(beginnerNoCards);
  const diversify = keysFor(advancedCollector);
  const earning = keysFor(vagueEarner);

  assert.ok(trip.has("trip_currency_utility"), "trip phải có trip_currency_utility");
  assert.ok(!nextCard.has("trip_currency_utility"), "next_card KHÔNG được có nó");
  assert.ok(diversify.has("new_currency_exposure"));
  assert.ok(earning.has("fee_drag"), "chỉ ý định tích điểm mới có fee_drag");
  assert.ok(!nextCard.has("fee_drag"));
  // Bốn bộ khoá phải thật sự khác nhau, không chỉ khác tên.
  const sets = [trip, nextCard, diversify, earning].map((s) => [...s].sort().join(","));
  assert.equal(new Set(sets).size, 4, "bốn ý định phải cho bốn bảng khác nhau");
});

test("§10 — trọng số đúng như spec viết, và cộng lại đúng 0.95", () => {
  // Con số của spec, không phải con số sau chuẩn hoá. Bảng in ra cho admin
  // phải khớp §10 tới từng phần trăm.
  const expected: Record<string, Record<string, number>> = {
    trip: {
      trip_currency_utility: 0.35, points_gap_reduction: 0.2, offer_quality: 0.15,
      spend_fit: 0.1, flexibility_value: 0.1, travel_benefits: 0.05,
    },
    next_card: {
      offer_quality: 0.25, spend_fit: 0.2, long_term_earn_fit: 0.15,
      currency_fit: 0.15, benefits_fit: 0.1, diversification: 0.1,
    },
    diversify: {
      new_currency_exposure: 0.35, transfer_flexibility: 0.25,
      long_term_earn_fit: 0.15, offer_quality: 0.1, spend_fit: 0.1,
    },
    earn_points: {
      long_term_earn_fit: 0.4, currency_fit: 0.2, offer_quality: 0.15,
      spend_fit: 0.1, fee_drag: 0.1,
    },
  };
  const samples: [string, UserState][] = [
    ["trip", vietnamTripShortfall],
    ["next_card", beginnerNoCards],
    ["diversify", advancedCollector],
    ["earn_points", vagueEarner],
  ];
  for (const [label, state] of samples) {
    const components = run(state).results[0].primaryAction.components;
    const actual = Object.fromEntries(components.map((c) => [c.key, c.weight]));
    assert.deepEqual(actual, expected[label], `bảng trọng số của ${label} lệch §10`);
    const sum = components.reduce((total, c) => total + c.weight, 0);
    assert.ok(
      Math.abs(sum - SCORABLE_WEIGHT) < 1e-9,
      `${label}: tổng ${sum} ≠ ${SCORABLE_WEIGHT} (5% còn lại là editorial §15, chưa làm)`,
    );
  }
});

/* ================================================================== *
 * §7 — không đếm trùng điểm chuyển được
 * ================================================================== */

test("§7 — 100K MR KHÔNG đồng thời là 100K Aeroplan® + 100K Avios®", () => {
  const state: UserState = {
    ...beginnerNoCards,
    balances: [{ userId: beginnerNoCards.profile.id, programId: AMEX_MR, balance: 100_000, updatedAt: ASOF }],
  };
  const toAeroplan = accessibleFor(state, IX, AEROPLAN, ASOF);
  const toAvios = accessibleFor(state, IX, AVIOS, ASOF);

  assert.equal(toAeroplan.total, 100_000);
  assert.equal(toAvios.total, 100_000);
  // Cả hai đều tra ra 100K — hợp lệ, vì mỗi lần là MỘT đích. Điều engine
  // không bao giờ được làm là CỘNG chúng, và `sources` là thứ làm phép cộng
  // sai đó nhìn thấy được: cùng một nguồn xuất hiện ở cả hai.
  assert.deepEqual(toAeroplan.sources, [AMEX_MR]);
  assert.deepEqual(toAvios.sources, [AMEX_MR]);
  assert.equal(toAeroplan.direct, 0, "không có Aeroplan® nào nằm sẵn");
});

test("§7 — tập trung danh mục KHÔNG cộng pool linh hoạt vào từng nơi", () => {
  const state: UserState = {
    ...beginnerNoCards,
    balances: [{ userId: beginnerNoCards.profile.id, programId: AMEX_MR, balance: 100_000, updatedAt: ASOF }],
  };
  const portfolio = analyzePortfolio(state, IX, ASOF);
  const total = portfolio.concentration.reduce((sum, row) => sum + row.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `tổng tỷ trọng phải bằng 1, đang là ${total}`);
  // MR với tới 5 chương trình, nên mỗi nơi nhận 1/5 — không phải nguyên vẹn.
  for (const row of portfolio.concentration) {
    assert.ok(row.share <= 0.21, `${row.ecosystem} nhận ${row.share}, tức đang đếm trùng`);
  }
});

test("§7 — `bonvoy` khai transferable nhưng KHÔNG có chặng nào ⇒ không tính là linh hoạt", () => {
  // Ca thật trong bộ dữ liệu, và lớp dữ liệu đã khai nó là
  // `transfer_paths_unmodelled`. Đọc cờ `transferable` thay vì đọc dữ liệu
  // từng đưa Bonvoy® lên đầu bảng cho một người muốn BAY.
  assert.equal(IX.programById.get(BONVOY)?.transferable, true);
  assert.equal(isFlexibleInPractice(IX, BONVOY, ASOF), false);
  assert.equal(isFlexibleInPractice(IX, AMEX_MR, ASOF), true);
});

test("§7 — số dư `null` là 'có tài khoản, chưa biết', không phải 0", () => {
  const state: UserState = {
    ...beginnerNoCards,
    balances: [{ userId: beginnerNoCards.profile.id, programId: AEROPLAN, balance: null, updatedAt: ASOF }],
  };
  const portfolio = analyzePortfolio(state, IX, ASOF);
  assert.equal(portfolio.direct.get(AEROPLAN)?.kind, "unknown");
  assert.equal(portfolio.hasUnknownBalance, true);
  assert.equal(accessibleFor(state, IX, AEROPLAN, ASOF).hasUnknownSource, true);
});

/* ================================================================== *
 * §14 — đủ điều kiện ≠ phù hợp
 * ================================================================== */

test("§14 — thẻ phí $799 với ngưỡng $200: PHẠT, không LOẠI", () => {
  const platinum = productIdFor("amex-platinum");
  const state: UserState = {
    ...beginnerNoCards,
    profile: { ...beginnerNoCards.profile, annualFeeTolerancePerCard: 200 },
  };
  const result = run(state).results[0];
  const all = [result.primaryAction, ...result.alternatives];
  const universe = candidateUniverse(state, DATA, IX, ASOF);
  assert.ok(
    universe.some((p) => p.id === platinum),
    "Amex® Platinum vẫn phải là ỨNG VIÊN — không phù hợp không phải không đủ điều kiện",
  );
  assert.ok(
    !all.some((c) => c.productSlug === "amex-platinum"),
    "nhưng nó không được đứng đầu bảng của người đặt ngưỡng $200",
  );
});

test("§14 — khoảng thu nhập BẮC QUA ngưỡng là `unknown`, không phải `ineligible`", () => {
  // Thu nhập khai 60–80K, thẻ đòi $80,000 cá nhân HOẶC $150,000 hộ gia đình.
  const state: UserState = {
    ...beginnerNoCards,
    profile: {
      ...beginnerNoCards.profile,
      annualPersonalIncome: { low: 60_000, high: 80_000 },
      annualHouseholdIncome: null,
    },
  };
  const verdict = evaluateEligibility(
    productIdFor("westjet-rbc-world-elite-mastercard"),
    state,
    IX,
    ASOF,
  );
  assert.equal(verdict.status, "unknown");
  assert.ok(verdict.reasonCodes.includes("INCOME_MAY_NOT_QUALIFY"));
});

test("§14 — vế HOẶC của thu nhập: cá nhân trượt, hộ gia đình đạt ⇒ ĐỦ điều kiện", () => {
  // `lowSpendCapacity` khai 45–55K cá nhân (dưới $60,000) và 110–130K hộ gia
  // đình (trên $100,000). Đọc hai dòng đó như phép VÀ là loại thẳng đúng
  // người mà vế hộ gia đình sinh ra để nhận.
  const verdict = evaluateEligibility(
    productIdFor("scotiabank-momentum-visa-infinite-plus"),
    lowSpendCapacity,
    IX,
    ASOF,
  );
  assert.equal(verdict.status, "eligible");
});

test("§14 — `hasBusiness: false` là KHÔNG ĐỦ ĐIỀU KIỆN, `businessCardsAllowed: false` là KHÔNG PHÙ HỢP", () => {
  const businessCard = productIdFor("amex-business-gold");
  const noBusiness: UserState = {
    ...beginnerNoCards,
    profile: { ...beginnerNoCards.profile, hasBusiness: false, businessCardsAllowed: true },
  };
  assert.equal(evaluateEligibility(businessCard, noBusiness, IX, ASOF).status, "ineligible");

  // Có doanh nghiệp nhưng không muốn xét thẻ doanh nghiệp: ĐỦ điều kiện, và
  // bị lọc ở tầng phù hợp thay vì bị báo là ngân hàng từ chối.
  const hasBusiness: UserState = {
    ...beginnerNoCards,
    profile: { ...beginnerNoCards.profile, hasBusiness: true, businessCardsAllowed: false },
  };
  assert.equal(evaluateEligibility(businessCard, hasBusiness, IX, ASOF).status, "eligible");
  const result = run(hasBusiness).results[0];
  assert.ok(
    ![result.primaryAction, ...result.alternatives].some((c) =>
      c.productSlug?.includes("business"),
    ),
    "người đã nói không xét thẻ doanh nghiệp thì không được thấy thẻ doanh nghiệp",
  );
});

test("§14 — sinh viên: nhánh ĐỦ điều kiện của student_status_required", () => {
  const card = productIdFor("scotiabank-scene-plus-visa-students");
  assert.equal(evaluateEligibility(card, studentStarter, IX, ASOF).status, "eligible");
  const nonStudent: UserState = {
    ...studentStarter,
    profile: { ...studentStarter.profile, isStudent: false },
  };
  assert.equal(evaluateEligibility(card, nonStudent, IX, ASOF).status, "ineligible");
});

test("Amex® once-in-a-lifetime đọc TỪNG GIỮ, không đọc `previously_held`", () => {
  // `flexiblePointsSufficient` có amex-gold-rewards ở trạng thái `closed`.
  // Viết `status === "previously_held"` sẽ để nó lọt, và hậu quả là một
  // khuyến nghị trông hợp lý hứa khoản bonus ngân hàng sẽ từ chối.
  const verdict = evaluateEligibility(
    productIdFor("amex-gold-rewards"),
    flexiblePointsSufficient,
    IX,
    ASOF,
  );
  assert.equal(verdict.welcomeOfferBlocked, true);
  assert.equal(verdict.status, "eligible", "vẫn mở được thẻ — chỉ mất welcome bonus");
  assert.ok(verdict.warnings.includes("WELCOME_BONUS_BLOCKED_BY_PAST_CARD"));
});

/* ================================================================== *
 * §13 — mốc chi không phải pass/fail
 * ================================================================== */

test("§13 — đường cong đi qua đúng hai ví dụ của spec", () => {
  assert.ok(Math.abs(minimumSpendFit(3_000, 9_000) - 1) < 1e-9, "cần 3K / dồn 9K → 1.0");
  assert.ok(Math.abs(minimumSpendFit(6_000, 7_000) - 0.75) < 1e-6, "cần 6K / dồn 7K → 0.75");
  assert.ok(minimumSpendFit(10_000, 6_000) < 0.35, "cần 10K / dồn 6K → phạt nặng");
  assert.equal(minimumSpendFit(20_000, 6_000), 0, "gấp hơn đôi thì về 0");
});

test("§13 — mốc chi ngoài tầm vẫn là ỨNG VIÊN, kèm cảnh báo", () => {
  // `highSpendLowCapacity`: chi $12,000/tháng nhưng chỉ dồn được $2,000 trong
  // 3 tháng. Suy sức dồn từ tổng tháng theo bất kỳ tỷ lệ nào cũng sai gấp
  // nhiều lần ở đúng người mà con số đó quyết định nhiều nhất.
  const state = highSpendLowCapacity;
  const universe = candidateUniverse(state, DATA, IX, ASOF);
  const heavy = universe.find((p) => p.slug === "amex-platinum");
  assert.ok(heavy !== undefined, "thẻ mốc chi $10,000 vẫn nằm trong tập ứng viên");

  const result = run(state).results[0];
  const flagged = [result.primaryAction, ...result.alternatives].filter((c) =>
    c.warnings.includes("SPEND_REQUIREMENT_LIKELY_UNSUITABLE"),
  );
  // Thẻ thắng cuộc ĐƯỢỢC PHÉP hơi quá tầm — §13 nói thẳng là mốc chi không
  // phải pass/fail, và một thẻ đòi $2,700 với người khai $2,000 vẫn là lựa
  // chọn hợp lý nếu người đọc được cảnh báo. Cái KHÔNG được phép là thẻ rơi
  // vào vùng "strong penalty" của §13 (Rule 4 nổ) mà vẫn thắng.
  const winnerFit = result.primaryAction.suitability?.minSpendFit;
  assert.ok(
    winnerFit === null || winnerFit === undefined || winnerFit >= 0.4,
    `thẻ thắng cuộc có fit=${winnerFit}, tức đã vào vùng phạt nặng của §13`,
  );
  assert.ok(
    !result.primaryAction.adjustments.some((a) => a.rule === "R4_minimum_spend_pressure"),
    "Rule 4 nổ trên chính thẻ thắng cuộc",
  );
  for (const candidate of flagged) {
    // Cảnh báo và mã lý do phải luôn đi cùng nhau — §13 đòi CẢ HAI vế, và một
    // vế đi một mình nghĩa là người đọc thấy thẻ tụt hạng mà không biết vì sao
    // (hoặc ngược lại, đọc lý do mà không thấy cảnh báo).
    assert.ok(
      candidate.reasonCodes.includes("MIN_SPEND_TOO_HIGH"),
      `${candidate.productSlug}: có cảnh báo mà thiếu mã lý do`,
    );
    // Và nó phải THẬT SỰ ngoài tầm: mốc chi vượt sức dồn đã khai.
    const fit = candidate.suitability?.minSpendFit;
    assert.ok(fit !== null && fit !== undefined && fit < 1, `${candidate.productSlug}: fit=${fit}`);
  }
  // Chiều ngược lại: mã lý do mà thiếu cảnh báo cũng là hỏng.
  for (const candidate of [result.primaryAction, ...result.alternatives]) {
    if (candidate.reasonCodes.includes("MIN_SPEND_TOO_HIGH")) {
      assert.ok(candidate.warnings.includes("SPEND_REQUIREMENT_LIKELY_UNSUITABLE"));
    }
  }
});

test("§13 — chưa khai sức dồn thì KHÔNG đoán, và thành chỗ trống", () => {
  const state: UserState = {
    ...beginnerNoCards,
    spend: { ...beginnerNoCards.spend!, minimumSpendCapacity3m: null },
  };
  const result = run(state).results[0];
  const withOffer = [result.primaryAction, ...result.alternatives].filter(
    (candidate) => candidate.suitability?.minSpendFit !== 1,
  );
  // Thẻ CÓ mốc chi mà chưa biết sức dồn → `null`, và mang mã nói ra điều đó.
  // Thẻ KHÔNG có welcome offer thì `1` mới đúng: không có mốc nào để đạt là
  // mức phù hợp tối đa, không phải một chỗ trống. Phân biệt này quyết định
  // một nửa số thẻ bị phạt hay không.
  for (const candidate of withOffer) {
    assert.equal(candidate.suitability?.minSpendFit ?? null, null);
    assert.ok(candidate.reasonCodes.includes("MIN_SPEND_CAPACITY_UNKNOWN"));
  }
  assert.ok(run(state).userGaps.some((gap) => gap.kind === "minimum_spend_capacity_unknown"));
});

/* ================================================================== *
 * §6 / §5.1 bàn giao — ba thừa số của số điểm chuyến đi
 * ================================================================== */

test("§6 — điểm cần = points × người × (khứ hồi ? 2 : 1)", () => {
  const goal = vietnamTripFunded.goals[0];
  assert.equal(goal.type, "trip");
  if (goal.type !== "trip") return;

  const one = tripNeedFor(resolveTripGoal(vietnamTripFunded.profile, goal), IX, ASOF);
  const two = tripNeedFor(
    resolveTripGoal(vietnamTripFunded.profile, { ...goal, passengers: 2 }),
    IX,
    ASOF,
  );
  const oneWay = tripNeedFor(
    resolveTripGoal(vietnamTripFunded.profile, { ...goal, roundTrip: false }),
    IX,
    ASOF,
  );

  assert.ok(one.high !== null && two.high !== null && oneWay.high !== null);
  assert.equal(two.high, one.high! * 2, "hai người phải gấp đôi");
  assert.equal(oneWay.high, one.high! / 2, "một chiều phải bằng nửa");
  assert.equal(one.perPassengerOneWayHigh, one.high! / 2, "con số gốc là MỘT CHIỀU MỘT NGƯỜI");
});

test("§6 — thiếu thừa số thì KHÔNG mặc định, mà báo trống", () => {
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  for (const [field, warning] of [
    ["passengers", "TRIP_PASSENGERS_UNKNOWN"],
    ["roundTrip", "TRIP_ROUND_TRIP_UNKNOWN"],
  ] as const) {
    const need = tripNeedFor(
      resolveTripGoal(vietnamTripFunded.profile, { ...goal, [field]: null }),
      IX,
      ASOF,
    );
    assert.equal(need.low, null, `thiếu ${field} mà vẫn ra một con số`);
    assert.equal(need.high, null);
    assert.ok(need.warnings.includes(warning));
    // Con số gốc vẫn tra được — chỉ phép nhân là chưa làm được.
    assert.ok(need.perPassengerOneWayLow !== null);
  }
});

test("§6 — vùng chưa có award strategy thì nói KHÔNG BIẾT, không đoán", () => {
  // CHÂU ÂU là vùng duy nhất còn chưa dựng bảng giá. Bài này TỪNG dùng chuyến
  // Nhật; sau khi JAPAN được lấp thì nó phải đổi sang một vùng thật sự trống,
  // nếu không nó chỉ đang chứng minh một chuyện đã hết đúng.
  const goal = flexiblePointsSufficient.goals[0];
  if (goal.type !== "trip") return;
  assert.equal(goal.destinationRegion, "EUROPE");
  const need = tripNeedFor(resolveTripGoal(flexiblePointsSufficient.profile, goal), IX, ASOF);
  assert.deepEqual(need.strategies, []);
  assert.equal(need.low, null);
  assert.ok(need.reasonCodes.includes("TRIP_ROUTE_NOT_PRICED"));
  assert.ok(need.warnings.includes("AWARD_ROUTE_NOT_IN_DATASET"));
  // Và chỗ trống đó phải nổi lên ở lượt chạy, không chìm đi.
  assert.ok(
    run(flexiblePointsSufficient).dataGaps.some((gap) => gap.kind === "award_route_uncovered"),
  );
});

test("§6 — chặng chưa có giá KHÔNG được kéo mọi đồng tiền về cùng một mức", () => {
  // Một chỗ trống của lớp dữ liệu không được biến thành "không đồng tiền nào
  // hữu ích", vì lúc đó thẻ thắng cuộc được chọn bằng tiếng ồn.
  // Phải dùng một chặng THẬT SỰ chưa có giá. Bài này từng dùng chuyến Nhật;
  // sau khi JAPAN được dựng nó vẫn xanh, nhưng xanh vì lý do khác hẳn (các
  // đồng tiền định giá được chặng vốn đã khác nhau) — tức nó thôi canh cái nó
  // sinh ra để canh.
  const goal = flexiblePointsSufficient.goals[0];
  if (goal.type !== "trip") return;
  assert.equal(goal.destinationRegion, "EUROPE", "cần một vùng chưa dựng bảng giá");
  const result = run(flexiblePointsSufficient).results[0];
  const utilities = [result.primaryAction, ...result.alternatives].map(
    (c) => c.components.find((x) => x.key === "trip_currency_utility")?.raw ?? 0,
  );
  assert.ok(new Set(utilities).size > 1, "mọi ứng viên đang có cùng một giá trị");
});

/* ================================================================== *
 * §16 — các luật còn lại
 * ================================================================== */

test("§16 Rule 5 — thẻ đang giữ KHÔNG phải ứng viên", () => {
  const held = new Set(
    aeroplanHeavy.cards.filter((c) => c.status === "active").map((c) => c.productId as string),
  );
  assert.ok(held.size > 0);
  for (const product of candidateUniverse(aeroplanHeavy, DATA, IX, ASOF)) {
    assert.ok(!held.has(product.id as string), `${product.slug} đang trong ví mà vẫn được khuyên`);
  }
});

test("§16 Rule 6 — quyền lợi chỉ trùng khi CÙNG hãng", () => {
  // `duplicateBagBenefit` giữ TD® Aeroplan®, tức đã có miễn hành lý
  // Air Canada®. Thẻ United® cho miễn hành lý United® — KHÁC hãng, vẫn là
  // giá trị mới. Cờ `duplicatesAcrossCards` một mình sẽ triệt tiêu nó.
  const result = run(duplicateBagBenefit).results[0];
  const united = [result.primaryAction, ...result.alternatives].find(
    (c) => c.productSlug === "united-mileageplus-neo-world-elite-mastercard",
  );
  const aeroplanCard = [result.primaryAction, ...result.alternatives].find((c) =>
    c.productSlug?.startsWith("cibc-aeroplan"),
  );
  if (aeroplanCard !== undefined) {
    assert.ok(
      aeroplanCard.reasonCodes.includes("EXISTING_BENEFIT_DUPLICATION"),
      "thẻ Aeroplan® thứ hai phải bị đánh dấu trùng",
    );
  }
  if (united !== undefined) {
    assert.ok(
      !united.adjustments.some((a) => a.rule === "R6_duplicate_benefits"),
      "thẻ United® không được bị phạt vì quyền lợi của Air Canada®",
    );
  }
});

test("§16 Rule 3 — luật chống tập trung không được phạt đồng tiền LINH HOẠT ngang co-brand", () => {
  // `vietnamTripFunded` dồn 100% vào Aeroplan®. Membership Rewards® đi được
  // Aeroplan® — nhưng cũng đi được bốn nơi khác, nên nó là thứ đa dạng hoá
  // nhất trong bảng. Phạt nó ngang một thẻ đồng thương hiệu Aeroplan® là để
  // luật chống tập trung quay ra phạt đúng liều thuốc.
  const result = run(vietnamTripFunded).results[0];
  const all = [result.primaryAction, ...result.alternatives];
  const penaltyOf = (slug: string) =>
    Math.abs(
      all
        .find((c) => c.productSlug === slug)
        ?.adjustments.find((a) => a.rule === "R3_portfolio_concentration")?.delta ?? 0,
    );
  const coBrand = penaltyOf("cibc-aeroplan-visa-infinite");
  const flexible = penaltyOf("amex-green");
  assert.ok(coBrand > 0, "thẻ đồng thương hiệu Aeroplan® phải bị phạt");
  assert.ok(flexible > 0, "MR có với tới Aeroplan® nên vẫn bị phạt một phần");
  assert.ok(coBrand > flexible * 2, `co-brand ${coBrand} phải nặng hơn hẳn linh hoạt ${flexible}`);
});

test("§16 Rule 3 — tập trung > 70% thì nhu cầu đa dạng hoá nổi lên", () => {
  const result = run(aeroplanHeavy).results[0];
  assert.ok((result.numbers.topEcosystemShare ?? 0) > 0.7);
  assert.ok(result.reasonCodes.includes("PORTFOLIO_CONCENTRATED"));
});

/* ================================================================== *
 * §17 / §19 / §29 / §30
 * ================================================================== */

test("§17 — không điều chỉnh nào vượt ±10% (editorial §15 chưa làm ⇒ chưa có dòng nào)", () => {
  for (const state of USER_FIXTURES) {
    for (const result of run(state).results) {
      for (const candidate of [result.primaryAction, ...result.alternatives]) {
        for (const adjustment of candidate.adjustments) {
          assert.notEqual(adjustment.rule, "editorial", "§15 chưa làm mà đã có dòng editorial");
        }
      }
    }
  }
});

test("§19 — bảng điểm cộng lại đúng bằng điểm nền, và điểm cuối bằng nền + điều chỉnh", () => {
  for (const state of USER_FIXTURES) {
    for (const result of run(state).results) {
      for (const candidate of [result.primaryAction, ...result.alternatives, result.noAction]) {
        const weight = candidate.components.reduce((sum, c) => sum + c.weight, 0);
        const total = candidate.components.reduce((sum, c) => sum + c.contribution, 0);
        assert.ok(
          Math.abs(total / weight - candidate.baseScore) < 1e-9,
          `bảng của ${candidate.productSlug ?? "NO_NEW_CARD"} không cộng lại ra baseScore`,
        );
        const delta = candidate.adjustments.reduce((sum, a) => sum + a.delta, 0);
        const expected = Math.min(1, Math.max(0, candidate.baseScore + delta));
        assert.ok(
          Math.abs(expected - candidate.score) < 1e-9,
          `điểm cuối của ${candidate.productSlug ?? "NO_NEW_CARD"} không giải thích được`,
        );
      }
    }
  }
});

test("§29 — hai ứng viên đầu sát nhau thì độ tin cậy KHÔNG được là `high`", () => {
  for (const state of USER_FIXTURES) {
    for (const result of run(state).results) {
      const gap = result.primaryAction.score - (result.alternatives[0]?.score ?? 0);
      if (gap < 0.05) {
        assert.equal(
          result.confidence.level,
          "low",
          `${state.profile.id}: cách nhau ${gap.toFixed(3)} mà vẫn ${result.confidence.level}`,
        );
      }
    }
  }
});

test("§29 — chuyến đi đủ ba thừa số cụ thể hơn chuyến đi thiếu", () => {
  const goal = flexiblePointsSufficient.goals[0];
  if (goal.type !== "trip") return;
  const vague = run(flexiblePointsSufficient).results[0].confidence.goalSpecificity;
  const precise = run({
    ...flexiblePointsSufficient,
    goals: [{ ...goal, roundTrip: true }],
  }).results[0].confidence.goalSpecificity;
  assert.ok(precise > vague, "biết khứ hồi mà độ cụ thể không tăng");
});

test("§30 — không hỏi lại điều người dùng vừa TỪ CHỐI trả lời", () => {
  // `studentStarter` khai `personalIncomeDeclined` và `householdIncomeDeclined`.
  const question = run(studentStarter).followUp;
  assert.notEqual(question?.gapKind, "personal_income_declined");
  assert.notEqual(question?.gapKind, "household_income_declined");
  assert.notEqual(question?.gapKind, "personal_income_unknown");
});

test("§30 — mảng rỗng CHƯA KHAI thì câu hỏi đầu tiên là chính nó", () => {
  // `beginnerUndeclared` có `cards: []` giống hệt `beginnerNoCards`, khác đúng
  // một cờ. Nếu engine không phân biệt được, nó sẽ tự tin khuyên thẻ khởi đầu
  // cho một người có thể đang giữ năm cái thẻ.
  const undeclared = run(USER_FIXTURES[1]);
  assert.equal(undeclared.followUp?.gapKind, "cards_undeclared");
  assert.ok(undeclared.warnings.includes("CARDS_UNDECLARED"));
  assert.ok(!run(beginnerNoCards).warnings.includes("CARDS_UNDECLARED"));
});

/* ================================================================== *
 * Mục tiêu: thiếu, và hoà
 * ================================================================== */

test("không có mục tiêu thì KHÔNG đoán một cái — hỏi", () => {
  const state: UserState = { ...beginnerNoCards, goals: [] };
  const result = run(state);
  assert.deepEqual(result.results, []);
  assert.equal(result.goalResolution, "none");
  assert.ok(result.reasonCodes.includes("GOAL_MISSING"));
  assert.equal(result.followUp?.gapKind, "goal_missing");
});

test("mục tiêu hoà ưu tiên thì chạy CẢ HAI, không chọn bừa", () => {
  const base = beginnerNoCards;
  const state: UserState = {
    ...base,
    goals: [
      { ...base.goals[0], id: id("goal_a"), priority: null },
      {
        type: "diversify",
        id: id("goal_b"),
        userId: base.profile.id,
        priority: null,
        createdAt: ASOF,
      },
    ],
  };
  const result = run(state);
  assert.equal(result.goalResolution, "ambiguous");
  assert.equal(result.results.length, 2);
  assert.ok(result.reasonCodes.includes("GOAL_AMBIGUOUS"));
  // Và hai mục tiêu khác nhau phải cho hai bảng điểm khác nhau (§10).
  const keys = result.results.map((r) =>
    r.primaryAction.components.map((c) => c.key).sort().join(","),
  );
  assert.notEqual(keys[0], keys[1]);
});

/* ================================================================== *
 * Từ vựng đóng
 * ================================================================== */

test("mọi mã phát ra đều nằm trong từ vựng đóng", () => {
  const reasons = new Set<string>(REASON_CODES);
  const warnings = new Set<string>(WARNING_CODES);
  for (const state of USER_FIXTURES) {
    const result = run(state);
    for (const code of result.reasonCodes) assert.ok(reasons.has(code), `mã lạ: ${code}`);
    for (const code of result.warnings) assert.ok(warnings.has(code), `cảnh báo lạ: ${code}`);
    for (const one of result.results) {
      for (const candidate of [one.primaryAction, ...one.alternatives, one.noAction]) {
        for (const code of candidate.reasonCodes) assert.ok(reasons.has(code), `mã lạ: ${code}`);
        for (const code of candidate.warnings) assert.ok(warnings.has(code), `cảnh báo lạ: ${code}`);
      }
    }
  }
});

/* ================================================================== *
 * Phép thử nghiệm thu thật sự của Phase 3
 * ================================================================== */

test("hai người khác hẳn nhau nhận hai lời khuyên khác hẳn nhau, truy được nguyên nhân", () => {
  const funded = run(vietnamTripFunded).results[0];
  const gap = run(vietnamTripShortfall).results[0];

  // CÙNG chặng, cùng hạng ghế. Khác nhau ở số dư và số người.
  assert.equal(funded.goalType, "trip");
  assert.equal(gap.goalType, "trip");

  assert.equal(funded.primaryAction.kind, "no_new_card");
  assert.equal(gap.primaryAction.kind, "open_card");

  assert.equal(funded.strategy.strategy, "USE_EXISTING_POINTS");
  assert.notEqual(gap.strategy.strategy, "USE_EXISTING_POINTS");

  // Và nguyên nhân truy ngược được tới đúng con số, không phải tới một điểm số.
  assert.equal(funded.numbers.pointsGapTypical, 0);
  assert.ok((gap.numbers.pointsGapTypical ?? 0) > 100_000);
  assert.ok(funded.reasonCodes.includes("POINTS_ALREADY_SUFFICIENT"));
  assert.ok(!gap.reasonCodes.includes("POINTS_ALREADY_SUFFICIENT"));
});

test("engine chạy được cho MỌI nhân vật, không ném và luôn có ứng viên", () => {
  for (const state of USER_FIXTURES) {
    const result = run(state);
    assert.equal(result.engineVersion, ENGINE_VERSION);
    assert.equal(result.asOf, ASOF);
    if (result.goalResolution === "none") continue;
    for (const one of result.results) {
      assert.ok(one.primaryAction.score >= 0 && one.primaryAction.score <= 1);
      assert.ok(one.noAction.score >= 0 && one.noAction.score <= 1);
      assert.ok(one.strategies.length > 0);
    }
  }
});

test("normalize: tập ứng viên chỉ có thẻ tín dụng, đúng nước, còn nhận đơn", () => {
  const normalized = normalize(beginnerNoCards, DATA, IX, ASOF);
  assert.ok(normalized.universe.length > 0);
  for (const product of normalized.universe) {
    assert.equal(product.productType, "credit_card");
    assert.equal(product.country, "CA");
  }
});

test("sản phẩm ngừng phát hành rơi khỏi tập ứng viên nhưng KHÔNG rơi khỏi bộ dữ liệu", () => {
  // Danh tính sản phẩm là vĩnh viễn — thẻ ngừng bán vẫn có thể đang nằm trong
  // ví người dùng, và Portfolio Analyzer phải tra được nó.
  const target = DATA.products[0];
  const closed = {
    ...DATA,
    productAvailability: DATA.productAvailability.map((row) =>
      row.productId === target.id ? { ...row, effectiveTo: "2026-01-01" } : row,
    ),
  };
  const ix = indexDataset(closed);
  const universe = candidateUniverse(beginnerNoCards, closed, ix, ASOF);
  assert.ok(!universe.some((p) => p.id === target.id));
  assert.ok(closed.products.some((p) => p.id === target.id));
  assert.ok(ix.productById.get(target.id as ProductId) !== undefined);
});

/* ================================================================== *
 * §11 — mức DÙNG ĐƯỢC, và hai phép đếm hai lần
 * ================================================================== */

test("§11 — miễn phí năm đầu KHÔNG được tính hai lần", () => {
  // Cả chín thẻ có `fee_waiver` trong bộ dữ liệu đều đồng thời khai
  // `annualFeeFirstYear: 0`. Cộng cả hai thì thẻ được cộng $139 vào phần
  // thưởng RỒI lại được tính là không mất phí — cùng một ưu đãi, hai lần, và
  // chín thẻ cùng được lợi so với phần còn lại của bảng.
  const product = DATA.products.find((p) => p.slug === "td-aeroplan-visa-infinite");
  assert.ok(product !== undefined);
  const facts = offerFacts(product, IX, ASOF, { low: 9_000, high: 9_000 }, []);
  assert.ok(facts.active !== null);

  const waivers = facts.active!.components.filter((c) => c.componentType === "fee_waiver");
  assert.ok(waivers.length > 0, "thẻ mẫu phải có thành phần fee_waiver");
  assert.equal(facts.active!.offer.annualFeeFirstYear, 0, "và phải khai miễn phí năm đầu");

  const waiverCents = waivers.reduce((sum, c) => sum + (c.cashAmount ?? 0) * 100, 0);
  const others = facts.active!.components
    .filter((c) => c.componentType !== "fee_waiver")
    .reduce((sum, c) => {
      const repeats = c.componentType === "monthly_spend" ? (c.repeatCount ?? 1) : 1;
      const cpp = 1.9; // Aeroplan®, xem PROGRAM_VALUATIONS
      return sum + (c.pointsAmount ?? 0) * repeats * cpp + (c.cashAmount ?? 0) * repeats * 100;
    }, 0);

  assert.ok(waiverCents > 0);
  assert.ok(
    Math.abs((facts.fullValueCents ?? 0) - others) < 1,
    `giá trị offer ${facts.fullValueCents} đang bao gồm cả ${waiverCents} cent tiền miễn phí`,
  );
  assert.equal(facts.firstYearFeeCents, 0, "ưu đãi đó phải nằm ở phí năm đầu, và chỉ ở đó");
});

test("§12 — percentile chỉ so hai đợt CÙNG ĐƠN VỊ", () => {
  const history = [
    { at: "2026-01-01", until: null, startCensored: true, endCensored: false, label: "10%", amount: 10, unit: "percent" as const },
    { at: "2026-02-01", until: null, startCensored: false, endCensored: false, label: "15%", amount: 15, unit: "percent" as const },
    { at: "2026-03-01", until: null, startCensored: false, endCensored: false, label: "20%", amount: 20, unit: "percent" as const },
    { at: "2026-04-01", until: null, startCensored: false, endCensored: true, label: "$250", amount: 250, unit: "dollar" as const },
  ];
  // Ba đợt phần trăm, một đợt đô. Hỏi về $250 thì chỉ có MỘT điểm cùng đơn vị
  // — dưới ngưỡng, nên `null`. So thẳng 250 với 10/15/20 rồi kết luận "cao
  // nhất từng thấy" là một câu về TIỀN, và nó sai.
  const dollars = historicalPercentile(history, 250, "dollar");
  assert.equal(dollars.percentile, null);
  assert.equal(dollars.points, 1);

  const percents = historicalPercentile(history, 15, "percent");
  assert.equal(percents.points, 3);
  assert.equal(percents.percentile, 67, "15 đứng trên 2 trong 3 đợt phần trăm");
});

test("§12 — mức hiện tại CHƯA có trong nhật ký vẫn không được so lẫn đơn vị", () => {
  // Recorder chạy mỗi ngày một lượt, nên một offer vừa đổi hôm nay chưa có
  // dòng nào. Bản đầu tra đơn vị bằng cách tìm con số trong lịch sử; không
  // tìm thấy thì đơn vị `undefined` và phép lọc mở toang cho mọi đơn vị.
  const history = [
    { at: "2026-01-01", until: null, startCensored: true, endCensored: false, label: "10%", amount: 10, unit: "percent" as const },
    { at: "2026-02-01", until: null, startCensored: false, endCensored: false, label: "15%", amount: 15, unit: "percent" as const },
    { at: "2026-03-01", until: null, startCensored: false, endCensored: true, label: "20%", amount: 20, unit: "percent" as const },
  ];
  const result = historicalPercentile(history, 60_000, "points");
  assert.equal(result.percentile, null, "60,000 điểm không được so với 10/15/20 phần trăm");
  assert.equal(result.points, 0);
});

test("trần tích điểm: `points` và `spend` so với đại lượng CÙNG ĐƠN VỊ", () => {
  // BMO® VIPorter® giới hạn $20,000 CHI TIÊU Porter® mỗi năm ở mức 3x. Bản
  // trước đem trần-ĐÔ chia cho tổng-ĐIỂM, nên với tỷ lệ 3x nó bắt đầu cắt ở
  // đúng một phần ba mức thật — tức cắt cả những người chưa hề chạm trần.
  //
  // Ca phân biệt được hai bản là ca NẰM DƯỚI TRẦN, không phải ca ở đúng trần:
  // ở đúng trần thì cả hai bản đều cắt, chỉ khác con số. Dưới trần thì bản
  // đúng không cắt gì cả, nên giá trị phải TUYẾN TÍNH theo chi tiêu.
  const capped = DATA.earningCaps.filter((cap) => cap.kind === "spend");
  assert.ok(capped.length > 0, "bộ dữ liệu phải còn ít nhất một trần theo chi tiêu");

  const cap = capped[0];
  const rate = DATA.earningRates.find((row) => row.capId === cap.id);
  assert.ok(rate !== undefined && rate.multiplier > 1, "và nó phải gắn vào một tỷ lệ > 1x");

  const spender = (annual: number): UserState["spend"] => ({
    userId: beginnerNoCards.profile.id,
    monthlyTotal: { low: annual / 12, high: annual / 12 },
    byCategory: { [rate!.category]: { low: annual / 12, high: annual / 12 } },
    minimumSpendCapacity3m: { low: 3_000, high: 3_000 },
    updatedAt: ASOF,
  });

  const quarter = earnFitFor(rate!.productId, spender(cap.amount / 4), IX, ASOF);
  const half = earnFitFor(rate!.productId, spender(cap.amount / 2), IX, ASOF);
  assert.ok(quarter.annualValueCents > 0);
  assert.ok(
    Math.abs(half.annualValueCents - quarter.annualValueCents * 2) < 1,
    `dưới trần mà đã bị cắt: ${quarter.annualValueCents} → ${half.annualValueCents}`,
  );

  // Và trên trần thì tỷ lệ BIÊN phải tụt xuống `rateAfterCap` — không phải về
  // 0. Chi tiêu vượt trần vẫn kiếm được: Amex® Cobalt® vượt trần 5x vẫn ăn 1x,
  // BMO® VIPorter® vượt trần 3x vẫn ăn 2x. Cắt thẳng về 0 làm người chi nhiều
  // bị đánh giá thấp hẳn.
  assert.ok(rate!.rateAfterCap !== null, "tỷ lệ có trần phải khai rateAfterCap");
  const atCap = earnFitFor(rate!.productId, spender(cap.amount), IX, ASOF);
  const double = earnFitFor(rate!.productId, spender(cap.amount * 2), IX, ASOF);

  const marginalBelow = (half.annualValueCents - quarter.annualValueCents) / (cap.amount / 4);
  const marginalAbove = (double.annualValueCents - atCap.annualValueCents) / cap.amount;
  assert.ok(marginalAbove > 0, "vượt trần mà không kiếm thêm gì");
  assert.ok(
    marginalAbove < marginalBelow,
    `tỷ lệ biên trên trần (${marginalAbove}) phải thấp hơn dưới trần (${marginalBelow})`,
  );
  // Và tụt đúng theo tỷ lệ khai trong dữ liệu, không theo một hằng nào khác.
  assert.ok(
    Math.abs(marginalAbove / marginalBelow - rate!.rateAfterCap! / rate!.multiplier) < 1e-6,
    "tỷ lệ biên sau trần không khớp rateAfterCap",
  );
});

/* ================================================================== *
 * Vòng review Codex — bốn lỗi P1
 * ================================================================== */

test("§14 — thẻ KHÔNG ĐỦ ĐIỀU KIỆN không bao giờ được khuyên", () => {
  // Hồ sơ khai thu nhập 0: mọi thẻ đòi thu nhập tối thiểu đều là cánh cửa
  // đóng. Phạt điểm không cứu được ca này — luật CỨNG là luật cứng, và bản
  // đầu để RBC® Avion® Visa Infinite thắng kèm nguyên `ineligible` trong đầu
  // ra của chính nó.
  const broke: UserState = {
    ...beginnerNoCards,
    profile: {
      ...beginnerNoCards.profile,
      annualPersonalIncome: { low: 0, high: 0 },
      annualHouseholdIncome: { low: 0, high: 0 },
    },
  };
  const result = run(broke).results[0];
  for (const candidate of [result.primaryAction, ...result.alternatives]) {
    assert.notEqual(
      candidate.eligibility?.status,
      "ineligible",
      `${candidate.productSlug} bị ngân hàng từ chối mà vẫn được khuyên`,
    );
  }
  // Nhưng chúng vẫn phải được ĐẾM vào "còn ứng viên nào với tới được không" —
  // đó chính là tín hiệu đẩy NO_NEW_CARD lên.
  const blocked = result.noAction.components.find((c) => c.key === "no_reachable_candidate");
  assert.ok((blocked?.raw ?? 0) > 0, "phần ứng viên bị chặn phải khác 0");
});

test("§14 — thẻ lớp dữ liệu nói CHƯA BIẾT điều kiện thì không được coi là đủ", () => {
  // Luật cư trú áp cho MỌI thẻ, nên thẻ chỉ có đúng dòng `residency` trông y
  // hệt thẻ đã kiểm và không có yêu cầu nào khác. Bộ dữ liệu phân biệt hai ca
  // đó bằng `eligibility_unknown`; engine phải đọc nó.
  const gaps = DATA.gaps.filter((gap) => gap.kind === "eligibility_unknown");
  assert.ok(gaps.length > 0, "bộ dữ liệu phải còn thẻ chưa biết điều kiện");

  const unknown = new Set(gaps.map((gap) => gap.subjectId));
  const target = DATA.products.find((p) => unknown.has(p.id as string));
  assert.ok(target !== undefined);

  const withGap = evaluateEligibility(target!.id, beginnerNoCards, IX, ASOF, unknown);
  assert.equal(withGap.status, "unknown");
  assert.ok(withGap.reasonCodes.includes("ELIGIBILITY_UNCERTAIN"));
  assert.ok(withGap.warnings.includes("ELIGIBILITY_NOT_VERIFIABLE"));

  // Và chỗ trống đó phải đi tới tận đầu ra của engine.
  const result = run(beginnerNoCards).results[0];
  const scored = [result.primaryAction, ...result.alternatives].find(
    (c) => c.productId === target!.id,
  );
  if (scored !== undefined) assert.equal(scored.eligibility?.status, "unknown");
});

test("§6 — phủ điểm đo theo TỪNG chương trình, không theo khoảng gộp", () => {
  // Ca Codex bắt được: khoảng gộp trộn mức thấp của chương trình này với mức
  // cao của chương trình kia, tạo ra một khoảng KHÔNG ai bán. 150,000 dặm
  // AAdvantage® phủ đủ chuyến khứ hồi 140,000 dặm của chính AAdvantage®,
  // nhưng bị đem so với trần của Asia Miles® — engine kết luận còn thiếu
  // trong khi cùng lúc báo khoảng cách bằng 0.
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  const need = tripNeedFor(resolveTripGoal(vietnamTripFunded.profile, goal), IX, ASOF);

  assert.ok(need.byProgram.length > 1, "chặng này phải có nhiều chương trình đặt được");
  const aa = need.byProgram.find((row) => row.programId === id<PointsProgramId>("aadvantage"));
  assert.ok(aa !== undefined && aa.high !== null);
  // Khoảng GỘP phải rộng hơn khoảng riêng của AAdvantage® — đó là lý do không
  // được đem số dư đi so với nó.
  assert.ok(need.high !== null && need.high > aa!.high!, "khoảng gộp phải rộng hơn");

  const holder: UserState = {
    ...vietnamTripFunded,
    balances: [
      {
        userId: vietnamTripFunded.profile.id,
        programId: id<PointsProgramId>("aadvantage"),
        balance: aa!.high! + 10_000,
        updatedAt: ASOF,
      },
    ],
    cards: [],
  };
  const covered = tripCoverage(holder, IX, ASOF, need);
  assert.equal(covered.coverage, 1, "đủ điểm cho chương trình của chính mình mà báo thiếu");
  assert.equal(covered.bestProgram, id<PointsProgramId>("aadvantage"));

  // Và hai con số trong cùng một đầu ra không được mâu thuẫn nhau.
  const result = run(holder).results[0];
  assert.equal(result.numbers.pointsGapTypical, 0);
  assert.ok(result.reasonCodes.includes("POINTS_ALREADY_SUFFICIENT"));
});

/* ================================================================== *
 * Vòng review Codex — các lỗi P2
 * ================================================================== */

test("gợi ý thay thế không được lặp lại cùng một HỌ thẻ", () => {
  // Ba hạng CIBC® Aeroplan® là ba hạng của MỘT thẻ, không phải ba lựa chọn.
  // Không gom lại thì một thẻ chiếm nhiều suất, và người đọc nhận "bốn lựa
  // chọn" mà thật ra là hai.
  for (const state of USER_FIXTURES) {
    for (const result of run(state).results) {
      const families = [result.primaryAction, ...result.alternatives]
        .map((c) => (c.productId === null ? null : IX.productById.get(c.productId)?.familyId ?? null))
        .filter((family): family is NonNullable<typeof family> => family !== null);
      assert.equal(
        families.length,
        new Set(families).size,
        `${state.profile.id}: một họ thẻ chiếm nhiều suất`,
      );
    }
  }
});

test("chỗ trống award chỉ tính cho chặng người dùng THẬT SỰ hỏi", () => {
  // Chuyến Canada–Việt Nam ĐÃ có giá. Báo kèm mọi vùng chưa có dữ liệu là nói
  // với người dùng rằng khuyến nghị của họ thiếu dữ liệu, trong khi nó không
  // thiếu — và §29 sẽ hạ độ tin cậy vì một chỗ trống không liên quan.
  const vietnam = run(vietnamTripFunded).dataGaps.filter(
    (gap) => gap.kind === "award_route_uncovered",
  );
  assert.deepEqual(vietnam, [], "chặng đã có giá mà vẫn báo thiếu award data");

  // Còn chuyến CHÂU ÂU thì phải báo — và chỉ báo chặng châu Âu.
  const europe = run(flexiblePointsSufficient).dataGaps.filter(
    (gap) => gap.kind === "award_route_uncovered",
  );
  assert.deepEqual(europe.map((gap) => gap.subjectId), ["CANADA_US|EUROPE"]);
});

test("chỗ trống của lớp dữ liệu KÉO độ tin cậy xuống, không chỉ để lại ghi chú", () => {
  // CÔ LẬP đúng một biến: cùng một người, cùng mọi thứ, chỉ đổi VÙNG ĐẾN —
  // một vùng đã dựng bảng giá và một vùng chưa. So hai NHÂN VẬT khác nhau
  // (như bài này từng làm) thì chênh lệch có thể đến từ bất kỳ chỗ trống nào
  // khác của hồ sơ, và bài kiểm thôi nói về award chart.
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  const priced = run(vietnamTripFunded).results[0].confidence;
  const unpricedRun = run({
    ...vietnamTripFunded,
    goals: [{ ...goal, destinationRegion: "EUROPE" as const }],
  });
  const unpriced = unpricedRun.results[0].confidence;

  // Chỗ trống phải được KHAI ra…
  assert.ok(unpricedRun.dataGaps.some((gap) => gap.kind === "award_route_uncovered"));
  assert.ok(unpricedRun.results[0].warnings.includes("AWARD_ROUTE_NOT_IN_DATASET"));

  // …và phải ĐẶT TRẦN độ tin cậy, không chỉ để lại ghi chú.
  //
  // Đo thật cho thấy `dataCompleteness` KHÔNG phân biệt được hai ca: nó đếm
  // theo LOẠI chỗ trống, nên `award_route_uncovered` cân bằng đúng một
  // `no_award_chart` và cả hai lượt chạy ra cùng 0.708. Chuyến châu Âu rơi
  // xuống `low` chỉ NHỜ điểm các ứng viên xúm lại — một sự tình cờ, không
  // phải một bảo đảm. Nên trần là thứ phải kiểm.
  assert.notEqual(unpriced.level, "high", "chặng chưa định giá mà vẫn tự tin CAO");
  assert.ok(
    unpriced.notes.some((note) => note.includes("chưa có bảng giá")),
    "phải nói ra lý do trong notes",
  );
  assert.equal(priced.level, "high", "mốc so sánh: chặng đã định giá vẫn được CAO");

  // Và TRẦN phải là thứ thật sự chặn, không phải một dòng ăn theo.
  //
  // Ca trên xanh kể cả khi gỡ trần đi, vì chuyến châu Âu vốn đã rơi xuống
  // `low` nhờ điểm các ứng viên xúm lại. Phải dựng ca mà khoảng cách điểm
  // RẤT TÁCH BẠCH — lúc đó chỉ còn trần ngăn engine tuyên bố `high` về một
  // chuyến bay nó không biết giá.
  const tripGoal = { ...goal, destinationRegion: "EUROPE" as const };
  const wide = computeConfidence({
    ranked: [
      { ...run(vietnamTripFunded).results[0].primaryAction, score: 0.95 },
      { ...run(vietnamTripFunded).results[0].primaryAction, score: 0.20 },
    ],
    goal: {
      goal: tripGoal,
      trip: resolveTripGoal(vietnamTripFunded.profile, tripGoal),
      tripNeed: tripNeedFor(
        resolveTripGoal(vietnamTripFunded.profile, tripGoal),
        IX,
        ASOF,
      ),
    },
    userGaps: [],
    dataGaps: [],
    oldestVerifiedAt: ASOF,
    asOf: ASOF,
  });
  assert.equal(wide.scoreSeparation, 1, "dựng đúng ca tách bạch tuyệt đối");
  assert.notEqual(wide.level, "high", "điểm tách bạch KHÔNG cứu được một chặng chưa định giá");
});

test("thẻ KHÔNG có welcome bonus được 0 điểm offer, không được ~0.4", () => {
  // `bonusKind: "none"` là một dòng offer THẬT nói rằng thẻ không có bonus.
  // Chỉ kiểm `active === null` thì chúng lọt qua và còn nhận hiệu quả chi tiêu
  // TỐI ĐA vì không đòi chi gì — tức được thưởng cho việc không có gì để
  // thưởng.
  const none = DATA.offers.filter((offer) => offer.bonusKind === "none");
  assert.ok(none.length > 0, "bộ dữ liệu phải còn thẻ không có welcome bonus");

  const product = DATA.products.find((p) => p.id === none[0].productId);
  assert.ok(product !== undefined);
  const facts = offerFacts(product!, IX, ASOF, { low: 5_000, high: 5_000 }, []);
  const climate = offerClimate([facts]);
  assert.equal(offerQualityScore(facts, climate), 0);
});

test("§30 — chỉ hỏi về thẻ doanh nghiệp khi có thẻ doanh nghiệp trong bảng", () => {
  const gaps = [
    { kind: "business_cards_preference_unknown" as const, subject: "profile", reason: "chưa hỏi" },
  ];
  const personal = nextQuestion({
    gaps,
    ranked: [{ ...run(beginnerNoCards).results[0].primaryAction }],
    businessProductIds: new Set<string>(),
  });
  assert.equal(personal, null, "không có thẻ doanh nghiệp nào mà vẫn hỏi");

  const winner = run(beginnerNoCards).results[0].primaryAction;
  const business = nextQuestion({
    gaps,
    ranked: [winner],
    businessProductIds: new Set([winner.productId as string]),
  });
  assert.equal(business?.gapKind, "business_cards_preference_unknown");
});

/* ================================================================== *
 * Vòng review Codex 2 — lỗi nằm trong chính bản vá của vòng 1
 * ================================================================== */

test("§6 — điểm tiếp cận được phải thuộc về CHÍNH chương trình đã chọn", () => {
  // Bản vá vòng 1 giữ `accessible` là cực đại toàn cục trong khi `bestProgram`
  // đi theo tỷ lệ phủ — hai đại lượng chọn độc lập, nên chúng tách ra ngay khi
  // chương trình nhiều điểm nhất KHÔNG phải chương trình phủ tốt nhất. Tầng
  // sau lấy giá của chương trình này trừ đi số điểm của chương trình kia.
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  const need = tripNeedFor(resolveTripGoal(vietnamTripFunded.profile, goal), IX, ASOF);

  const aa = need.byProgram.find((row) => row.programId === id<PointsProgramId>("aadvantage"));
  const asia = need.byProgram.find((row) => row.programId === id<PointsProgramId>("asia-miles"));
  assert.ok(aa?.high != null && asia?.high != null);
  assert.ok(asia!.high! > aa!.high!, "Asia Miles® phải đắt hơn AAdvantage® trên chặng này");

  // Nhiều điểm Asia Miles® hơn, nhưng AAdvantage® phủ tốt hơn theo TỶ LỆ.
  const aaPoints = Math.round(aa!.high! * 0.93);
  const asiaPoints = Math.round(asia!.high! * 0.8);
  assert.ok(asiaPoints > aaPoints, "dựng ca mà chương trình nhiều điểm hơn lại phủ kém hơn");

  const split: UserState = {
    ...vietnamTripFunded,
    cards: [],
    balances: [
      { userId: vietnamTripFunded.profile.id, programId: id<PointsProgramId>("aadvantage"), balance: aaPoints, updatedAt: ASOF },
      { userId: vietnamTripFunded.profile.id, programId: id<PointsProgramId>("asia-miles"), balance: asiaPoints, updatedAt: ASOF },
    ],
  };

  const covered = tripCoverage(split, IX, ASOF, need);
  assert.equal(covered.bestProgram, id<PointsProgramId>("aadvantage"));
  assert.equal(
    covered.accessible,
    aaPoints,
    "trả về số điểm của một chương trình KHÁC với chương trình đã chọn",
  );

  // Và khoảng cách báo ra phải khác 0 — đó là con số người đọc hành động theo.
  const result = run(split).results[0];
  assert.ok((result.numbers.pointsGapTypical ?? 0) > 0, "báo khoảng cách 0 trong khi vẫn còn thiếu");
});

test("chỗ trống `no_award_chart` chỉ tính cho mục tiêu CHUYẾN ĐI", () => {
  // Câu "chương trình này không công bố bảng giá" chỉ có nghĩa khi ai đó định
  // đổi vé. Bản vá vòng 1 gom cả sản phẩm ứng viên, nên một người hỏi "thẻ
  // tiếp theo" bị báo thiếu bảng giá MileagePlus® chỉ vì thẻ United® có mặt
  // trong danh sách.
  const nextCard = run(beginnerNoCards).dataGaps.filter((gap) => gap.kind === "no_award_chart");
  assert.deepEqual(nextCard, [], "mục tiêu không phải chuyến đi mà vẫn báo thiếu bảng giá");
});

test("chỗ trống `no_award_chart` tính cả chương trình người dùng ĐANG GIỮ", () => {
  // Avios® có `no_award_chart` và KHÔNG có thẻ nào trong bộ dữ liệu kiếm nó
  // trực tiếp. Bản vá vòng 1 chỉ gom chương trình định giá được chặng, nên
  // người giữ Avios® mất hẳn chỗ trống đó — engine lặng lẽ bỏ qua số điểm của
  // họ mà không hạ độ tin cậy.
  assert.ok(
    DATA.gaps.some((gap) => gap.kind === "no_award_chart" && gap.subjectId === "avios"),
    "bộ dữ liệu phải còn khai avios là no_award_chart",
  );
  const holder: UserState = {
    ...vietnamTripFunded,
    balances: [
      ...vietnamTripFunded.balances,
      { userId: vietnamTripFunded.profile.id, programId: AVIOS, balance: 80_000, updatedAt: ASOF },
    ],
  };
  const gaps = run(holder).dataGaps.filter((gap) => gap.kind === "no_award_chart");
  assert.ok(
    gaps.some((gap) => gap.subjectId === "avios"),
    "người giữ Avios® mà chỗ trống bảng giá của nó biến mất",
  );
});

test("§29 — độ tươi chỉ đọc award strategy của CHẶNG đang hỏi", () => {
  // Quét cả bảng thì một chiến lược cũ cho một vùng chẳng liên quan cũng kéo
  // `dataFreshness` xuống, và một khuyến nghị hoàn toàn tươi bị hạ độ tin cậy
  // vì dữ liệu nó không hề đọc.
  const stale = {
    ...DATA,
    awardStrategies: DATA.awardStrategies.map((row) =>
      // Làm cũ MỌI chiến lược không thuộc chặng Việt Nam.
      row.destinationRegion === "SEA_VIETNAM" ? row : { ...row, verifiedAt: "2020-01-01" },
    ),
  };
  const ix = indexDataset(stale);
  const before = run(vietnamTripFunded).results[0].confidence.dataFreshness;
  const after = recommend({ state: vietnamTripFunded, data: stale, ix, asOf: ASOF }).results[0]
    .confidence.dataFreshness;
  assert.equal(after, before, "dữ liệu của chặng khác kéo tụt độ tươi của chặng này");
});

test("§20 — bản chụp hành vi khoá theo ENGINE_VERSION", async () => {
  // Bài test cũ ở đây chỉ so `ENGINE_VERSION !== "3.0.0"` — xanh vĩnh viễn
  // ngay sau lần tăng đầu tiên, tức một bài test KHÔNG bảo vệ gì. Vòng review
  // bắt đúng chỗ đó.
  //
  // Thay bằng thứ cưỡng chế được luật thật của §20: cùng đầu vào + CÙNG
  // VERSION = cùng đầu ra. Bản chụp khoá kết quả của cả 15 nhân vật vào
  // version hiện tại.
  //
  // HAI ĐƯỜNG TÁCH BẠCH, và tách chúng ra là bài học của một vòng review nữa:
  //
  //   chạy test bình thường → chỉ ĐỌC và SO. Lệch, thiếu file, hay lệch
  //                            version đều là ĐỎ.
  //   `UPDATE_ENGINE_SNAPSHOT=1` → ghi lại bản chụp. Một hành động CÓ CHỦ Ý.
  //
  // Bản trước gộp hai đường: nó tự ghi khi version đổi, và bọc phép ghi trong
  // try/catch để CI đọc-only không gãy. Hai thứ đó cộng lại thành một lỗ:
  // tăng version mà quên commit bản chụp, chạy trên CI đọc-only, thì phép ghi
  // hỏng, ngoại lệ bị nuốt, và test XANH — mãi mãi, không bao giờ so hành vi
  // một lần nào nữa. Một bản vá "phòng thủ" tự vô hiệu hoá đúng thứ nó bảo vệ.
  const { readFile, writeFile } = await import("node:fs/promises");
  const path = new URL("./engine.snapshot.json", import.meta.url);

  /**
   * Dấu vân tay của BỘ DỮ LIỆU, tách khỏi version của ENGINE.
   *
   * Hai thứ đổi vì hai lý do khác nhau, và gộp chúng lại thì mỗi lần thêm một
   * dòng award chart lại buộc phải tăng `ENGINE_VERSION` — trong khi logic
   * không đổi một dòng. §20 replay lưu `input_snapshot` của chính lượt chạy
   * đó, nên `ENGINE_VERSION` chỉ nói về LOGIC; dữ liệu đi kèm bản chụp.
   *
   * Giữ cả hai ở đây thì thông báo lỗi nói được ĐÚNG thứ đã đổi.
   */
  //
  // Băm NỘI DUNG, không đếm số dòng. Đếm dòng hỏng theo cả hai chiều: sửa một
  // tỷ lệ tích điểm tại chỗ thì mọi con số đếm đứng yên (nên đường cập nhật
  // TỪ CHỐI một thay đổi dữ liệu hợp lệ), còn thêm một dòng chẳng liên quan
  // thì lại cho một thay đổi LOGIC chưa đánh version đi lọt.
  const canonical = JSON.stringify([
    DATA.products, DATA.productFees, DATA.productAvailability, DATA.offers,
    DATA.offerComponents, DATA.earningRates, DATA.earningCaps, DATA.benefits,
    DATA.productBenefits, DATA.eligibilityRules, DATA.transferPaths,
    DATA.awardStrategies, DATA.programValuations, DATA.pointsPrograms,
  ]);
  // FNV-1a: ổn định giữa các lần chạy và giữa các máy, không phụ thuộc thư viện.
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const datasetFingerprint = `${canonical.length}-${hash.toString(16)}`;

  const actual = {
    engineVersion: ENGINE_VERSION,
    datasetFingerprint,
    runs: USER_FIXTURES.map((state) => {
      const result = run(state);
      const first = result.results[0];
      return {
        user: state.profile.id as string,
        goalResolution: result.goalResolution,
        followUp: result.followUp?.gapKind ?? null,
        primary: first?.primaryAction.productSlug ?? first?.primaryAction.kind ?? null,
        score: first === undefined ? null : Number(first.primaryAction.score.toFixed(4)),
        noAction: first === undefined ? null : Number(first.noAction.score.toFixed(4)),
        strategy: first?.strategy.strategy ?? null,
        confidence: first?.confidence.level ?? null,
        reasonCodes: first?.reasonCodes ?? [],
        numbers: first?.numbers ?? null,
        // Ghi cả các gợi ý thay thế: một thay đổi chỉ xáo trộn thứ hạng phía
        // dưới vẫn là một thay đổi HÀNH VI, và bản chụp chỉ nhìn ứng viên
        // đứng đầu sẽ để nó trôi qua. Đã kiểm thật — sửa hình phạt của §16
        // Rule 1 không đổi người thắng của `vietnamTripFunded` (là
        // NO_NEW_CARD) mà chỉ đảo thứ tự bên dưới.
        alternatives:
          first?.alternatives.map((candidate) => [
            candidate.productSlug,
            Number(candidate.score.toFixed(4)),
          ]) ?? [],
      };
    }),
  };

  const raw = await readFile(path, "utf8").catch(() => null);

  if (process.env.UPDATE_ENGINE_SNAPSHOT === "1") {
    // Đường cập nhật KHÔNG được ban phước cho một thay đổi hành vi chưa tăng
    // version. Không có phép kiểm này thì cách dễ nhất để làm test xanh trở
    // lại là chạy đúng lệnh cập nhật — và bất biến §20 mất sạch ý nghĩa, vì
    // hai kết quả khác nhau lại được lưu dưới cùng một version.
    if (raw !== null) {
      const current = JSON.parse(raw) as typeof actual;
      const drifted = JSON.stringify(current.runs) !== JSON.stringify(actual.runs);
      const sameEngine = current.engineVersion === ENGINE_VERSION;
      const sameData = current.datasetFingerprint === datasetFingerprint;
      assert.ok(
        !(sameEngine && sameData && drifted),
        `Hành vi đã đổi nhưng CẢ ${ENGINE_VERSION} lẫn dấu vân tay dữ liệu ` +
          `(${datasetFingerprint}) đều đứng yên. Tăng ENGINE_VERSION nếu đổi ` +
          "logic; nếu đổi dữ liệu thì dấu vân tay phải tự đổi theo — đứng yên " +
          "cả hai nghĩa là một hồi quy không ai đánh dấu.",
      );
    }
    await writeFile(path, `${JSON.stringify(actual, null, 2)}\n`, "utf8");
    return;
  }

  assert.ok(
    raw !== null,
    "thiếu engine.snapshot.json — chạy `UPDATE_ENGINE_SNAPSHOT=1 npm run test:reco` rồi COMMIT file đó",
  );
  const expected = JSON.parse(raw as string) as typeof actual;

  assert.equal(
    expected.engineVersion,
    ENGINE_VERSION,
    `bản chụp đang ở ${expected.engineVersion} còn engine ở ${ENGINE_VERSION}. ` +
      "Đổi version là đổi hành vi CÓ CHỦ Ý — chạy " +
      "`UPDATE_ENGINE_SNAPSHOT=1 npm run test:reco` rồi COMMIT bản chụp mới.",
  );
  assert.equal(
    expected.datasetFingerprint,
    datasetFingerprint,
    `bộ dữ liệu đã đổi (${expected.datasetFingerprint} → ${datasetFingerprint}) ` +
      "mà bản chụp chưa cập nhật. Thêm/bớt dữ liệu KHÔNG cần tăng " +
      "ENGINE_VERSION — logic không đổi — nhưng bản chụp thì phải chạy lại.",
  );

  assert.deepEqual(
    actual.runs,
    expected.runs,
    `Hành vi đã đổi trong khi engine (${ENGINE_VERSION}) và dữ liệu ` +
      `(${datasetFingerprint}) đều đứng yên. ` +
      "Nếu đây là đổi CÓ CHỦ Ý thì tăng ENGINE_VERSION (§20 replay đọc nó) rồi " +
      "chạy `UPDATE_ENGINE_SNAPSHOT=1 npm run test:reco`; nếu không thì đây là một hồi quy.",
  );
});

/* ================================================================== *
 * Vòng review Codex 3 — lỗi trong bản vá của vòng 2
 * ================================================================== */

test("§12 — không xác định được ĐƠN VỊ thì KHÔNG so, chứ không đoán", () => {
  // Ba cách đoán đều đã thử và đều hỏng: tra ngược theo con số (không thấy thì
  // mở toang mọi đơn vị), gán cứng cash→dollar (lọc sạch các đợt phần trăm),
  // lấy đơn vị đợt gần nhất (recorder chạy mỗi ngày một lượt, nên một thẻ vừa
  // đổi từ 15% sang $250 vẫn còn `percent` ở dòng cuối → so 250 với 10/15/20
  // ra percentile 100 và một mã CURRENT_OFFER_STRONG hoàn toàn bịa).
  const percentHistory = [
    { at: "2026-01-01", until: null, startCensored: true, endCensored: false, label: "10%", amount: 10, unit: "percent" as const },
    { at: "2026-02-01", until: null, startCensored: false, endCensored: false, label: "15%", amount: 15, unit: "percent" as const },
    { at: "2026-03-01", until: null, startCensored: false, endCensored: true, label: "20%", amount: 20, unit: "percent" as const },
  ];
  // Offer hiện tại là $250, nhật ký chưa kịp ghi. Đơn vị KHÔNG xác định được.
  assert.equal(historicalPercentile(percentHistory, 250, null).percentile, null);

  // Cùng con số xuất hiện dưới HAI đơn vị khác nhau cũng là không xác định.
  const mixed = [
    ...percentHistory,
    { at: "2026-04-01", until: null, startCensored: false, endCensored: true, label: "$15", amount: 15, unit: "dollar" as const },
  ];
  const ambiguous = new Set(mixed.filter((p) => p.amount === 15).map((p) => p.unit));
  assert.equal(ambiguous.size, 2, "dựng ca hai đơn vị cho cùng một con số");
});

test("chỗ trống bảng giá tính cả đồng tiền của thẻ ỨNG VIÊN, nhưng chỉ khi có chuyến đi", () => {
  // Thẻ United® vẫn được chấm điểm cho một mục tiêu chuyến đi, và `scoreTrip`
  // cho nó mức thấp nhất CHÍNH VÌ MileagePlus® không định giá được chặng. Chỗ
  // trống đó có thật.
  const united = DATA.products.find(
    (p) => p.slug === "united-mileageplus-neo-world-elite-mastercard",
  );
  assert.ok(united?.pointsProgramId != null);
  assert.ok(
    DATA.gaps.some((g) => g.kind === "no_award_chart" && g.subjectId === united!.pointsProgramId),
    "bộ dữ liệu phải còn khai mileageplus là no_award_chart",
  );

  const trip = run(vietnamTripFunded).dataGaps.filter((g) => g.kind === "no_award_chart");
  assert.ok(
    trip.some((g) => g.subjectId === united!.pointsProgramId),
    "mục tiêu chuyến đi mà bỏ qua chỗ trống bảng giá của một thẻ ứng viên",
  );

  // Nhưng KHÔNG được rò sang người chỉ hỏi "thẻ tiếp theo".
  assert.deepEqual(
    run(beginnerNoCards).dataGaps.filter((g) => g.kind === "no_award_chart"),
    [],
  );
});

test("số dư bằng 0 là CÂU TRẢ LỜI, không phải một chương trình đang tham gia", () => {
  // `balance: 0` = "đã hỏi, không có điểm nào". Không đồng điểm nào của chương
  // trình đó tham gia phép tính, nên khai thiếu bảng giá của nó là hạ độ tin
  // cậy vì một thứ không ảnh hưởng gì. `balance: null` thì ngược lại — có tài
  // khoản, chưa biết bao nhiêu.
  const withZero: UserState = {
    ...vietnamTripFunded,
    balances: [
      ...vietnamTripFunded.balances,
      { userId: vietnamTripFunded.profile.id, programId: AVIOS, balance: 0, updatedAt: ASOF },
    ],
  };
  const withUnknown: UserState = {
    ...vietnamTripFunded,
    balances: [
      ...vietnamTripFunded.balances,
      { userId: vietnamTripFunded.profile.id, programId: AVIOS, balance: null, updatedAt: ASOF },
    ],
  };
  const gapsOf = (state: UserState) =>
    run(state)
      .dataGaps.filter((g) => g.kind === "no_award_chart")
      .map((g) => g.subjectId);

  assert.ok(!gapsOf(withZero).includes("avios"), "số dư 0 mà vẫn khai thiếu bảng giá");
  assert.ok(gapsOf(withUnknown).includes("avios"), "số dư chưa biết thì PHẢI khai");
});

/* ================================================================== *
 * Vòng review Codex 4 — bác lại chính bản vá của các vòng trước
 * ================================================================== */

test("§7 — 'chưa biết' KHÔNG được xuất ra thành 0 điểm", () => {
  // Đây là luật trống-≠-bằng-không thủng ngay tại BIÊN GIỚI ĐẦU RA — chỗ nguy
  // hiểm nhất, vì con số này đi thẳng vào câu engine nói với người đọc.
  // `flexiblePointsSufficient` có 240,000 điểm Membership Rewards®, và bản
  // trước xuất ra `accessiblePoints: 0` chỉ vì chặng chưa có award strategy.
  const unpriced = run(flexiblePointsSufficient).results[0];
  assert.equal(unpriced.numbers.accessiblePoints, null, "chưa tra được giá mà báo 0 điểm");
  assert.equal(unpriced.numbers.directPoints, null);
  assert.equal(unpriced.numbers.pointsGapTypical, null);

  // Và số dư `null` (có tài khoản, không nhớ số) không được sinh ra một
  // khoảng cách CHÍNH XÁC GIẢ.
  const unsure: UserState = {
    ...vietnamTripFunded,
    balances: [
      { userId: vietnamTripFunded.profile.id, programId: AEROPLAN, balance: null, updatedAt: ASOF },
    ],
  };
  const result = run(unsure).results[0];
  assert.equal(
    result.numbers.pointsGapTypical,
    null,
    "số dư chưa biết mà vẫn báo còn thiếu đúng bao nhiêu điểm",
  );
  // Và con số điểm tiếp cận được phải TỰ NÓI ra rằng nó là cận dưới. Không có
  // cờ này thì "0 điểm" của người có tài khoản Aeroplan® đọc y hệt "0 điểm"
  // của người chưa từng mở tài khoản nào.
  assert.equal(result.numbers.accessiblePointsIsLowerBound, true);
  assert.equal(
    run(vietnamTripFunded).results[0].numbers.accessiblePointsIsLowerBound,
    false,
    "mọi số dư đã biết mà vẫn đánh dấu là cận dưới",
  );
});

test("§7 — cận dưới vẫn kết luận ĐỦ được, chỉ không kết luận THIẾU", () => {
  // Hướng an toàn: nếu cận DƯỚI đã phủ đủ thì chắc chắn đủ thật. Chiều ngược
  // lại thì không — chưa biết bao nhiêu thì không nói thiếu bao nhiêu.
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  const need = tripNeedFor(resolveTripGoal(vietnamTripFunded.profile, goal), IX, ASOF);
  const covered = tripCoverage(vietnamTripFunded, IX, ASOF, need);
  assert.equal(covered.accessibleIsLowerBound, false, "mọi số dư đều đã biết");
  assert.equal(covered.coverage, 1);
  assert.equal(run(vietnamTripFunded).results[0].numbers.pointsGapTypical, 0);
});

test("§12 — offer TIỀN MẶT: engine thôi đoán đơn vị", () => {
  // Bốn cách đoán đã thử và đều hỏng, cách cuối cùng là "con số này trước đây
  // chỉ từng thấy dưới một đơn vị" — nhưng lịch sử 5%/10%/15% cộng một offer
  // mới "$15" vẫn khớp con số 15 và trả về `percent`. Quá khứ của một CON SỐ
  // không chứng minh đơn vị của HIỆN TẠI.
  const percentHistory = [
    { at: "2026-01-01", until: null, startCensored: true, endCensored: false, label: "5%", amount: 5, unit: "percent" as const },
    { at: "2026-02-01", until: null, startCensored: false, endCensored: false, label: "10%", amount: 10, unit: "percent" as const },
    { at: "2026-03-01", until: null, startCensored: false, endCensored: true, label: "15%", amount: 15, unit: "percent" as const },
  ];
  const cashProduct = DATA.products.find((p) => p.slug === "scotiabank-momentum-visa-infinite-plus");
  assert.ok(cashProduct !== undefined);
  const facts = offerFacts(cashProduct!, IX, ASOF, { low: 5_000, high: 5_000 }, percentHistory);
  assert.equal(facts.active?.offer.bonusKind, "cash");
  assert.equal(
    facts.historicalPercentile,
    null,
    "offer tiền mặt vẫn đang được gán một đơn vị đoán được",
  );
});

test("chỗ trống bảng giá theo được ĐÍCH CHUYỂN ĐIỂM của số dư đang giữ", () => {
  // Người giữ Membership Rewards® thật sự đang nắm quyền đổi sang Avios® và
  // Flying Blue® — cả hai đều `no_award_chart`. Chỉ khai `amex-mr` là nuốt mất
  // đúng hai lựa chọn có thật mà engine không định giá nổi.
  const mrHolder: UserState = {
    ...vietnamTripFunded,
    balances: [
      { userId: vietnamTripFunded.profile.id, programId: AMEX_MR, balance: 120_000, updatedAt: ASOF },
    ],
  };
  const subjects = run(mrHolder)
    .dataGaps.filter((gap) => gap.kind === "no_award_chart")
    .map((gap) => gap.subjectId);
  assert.ok(subjects.includes("avios"), "MR đi được Avios® mà chỗ trống của nó biến mất");
  assert.ok(subjects.includes("flying-blue"));
});

test("chặng CHƯA định giá không bị trừ độ tin cậy hai lần", () => {
  // Chuyến Nhật chưa có award strategy nào — scoring đã rơi về công thức
  // chung và không đọc bảng giá của MileagePlus®. Thêm chỗ trống đó vào là
  // trừ độ tin cậy lần thứ hai cho cùng một sự thật.
  const unpriced = run(flexiblePointsSufficient);
  const chartGaps = unpriced.dataGaps.filter((g) => g.kind === "no_award_chart");
  const united = DATA.products.find(
    (p) => p.slug === "united-mileageplus-neo-world-elite-mastercard",
  );
  assert.ok(
    !chartGaps.some((g) => g.subjectId === united!.pointsProgramId),
    "chặng chưa định giá mà vẫn khai chỗ trống của một thẻ ứng viên",
  );
  assert.ok(unpriced.dataGaps.some((g) => g.kind === "award_route_uncovered"));
});

/* ================================================================== *
 * Rà đối kháng — đầu vào THÙ ĐỊCH, không phải đầu vào mẫu
 *
 * Mọi ca dưới đây từng cho ra một con số SAI mà không lỗi nào nổ ra, và
 * không ca nào bị các test phía trên bắt. `validateUserState` cấm phần lớn
 * chúng, nhưng engine KHÔNG gọi validator — §30 đòi nhận hồ sơ dở dang —
 * nên engine phải tự phòng, và phòng theo đúng hướng của cả module: dữ liệu
 * không dùng được là CHƯA BIẾT, không phải một giá trị.
 * ================================================================== */

test("§7 — HAI DÒNG số dư cùng một chương trình không được cộng lại", () => {
  // Không gì trong `UserDataSource` hứa mỗi chương trình chỉ có một dòng.
  // Hai dòng 100,000 MR cộng thành 200,000 là ĐÚNG phép đếm trùng §7 cấm,
  // chỉ đến từ một hướng không ai canh.
  const twice: UserState = {
    ...beginnerNoCards,
    balances: [
      { userId: beginnerNoCards.profile.id, programId: AMEX_MR, balance: 100_000, updatedAt: ASOF },
      { userId: beginnerNoCards.profile.id, programId: AMEX_MR, balance: 100_000, updatedAt: ASOF },
    ],
  };
  assert.equal(accessibleFor(twice, IX, AEROPLAN, ASOF).total, 100_000);
  assert.deepEqual(accessibleFor(twice, IX, AEROPLAN, ASOF).sources, [AMEX_MR]);

  const once: UserState = { ...twice, balances: [twice.balances[0]] };
  assert.equal(
    analyzePortfolio(twice, IX, ASOF).knownValueCents,
    analyzePortfolio(once, IX, ASOF).knownValueCents,
    "giá trị danh mục bị nhân đôi bởi một dòng trùng",
  );
});

test("§7 — hai dòng nói HAI SỐ khác nhau là CHƯA BIẾT, không phải chọn bừa", () => {
  const conflicting: UserState = {
    ...beginnerNoCards,
    balances: [
      { userId: beginnerNoCards.profile.id, programId: AEROPLAN, balance: 10_000, updatedAt: ASOF },
      { userId: beginnerNoCards.profile.id, programId: AEROPLAN, balance: 90_000, updatedAt: ASOF },
    ],
  };
  assert.equal(balanceKnowledge(conflicting, AEROPLAN).kind, "unknown");
  assert.equal(analyzePortfolio(conflicting, IX, ASOF).hasUnknownBalance, true);
});

test("số dư ÂM là dữ liệu hỏng ⇒ CHƯA BIẾT, và tỷ trọng vẫn nằm trong [0,1]", () => {
  // `flexibilityScore` từng ra 2.12 — một tỷ trọng lớn hơn 1 — rồi lan sang
  // `needs.portfolio.flexibility` và mọi chiến lược đọc nó.
  const negative: UserState = {
    ...beginnerNoCards,
    balances: [
      { userId: beginnerNoCards.profile.id, programId: AEROPLAN, balance: -50_000, updatedAt: ASOF },
      { userId: beginnerNoCards.profile.id, programId: AMEX_MR, balance: 100_000, updatedAt: ASOF },
    ],
  };
  const portfolio = analyzePortfolio(negative, IX, ASOF);
  assert.equal(balanceKnowledge(negative, AEROPLAN).kind, "unknown");
  assert.ok(portfolio.flexibilityScore >= 0 && portfolio.flexibilityScore <= 1);
  const total = portfolio.concentration.reduce((sum, row) => sum + row.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `tổng tỷ trọng = ${total}`);
});

test("§6 — số người không phải SỐ NGUYÊN DƯƠNG thì không nhân, và nói ra", () => {
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  for (const passengers of [0, -2, 1.5]) {
    const need = tripNeedFor(
      resolveTripGoal(vietnamTripFunded.profile, { ...goal, passengers }),
      IX,
      ASOF,
    );
    assert.equal(need.low, null, `passengers=${passengers} vẫn ra một con số`);
    assert.equal(need.high, null);
    assert.equal(need.passengers, null);
    assert.ok(need.warnings.includes("TRIP_PASSENGERS_UNKNOWN"));
  }
  // `passengers: -2` từng cho "chuyến này cần −476,000 điểm".
  const negative = tripNeedFor(
    resolveTripGoal(vietnamTripFunded.profile, { ...goal, passengers: -2 }),
    IX,
    ASOF,
  );
  assert.ok((negative.perPassengerOneWayLow ?? 0) > 0, "con số gốc vẫn tra được");
});

test("hồ sơ VẮNG HẲN không được làm đổ cả lượt chạy", () => {
  // Kiểu hứa `profile` luôn có, nhưng kiểu vắng mặt lúc chạy và dữ liệu tới
  // từ database. Cùng lập luận đã sinh ra `asArray`/`isObject` ở Phase 2.
  for (const broken of [
    { ...vietnamTripFunded, profile: undefined },
    { ...vietnamTripFunded, profile: { ...vietnamTripFunded.profile, country: undefined } },
  ] as never as UserState[]) {
    const result = run(broken);
    assert.ok(result.results.length >= 0, "không được ném");
  }
});

test("§14 — operator engine KHÔNG hiểu thì trả `unknown`, không im lặng coi là gte", () => {
  // `EligibilityRule.operator` có năm giá trị, engine chỉ đọc đúng hai. Một
  // luật `lte` bị đọc như `gte` là đọc NGƯỢC một luật CỨNG — loại đúng những
  // người đủ điều kiện, hoặc hứa một thẻ ngân hàng sẽ từ chối.
  // Chọn một luật ĐỨNG RIÊNG, không thuộc nhóm HOẶC nào. Luật thu nhập nằm
  // trong nhóm "income" (cá nhân HOẶC hộ gia đình), nên một vế không đánh giá
  // được mà vế kia vẫn đạt thì cả nhóm ĐẠT — đó là phép HOẶC hoạt động đúng,
  // không phải chỗ để thử luật này.
  const product = productIdFor("scotiabank-scene-plus-visa-students");
  const solo = DATA.eligibilityRules.find(
    (rule) => rule.productId === product && rule.ruleType === "student_status_required",
  );
  assert.ok(solo !== undefined && solo.ruleGroup === null, "cần một luật cứng đứng riêng");

  const student: UserState = {
    ...beginnerNoCards,
    profile: { ...beginnerNoCards.profile, isStudent: true },
  };
  assert.equal(
    evaluateEligibility(product, student, IX, ASOF).status,
    "eligible",
    "mốc so sánh: operator hiểu được thì phán quyết bình thường",
  );

  const flipped = {
    ...DATA,
    eligibilityRules: DATA.eligibilityRules.map((rule) =>
      rule.id === solo!.id ? { ...rule, operator: "not_in" as const } : rule,
    ),
  };
  const verdict = evaluateEligibility(product, student, indexDataset(flipped), ASOF);
  assert.equal(verdict.status, "unknown", "operator lạ mà vẫn phán quyết chắc chắn");
  assert.ok(verdict.reasonCodes.includes("ELIGIBILITY_UNCERTAIN"));
});

test("§29 — MỘT ứng viên duy nhất thì không có khoảng cách để đo ⇒ không `high`", () => {
  // Người dùng đã giữ hết thẻ trong bộ dữ liệu: chỉ còn `NO_NEW_CARD`, và bản
  // trước lấy `second = 0` rồi kết luận "tách bạch tuyệt đối".
  const everything: UserState = {
    ...beginnerNoCards,
    cards: DATA.products
      .filter((product) => product.productType === "credit_card")
      .map((product, index) => ({
        id: id<UserCardId>(`uc_all_${index}`),
        userId: beginnerNoCards.profile.id,
        productId: product.id,
        status: "active" as const,
        openedDate: "2024-01-01",
        closedDate: null,
      })),
  };
  const result = run(everything).results[0];
  assert.equal(result.primaryAction.kind, "no_new_card");
  assert.equal(result.alternatives.length, 0);
  assert.notEqual(result.confidence.level, "high", "một ứng viên mà vẫn tự tin CAO");
});

test("§6 — chương trình CÓ ĐIỂM mà không định giá nổi ⇒ thôi nói khoảng cách chính xác", () => {
  // Ca thật: hạng phổ thông đặc biệt Canada→Việt Nam chỉ có Aeroplan® ở dạng
  // `dynamic_floor`, nên nó bị loại khỏi phép đo phủ. Người giữ 260,000 điểm
  // Aeroplan® bị kết luận "phủ 0%, còn thiếu đúng 100,000 điểm" — đo trên hai
  // chương trình họ không có đồng nào.
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  const premium = { ...goal, cabin: "premium_economy" as const };
  const need = tripNeedFor(resolveTripGoal(vietnamTripFunded.profile, premium), IX, ASOF);

  const aeroplanRow = need.byProgram.find((row) => row.programId === AEROPLAN);
  assert.ok(aeroplanRow !== undefined && aeroplanRow.high === null, "dựng đúng ca giá sàn");

  const covered = tripCoverage(vietnamTripFunded, IX, ASOF, need);
  assert.deepEqual(covered.unpricedHeldPrograms, [AEROPLAN]);
  assert.equal(covered.accessibleIsLowerBound, true);

  const result = run({ ...vietnamTripFunded, goals: [premium] }).results[0];
  assert.equal(result.numbers.pointsGapTypical, null, "vẫn nói một khoảng cách chính xác");
  assert.ok(result.warnings.includes("AWARD_PRICE_FLOOR_ONLY"));
});

test("§16 Rule 6 — thẻ trùng HẾT quyền lợi thì giá trị tăng thêm bằng 0", () => {
  const product = DATA.products.find((p) => p.slug === "td-aeroplan-visa-infinite");
  assert.ok(product !== undefined);
  const held = heldBenefitKeys([product!], IX, ASOF);
  const fit = benefitFitFor(product!.id, held, IX, ASOF);
  assert.equal(fit.incrementalCount, 0);
  assert.equal(fit.incrementalCashCents, 0);
  assert.equal(fit.duplicatedCount, fit.totalCount);
  assert.ok(fit.reasonCodes.includes("EXISTING_BENEFIT_DUPLICATION"));
});

test("§7 — chương trình chưa có ĐỊNH GIÁ không phá phép đo tập trung", () => {
  const exotic: UserState = {
    ...beginnerNoCards,
    balances: [
      { userId: beginnerNoCards.profile.id, programId: id<PointsProgramId>("khong-ton-tai"), balance: 500_000, updatedAt: ASOF },
      { userId: beginnerNoCards.profile.id, programId: AEROPLAN, balance: 100_000, updatedAt: ASOF },
    ],
  };
  const portfolio = analyzePortfolio(exotic, IX, ASOF);
  const total = portfolio.concentration.reduce((sum, row) => sum + row.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `tổng tỷ trọng = ${total}`);
  // Vẫn được ghi nhận là CÓ số dư, chỉ không đưa vào phép đo giá trị.
  assert.equal(portfolio.direct.size, 2);
});

test("§8/§9 — tầng chiến lược và nhu cầu KHÔNG nhắc tên sản phẩm nào", async () => {
  // Phép thử cấu trúc của "sinh hành động TRƯỚC khi nghĩ tới thẻ". Khoảnh khắc
  // một chiến lược ra đời vì một cái thẻ cụ thể, thứ tự suy luận của spec đã
  // bị đảo ngược.
  const { readFile } = await import("node:fs/promises");
  for (const name of ["strategies.ts", "needs.ts"]) {
    const text = await readFile(new URL(`./${name}`, import.meta.url), "utf8");
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const product of DATA.products) {
      assert.ok(!code.includes(product.slug), `${name} nhắc tới sản phẩm ${product.slug}`);
    }
  }
});

/* ================================================================== *
 * Rà đối kháng, vòng 2 — "chưa biết" phải LAN tới siêu dữ liệu
 *
 * Bản vá vòng trước biến giá trị hỏng thành CHƯA BIẾT ở bên trong engine,
 * nhưng `userGaps`, `goalSpecificity` và các cảnh báo vẫn đọc giá trị THÔ.
 * Engine coi là chưa biết, siêu dữ liệu lại báo đã biết đủ: không sinh chỗ
 * trống, không hạ độ tin cậy, không hỏi lại. Một nửa bản vá tệ hơn không vá,
 * vì nó tạo ra vẻ ngoài đã xử lý.
 * ================================================================== */

test("§14 — thiếu NƯỚC Ở là chưa biết, không được loại sạch tập ứng viên", () => {
  // Luật cư trú áp cho MỌI thẻ. Coi thiếu-dữ-liệu là trượt sẽ loại sạch bảng
  // và trả `NO_NEW_CARD` — một khuyến nghị trông có lý, dựng trên một dữ kiện
  // chưa ai hỏi.
  const noCountry: UserState = {
    ...beginnerNoCards,
    profile: { ...beginnerNoCards.profile, country: undefined as never },
  };
  const verdict = evaluateEligibility(
    productIdFor("td-aeroplan-visa-infinite"),
    noCountry,
    IX,
    ASOF,
  );
  assert.notEqual(verdict.status, "ineligible");

  const result = run(noCountry).results[0];
  assert.ok(result.alternatives.length > 0, "tập ứng viên bị quét sạch vì thiếu nước ở");
});

test("mọi chỗ trống phải có `subject` dùng được, kể cả khi hồ sơ vắng hẳn", () => {
  // `undefined` ở đó biến chỗ trống thành rác không tra ngược được, đúng lúc
  // §30 cần nó để chọn câu hỏi tiếp theo.
  const noProfile = { ...vietnamTripFunded, profile: undefined } as never as UserState;
  for (const gap of userGaps(noProfile)) {
    assert.equal(typeof gap.subject, "string", `chỗ trống ${gap.kind} có subject không dùng được`);
    assert.ok(gap.subject.length > 0);
  }
});

test("thiếu THỪA SỐ chuyến đi ≠ thiếu GIÁ của chương trình", () => {
  // Thiếu số người làm MỌI `row.high` thành null, kể cả những chương trình có
  // bảng giá cố định đầy đủ. Bản vá đầu đọc `row.high` nên kết luận mọi
  // chương trình đều "chưa định giá" và phát AWARD_PRICE_FLOOR_ONLY cho một
  // chặng giá cố định bình thường.
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  const result = run({ ...vietnamTripFunded, goals: [{ ...goal, passengers: null }] }).results[0];
  assert.ok(result.warnings.includes("TRIP_PASSENGERS_UNKNOWN"));
  assert.ok(
    !result.warnings.includes("AWARD_PRICE_FLOOR_ONLY"),
    "thiếu thừa số bị báo nhầm thành thiếu bảng giá",
  );
  assert.equal(result.numbers.accessiblePointsIsLowerBound, false);
});

test("thừa số chuyến đi bị làm sạch phải LAN tới chỗ trống và độ cụ thể", () => {
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  const full = run(vietnamTripFunded).results[0].confidence.goalSpecificity;

  for (const passengers of [0, -2, 1.5]) {
    const broken: UserState = { ...vietnamTripFunded, goals: [{ ...goal, passengers }] };
    assert.ok(
      userGaps(broken).some((gap) => gap.kind === "trip_passengers_unknown"),
      `passengers=${passengers} không sinh chỗ trống`,
    );
    assert.ok(
      run(broken).results[0].confidence.goalSpecificity < full,
      `passengers=${passengers} mà độ cụ thể của mục tiêu không giảm`,
    );
  }
});

test("số dư bị TỪ CHỐI phải sinh chỗ trống y như số dư `null`", () => {
  // `portfolio.ts` coi số âm và hai dòng lệch nhau là chưa biết. `userGaps`
  // đọc giá trị thô thì hai tầng nói hai chuyện khác nhau về cùng một dòng.
  const row = (balance: number | null) => ({
    userId: beginnerNoCards.profile.id,
    programId: AEROPLAN,
    balance,
    updatedAt: ASOF,
  });
  const has = (state: UserState) =>
    userGaps(state).some((gap) => gap.kind === "point_balance_amount_unknown");

  assert.ok(has({ ...beginnerNoCards, balances: [row(-5)] }), "số dư âm");
  assert.ok(has({ ...beginnerNoCards, balances: [row(10), row(90)] }), "hai dòng lệch nhau");
  assert.ok(has({ ...beginnerNoCards, balances: [row(null)] }), "số dư null");
  // Hai dòng KHỚP nhau thì không phải chỗ trống — và chỉ sinh MỘT chỗ trống
  // cho mỗi chương trình, không phải một chỗ cho mỗi dòng.
  assert.ok(!has({ ...beginnerNoCards, balances: [row(50), row(50)] }), "hai dòng khớp nhau");
  assert.equal(
    userGaps({ ...beginnerNoCards, balances: [row(null), row(null)] }).filter(
      (gap) => gap.kind === "point_balance_amount_unknown",
    ).length,
    1,
    "hai dòng cùng chương trình sinh hai chỗ trống",
  );
});

test("một khái niệm, một hàm: engine và chỗ trống dùng CHUNG phép kiểm", () => {
  // Phép thử cấu trúc cho bài học đã trả giá ba lần (`isObject`, đơn vị offer,
  // và chính vòng này). Nếu `user-gaps.ts` tự viết lại phép kiểm hợp lệ thay
  // vì gọi hàm chung, hai tầng sẽ lệch nhau lần nữa.
  assert.equal(usableBalance(-1), null);
  assert.equal(usableBalance(0), 0, "0 là một câu trả lời hợp lệ, không phải rác");
  assert.equal(usablePassengers(0), null);
  assert.equal(usablePassengers(2), 2);
  assert.equal(usableRoundTrip("false" as never), null, "chuỗi truthy không phải boolean");
  assert.equal(usableRoundTrip(false), false);
});

test("thiếu NƯỚC Ở sinh chỗ trống, hạ độ tin cậy, và thành câu hỏi ƯU TIÊN", () => {
  // `evaluateEligibility` trả `unknown` cho TOÀN BỘ tập ứng viên khi thiếu
  // nước ở — mọi thẻ bị phạt và kèm cảnh báo cùng lúc. Không khai chỗ trống
  // này thì §29 không hạ độ tin cậy và §30 đi hỏi những câu chẳng liên quan,
  // trong khi đây là câu DUY NHẤT gỡ được cả bảng.
  const noCountry: UserState = {
    ...beginnerNoCards,
    profile: { ...beginnerNoCards.profile, country: undefined as never },
  };
  assert.ok(userGaps(noCountry).some((gap) => gap.kind === "country_unknown"));

  const result = run(noCountry);
  assert.equal(result.followUp?.gapKind, "country_unknown", "hỏi sai câu");
  assert.ok(
    result.results[0].confidence.dataCompleteness <
      run(beginnerNoCards).results[0].confidence.dataCompleteness,
    "thiếu nước ở mà độ đầy đủ không giảm",
  );
});

test("`tripNeedFor` tự phòng ở BIÊN GIỚI của chính nó", () => {
  // Nó được export, và `ResolvedTripGoal.passengers` vẫn là `number | null`,
  // nên một người gọi hợp lệ về kiểu vẫn truyền thẳng `0` vào mà không đi qua
  // `resolveTripGoal`. Gọi lại cùng một hàm thuần thì vô hại; một biên giới
  // không ai canh thì không.
  const goal = vietnamTripFunded.goals[0];
  if (goal.type !== "trip") return;
  const resolved = resolveTripGoal(vietnamTripFunded.profile, goal);
  const forged = { ...resolved, passengers: 0 };
  const need = tripNeedFor(forged, IX, ASOF);
  assert.equal(need.low, null, "gọi thẳng với passengers=0 vẫn ra một con số");
  assert.ok(need.warnings.includes("TRIP_PASSENGERS_UNKNOWN"));
});

test("id người dùng phục hồi được từ BẤT KỲ bản ghi nào, kể cả chỉ có `spend`", () => {
  const onlySpend = {
    profile: undefined,
    spend: { ...beginnerNoCards.spend },
    cards: [],
    balances: [],
    goals: [],
    declared: { cards: false, balances: false },
  } as never as UserState;
  for (const gap of userGaps(onlySpend)) {
    assert.notEqual(gap.subject, "unknown-user", `${gap.kind} mất id thật của người dùng`);
  }
});

/* ================================================================== *
 * Rà theo góc nhìn CHƠI ĐIỂM — lời khuyên có đúng ngoài đời không
 *
 * Mọi ca dưới đây engine đều tính ĐÚNG về mặt số học trước khi sửa; cái sai
 * là lời khuyên đi ra. Đó là lớp lỗi mà test kỹ thuật không bắt được, vì
 * không có bất biến nào bị vi phạm — chỉ có một người thật bị khuyên sai.
 * ================================================================== */

test("linh hoạt là MỘT THANG, không phải có/không", () => {
  // Membership Rewards® đi được 5 nơi ai cũng đi được; Avion® đi được đúng
  // MỘT (WestJet®) — ba đích còn lại đòi hạng Avion® Elite. Với người không
  // có hạng đó, Avion® gần như là đồng tiền CỐ ĐỊNH tiêu qua cổng du lịch.
  // Chấm cả hai bằng 1.0 là nói rằng hai thứ giữ lại cùng một lượng lựa chọn.
  const mr = flexibilityReach(IX, AMEX_MR, ASOF);
  const avion = flexibilityReach(IX, id<PointsProgramId>("avion"), ASOF);
  const aeroplan = flexibilityReach(IX, AEROPLAN, ASOF);
  assert.equal(mr, 1, "MR với tới nhiều nhất nên là mốc 1.0");
  assert.ok(avion > 0 && avion < mr, `Avion® phải nằm GIỮA: đang là ${avion}`);
  assert.equal(aeroplan, 0, "Aeroplan® không chuyển đi đâu được");

  // Và thang đó phải ĐI VÀO điểm: thưởng "giữ điểm linh hoạt" của §16 Rule 2
  // không được bằng nhau cho hai đồng tiền khác nhau một trời một vực.
  const bonusOf = (slug: string) => {
    const result = run(aeroplanHeavy).results[0];
    return [result.primaryAction, ...result.alternatives]
      .find((c) => c.productSlug === slug)
      ?.adjustments.find((a) => a.rule === "R2_keep_points_flexible")?.delta;
  };
  const mrBonus = bonusOf("amex-gold-rewards");
  const avionBonus = bonusOf("rbc-avion-visa-platinum");
  if (mrBonus !== undefined && avionBonus !== undefined) {
    assert.ok(mrBonus > avionBonus, `MR ${mrBonus} phải được thưởng hơn Avion® ${avionBonus}`);
  }
});

test("CHƯA HỎI ngưỡng phí không phải là ĐỒNG Ý với thẻ $799", () => {
  // Hồ sơ trống: `benefits_fit` đếm quyền lợi tăng thêm, mà người chưa có thẻ
  // nào thì MỌI quyền lợi đều mới — nên thẻ đắt nhất có nhiều quyền lợi nhất
  // và không có gì kéo lại. Amex® Business Platinum $799 từng đứng đầu bảng
  // cho một người chưa khai một chữ nào.
  const blank: UserState = {
    profile: {
      ...beginnerNoCards.profile,
      annualPersonalIncome: null,
      annualFeeTolerancePerCard: null,
      businessCardsAllowed: null,
      hasBusiness: null,
      isStudent: null,
    },
    spend: null,
    cards: [],
    balances: [],
    goals: beginnerNoCards.goals,
    declared: { cards: false, balances: false },
  };
  const result = run(blank).results[0];
  const fee = result.primaryAction.suitability?.firstYearFee ?? 0;
  assert.ok(fee <= 300, `hồ sơ trống mà được khuyên thẻ phí $${fee}`);

  // Và thẻ phí cao phải mang mã nói ra vì sao nó bị hạ điểm.
  const pricey = DATA.products.find((p) => p.slug === "amex-business-platinum");
  const scored = [result.primaryAction, ...result.alternatives].find(
    (c) => c.productId === pricey?.id,
  );
  if (scored !== undefined) {
    assert.ok(scored.reasonCodes.includes("ANNUAL_FEE_HIGH_TOLERANCE_UNKNOWN"));
  }
});

test("§30 — thẻ thắng cuộc phụ thuộc dữ kiện nào thì hỏi CHÍNH dữ kiện đó", () => {
  // Ngưỡng phí là câu hỏi hạng 14 với người được khuyên thẻ $0, và là câu hỏi
  // QUAN TRỌNG NHẤT với người đang được khuyên một thẻ đắt mà chưa khai ngưỡng.
  const winner = {
    ...run(beginnerNoCards).results[0].primaryAction,
    reasonCodes: ["ANNUAL_FEE_HIGH_TOLERANCE_UNKNOWN" as const],
  };
  const question = nextQuestion({
    gaps: [
      { kind: "spend_category_unknown", subject: "grocery", reason: "" },
      { kind: "annual_fee_tolerance_unknown", subject: "profile", reason: "" },
    ],
    ranked: [winner],
  });
  assert.equal(question?.gapKind, "annual_fee_tolerance_unknown");
});

test("điều khoản offer CHƯA BIẾT ≠ offer KHÔNG đòi chi tiêu", () => {
  // Cả hai đều cho `spendPerNinetyDays === null`, và bản trước chấm cả hai
  // bằng 1.0 — mức phù hợp TỐI ĐA. Nghĩa là engine nói "thẻ này dễ đạt bonus"
  // về một thẻ chưa ai biết phải chi bao nhiêu.
  const unknownTerms = DATA.offers.find(
    (offer) =>
      offer.headlineBonus !== null &&
      (IX.componentsByOffer.get(offer.id) ?? []).length === 0,
  );
  assert.ok(unknownTerms !== undefined, "bộ dữ liệu phải còn offer chưa rõ điều khoản");
  const product = DATA.products.find((p) => p.id === unknownTerms!.productId);
  const facts = offerFacts(product!, IX, ASOF, { low: 5_000, high: 5_000 }, []);
  assert.equal(facts.termsUnknown, true);

  const verdict = evaluateSuitability({
    product: product!,
    state: beginnerNoCards,
    facts,
    capacity: { low: 5_000, high: 5_000 },
    ix: IX,
    asOf: ASOF,
    heldProducts: [],
    medianFeeCents: 13_900,
  });
  assert.equal(verdict.minSpendFit, null, "điều khoản chưa biết mà vẫn chấm là vừa sức");
  assert.ok(verdict.reasonCodes.includes("OFFER_TERMS_UNKNOWN"));
});

test("NO_NEW_CARD không được chấm bằng một chương trình CHỌN BỪA", () => {
  // `needs.currency` tỷ lệ NGHỊCH với những gì người dùng đang có, nên
  // "chương trình cần nhất" theo định nghĩa là chương trình họ KHÔNG có, và
  // hàng chục chương trình hoà nhau ở cùng một mức. Phép phá hoà theo `id`
  // chọn ra `a-la-carte` — một đồng tiền cố định chẳng liên quan — rồi để nó
  // quyết định 55% điểm của `NO_NEW_CARD`.
  const wellServed: UserState = {
    ...beginnerNoCards,
    cards: [
      {
        id: id<UserCardId>("uc_cobalt"),
        userId: beginnerNoCards.profile.id,
        productId: productIdFor("amex-cobalt"),
        status: "active",
        openedDate: "2023-01-01",
        closedDate: null,
      },
    ],
    balances: [
      { userId: beginnerNoCards.profile.id, programId: AMEX_MR, balance: 240_000, updatedAt: ASOF },
    ],
  };
  const result = run(wellServed).results[0];
  const covers = result.noAction.components.find((c) => c.key === "portfolio_already_covers");
  assert.ok(covers !== undefined);
  assert.ok(
    covers.raw > 0.5,
    `ví đã có Amex® Cobalt® mà chỉ được chấm ${covers.raw} — đang đo bằng một chương trình vô can`,
  );

  // Và khi mục tiêu KHÔNG phải chuyến đi định giá được, "đã đủ điểm" là câu
  // không đặt ra được: BỎ HẲN dòng đó thay vì điền một số 0 vô nghĩa.
  assert.ok(
    !result.noAction.components.some((c) => c.key === "points_already_sufficient"),
    "mục tiêu không có chuyến đi mà vẫn chấm 'đã đủ điểm'",
  );
  // Chuyến đi ĐỊNH GIÁ ĐƯỢC thì dòng đó phải có mặt.
  assert.ok(
    run(vietnamTripFunded).results[0].noAction.components.some(
      (c) => c.key === "points_already_sufficient",
    ),
  );
});

/* ================================================================== *
 * Rà toàn vẹn cuối Phase 3
 *
 * Engine này sẽ tác động tới quyết định TÀI CHÍNH thật. Các bài dưới đây
 * khoá lại những bảo đảm mà mọi vòng rà trước đã dựng, ở dạng KIỂM ĐƯỢC.
 * ================================================================== */

test("§7 — mỗi đích quy đổi theo tỷ lệ CỦA NÓ, và không ai cộng chúng lại", () => {
  // Bài kiểm đầu tiên mình viết cho việc này đã SAI: nó đòi mọi đích ≤ pool
  // gốc, tức ngầm giả định mọi tỷ lệ là 1:1. Membership Rewards® → Bonvoy® là
  // 1000:1200, nên 120,000 mới là con số ĐÚNG. Bất biến thật không phải "≤
  // pool" mà là "đúng bằng pool ĐÓ quy đổi theo tỷ lệ CỦA ĐÍCH ĐÓ".
  const holder: UserState = {
    ...beginnerNoCards,
    balances: [
      { userId: beginnerNoCards.profile.id, programId: AMEX_MR, balance: 100_000, updatedAt: ASOF },
    ],
  };
  const paths = activeAt(IX.pathsBySource.get(AMEX_MR) ?? [], ASOF).filter(
    (path) => path.requiresTier === null,
  );
  assert.ok(paths.length >= 3, "cần nhiều đích để bài này có nghĩa");

  let sawRatioAboveOne = false;
  for (const path of paths) {
    const ratio = path.ratioTo / path.ratioFrom;
    if (ratio > 1) sawRatioAboveOne = true;
    const reach = accessibleFor(holder, IX, path.destinationProgramId, ASOF);
    assert.equal(
      reach.total,
      Math.floor(100_000 * ratio),
      `${path.destinationProgramId} quy đổi sai`,
    );
    // Và mọi đích phải khai NGUỒN chung — đó là thứ làm phép cộng sai nhìn
    // thấy được thay vì im lặng.
    assert.deepEqual(reach.sources, [AMEX_MR]);
  }
  assert.ok(sawRatioAboveOne, "bộ dữ liệu phải còn một tỷ lệ > 1:1 để bài này không vô nghĩa");
});

test("một thay đổi đầu vào cho thay đổi HIỂU ĐƯỢC, không hỗn loạn", () => {
  // Người dùng thật sẽ chỉnh một câu trả lời rồi chạy lại. Nếu người thắng
  // nhảy loạn xạ giữa các bước liền nhau thì engine không đáng tin, dù mỗi
  // lượt chạy đều tất định.
  const at = (capacity: number): UserState => ({
    ...beginnerNoCards,
    profile: { ...beginnerNoCards.profile, annualFeeTolerancePerCard: 700 },
    spend: { ...beginnerNoCards.spend!, minimumSpendCapacity3m: { low: capacity, high: capacity } },
  });
  const steps = [500, 1_000, 2_000, 3_000, 4_000, 6_000, 8_000, 12_000, 20_000];
  const runs = steps.map((capacity) => {
    const result = run(at(capacity)).results[0];
    return { capacity, winner: result.primaryAction.productSlug, score: result.primaryAction.score };
  });

  // Đơn điệu phải phát biểu trên MỘT thẻ cố định, không trên "thẻ thắng cuộc":
  // ở bước đầu người thắng là `NO_NEW_CARD`, và so điểm của nó với điểm của
  // một cái thẻ là so hai thứ đo bằng hai bảng khác nhau. Bài kiểm đầu tiên
  // mình viết đã vấp đúng chỗ đó.
  //
  // Bất biến thật: với MỘT thẻ, dồn được nhiều hơn thì mốc chi dễ hơn hoặc
  // bằng — không bao giờ khó hơn.
  const scoreOf = (state: UserState, slug: string): number | null => {
    const result = run(state).results[0];
    return (
      [result.primaryAction, ...result.alternatives].find((c) => c.productSlug === slug)?.score ??
      null
    );
  };
  const tracked = "amex-cobalt";
  const curve = steps
    .map((capacity) => ({ capacity, score: scoreOf(at(capacity), tracked) }))
    .filter((row): row is { capacity: number; score: number } => row.score !== null);
  assert.ok(curve.length >= 4, "cần đủ điểm dữ liệu để nói về đơn điệu");
  for (let i = 1; i < curve.length; i += 1) {
    assert.ok(
      curve[i].score >= curve[i - 1].score - 1e-9,
      `${tracked}: dồn $${curve[i].capacity} cho điểm THẤP hơn $${curve[i - 1].capacity}`,
    );
  }
  // Và người thắng chỉ được đổi vài lần trên cả dải — mỗi lần là một ngưỡng
  // có thật (đủ sức đạt mốc chi của một hạng thẻ cao hơn).
  const flips = runs.filter((row, i) => i > 0 && row.winner !== runs[i - 1].winner).length;
  assert.ok(flips <= 4, `người thắng đổi ${flips} lần trên 9 bước — hỗn loạn`);
  // Đầu dải phải là "chưa cần thẻ": dồn $500 thì không bonus nào với tới.
  assert.equal(runs[0].winner, null, "dồn $500 mà vẫn khuyên mở thẻ");
});

test("một chỉ số CỰC ĐOAN không đè bẹp được phù hợp", () => {
  // Thẻ bonus lớn nhất bộ dữ liệu, đặt cạnh một người không thể đạt mốc chi
  // và không chịu nổi phí. Nếu `offer_quality` một mình kéo được nó lên đầu
  // thì mọi vế phù hợp của §14 là trang trí.
  // "Lớn nhất" phải đo bằng GIÁ TRỊ, không bằng SỐ ĐIỂM. 160,000 điểm
  // TD Rewards® (0.5¢) đáng $800; 120,000 Membership Rewards® (1.8¢) đáng
  // $2,160.
  // Bài kiểm đầu tiên mình viết xếp hạng theo số điểm rồi kết luận nhầm rằng
  // engine đang chôn vùi thẻ bonus lớn nhất — trong khi chính engine mới là
  // bên quy đổi đúng. Đây là cùng một cái bẫy §11 và luật đơn vị của nhật ký
  // offer sinh ra để chặn.
  const valueOf = (offer: (typeof DATA.offers)[number]): number => {
    if (offer.headlineBonus === null) return 0;
    if (offer.bonusCurrencyId === null) return offer.headlineBonus * 100;
    return offer.headlineBonus * (centsPerPoint(IX, offer.bonusCurrencyId, ASOF) ?? 0);
  };
  const biggest = [...DATA.offers].sort((a, b) => valueOf(b) - valueOf(a))[0];
  const bigProduct = DATA.products.find((p) => p.id === biggest.productId);
  assert.ok(bigProduct !== undefined);

  const constrained: UserState = {
    ...beginnerNoCards,
    profile: {
      ...beginnerNoCards.profile,
      annualFeeTolerancePerCard: 100,
      businessCardsAllowed: false,
      hasBusiness: false,
    },
    spend: { ...beginnerNoCards.spend!, minimumSpendCapacity3m: { low: 500, high: 500 } },
  };
  const result = run(constrained).results[0];
  assert.notEqual(result.primaryAction.productId, bigProduct!.id);

  // Bài này KHÔNG được thắng một cách rỗng: phải chứng minh chính thẻ đó
  // THẮNG ĐƯỢC khi người dùng hợp với nó — nếu không thì nó chỉ đang chứng
  // minh "chẳng thẻ nào thắng".
  const wellMatched: UserState = {
    ...beginnerNoCards,
    profile: {
      ...beginnerNoCards.profile,
      annualPersonalIncome: { low: 200_000, high: null },
      annualHouseholdIncome: { low: 200_000, high: null },
      annualFeeTolerancePerCard: 900,
      businessCardsAllowed: true,
      hasBusiness: true,
      isStudent: false,
    },
    spend: {
      ...beginnerNoCards.spend!,
      monthlyTotal: { low: 12_000, high: 12_000 },
      minimumSpendCapacity3m: { low: 30_000, high: 30_000 },
    },
  };
  const matched = run(wellMatched).results[0];
  const seen = [matched.primaryAction, ...matched.alternatives].some(
    (c) => c.productId === bigProduct!.id,
  );
  assert.ok(seen, `${bigProduct!.slug} không bao giờ nổi lên — bài kiểm trên là rỗng`);
});

test("§29 — dữ liệu CŨ kéo độ tươi xuống", () => {
  const stale = {
    ...DATA,
    programValuations: DATA.programValuations.map((row) => ({ ...row, verifiedAt: "2020-01-01" })),
  };
  const before = run(vietnamTripFunded).results[0].confidence.dataFreshness;
  const after = recommend({
    state: vietnamTripFunded,
    data: stale,
    ix: indexDataset(stale),
    asOf: ASOF,
  }).results[0].confidence.dataFreshness;
  assert.ok(after < before, `định giá cũ 6 năm mà độ tươi không đổi (${before} → ${after})`);
});

test("KHÔNG có hack theo sản phẩm trong logic chung", async () => {
  // Mở rộng bài kiểm affiliate thành phép quét đầy đủ: không file engine nào
  // được nhắc tới một SLUG sản phẩm, một ID sản phẩm, hay một ID chương trình
  // cụ thể. Một dòng `if (slug === "amex-cobalt")` lọt vào đây là engine thôi
  // tất định theo DỮ LIỆU và bắt đầu tất định theo DANH SÁCH.
  const ENGINE_FILES = [
    "engine.ts", "normalize.ts", "portfolio.ts", "strategies.ts", "needs.ts",
    "eligibility.ts", "suitability.ts", "rules.ts", "rank.ts", "confidence.ts",
    "explain.ts", "offer-quality.ts", "earn-fit.ts", "benefit-fit.ts", "trip-need.ts",
    "scoring/weights.ts", "scoring/context.ts", "scoring/next-card.ts",
    "scoring/trip.ts", "scoring/diversify.ts", "scoring/earning.ts",
  ];
  const { readFile } = await import("node:fs/promises");
  for (const name of ENGINE_FILES) {
    const text = await readFile(new URL(`./${name}`, import.meta.url), "utf8");
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!code.includes("affiliateAvailable"), `${name} đọc affiliateAvailable`);
    for (const product of DATA.products) {
      assert.ok(!code.includes(product.slug), `${name} nhắc slug ${product.slug}`);
      assert.ok(!code.includes(product.id as string), `${name} nhắc id ${product.id}`);
    }
    for (const program of DATA.pointsPrograms) {
      assert.ok(!code.includes(`"${program.id}"`), `${name} nhắc chương trình ${program.id}`);
    }
  }
});

/* ================================================================== *
 * Award chart: JAPAN và EAST_ASIA
 *
 * Mọi con số suy ra từ CÙNG ba bảng giá đã kiểm của `lib/award-charts.ts`,
 * cộng một phép tính band từ chính toạ độ sân bay trong file đó. Các bài
 * dưới đây khoá lại những chỗ dữ liệu mới dễ trôi nhất.
 * ================================================================== */

test("JAPAN và EAST_ASIA đã định giá được; EUROPE thì CHƯA — và nói ra", () => {
  const priced = (region: TripRegion) =>
    DATA.awardStrategies.filter(
      (row) => row.originRegion === "CANADA_US" && row.destinationRegion === region,
    );
  assert.ok(priced("JAPAN").length >= 3, "JAPAN phải có ít nhất 3 chiến lược");
  assert.ok(priced("EAST_ASIA").length >= 3, "EAST_ASIA phải có ít nhất 3 chiến lược");
  assert.equal(priced("EUROPE").length, 0, "EUROPE vẫn chưa dựng — đừng lấp bằng phỏng đoán");

  // Và chỗ trống phải khớp: đúng một cặp vùng còn lại.
  const gaps = DATA.gaps.filter((gap) => gap.kind === "award_route_uncovered");
  assert.deepEqual(gaps.map((gap) => gap.subjectId), ["CANADA_US|EUROPE"]);
});

test("KHÔNG có hạng First đi châu Á — vắng mặt là CÓ CHỦ Ý", () => {
  // `award-charts.ts` ghi rõ: không hãng nào bán First giữa Canada và châu Á.
  // Nếu ngày nào đó có người thêm một dòng First, bài này đỏ và bắt họ chứng
  // minh bằng nguồn thay vì suy từ việc "các hạng khác đều có".
  for (const region of ["JAPAN", "EAST_ASIA", "SEA_VIETNAM"] as const) {
    assert.equal(
      DATA.awardStrategies.filter(
        (row) => row.destinationRegion === region && row.cabin === "first",
      ).length,
      0,
      `${region} có dòng First`,
    );
  }
});

test("EAST_ASIA bắc qua HAI vùng giá của AAdvantage®", () => {
  // Seoul nằm Asia Region 1, còn Trung Quốc / Đài Loan / Hong Kong nằm Region
  // 2 — nên MỘT vùng của engine có HAI mức giá của hãng. Đây là ca duy nhất
  // trong bộ dữ liệu mà ba con số khác nhau KHÔNG vì khoảng cách.
  const aa = DATA.awardStrategies.find(
    (row) =>
      row.destinationRegion === "EAST_ASIA" &&
      row.programId === id<PointsProgramId>("aadvantage") &&
      row.cabin === "business",
  );
  assert.ok(aa !== undefined);
  assert.ok(
    aa!.pointsLow !== null && aa!.pointsHigh !== null && aa!.pointsLow < aa!.pointsHigh,
    "AAdvantage® EAST_ASIA phải là một KHOẢNG, không phải một con số",
  );
  // Nhật thì ngược lại: cả NRT lẫn HND đều Region 1 ⇒ một mức duy nhất.
  const japan = DATA.awardStrategies.find(
    (row) =>
      row.destinationRegion === "JAPAN" &&
      row.programId === id<PointsProgramId>("aadvantage") &&
      row.cabin === "business",
  );
  assert.ok(japan !== undefined);
  assert.equal(japan!.pointsLow, japan!.pointsHigh, "Nhật chỉ có một vùng giá AA");
});

test("Aeroplan® JAPAN là KHOẢNG theo band khoảng cách, không phải một số", () => {
  // Bờ Tây bay thẳng rơi band 0–5,000; bờ Đông rơi band 5,001–7,500; nối
  // chuyến hợp lệ đẩy lên band 7,501–11,000. Ba con số phải phản ánh đúng ba
  // mức đó, nếu không thì engine hứa một cái giá cho cả nước.
  const aero = DATA.awardStrategies.find(
    (row) =>
      row.destinationRegion === "JAPAN" &&
      row.programId === AEROPLAN &&
      row.cabin === "business" &&
      row.pricingModel === "fixed",
  );
  assert.ok(aero !== undefined);
  assert.ok(
    (aero!.pointsLow as number) < (aero!.pointsTypical as number) &&
      (aero!.pointsTypical as number) < (aero!.pointsHigh as number),
    "ba band phải cho ba con số tăng dần",
  );
  // Và cột đối tác cố định KHÔNG có Premium Economy — nó chỉ tồn tại ở cột
  // giá động, đúng như chặng Đông Nam Á.
  assert.equal(
    DATA.awardStrategies.filter(
      (row) =>
        row.destinationRegion === "JAPAN" &&
        row.programId === AEROPLAN &&
        row.cabin === "premium_economy" &&
        row.pricingModel === "fixed",
    ).length,
    0,
    "cột đối tác cố định của Aeroplan® không có Premium Economy",
  );
});

test("Test C/D của §32 nay CHẠY trên dữ liệu thật, không còn bị chặn", () => {
  // Hai nhân vật Nhật của Phase 2 từng rơi vào nhánh "chưa có bảng giá". Nay
  // chúng đo được — và khoảng cách giữa "gần đủ" và "thiếu xa" phải hiện ra
  // bằng SỐ, không phải bằng hai hình dạng trạng thái khác nhau.
  const funded = run(japanTripFunded).results[0];
  const short = run(japanTripShortfall).results[0];
  for (const result of [funded, short]) {
    assert.ok(result.numbers.tripNeedHigh !== null, "chặng Nhật vẫn chưa định giá được");
    assert.ok(!result.warnings.includes("AWARD_ROUTE_NOT_IN_DATASET"));
  }
  assert.equal(funded.numbers.pointsGapTypical, 0, "200K MR phủ được mức thường");
  assert.ok(
    (short.numbers.pointsGapTypical ?? 0) > 200_000,
    "20K điểm cho 2 người phải còn thiếu rất nhiều",
  );
  assert.ok(short.reasonCodes.includes("POINTS_GAP_LARGE"));
});
