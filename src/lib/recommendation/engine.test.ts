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
import { datasetAt } from "./temporal.ts";
import { indexDataset } from "./indexes.ts";
import { ENGINE_VERSION, recommend } from "./engine.ts";
import { accessibleFor, analyzePortfolio, isFlexibleInPractice } from "./portfolio.ts";
import { evaluateEligibility } from "./eligibility.ts";
import { minimumSpendFit } from "./suitability.ts";
import { tripNeedFor } from "./trip-need.ts";
import { candidateUniverse, normalize } from "./normalize.ts";
import { REASON_CODES, WARNING_CODES } from "./reason-codes.ts";
import { SCORABLE_WEIGHT } from "./scoring/weights.ts";
import { resolveTripGoal } from "./user.ts";
import { id, type PointsProgramId, type ProductId } from "./types.ts";
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
  lowSpendCapacity,
  studentStarter,
  vagueEarner,
  vietnamTripFunded,
  vietnamTripShortfall,
} from "./data/user-fixtures.ts";
import type { UserState } from "./user-types.ts";
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

test("§7 — 100K MR KHÔNG đồng thời là 100K Aeroplan + 100K Avios", () => {
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
  assert.equal(toAeroplan.direct, 0, "không có Aeroplan nào nằm sẵn");
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
  // Thẻ nào lọt vào top mà ngoài tầm thì phải mang cảnh báo; và thẻ thắng
  // cuộc thì không được ngoài tầm.
  assert.ok(!result.primaryAction.warnings.includes("SPEND_REQUIREMENT_LIKELY_UNSUITABLE"));
  for (const candidate of flagged) {
    assert.ok((candidate.suitability?.minSpendFit ?? 1) < 0.5);
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
  const goal = japanTripFunded.goals[0];
  if (goal.type !== "trip") return;
  const need = tripNeedFor(resolveTripGoal(japanTripFunded.profile, goal), IX, ASOF);
  assert.deepEqual(need.strategies, []);
  assert.equal(need.low, null);
  assert.ok(need.reasonCodes.includes("TRIP_ROUTE_NOT_PRICED"));
  assert.ok(need.warnings.includes("AWARD_ROUTE_NOT_IN_DATASET"));
  // Và chỗ trống đó phải nổi lên ở lượt chạy, không chìm đi.
  assert.ok(run(japanTripFunded).dataGaps.some((gap) => gap.kind === "award_route_uncovered"));
});

test("§6 — chặng chưa có giá KHÔNG được kéo mọi đồng tiền về cùng một mức", () => {
  // Một chỗ trống của lớp dữ liệu không được biến thành "không đồng tiền nào
  // hữu ích", vì lúc đó thẻ thắng cuộc được chọn bằng tiếng ồn.
  const result = run(japanTripFunded).results[0];
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
  // `duplicateBagBenefit` giữ TD® Aeroplan®, tức đã có miễn hành lý Air
  // Canada®. Thẻ United® cho miễn hành lý United® — KHÁC hãng, vẫn là giá trị
  // mới. Cờ `duplicatesAcrossCards` một mình sẽ triệt tiêu nó.
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
