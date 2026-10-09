/**
 * Hợp đồng của lớp trình bày.
 *
 * Bài quan trọng nhất là bài affiliate: bật/tắt cờ `affiliateAvailable` của MỌI
 * thẻ rồi đòi trang nói y hệt, trừ đúng cái nút "Đăng ký ngay". Test F ở engine
 * canh Rule 7 cho THỨ HẠNG; bài này canh chỗ còn lại — nơi thứ hạng đã đúng mà
 * trang vẫn có thể lặng lẽ ưu ái thẻ có hoa hồng.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CreditCardOffer } from "../content/types.ts";
import { offlineDataset } from "../recommendation/data/index.ts";
import {
  advancedCollector,
  aeroplanHeavy,
  beginnerNoCards,
  japanTripFunded,
  vietnamTripFunded,
  vietnamTripShortfall,
  vagueEarner,
} from "../recommendation/data/user-fixtures.ts";
import { productIdFor } from "../recommendation/data/products.ts";
import { REASON_CODES, WARNING_CODES } from "../recommendation/reason-codes.ts";
import { executeRun } from "../recommendation/runs.ts";
import { datasetAt } from "../recommendation/temporal.ts";
import type { RecommendationDataset } from "../recommendation/types.ts";
import type { UserState } from "../recommendation/user-types.ts";
import { userGaps } from "../recommendation/user-gaps.ts";
import { COMPONENT_STRENGTH, REASON_COVERED_BY_WARNING, REASON_TEXT, WARNING_TEXT } from "./copy.ts";
import { answeredRows, coverageStatement, presentRun, reasonsOf, spendSentenceOf } from "./present.ts";
import {
  applyAnswer,
  goalFrom,
  newUserState,
  questionFor,
  questionFromKey,
  type AnswerForm,
  type QuestionContext,
  type QuestionSpec,
} from "./questions.ts";

const ASOF = "2026-09-08";
const DATA = datasetAt(offlineDataset(), ASOF);

const CTX: QuestionContext = { dataset: DATA, today: ASOF };

function stateWithGoal(value: string): UserState {
  const state = newUserState("u_test", ASOF, "CA");
  const goal = goalFrom(value, "u_test", ASOF);
  assert.ok(goal !== null);
  state.goals = [goal];
  return state;
}

/** Một câu trả lời hợp lệ bất kỳ cho mỗi loại câu hỏi. */
function answerFor(spec: QuestionSpec): AnswerForm {
  const values: Record<string, string | string[]> =
    spec.input.type === "choice"
      ? { answer: (spec.input.options.find((option) => option.terminal !== true) ?? spec.input.options[0]).value }
      : spec.input.type === "number"
        ? { answer: String(Math.max(spec.input.min, 2)) }
        : spec.input.type === "month"
          ? { month: spec.input.months[0].value }
          : spec.input.type === "cards"
            ? { holding: [spec.input.groups[0].cards[0].value], closed: [spec.input.groups[0].cards[1].value] }
            : { programs: [spec.input.programs[0].value] };
  return {
    get: (name) => (typeof values[name] === "string" ? (values[name] as string) : null),
    getAll: (name) => (Array.isArray(values[name]) ? (values[name] as string[]) : []),
  };
}


/** Entry Contentful tối thiểu cho mỗi thẻ — đủ để dựng nút và ảnh. */
function offersFor(data: RecommendationDataset): CreditCardOffer[] {
  return data.products.map((product) => ({
    slug: product.slug,
    name: product.name,
    issuer: "Ngân hàng",
    image: `/${product.slug}.png`,
    cardImage: `/${product.slug}-card.png`,
    country: "CA" as const,
    annualFee: "$120",
    cardType: "travel",
    welcomeBonus: "60,000 điểm",
    headline: "",
    editorsTake: "",
    keyBenefits: [],
    elevatedBonus: false,
    applyUrl: `https://www.finlywealth.com/apply/${product.slug}`,
  }));
}

let counter = 0;
function runFor(state: UserState, data: RecommendationDataset = DATA) {
  counter += 1;
  return executeRun(
    { state, data, asOf: ASOF },
    { id: `run_present_${counter}`, createdAt: "2026-09-08T12:00:00.000Z", userId: "u_test" },
  ).record;
}

test("mọi mã của engine đều có câu tiếng Việt, không mã nào lọt ra trang", () => {
  for (const code of REASON_CODES) {
    assert.ok(REASON_TEXT[code].text.trim().length > 0, `${code}: câu rỗng`);
    assert.ok(!REASON_TEXT[code].text.includes(code), `${code}: câu còn chứa chính mã`);
  }
  for (const code of WARNING_CODES) {
    assert.ok(WARNING_TEXT[code].trim().length > 0, `${code}: câu rỗng`);
    assert.ok(!WARNING_TEXT[code].includes(code), `${code}: câu còn chứa chính mã`);
  }
});

test("lý do xếp theo ủng hộ → cần cân nhắc → ngữ cảnh, và không lặp", () => {
  const rows = reasonsOf([
    "ELIGIBILITY_UNCERTAIN",
    "MIN_SPEND_TOO_HIGH",
    "CURRENT_OFFER_STRONG",
    "CURRENT_OFFER_STRONG",
  ]);
  assert.deepEqual(
    rows.map((row) => row.tone),
    ["good", "caution", "info"],
  );
});

test("hành động chính và các lựa chọn khác lấy NGUYÊN thứ tự của bản ghi", () => {
  for (const state of [beginnerNoCards, aeroplanHeavy, japanTripFunded, vietnamTripShortfall]) {
    const record = runFor(state);
    const view = presentRun(record, DATA, offersFor(DATA));
    assert.ok(view !== null);
    const result = record.outputSnapshot.results[0];
    assert.equal(view.primary.slug, result.primaryAction.productSlug);
    assert.deepEqual(
      view.alternatives.map((row) => row.slug),
      result.alternatives.slice(0, 3).map((row) => row.productSlug),
    );
    // `NO_NEW_CARD` luôn có mặt: hoặc là hành động chính, hoặc là một lựa chọn
    // đứng riêng — không bao giờ biến mất (§16 Rule 8).
    if (result.primaryAction.kind === "no_new_card") {
      assert.equal(view.noAction, null);
      assert.equal(view.primary.kind, "no_new_card");
    } else {
      assert.equal(view.noAction?.kind, "no_new_card");
    }
  }
});

test("'đã đủ điểm' chỉ nói khi engine nói — phủ 97.6% không được thành 'đủ'", () => {
  // `japanTripFunded`: NO_NEW_CARD với dòng điểm `points_already_sufficient`
  // đóng góp nhiều nhất ở mức phủ 0.976, mà engine KHÔNG phát
  // `POINTS_ALREADY_SUFFICIENT` (và vì thế cũng không phát cảnh báo điểm hết
  // hạn). Trang từng in "số điểm bạn đang có đã đủ cho mục tiêu này".
  const record = runFor(japanTripFunded);
  const view = presentRun(record, DATA, offersFor(DATA));
  assert.ok(view !== null);
  const action = view.primary.kind === "no_new_card" ? view.primary : view.noAction;
  assert.ok(action !== null);
  const candidate = record.outputSnapshot.results[0].primaryAction;
  assert.equal(candidate.kind, "no_new_card");
  assert.ok(!candidate.reasonCodes.includes("POINTS_ALREADY_SUFFICIENT"));
  assert.notEqual(action.noCardReason, "points_sufficient");

  // Có mã thì nói được — và engine phát mã đó cùng lúc với cảnh báo hết hạn.
  const funded = runFor(vietnamTripFunded);
  const fundedView = presentRun(funded, DATA, offersFor(DATA));
  const fundedCandidate = funded.outputSnapshot.results[0].primaryAction;
  assert.ok(fundedCandidate.reasonCodes.includes("POINTS_ALREADY_SUFFICIENT"));
  assert.ok(fundedCandidate.warnings.includes("POINTS_EXPIRY_NOT_MODELLED"));
  const fundedAction = fundedView!.primary.kind === "no_new_card" ? fundedView!.primary : fundedView!.noAction;
  assert.equal(fundedAction!.noCardReason, "points_sufficient");
});

test("affiliate KHÔNG đổi gì ngoài chính cái nút đăng ký", () => {
  // Dữ liệu y hệt, chỉ khác chỗ link apply có hoa hồng hay không — và cờ
  // affiliate đọc từ CHÍNH link sắp render, nên đây là đúng cặp so.
  const withAffiliate: RecommendationDataset = {
    ...DATA,
    products: DATA.products.map((product) => ({ ...product, affiliateAvailable: true })),
  };
  const without: RecommendationDataset = {
    ...DATA,
    products: DATA.products.map((product) => ({ ...product, affiliateAvailable: false })),
  };
  const plainOffers = offersFor(DATA).map((offer) => ({
    ...offer,
    applyUrl: `https://www.rbcroyalbank.com/apply/${offer.slug}`,
  }));
  for (const state of [beginnerNoCards, aeroplanHeavy, vietnamTripShortfall]) {
    const a = presentRun(runFor(state, withAffiliate), withAffiliate, offersFor(withAffiliate));
    const b = presentRun(runFor(state, without), without, plainOffers);
    assert.ok(a !== null && b !== null);
    const strip = (view: typeof a) =>
      JSON.stringify(view, (key, value) =>
        key === "affiliate" || key === "runId" || key === "url" ? undefined : value,
      );
    assert.equal(strip(a), strip(b), "trang đổi theo hoa hồng");
    assert.equal(a.primary.apply?.affiliate, true);
    assert.equal(b.primary.apply?.affiliate, false);
  }
});

test("thẻ không có link đăng ký thì KHÔNG có nút, và trang vẫn dựng", () => {
  const record = runFor(beginnerNoCards);
  const view = presentRun(record, DATA, offersFor(DATA).map((offer) => ({ ...offer, applyUrl: undefined })));
  assert.ok(view !== null);
  assert.equal(view.primary.apply, null);
  assert.ok(view.primary.name.length > 0);
});

test("thẻ chưa có entry Contentful: vẫn có tên và lý do, chỉ thiếu ảnh và nút", () => {
  const record = runFor(beginnerNoCards);
  const view = presentRun(record, DATA, []);
  assert.ok(view !== null);
  assert.equal(view.primary.image, null);
  assert.equal(view.primary.apply, null);
  assert.ok(view.primary.reasons.length > 0);
});

test("số của chuyến đi lấy đúng con số bản ghi đã lưu", () => {
  const record = runFor(vietnamTripShortfall);
  const view = presentRun(record, DATA, offersFor(DATA));
  assert.ok(view !== null && view.trip !== null);
  const numbers = record.outputSnapshot.results[0].numbers;
  assert.equal(view.trip.accessible, numbers.accessiblePoints);
  assert.equal(view.trip.gap, numbers.pointsGapTypical);
  assert.equal(view.trip.accessibleIsLowerBound, numbers.accessiblePointsIsLowerBound);
  // "Cần" đo trên CÙNG chương trình với "còn thiếu", không trên khoảng gộp:
  // bản trước in "cần 280,000 – 476,000 · gom được 60,000 · còn thiếu
  // 350,000", với 280,000 của AAdvantage® và 350,000 của Aeroplan® (audit
  // trang 25/09/2026).
  const trace = record.derivedState.goals[0];
  const best = trace.goal.tripNeed?.byProgram.find((row) => row.programId === trace.tripCoverage?.bestProgram);
  assert.ok(best !== undefined);
  assert.notEqual(best.typical, numbers.tripNeedTypical, "fixture phải có khoảng gộp khác khoảng của chương trình phủ");
  assert.equal(view.trip.needTypical, best.typical);
  assert.equal(view.trip.needLow, best.low);
  assert.equal(view.trip.needHigh, best.high);
  assert.equal(view.trip.gap, (best.typical ?? 0) - (numbers.accessiblePoints ?? 0));
  assert.ok(view.trip.needProgram !== null && view.trip.needProgram.includes("Aeroplan"));
});

test("chưa khai số dư: 'cần' là khoảng gộp, không gắn tên chương trình", () => {
  const bare = structuredClone(vietnamTripShortfall);
  bare.declared = { ...bare.declared, balances: false };
  bare.balances = [];
  const record = runFor(bare);
  const view = presentRun(record, DATA, offersFor(DATA));
  assert.ok(view !== null && view.trip !== null);
  assert.equal(view.trip.needProgram, null);
  assert.equal(view.trip.needTypical, record.outputSnapshot.results[0].numbers.tripNeedTypical);
});

test("thẻ bị chặn welcome bonus không được khen 'mức spend vừa sức bạn'", () => {
  // Mốc chi của một bonus người dùng không nhận được không phải thứ họ phải
  // đạt — "vừa sức" là khen một việc không ai làm (audit trang 25/09/2026).
  const record = runFor(beginnerNoCards);
  const spend = COMPONENT_STRENGTH.spend_fit;
  const before = presentRun(record, DATA, offersFor(DATA));
  assert.ok(before !== null && before.primary.strengths.includes(spend), "fixture phải có thẻ chính khen vế mốc chi");
  const blocked = structuredClone(record);
  const primary = blocked.outputSnapshot.results[0].primaryAction;
  assert.ok(primary.eligibility !== null && primary.eligibility !== undefined);
  primary.eligibility.welcomeOfferBlocked = true;
  const after = presentRun(blocked, DATA, offersFor(DATA));
  assert.ok(after !== null);
  assert.ok(!after.primary.strengths.includes(spend), after.primary.strengths.join(" | "));
});

test("'không thiếu' ở giá điển hình mà phủ dưới 100% cận trên: câu phủ nói rõ hai mức giá", () => {
  // Codex, audit 25/09/2026: "Không thiếu" ngay trên "phủ khoảng 98%".
  assert.equal(
    coverageStatement({ coverage: 0.976, gap: 0 }),
    "điểm hiện tại đủ ở mức giá điển hình; so với mức giá cao nhất thì phủ khoảng 98%",
  );
  assert.equal(coverageStatement({ coverage: 0.5, gap: 100_000 }), "điểm hiện tại phủ khoảng 50% chuyến này");
  assert.equal(coverageStatement({ coverage: 1, gap: 0 }), "điểm hiện tại phủ được cả chuyến này");
  assert.equal(coverageStatement({ coverage: 1.2, gap: 5_000 }), null);
  // Làm tròn không được đẩy lên 100% khi vẫn còn thiếu (kiểm định kỳ 26/09/2026).
  assert.equal(coverageStatement({ coverage: 139_999 / 140_000, gap: 1 }), "điểm hiện tại phủ khoảng 99% chuyến này");
  assert.equal(
    coverageStatement({ coverage: 0.997, gap: 0 }),
    "điểm hiện tại đủ ở mức giá điển hình; so với mức giá cao nhất thì phủ khoảng 99%",
  );
});

test("số dư đã khai mà chưa nói bao nhiêu: không in điểm giữa thành 'phủ khoảng 50%'", () => {
  // Audit trang 27/09/2026: khai có tài khoản Aeroplan® nhưng chưa nói số dư →
  // "gom được 0 điểm (ít nhất) · còn thiếu: chưa tính được · phủ khoảng 50%".
  // 50% là điểm giữa [0, 1] engine dùng để QUYẾT ĐỊNH, không phải một dữ kiện.
  const unknownBalance = structuredClone(vietnamTripShortfall);
  unknownBalance.balances = unknownBalance.balances.map((row) => ({ ...row, balance: null }));
  const view = presentRun(runFor(unknownBalance), DATA, offersFor(DATA));
  assert.ok(view !== null && view.trip !== null);
  assert.equal(view.trip.accessible, 0);
  assert.ok(view.trip.accessibleIsLowerBound);
  assert.ok(view.trip.coverageIsEstimate);
  assert.equal(view.trip.coverageLowerBound, 0);
  assert.equal(coverageStatement(view.trip), null, "sàn bằng 0 thì không có phần phủ nào để nói");
  // Và khối chuyến bay phải dẫn tới đúng câu làm con số chính xác.
  assert.ok(
    view.trip.missing.some((row) => row.questionKey === "point_balance_amount_unknown:aeroplan"),
    JSON.stringify(view.trip.missing),
  );

  // Có phần đã biết thì nói đúng là phần đã biết — không bao giờ nói điểm giữa,
  // và không hứa "ít nhất": mẫu số là cận trên của khoảng mô hình.
  assert.equal(
    coverageStatement({ coverage: 0.728, gap: null, coverageIsEstimate: true, coverageLowerBound: 0.456 }),
    "số điểm đã biết của bạn phủ khoảng 46% chuyến này",
  );
  assert.equal(
    coverageStatement({ coverage: 0.9995, gap: null, coverageIsEstimate: true, coverageLowerBound: 0.999 }),
    "số điểm đã biết của bạn phủ khoảng 99% chuyến này",
  );

  // Hai chương trình: sàn phải là của CHƯƠNG TRÌNH ĐANG HIỂN THỊ (Codex, review
  // 27/09/2026). 100,000 Aeroplan® + 160,000 AAdvantage® + Membership Rewards®
  // chưa khai số dư: trang đo bằng Aeroplan®, nên không được mượn sàn 57% của
  // AAdvantage®.
  const mixed = structuredClone(vietnamTripShortfall);
  mixed.balances = [
    { ...mixed.balances[0], programId: "aeroplan" as never, balance: 100_000 },
    { ...mixed.balances[0], programId: "aadvantage" as never, balance: 160_000 },
    { ...mixed.balances[0], programId: "amex-mr" as never, balance: null },
  ];
  const mixedView = presentRun(runFor(mixed), DATA, offersFor(DATA));
  assert.ok(mixedView !== null && mixedView.trip !== null);
  assert.equal(mixedView.trip.needProgram, "Air Canada® Aeroplan®");
  assert.ok(mixedView.trip.coverageIsEstimate);
  assert.equal(mixedView.trip.coverageLowerBound, 100_000 / (mixedView.trip.needHigh ?? Number.NaN));
  assert.equal(coverageStatement(mixedView.trip), "số điểm đã biết của bạn phủ khoảng 22% chuyến này");
  assert.ok(mixedView.trip.missing.some((row) => row.questionKey === "point_balance_amount_unknown:amex-mr"));

  // Số dư chưa khai ở chương trình KHÔNG chạm tới chặng (Avios® không có bảng
  // giá, và không chuyển sang Aeroplan®/AAdvantage®/Asia Miles®) thì không
  // mời khai — trả lời xong con số vẫn y nguyên (Codex, review 27/09/2026).
  const avios = structuredClone(vietnamTripShortfall);
  avios.balances = [...avios.balances, { ...avios.balances[0], programId: "avios" as never, balance: null }];
  const aviosView = presentRun(runFor(avios), DATA, offersFor(DATA));
  assert.ok(aviosView !== null && aviosView.trip !== null);
  assert.ok(!aviosView.trip.missing.some((row) => row.questionKey === "point_balance_amount_unknown:avios"));

  assert.equal(view.trip.coverageUncertainty, "balance");
  assert.equal(mixedView.trip.coverageUncertainty, "balance");

  // Chỗ chưa chắc đến từ GIÁ, không từ số dư: khai đủ số dư, premium economy
  // châu Âu (Aeroplan® chỉ có sàn động) — câu đuôi không được nói "chưa tính
  // phần điểm chưa biết" (Codex, vòng chốt 27/09/2026).
  const europeData = datasetAt(offlineDataset(), "2026-09-27");
  const priceOnly = structuredClone(vietnamTripShortfall);
  priceOnly.goals = priceOnly.goals.map((goal) =>
    goal.type === "trip" ? { ...goal, destinationRegion: "EUROPE" as const, cabin: "premium_economy" as const, passengers: 1, roundTrip: false } : goal,
  );
  priceOnly.balances = [
    { ...priceOnly.balances[0], programId: "aadvantage" as never, balance: 20_000 },
    { ...priceOnly.balances[0], programId: "aeroplan" as never, balance: 30_000 },
  ];
  const priceRecord = executeRun(
    { state: priceOnly, data: europeData, asOf: "2026-09-27" },
    { id: "run_present_price_only", createdAt: "2026-09-27T12:00:00.000Z", userId: "u_test" },
  ).record;
  const priceView = presentRun(priceRecord, europeData, offersFor(europeData));
  assert.ok(priceView !== null && priceView.trip !== null);
  assert.ok(priceView.trip.coverageIsEstimate, "fixture phải rơi vào nhánh ước lượng");
  assert.equal(priceView.trip.coverageUncertainty, "price");
  assert.ok(!priceView.trip.missing.some((row) => row.questionKey.startsWith("point_balance_amount_unknown:")));

  // Số dư đã biết đủ thì dòng "nói thêm số điểm" không xuất hiện.
  const known = presentRun(runFor(vietnamTripShortfall), DATA, offersFor(DATA));
  assert.ok(known !== null && known.trip !== null);
  assert.ok(!known.trip.missing.some((row) => row.questionKey.startsWith("point_balance_amount_unknown")));
});

test("bước bắt buộc mà engine không chặn (luật soft) vẫn tới mắt người đọc", () => {
  // Wealthsimple® Visa Infinite+ đòi tài khoản chequing Wealthsimple® — `soft`
  // vì ai cũng mở được lúc đăng ký. Engine bỏ qua luật soft, nên trước bản vá
  // này thẻ được gợi ý mà người đọc không hề biết bước đó (Codex, 27/09/2026).
  // Gắn luật vào thẻ chính của một nhân vật để khỏi phụ thuộc thứ hạng thật.
  const record = runFor(beginnerNoCards);
  const primaryId = record.outputSnapshot.results[0].primaryAction.productId;
  assert.ok(primaryId != null);
  const template = DATA.eligibilityRules.find((rule) => rule.productId === primaryId)!;
  const data = {
    ...DATA,
    eligibilityRules: [
      ...DATA.eligibilityRules,
      {
        ...template,
        id: "elig_test_banking" as never,
        ruleType: "banking_relationship_required" as const,
        operator: "eq" as const,
        value: "wealthsimple-chequing",
        severity: "soft" as const,
        scope: "application" as const,
        ruleGroup: null,
        lookback: null,
      },
    ],
  };
  const view = presentRun(record, data, offersFor(data));
  assert.ok(view !== null);
  assert.equal(view.primary.prerequisites.length, 1);
  assert.match(view.primary.prerequisites[0], /chequing Wealthsimple®/u);
  // Không có luật đó thì không có dòng nào.
  assert.deepEqual(presentRun(record, DATA, offersFor(DATA))?.primary.prerequisites, []);
});

test("độ chắc chắn nói ra NGUYÊN NHÂN sửa được, không phải chỉ một mức", () => {
  const record = runFor(beginnerNoCards);
  const view = presentRun(record, DATA, offersFor(DATA));
  assert.ok(view !== null);
  assert.equal(view.confidence.level, record.outputSnapshot.results[0].confidence.level);
  // Nhãn không bao giờ chỉ là một mức trừu tượng: nó phải nói ra chuyện gì.
  assert.ok(view.confidence.label.length > 0);
  assert.ok(view.confidence.sentence.length > 20);
  assert.notEqual(view.confidence.label, "Còn nhiều chỗ chưa chắc");
});

test("hồ sơ mới khai rất ít thì độ chắc chắn nói 'còn thiếu thông tin', không nói 'hai thẻ ngang nhau'", () => {
  // Trên bộ dữ liệu này khoảng cách điểm gần như luôn là yếu tố thấp nhất, nên
  // lấy yếu tố thấp nhất một cách máy móc thì MỌI người đều nhận cùng một câu
  // — kể cả người chưa trả lời gì, tức đúng người sửa được nó bằng một cú bấm.
  const bare = structuredClone(beginnerNoCards);
  bare.declared = { cards: false, balances: false };
  bare.spend = null;
  bare.profile.annualPersonalIncome = null;
  bare.profile.annualFeeTolerancePerCard = null;
  const view = presentRun(runFor(bare), DATA, offersFor(DATA));
  assert.ok(view !== null);
  assert.equal(view.confidence.label, "Còn thiếu thông tin");
});

test("mục tiêu không có trong bản ghi thì trả null, không nổ", () => {
  const record = runFor(beginnerNoCards);
  assert.equal(presentRun(record, DATA, offersFor(DATA), 7), null);
});

test("bảng 'mình đang dựa vào những gì' kể ĐỦ mọi câu đã trả lời, và sửa được", () => {
  // Một câu trả lời engine có đọc mà bảng không kể ra là một câu người dùng
  // bấm nhầm rồi không sửa được — cách duy nhất còn lại là làm lại từ đầu
  // (Codex vòng 1, Phase 5 UI).
  let state = stateWithGoal("trip:SEA_VIETNAM");
  const answered = new Set<string>();
  for (let step = 0; step < 60; step += 1) {
    const gap = userGaps(state).find((row) => questionFor(row, state, CTX) !== null);
    if (gap === undefined) break;
    const spec = questionFor(gap, state, CTX);
    assert.ok(spec !== null);
    const applied = applyAnswer(state, spec, answerFor(spec), CTX);
    assert.ok(applied.ok, `${spec.key}: ${applied.ok ? "" : applied.error}`);
    answered.add(spec.key);
    state = applied.state;
  }

  const rows = answeredRows(state, DATA);
  const shown = new Set(rows.map((row) => row.questionKey).filter((key): key is string => key !== null));
  for (const key of answered) {
    // `spend_profile_missing` và `monthly_total_unknown` ghi vào CÙNG một
    // trường (tổng chi tiêu tháng): câu đầu hỏi khi chưa có phần chi tiêu nào,
    // câu sau khi đã có. Bảng chỉ cần một dòng, và dòng đó mở ra câu sửa đúng.
    // Khoá in ra URL giấu id phiên đi (`:toi`) — xem `publicQuestionKey`.
    const shownKey = key
      .replace("spend_profile_missing:", "monthly_total_unknown:")
      .replace(`:${state.profile.id}`, ":toi");
    assert.ok(shown.has(shownKey), `bảng không kể ra câu đã trả lời: ${key}`);
  }
  // Và mọi khoá in ra phải mở lại được thành một câu hỏi thật.
  for (const key of shown) {
    assert.ok(questionFromKey(key, state, CTX) !== null, `khoá sửa không mở được: ${key}`);
  }
});

test("thẻ mà người dùng KHÔNG còn nhận được welcome bonus thì không hứa welcome bonus", () => {
  // Amex® once-in-a-lifetime: thẻ vẫn có thể là lựa chọn đúng (tỷ lệ tích
  // điểm, quyền lợi), nhưng câu "chi $X để nhận trọn welcome bonus" là một lời
  // hứa ngân hàng sẽ không giữ.
  //
  // Chạy trên dữ liệu 07/10/2026 (cắt cả `knownAt`). Ca gốc là Amex® Gold của
  // `advancedCollector`; từ engine 4.34.0 mục tiêu "đa dạng hơn" thôi chấm thẻ
  // MR thứ tư là linh hoạt thêm, và Gold rời bảng hiển thị — đổi kịch bản, giữ
  // phép kiểm: người "tích thêm điểm" từng giữ Amex® Green, Green vẫn hiện ra
  // (hạng 4) nhờ tỷ lệ tích điểm.
  const asOf = "2026-10-07";
  const data = datasetAt(offlineDataset(), asOf, { knownAt: asOf });
  const state = structuredClone(vagueEarner);
  state.cards = [
    {
      id: "uc_present_green" as never,
      userId: state.profile.id,
      productId: productIdFor("amex-green"),
      status: "previously_held",
      openedDate: "2022-01-01",
      closedDate: "2023-01-01",
    } as never,
  ];
  state.declared = { ...state.declared, cards: true };
  // Sức dồn ĐÃ KHAI: chưa khai thì không thẻ nào có câu về mức spend, và phép
  // kiểm bên dưới xanh với mọi đầu vào.
  state.spend = { ...state.spend!, minimumSpendCapacity3m: { low: 3_000, high: 3_000 } };
  const record = executeRun(
    { state, data, asOf, knownAt: asOf },
    { id: "run_present_blocked", createdAt: `${asOf}T12:00:00.000Z`, userId: "u_test" },
  ).record;
  const view = presentRun(record, data, offersFor(data));
  assert.ok(view !== null);
  const blocked = [view.primary, ...view.alternatives].find((row) => row.welcomeBonusBlocked);
  assert.ok(blocked !== undefined, "nhân vật này phải có ít nhất một thẻ bị chặn bonus");
  // So bằng MÃ, không bằng chữ: phép so cũ tìm "Mốc chi để nhận bonus" trong khi
  // copy đã đổi thành "Mức spend để nhận bonus…" — nên nó xanh với mọi đầu vào
  // (vòng Codex bác bản vá 09/10/2026).
  assert.equal(
    blocked.reasons.some((row) => row.code.startsWith("MIN_SPEND_")),
    false,
    `thẻ bị chặn bonus vẫn có câu về mức spend để nhận bonus: ${blocked.reasons.map((row) => row.code).join(", ")}`,
  );
  assert.equal(blocked.strengths.includes(COMPONENT_STRENGTH.spend_fit), false);
  assert.equal(blocked.strengths.includes(COMPONENT_STRENGTH.offer_quality), false);
});

test("lựa chọn thay thế GIỮ vế cảnh báo của nó — khối cảnh báo chỉ có ở thẻ chính", () => {
  // Bỏ lý do trùng cảnh báo chỉ đúng với thẻ chính, nơi khối cảnh báo hiện ra.
  // Làm vậy với hàng thay thế là xoá vế cảnh báo duy nhất của nó — hàng đó
  // không có chỗ nào khác để nói.
  let checked = 0;
  for (const state of [beginnerNoCards, aeroplanHeavy, vietnamTripShortfall, advancedCollector]) {
    const record = runFor(state);
    const view = presentRun(record, DATA, offersFor(DATA));
    assert.ok(view !== null);
    const result = record.outputSnapshot.results[0];
    result.alternatives.slice(0, 3).forEach((candidate, index) => {
      // Mã lý do có "anh em song sinh" bên phía cảnh báo — đúng những mã bị lọc
      // nếu người viết quên rằng hàng thay thế không hiện cảnh báo.
      for (const code of REASON_CODES) {
        const warning = REASON_COVERED_BY_WARNING[code];
        if (warning === undefined) continue;
        if (!candidate.reasonCodes.includes(code)) continue;
        if (!result.warnings.includes(warning)) continue;
        checked += 1;
        assert.ok(
          view.alternatives[index].reasons.some((row) => row.text === REASON_TEXT[code].text),
          `${candidate.productSlug}: mất câu "${code}" vì cảnh báo của THẺ KHÁC`,
        );
      }
    });
  }
  assert.ok(checked > 0, "không ca nào chạm tới cặp lý do/cảnh báo — bài này đang kiểm rỗng");
});

/* ------------------------------------------------------------------ *
 * Câu "mở thẻ rồi chi bao nhiêu"
 * ------------------------------------------------------------------ */

function componentsOf(slug: string) {
  const product = DATA.products.find((row) => row.slug === slug);
  assert.ok(product !== undefined, `thiếu thẻ ${slug}`);
  const offer = DATA.offers.find((row) => row.productId === product.id);
  assert.ok(offer !== undefined, `thiếu offer của ${slug}`);
  return { offer, components: DATA.offerComponents.filter((row) => row.offerId === offer.id) };
}

test("offer nhiều mốc liệt kê ĐÚNG từng mốc và thời hạn, không hứa \"nhận trọn\" bằng con số quy đổi", () => {
  // TD® Aeroplan® Visa Infinite*: $3,000/90 ngày RỒI $12,000/12 tháng. Con số
  // quy về 90 ngày là $3,000 — in nó thành "chi $3,000 trong 3 tháng đầu để
  // nhận trọn welcome bonus" là bỏ mất nửa bonus.
  const { offer, components } = componentsOf("td-aeroplan-visa-infinite");
  assert.equal(offer.spendPerNinetyDays, 3000, "dữ liệu đổi — bài này cần một offer nhiều mốc khác");
  const sentence = spendSentenceOf(components);
  assert.ok(sentence !== null);
  assert.ok(sentence.includes("$3,000 trong 90 ngày đầu"), sentence);
  assert.ok(sentence.includes("tổng cộng $12,000 trong 12 tháng đầu"), sentence);
  assert.ok(sentence.includes("giữ thẻ"), sentence);
  assert.ok(!sentence.includes("nhận trọn"), sentence);
  assert.ok(!sentence.includes("3 tháng đầu"), sentence);
});

test("mốc mở muộn nói \"thêm\" (tiền không dùng lại được), và điều kiện không phải chi tiêu vẫn được kể", () => {
  const reserve = spendSentenceOf(componentsOf("amex-aeroplan-reserve").components);
  assert.ok(reserve?.includes("$7,500 trong 90 ngày đầu, rồi chi thêm $2,500 trong tháng thứ 13"), reserve ?? "null");

  const platinum = spendSentenceOf(componentsOf("amex-platinum").components);
  assert.ok(platinum?.includes("tháng 15–17"), platinum ?? "null");
  assert.ok(!platinum?.includes("nhận trọn"), platinum ?? "null");
});

test("offer đúng MỘT mốc chi, không phần nào trả muộn, mới được hứa \"nhận trọn\" — với thời hạn thật", () => {
  // TD® First Class: $7,500 trong 180 ngày. Con số quy đổi là $3,750 — câu
  // cũ in "$3,750 trong 3 tháng đầu", một điều khoản không tồn tại.
  const { offer, components } = componentsOf("td-first-class-travel-visa-infinite");
  assert.equal(offer.spendPerNinetyDays, 3750);
  assert.equal(
    spendSentenceOf(components),
    "Mở thẻ này, rồi chi $7,500 trong 180 ngày đầu, để nhận trọn welcome bonus.",
  );
  // Mỗi chu kỳ sao kê là một mốc riêng — nói theo chu kỳ, không cộng dồn.
  assert.ok(
    spendSentenceOf(componentsOf("amex-cobalt").components)?.includes("$750 mỗi chu kỳ sao kê, suốt 12 chu kỳ đầu"),
  );
  assert.equal(spendSentenceOf([]), null);
});

test("câu mốc chi trên trang chỉ in số tiền có thật trong điều khoản, và chỉ hứa \"trọn\" khi offer một mốc", () => {
  let checked = 0;
  let multi = 0;
  for (const state of [beginnerNoCards, aeroplanHeavy, vietnamTripShortfall, japanTripFunded, advancedCollector]) {
    const record = runFor(state);
    const view = presentRun(record, DATA, offersFor(DATA));
    assert.ok(view !== null);
    for (const action of [view.primary, ...view.alternatives]) {
      if (action.slug === null) continue;
      const facts = record.derivedState.candidates.find((row) => row.productSlug === action.slug);
      assert.ok(facts !== undefined);
      const components = DATA.offerComponents.filter((row) => facts.offer.componentIds.includes(row.id));
      if (action.minSpendPer90Days === null) {
        assert.equal(action.spendSentence, null, `${action.slug}: hứa mốc chi khi engine không dựng được mốc nào`);
        continue;
      }
      assert.ok(action.spendSentence !== null, `${action.slug}: có mốc chi mà không có câu`);
      checked += 1;
      const real = new Set(
        components.flatMap((row) => (row.spendRequirement === null ? [] : [`$${row.spendRequirement.toLocaleString("en-US")}`])),
      );
      for (const amount of action.spendSentence.match(/\$[\d,]+/g) ?? []) {
        assert.ok(real.has(amount), `${action.slug}: "${amount}" không có trong điều khoản — ${action.spendSentence}`);
      }
      const spendRows = components.filter((row) => row.spendRequirement !== null);
      if (spendRows.length > 1) multi += 1;
      if (action.spendSentence.includes("nhận trọn")) {
        assert.equal(spendRows.length, 1, `${action.slug}: hứa "nhận trọn" với offer nhiều mốc`);
      }
    }
  }
  assert.ok(checked > 0 && multi > 0, "không ca nào chạm tới offer nhiều mốc — bài này đang kiểm rỗng");
});

test("mốc khai lời điều khoản thì trang nói lời đó, KHÔNG nói số ngày quy đổi", () => {
  // CIBC® Aventura®: "4 kỳ sao kê đầu tiên". 120 ngày là con số engine tự quy
  // ra để so với sức chi — in nó là bịa một điều khoản ngân hàng không viết.
  for (const slug of ["cibc-aventura-visa-infinite", "cibc-aventura-gold-visa"]) {
    const { components } = componentsOf(slug);
    const spoken = components.filter((row) => row.spendWindowText !== null);
    assert.equal(spoken.length, 2, `${slug}: dữ liệu đổi — bài này cần mốc khai lời điều khoản`);
    const sentence = spendSentenceOf(components);
    assert.ok(sentence !== null);
    assert.ok(sentence.includes("trong 4 kỳ sao kê đầu tiên"), sentence);
    assert.ok(!sentence.includes("120 ngày"), sentence);
    assert.ok(sentence.includes("tổng cộng $5,000"), sentence);
  }

  // Và luật chung: không mốc nào khai lời điều khoản mà trang vẫn in số ngày
  // của nó.
  for (const offer of DATA.offers) {
    const components = DATA.offerComponents.filter((row) => row.offerId === offer.id);
    const sentence = spendSentenceOf(components);
    if (sentence === null) continue;
    for (const row of components) {
      if (row.spendWindowText === null || row.spendRequirement === null) continue;
      assert.ok(
        !sentence.includes(`${row.spendWindowDays} ngày`),
        `${offer.id}: in số ngày quy đổi thay vì "${row.spendWindowText}" — ${sentence}`,
      );
    }
  }
});

test("chưa khai số dư: khối chuyến bay KHÔNG in 'gom được 0 điểm · còn thiếu · phủ 0%'", () => {
  // `japanTripFunded` có số dư thật; bỏ hẳn phần đã khai là đúng hồ sơ của người
  // bấm "Bỏ qua" ở câu "có điểm ở chương trình nào".
  const skipped: UserState = {
    ...japanTripFunded,
    balances: [],
    declared: { ...japanTripFunded.declared, balances: false },
  };
  const view = presentRun(runFor(skipped), DATA, offersFor(DATA));
  assert.ok(view?.trip != null);
  assert.ok(view.trip.needLow !== null, "tiền đề: chặng đã định giá, số điểm cần có mặt");
  assert.equal(view.trip.accessible, null);
  assert.equal(view.trip.gap, null);
  assert.equal(view.trip.coverage, null);

  // Chiều ngược lại: đã khai thì con số vẫn hiện.
  const funded = presentRun(runFor(japanTripFunded), DATA, offersFor(DATA));
  assert.ok(funded?.trip?.accessible != null);
});

test("câu 'offer đang yếu' / 'chưa thẻ nào vừa' chỉ nói khi đúng điều kiện, không vì là dòng lớn nhất", () => {
  // Rà trang 22/09/2026 (Codex): hồ sơ người mới có `offer_climate_weak` =
  // 0.5 — "không biết", trung tính — là dòng đóng góp nhiều nhất của "chưa mở
  // thẻ nào", và trang in "offer đang ở vùng thấp so với lịch sử".
  const record = runFor(beginnerNoCards);
  const noAction = record.outputSnapshot.results[0].noAction;
  assert.ok(!noAction.reasonCodes.includes("WAIT_FOR_BETTER_OFFER"));
  const top = [...noAction.components].sort((a, b) => b.contribution - a.contribution)[0];
  assert.equal(top.key, "offer_climate_weak", "fixture phải còn tái hiện đúng ca này");
  const view = presentRun(record, DATA, offersFor(DATA));
  assert.ok(view?.noAction);
  assert.equal(view.noAction.noCardReason, null);

  // Một phần ứng viên bị chặn không phải "chưa thẻ nào vừa".
  const blocked = structuredClone(record);
  for (const row of blocked.outputSnapshot.results[0].noAction.components) {
    if (row.key === "no_reachable_candidate") Object.assign(row, { raw: 0.9, contribution: 0.18 });
    if (row.key === "offer_climate_weak") Object.assign(row, { raw: 0.5, contribution: 0.1 });
  }
  assert.equal(presentRun(blocked, DATA, offersFor(DATA))?.noAction?.noCardReason, null);
  for (const row of blocked.outputSnapshot.results[0].noAction.components) {
    if (row.key === "no_reachable_candidate") Object.assign(row, { raw: 1, contribution: 0.2 });
  }
  assert.equal(presentRun(blocked, DATA, offersFor(DATA))?.noAction?.noCardReason, "nothing_fits");

  // "Thẻ bạn đang giữ đã kiếm đúng loại điểm" chỉ khi phép so ĐO ĐƯỢC: chưa
  // khai chi tiêu thì `portfolio_already_covers` = 0.5 trung tính (Codex, audit
  // trang 25/09/2026).
  const covers = structuredClone(record);
  for (const row of covers.outputSnapshot.results[0].noAction.components) {
    if (row.key === "portfolio_already_covers") Object.assign(row, { raw: 0.5, contribution: 0.3 });
    if (row.key === "no_reachable_candidate") Object.assign(row, { raw: 0, contribution: 0 });
  }
  assert.equal(presentRun(covers, DATA, offersFor(DATA))?.noAction?.noCardReason, null);
  for (const row of covers.outputSnapshot.results[0].noAction.components) {
    if (row.key === "portfolio_already_covers") Object.assign(row, { raw: 0.9, contribution: 0.3 });
  }
  assert.equal(presentRun(covers, DATA, offersFor(DATA))?.noAction?.noCardReason, "portfolio_covers");
});

test("dải chi tiêu lưu trước 25/09 [0, X] in 'Tới $X', dải mới [0, X−1] in 'Dưới $X'", () => {
  const state = structuredClone(beginnerNoCards);
  const label = "Spend dồn được trong 3 tháng";
  state.spend = { ...state.spend!, minimumSpendCapacity3m: { low: 0, high: 1_500 } };
  assert.equal(answeredRows(state, DATA).find((row) => row.label === label)?.value, "Tới $1,500");
  state.spend = { ...state.spend!, minimumSpendCapacity3m: { low: 0, high: 1_499 } };
  assert.equal(answeredRows(state, DATA).find((row) => row.label === label)?.value, "Dưới $1,500");
  state.spend = { ...state.spend!, minimumSpendCapacity3m: { low: 0, high: 0 } };
  assert.equal(answeredRows(state, DATA).find((row) => row.label === label)?.value, "Gần như không chi");
});

test("hết câu để hỏi thì độ chắc chắn không bảo 'trả lời thêm vài câu'", () => {
  const bare = structuredClone(beginnerNoCards);
  bare.declared = { cards: false, balances: false };
  bare.spend = null;
  bare.profile.annualPersonalIncome = null;
  bare.profile.annualFeeTolerancePerCard = null;
  const record = runFor(bare);
  const asked = presentRun(record, DATA, offersFor(DATA));
  assert.equal(asked?.confidence.label, "Còn thiếu thông tin");
  assert.match(asked!.confidence.sentence, /Trả lời thêm/);
  const skippedAll = presentRun(record, DATA, offersFor(DATA), 0, false);
  assert.ok(skippedAll !== null);
  assert.doesNotMatch(skippedAll.confidence.sentence, /Trả lời thêm/);
  // Và khi thiếu dữ liệu vẫn là yếu tố thấp nhất, câu đó nói đúng tình trạng.
  const weakest = structuredClone(record);
  weakest.outputSnapshot.results[0].confidence.scoreSeparation = 1;
  const onlyMissing = presentRun(weakest, DATA, offersFor(DATA), 0, false);
  assert.equal(onlyMissing?.confidence.label, "Còn thiếu thông tin");
  assert.doesNotMatch(onlyMissing!.confidence.sentence, /Trả lời thêm/);
});

test("chặng chưa có giá / thiếu thừa số chuyến đi: khối 'Đọc kỹ trước khi đăng ký' không nhắc lại khối chuyến bay", () => {
  // Rà trang 22/09/2026: "Chưa biết chuyến đi có mấy người" nằm trong khối
  // điều kiện của ngân hàng, ngay trên khối chuyến bay nói đúng câu đó.
  const tripTexts = [
    WARNING_TEXT.TRIP_CABIN_UNKNOWN,
    WARNING_TEXT.TRIP_PASSENGERS_UNKNOWN,
    WARNING_TEXT.TRIP_ROUND_TRIP_UNKNOWN,
    WARNING_TEXT.AWARD_ROUTE_NOT_IN_DATASET,
  ];
  for (const goalValue of ["trip:EUROPE", "trip:SEA_VIETNAM"]) {
    const record = runFor(stateWithGoal(goalValue));
    const runWarnings = [
      ...record.outputSnapshot.results[0].warnings,
      ...record.outputSnapshot.warnings,
    ].map((code) => WARNING_TEXT[code]);
    assert.ok(
      tripTexts.some((text) => runWarnings.includes(text)),
      `${goalValue}: lượt chạy phải còn cảnh báo chuyến đi, nếu không bài test không canh gì`,
    );
    const view = presentRun(record, DATA, offersFor(DATA));
    assert.ok(view?.trip);
    for (const text of tripTexts) assert.ok(!view.warnings.includes(text), `${goalValue}: "${text}"`);
  }
});
