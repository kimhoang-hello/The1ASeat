/**
 * Welcome bonus CHƯA CHẮC không được hiện như một điều chắc chắn.
 *
 * Engine chỉ tính nửa phần bonus khi cửa welcome offer là `unknown`, nên thẻ
 * đó vẫn có thể đứng đầu. Trước vòng Codex 21/09/2026, trang khi ấy in trọn
 * con số bonus, câu "chi … để nhận trọn welcome bonus", và Phase 6 được phép
 * ghép "welcome bonus hiện hành là …" mà không một lời nào về chuyện chưa chắc
 * — đúng lời hứa của lỗi gốc (TD® Aeroplan® đã đóng, không rõ ngày).
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CreditCardOffer } from "../content/types.ts";
import { offlineDataset } from "../recommendation/data/index.ts";
import { cashSeeker } from "../recommendation/data/user-fixtures.ts";
import { executeRun } from "../recommendation/runs.ts";
import { datasetAt } from "../recommendation/temporal.ts";
import type { RecommendationDataset } from "../recommendation/types.ts";
import type { UserState } from "../recommendation/user-types.ts";
import { checkExplanation, MAX_FACTS_PER_SENTENCE } from "./explain-check.ts";
import { explanationPayload } from "./explain-payload.ts";
import { alternativeBonusLead, openCardSentence, presentRun } from "./present.ts";

// Luật "24 tháng" của Scotia Momentum® có hiệu lực từ ngày đọc điều khoản.
const ASOF = "2026-09-21";
const DATA = datasetAt(offlineDataset(), ASOF);

function offersFor(data: RecommendationDataset): CreditCardOffer[] {
  return data.products.map((product) => ({
    slug: product.slug,
    name: product.name,
    issuer: "Ngân hàng",
    image: `/${product.slug}.png`,
    cardImage: `/${product.slug}-card.png`,
    country: "CA" as const,
    annualFee: "$0",
    cardType: "travel",
    welcomeBonus: "30,000 điểm",
    headline: "",
    editorsTake: "",
    keyBenefits: [],
    elevatedBonus: false,
    applyUrl: `https://www.finlywealth.com/apply/${product.slug}`,
  }));
}

function viewFor(state: UserState) {
  const record = executeRun(
    { state, data: DATA, asOf: ASOF },
    { id: `run_bonus_${state.declared.cards}`, createdAt: `${ASOF}T12:00:00.000Z`, userId: "u_test" },
  ).record;
  const view = presentRun(record, DATA, offersFor(DATA));
  assert.ok(view !== null);
  return view;
}

// Người tìm hoàn tiền CHƯA khai thẻ từng giữ: Scotia Momentum® loại mọi người
// từng giữ thẻ Scotiabank® trong 24 tháng, nên bonus của thẻ đứng đầu là chưa biết.
const undeclared: UserState = { ...cashSeeker, declared: { ...cashSeeker.declared, cards: false } };

test("bonus chưa chắc: trang và Phase 6 đều phải nói ra", () => {
  const view = viewFor(undeclared);
  assert.equal(view.primary.slug, "scotiabank-momentum-visa-infinite-plus", "tiền đề: thẻ Scotia Momentum® đứng đầu");
  assert.equal(view.primary.welcomeBonusUncertain, true);
  assert.equal(view.primary.welcomeBonusBlocked, false);
  // Chữ người đọc thấy: không "nhận trọn", có "chưa chắc".
  assert.doesNotMatch(openCardSentence(view.primary), /nhận trọn/);
  assert.match(openCardSentence(view.primary), /chưa chắc/);
  assert.match(alternativeBonusLead(view.primary) ?? "", /chưa chắc bạn nhận được/);

  const payload = explanationPayload(view);
  const ids = payload.facts.map((fact) => fact.id);
  assert.ok(ids.includes("bonus") && ids.includes("bonus_uncertain"));

  // Dựng một bản ghép hợp lệ về mọi mặt khác, rồi nói con số bonus mà giấu
  // việc chưa chắc — cửa kiểm phải chặn.
  const reasons = payload.facts.filter((fact) => fact.role === "reason").map((fact) => fact.id);
  const sentences = [];
  for (let start = 0; start < reasons.length; start += MAX_FACTS_PER_SENTENCE) {
    sentences.push({ lead: start === 0 ? "why_card" : "also", facts: reasons.slice(start, start + MAX_FACTS_PER_SENTENCE) });
  }
  const hiding = checkExplanation(payload, { sentences: [...sentences, { lead: "cost", facts: ["bonus"] }] });
  assert.equal(hiding.ok, false);
  const honest = checkExplanation(payload, {
    sentences: [...sentences, { lead: "cost", facts: ["bonus", "bonus_uncertain"] }],
  });
  assert.equal(honest.ok, true, honest.ok ? "" : honest.problems.join("; "));
});

test("đã khai thẻ và không vướng luật nào ⇒ không gắn cờ chưa chắc", () => {
  const view = viewFor(cashSeeker);
  assert.equal(view.primary.slug, "scotiabank-momentum-visa-infinite-plus");
  assert.equal(view.primary.welcomeBonusUncertain, false);
  assert.doesNotMatch(openCardSentence(view.primary), /chưa chắc/);
  assert.ok(!explanationPayload(view).facts.some((fact) => fact.id === "bonus_uncertain"));
});
