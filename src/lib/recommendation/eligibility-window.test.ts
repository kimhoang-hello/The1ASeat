/**
 * Luật "không có welcome bonus nếu … trong N tháng qua"
 * (`previous_cardholder_within_months`).
 *
 * Lỗi gốc, test end-to-end 21/09/2026: hồ sơ "bay đi Nhật" khai từng giữ TD®
 * Aeroplan® Visa Infinite (đã đóng, không rõ ngày) được khuyên CHÍNH thẻ đó
 * làm hành động chính, hiện trọn 50,000 điểm, không một dòng cảnh báo — vì chỉ
 * Amex® có luật "từng giữ", còn TD thì không có luật nào.
 *
 * Import thẳng từng file, không qua `./index.ts` — xem đầu `engine.test.ts`.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { offlineDataset } from "./data/index.ts";
import { productIdFor } from "./data/products.ts";
import { japanTripShortfall } from "./data/user-fixtures.ts";
import { evaluateEligibility, monthsBefore } from "./eligibility.ts";
import { recommend } from "./engine.ts";
import { indexDataset } from "./indexes.ts";
import { answersFor } from "./sensitivity.ts";
import { datasetAt } from "./temporal.ts";
import { id, type EligibilityRule } from "./types.ts";
import type { UserCard, UserCardId, UserState } from "./user-types.ts";
import { closedDateFromAnswer } from "./user.ts";
import { validateDataset } from "./validate.ts";

// Luật đọc từ điều khoản ngân hàng ngày 21/09/2026 — chạy đúng ngày đó.
const ASOF = "2026-09-21";
const RAW = offlineDataset();
const DATA = datasetAt(RAW, ASOF);
const IX = indexDataset(DATA);

const TD_VI = productIdFor("td-aeroplan-visa-infinite");

function card(slug: string, status: UserCard["status"], openedDate: string | null, closedDate: string | null, key = slug): UserCard {
  return {
    id: id<UserCardId>(`uc_${key}`),
    userId: japanTripShortfall.profile.id,
    productId: productIdFor(slug),
    status,
    openedDate,
    closedDate,
  };
}

/**
 * Hồ sơ "bay đi Nhật" mà TD® Aeroplan® Visa Infinite ĐỨNG ĐẦU khi chưa từng
 * giữ nó: ba thẻ Amex® Membership Rewards® đã đóng từ 2020 (once-in-a-lifetime chặn bonus của
 * chúng), không xét thẻ doanh nghiệp.
 */
function japanProfile(extra: UserCard[]): UserState {
  const amex = ["amex-green", "amex-gold-rewards", "amex-cobalt"].map((slug) =>
    card(slug, "closed", "2019-01-01", "2020-01-01"),
  );
  return {
    ...japanTripShortfall,
    profile: {
      ...japanTripShortfall.profile,
      annualFeeTolerancePerCard: 150,
      businessCardsAllowed: false,
      hasBusiness: false,
    },
    cards: [...amex, ...extra],
    declared: { cards: true, balances: true },
  };
}

function run(state: UserState) {
  return recommend({ state, data: DATA, ix: IX, asOf: ASOF });
}

function tdAction(state: UserState) {
  const result = run(state).results[0];
  return [result.primaryAction, ...result.alternatives].find((action) => action.productSlug === "td-aeroplan-visa-infinite");
}

test("ca 21/09/2026: từng giữ TD® Aeroplan® VI, không rõ ngày đóng ⇒ mất bonus, không còn được khuyên như thẻ mới", () => {
  // Chốt tiền đề: chưa từng giữ thì TD đúng là hành động chính. Không có dòng
  // này thì test dưới xanh cả khi hồ sơ đơn giản là không bao giờ chọn TD.
  const fresh = run(japanProfile([])).results[0];
  assert.equal(fresh.primaryAction.productSlug, "td-aeroplan-visa-infinite");

  const state = japanProfile([card("td-aeroplan-visa-infinite", "closed", null, null, "td")]);
  const verdict = evaluateEligibility(TD_VI, state, IX, ASOF);
  assert.equal(verdict.status, "eligible", "vẫn mở được thẻ — luật chỉ nói về bonus");
  // Aeroplan® once-in-a-lifetime theo loại thẻ: ngày đóng không cứu được.
  assert.equal(verdict.welcomeOfferBlocked, true, "hứa trọn bonus cho thẻ Aeroplan® cùng loại đã từng giữ");
  assert.ok(verdict.warnings.includes("WELCOME_BONUS_BLOCKED_BY_PAST_CARD"));
  const byType = (type: string) => verdict.rules.find((rule) => rule.ruleType === type);
  assert.equal(byType("previous_cardholder_same_category")?.outcome, "fail");
  // Luật 12 tháng của TD® thì đúng là CHƯA BIẾT — không có ngày nào để đọc.
  assert.equal(byType("previous_cardholder_within_months")?.outcome, "unknown");
  assert.equal(byType("previous_cardholder_within_months")?.unknownCause, "user_field_missing");

  const result = run(state).results[0];
  assert.notEqual(result.primaryAction.productSlug, "td-aeroplan-visa-infinite", "vẫn khuyên chính thẻ vừa đóng");
  // Có thể rớt hẳn khỏi danh sách; còn hiện thì phải mang cảnh báo.
  const td = tdAction(state);
  assert.ok(td === undefined || td.warnings.includes("WELCOME_BONUS_BLOCKED_BY_PAST_CARD"), "thẻ TD không mang cảnh báo nào");
  // Chuyển sang ngân hàng khác cũng không thoát: cùng loại "core".
  for (const slug of ["cibc-aeroplan-visa-infinite", "amex-aeroplan"]) {
    assert.equal(evaluateEligibility(productIdFor(slug), state, IX, ASOF).welcomeOfferBlocked, true, slug);
  }
  // Loại KHÁC thì không bị luật này chặn.
  const vip = evaluateEligibility(productIdFor("cibc-aeroplan-visa-infinite-privilege"), state, IX, ASOF);
  assert.equal(vip.welcomeOfferBlocked, false);
});

test("TD® Aeroplan® 12 tháng đếm theo ngày MỞ, và xuyên loại trong cùng họ", () => {
  // Bản Platinum (loại "entry") không chạm luật loại thẻ của bản Infinite
  // ("core") — chỉ luật 12 tháng của TD® nói về nó.
  // Đóng tháng 6/2026 nhưng mở 2022 — điều khoản chỉ nói "not have OPENED …
  // in the last 12 months". Đọc như luật "từng giữ" là giấu một bonus có thật.
  const openedLongAgo = japanProfile([card("td-aeroplan-visa-platinum", "closed", "2022-03-01", "2026-06-30", "td")]);
  const verdict = evaluateEligibility(TD_VI, openedLongAgo, IX, ASOF);
  assert.equal(verdict.welcomeOfferBlocked, false);
  assert.equal(verdict.welcomeOfferUncertain, false);
  assert.equal(run(openedLongAgo).results[0].primaryAction.productSlug, "td-aeroplan-visa-infinite");

  // Mở trong 12 tháng thì mất bonus — mở bản Platinum tháng 1 chặn bản Infinite.
  const openedRecently = japanProfile([card("td-aeroplan-visa-platinum", "closed", "2026-01-15", "2026-05-01", "td")]);
  const blocked = evaluateEligibility(TD_VI, openedRecently, IX, ASOF);
  assert.equal(blocked.welcomeOfferBlocked, true);
  assert.ok(blocked.warnings.includes("WELCOME_BONUS_BLOCKED_BY_PAST_CARD"));

  // Chỉ biết ngày đóng: đóng TRƯỚC ngày cắt thì chắc chắn đã mở trước ngày cắt
  // — câu "đóng tháng nào" của §30 trả lời được luật đếm theo ngày mở.
  const closedBeforeCutoff = japanProfile([card("td-aeroplan-visa-platinum", "closed", null, "2025-06-30", "td")]);
  assert.equal(evaluateEligibility(TD_VI, closedBeforeCutoff, IX, ASOF).welcomeOfferUncertain, false);
  // Đóng TRONG cửa sổ mà không rõ ngày mở: có thể mở trong cửa sổ, có thể
  // không — vẫn chưa biết.
  const closedInside = japanProfile([card("td-aeroplan-visa-platinum", "closed", null, "2026-06-30", "td")]);
  assert.equal(evaluateEligibility(TD_VI, closedInside, IX, ASOF).welcomeOfferUncertain, true);
});

test("ngày đóng không rõ mà ĐỔI được người thắng ⇒ §30 hỏi đúng câu đó", () => {
  const state = japanProfile([card("td-aeroplan-visa-platinum", "closed", null, null, "td")]);
  assert.equal(evaluateEligibility(TD_VI, state, IX, ASOF).welcomeOfferUncertain, true);
  assert.ok(tdAction(state)?.warnings.includes("WELCOME_BONUS_NOT_VERIFIABLE"), "thẻ TD không mang cảnh báo nào");
  const outcome = run(state);
  assert.equal(outcome.followUp?.gapKind, "card_closed_date_unknown");
  assert.equal(outcome.followUp?.subject, "uc_td");
  assert.equal(outcome.followUp?.basis, "measured");
});

test("Scotiabank® đếm MỌI thẻ cá nhân của ngân hàng, và đang giữ là trượt", () => {
  const gold = productIdFor("scotiabank-gold-amex");
  // Đang giữ Passport mở từ 2018: luật `held` — mở từ bao giờ cũng không cứu.
  const holdingOther = japanProfile([card("scotiabank-passport-visa-infinite", "active", "2018-01-01", null)]);
  assert.equal(evaluateEligibility(gold, holdingOther, IX, ASOF).welcomeOfferBlocked, true);
  // Đóng 25 tháng trước: ngoài cửa sổ 2 năm.
  const closedLongAgo = japanProfile([card("scotiabank-passport-visa-infinite", "closed", "2018-01-01", "2024-08-01")]);
  assert.equal(evaluateEligibility(gold, closedLongAgo, IX, ASOF).welcomeOfferBlocked, false);
  assert.equal(evaluateEligibility(gold, closedLongAgo, IX, ASOF).welcomeOfferUncertain, false);
  // Thẻ ngân hàng KHÁC không tính.
  const otherBank = japanProfile([card("td-aeroplan-visa-infinite", "active", "2026-09-01", null)]);
  assert.equal(evaluateEligibility(gold, otherBank, IX, ASOF).welcomeOfferBlocked, false);
});

test("TD® First Class: mở HOẶC đóng trong 12 tháng đều mất bonus", () => {
  const fct = productIdFor("td-first-class-travel-visa-infinite");
  const closedRecently = japanProfile([card("td-first-class-travel-visa-infinite", "closed", "2015-01-01", "2026-02-01")]);
  assert.equal(evaluateEligibility(fct, closedRecently, IX, ASOF).welcomeOfferBlocked, true);
  const clear = japanProfile([card("td-first-class-travel-visa-infinite", "closed", "2015-01-01", "2025-02-01")]);
  assert.equal(evaluateEligibility(fct, clear, IX, ASOF).welcomeOfferBlocked, false);
  assert.equal(evaluateEligibility(fct, clear, IX, ASOF).welcomeOfferUncertain, false);
});

test("chưa khai thẻ nào ⇒ luật N tháng là CHƯA BIẾT, không phải qua", () => {
  const undeclared: UserState = { ...japanProfile([]), cards: [], declared: { cards: false, balances: true } };
  assert.equal(evaluateEligibility(TD_VI, undeclared, IX, ASOF).welcomeOfferUncertain, true);
});

test("monthsBefore kẹp ngày cuối tháng", () => {
  assert.equal(monthsBefore("2026-09-21", 12), "2025-09-21");
  assert.equal(monthsBefore("2026-03-31", 1), "2026-02-28");
  assert.equal(monthsBefore("2024-02-29", 12), "2023-02-28");
  assert.equal(monthsBefore("2026-01-15", 24), "2024-01-15");
});

test("§30 thử tháng đóng thẻ bằng CHÍNH phép dịch của trang", () => {
  const gap = { kind: "card_closed_date_unknown" as const, subject: "uc_td", reason: "" };
  assert.deepEqual(answersFor(gap), [], "không có ngày chạy thì không suy được 'tháng trước'");
  const answers = answersFor(gap, ASOF);
  assert.deepEqual(
    answers.map((answer) => answer.label),
    ["đóng tháng 9/2026", "đóng tháng 3/2025", "đóng trước tháng 9/2023"],
  );
  const days = answers.map((answer) => {
    const copy = structuredClone(japanProfile([card("td-aeroplan-visa-infinite", "closed", null, null, "td")]));
    answer.apply(copy);
    return copy.cards.find((row) => row.id === "uc_td")?.closedDate;
  });
  assert.deepEqual(days, ["2026-09-21", "2025-03-31", "2023-08-31"]);
});

test("tháng đóng thẻ ghi ngày MUỘN NHẤT — tháng 12 không bao giờ lọt ra ngoài cửa sổ", () => {
  // Bản hỏi NĂM ghi "2024" thành 30/06/2024: người đóng Scotiabank® tháng
  // 12/2024 bị đọc là ngoài cửa sổ 24 tháng (cắt 21/09/2024) và được hứa bonus.
  assert.equal(closedDateFromAnswer("2024-12", ASOF), "2024-12-31");
  assert.equal(closedDateFromAnswer("2026-09", ASOF), ASOF, "không ghi một ngày trong tương lai");
  assert.equal(closedDateFromAnswer("2024-09", ASOF), "2024-09-30", "tháng cắt: nghiêng về phía trong cửa sổ");
  assert.equal(closedDateFromAnswer("2023-08", ASOF), null, "tháng ngoài danh sách");
  assert.equal(closedDateFromAnswer("2024", ASOF), null, "câu trả lời kiểu năm cũ");
  const gold = productIdFor("scotiabank-gold-amex");
  const december = japanProfile([
    card("scotiabank-passport-visa-infinite", "closed", null, closedDateFromAnswer("2024-12", ASOF)),
  ]);
  assert.equal(evaluateEligibility(gold, december, IX, ASOF).welcomeOfferBlocked, true);
  // Tháng cắt của TD® (09/2025): cuối tháng nằm SAU ngày cắt 21/09/2025, nên
  // không được suy "đã mở trước ngày cắt" — vẫn chưa biết.
  const cutoffMonth = japanProfile([
    card("td-aeroplan-visa-platinum", "closed", null, closedDateFromAnswer("2025-09", ASOF), "td"),
  ]);
  assert.equal(evaluateEligibility(TD_VI, cutoffMonth, IX, ASOF).welcomeOfferUncertain, true);
});

test("validator: luật N tháng phải có lookback gồm chính thẻ đó, và chỉ luật đó được có", () => {
  const rule = RAW.eligibilityRules.find(
    (row) => row.productId === TD_VI && row.ruleType === "previous_cardholder_within_months",
  ) as EligibilityRule;
  assert.ok(rule !== undefined, "dữ liệu mất luật TD® Aeroplan®");
  const messages = (rules: EligibilityRule[]) =>
    validateDataset({ ...RAW, eligibilityRules: rules })
      .filter((issue) => issue.level === "error")
      .map((issue) => issue.message);
  const others = RAW.eligibilityRules.filter((row) => row !== rule);

  assert.ok(messages([...others, { ...rule, lookback: null }]).some((m) => m.includes("thiếu lookback")));
  assert.ok(
    messages([...others, { ...rule, lookback: { anchor: "opened", productIds: [productIdFor("td-cash-back-visa-infinite")] } }]).some(
      (m) => m.includes("phải gồm chính thẻ"),
    ),
  );
  assert.ok(messages([...others, { ...rule, value: 0 }]).some((m) => m.includes("số nguyên dương")));
  assert.ok(messages([...others, { ...rule, scope: "application" }]).some((m) => m.includes("scope welcome_offer")));
  assert.ok(messages([...others, { ...rule, severity: "soft" }]).some((m) => m.includes("severity hard")));
  const category = RAW.eligibilityRules.find(
    (row) => row.productId === TD_VI && row.ruleType === "previous_cardholder_same_category",
  ) as EligibilityRule;
  assert.ok(category !== undefined, "dữ liệu mất luật loại thẻ Aeroplan®");
  const withoutCategory = RAW.eligibilityRules.filter((row) => row !== category);
  assert.ok(
    messages([...withoutCategory, { ...category, lookback: { ...category.lookback!, anchor: "opened" } }]).some((m) =>
      m.includes("anchor held"),
    ),
  );
  const residency = others.find((row) => row.ruleType === "residency") as EligibilityRule;
  assert.ok(
    messages([...others.filter((row) => row !== residency), { ...residency, lookback: rule.lookback }]).some((m) =>
      m.includes("chỉ dành cho"),
    ),
  );
});
