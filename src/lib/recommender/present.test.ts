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
  vietnamTripShortfall,
} from "../recommendation/data/user-fixtures.ts";
import { REASON_CODES, WARNING_CODES } from "../recommendation/reason-codes.ts";
import { executeRun } from "../recommendation/runs.ts";
import { datasetAt } from "../recommendation/temporal.ts";
import type { RecommendationDataset } from "../recommendation/types.ts";
import type { UserState } from "../recommendation/user-types.ts";
import { userGaps } from "../recommendation/user-gaps.ts";
import { REASON_TEXT, WARNING_TEXT } from "./copy.ts";
import { answeredRows, presentRun, reasonsOf } from "./present.ts";
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
  assert.equal(view.trip.needTypical, numbers.tripNeedTypical);
  assert.equal(view.trip.accessible, numbers.accessiblePoints);
  assert.equal(view.trip.gap, numbers.pointsGapTypical);
  assert.equal(view.trip.accessibleIsLowerBound, numbers.accessiblePointsIsLowerBound);
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
  const view = presentRun(runFor(advancedCollector), DATA, offersFor(DATA));
  assert.ok(view !== null);
  const blocked = [view.primary, ...view.alternatives].find((row) => row.welcomeBonusBlocked);
  assert.ok(blocked !== undefined, "nhân vật này phải có ít nhất một thẻ bị chặn bonus");
  assert.equal(
    blocked.reasons.some((row) => row.text.includes("Mốc chi để nhận bonus")),
    false,
  );
});
