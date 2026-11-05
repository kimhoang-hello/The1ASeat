import { test } from "node:test";
import assert from "node:assert/strict";

import {
  copyOf,
  datesIn,
  MAX_SNAPSHOT_AGE_DAYS,
  standingCopy,
  standingCopyProblems,
  withRebate,
  type OfferCopy,
  type PublishSnapshot,
} from "./standing-offer.ts";

const L = (value: unknown) => ({ "en-US": value });

function snapshot(publishedAt: string, elevated: boolean, copy: OfferCopy): PublishSnapshot {
  return {
    publishedAt,
    fields: {
      elevatedBonus: L(elevated),
      welcomeBonusVi: L(copy.welcomeBonusVi),
      headlineVi: L(copy.headlineVi),
      keyBenefitsVi: L(copy.keyBenefitsVi),
      editorsTakeVi: L(copy.editorsTakeVi),
    },
  };
}

const STANDING: OfferCopy = {
  welcomeBonusVi: "50,000 điểm WestJet®",
  headlineVi: "Welcome bonus lên đến 50,000 điểm WestJet® kèm companion voucher từ $119 mỗi năm.",
  keyBenefitsVi: [
    "Welcome bonus 50,000 điểm WestJet® (30,000 điểm sau giao dịch đầu tiên + 20,000 điểm khi chi $5,000 trong 3 tháng đầu)",
    "Tích 2 điểm/$1 cho vé WestJet®",
  ],
  editorsTakeVi: "Thẻ hợp người bay WestJet® thường xuyên. HOT TIP: Apply thẻ qua FinlyWealth để nhận thêm $100 rebate.",
};

const ELEVATED: OfferCopy = {
  welcomeBonusVi: "70,000 điểm WestJet®",
  headlineVi: "Welcome bonus lên đến 70,000 điểm WestJet® kèm companion voucher từ $119 mỗi năm.",
  keyBenefitsVi: [
    "Welcome bonus lên đến 70,000 điểm WestJet® (30,000 + 30,000 khi chi $5,000 trong 3 tháng đầu + 10,000), promo đến 4/11/2026",
    "Tích 2 điểm/$1 cho vé WestJet®",
  ],
  editorsTakeVi: "Promo chỉ chạy đến ngày 4 tháng 11, 2026. HOT TIP: Apply thẻ qua FinlyWealth để nhận thêm $140 rebate.",
};

const SOURCE = {
  name: "WestJet RBC® World Elite Mastercard®",
  annualFee: "$139",
  rebate: "$140",
  offerDetails:
    "How to earn the welcome bonus Get up to 50,000 WestJet points 30,000 WestJet points upon your first purchase 20,000 WestJet points when you spend $5,000 in the first 3 months Earns rewards on 1.5x - 2x Fees & rates Annual fee $139",
};

const TODAY = "2026-11-19";

test("khôi phục bản publish cuối trước đợt nâng", () => {
  const history = [
    snapshot("2026-10-01T10:00:00Z", false, STANDING),
    snapshot("2026-10-10T10:00:00Z", true, ELEVATED),
  ];
  const result = standingCopy(history, ELEVATED, TODAY);
  assert.ok(result.ok && result.source === "snapshot");
  assert.deepEqual(result.copy, STANDING);
  assert.equal(result.publishedAt, "2026-10-01T10:00:00Z");
});

test("bản 'tắt cờ, giữ chữ elevated' MỚI HƠN lần elevated cuối không che bản offer thường", () => {
  const history = [
    snapshot("2026-11-05T15:55:00Z", false, ELEVATED),
    snapshot("2026-11-05T15:54:00Z", false, ELEVATED),
    snapshot("2026-10-10T10:00:00Z", true, ELEVATED),
    snapshot("2026-10-01T10:00:00Z", false, STANDING),
  ];
  const result = standingCopy(history, ELEVATED, TODAY);
  assert.ok(result.ok && result.source === "snapshot");
  assert.deepEqual(result.copy, STANDING);
});

test("gặp 'tắt cờ, giữ chữ elevated' giữa đường thì DỪNG, không lùi sang offer cũ hơn", () => {
  // Lượt job hỏng 05/11 rồi tác giả gia hạn: không phân biệt được với ca tác
  // giả chốt offer nâng cũ thành offer thường.
  const extended = { ...ELEVATED, editorsTakeVi: ELEVATED.editorsTakeVi.replace("4 tháng 11", "18 tháng 11") };
  const jobOff = [
    snapshot("2026-11-06T00:00:00Z", true, extended),
    snapshot("2026-11-05T15:54:00Z", false, ELEVATED),
    snapshot("2026-10-10T10:00:00Z", true, ELEVATED),
    snapshot("2026-10-01T10:00:00Z", false, STANDING),
  ];
  assert.equal(standingCopy(jobOff, extended, TODAY).ok, false);

  // Codex 05/11: thường 30,000 → nâng 50,000 → thường 50,000 (cùng chữ) → nâng 70,000.
  const c30 = { ...STANDING, welcomeBonusVi: "30,000 điểm WestJet®" };
  const c50 = { ...STANDING, welcomeBonusVi: "50,000 điểm WestJet®" };
  const c70 = { ...STANDING, welcomeBonusVi: "70,000 điểm WestJet®" };
  const promoted = [
    snapshot("2026-11-01T00:00:00Z", true, c70),
    snapshot("2026-10-20T00:00:00Z", false, c50),
    snapshot("2026-10-10T00:00:00Z", true, c50),
    snapshot("2026-10-01T00:00:00Z", false, c30),
  ];
  const result = standingCopy(promoted, c70, TODAY);
  assert.equal(result.ok, false, "không được chọn bản 30,000");
});

test("copy hiện tại chưa từng đi cùng cờ elevated → giữ nguyên, không đè bằng bản cũ", () => {
  const rewritten = { ...STANDING, editorsTakeVi: "Bản tác giả vừa viết lại cho offer thường." };
  const history = [
    snapshot("2026-11-20T00:00:00Z", false, rewritten),
    snapshot("2026-10-10T10:00:00Z", true, ELEVATED),
    snapshot("2026-10-01T10:00:00Z", false, STANDING),
  ];
  const result = standingCopy(history, rewritten, TODAY);
  assert.ok(result.ok && result.source === "current");
  assert.deepEqual(result.copy, rewritten);
});

test("so nội dung bỏ qua khác biệt khoảng trắng", () => {
  const spaced = { ...ELEVATED, headlineVi: `  ${ELEVATED.headlineVi.replace(/ /g, "  ")} ` };
  const history = [snapshot("2026-10-10T10:00:00Z", true, ELEVATED), snapshot("2026-10-01T10:00:00Z", false, STANDING)];
  const result = standingCopy(history, spaced, TODAY);
  assert.ok(result.ok && result.source === "snapshot");
});

test("thẻ bật elevated ngay từ lần publish đầu → không có gì để khôi phục", () => {
  const history = [snapshot("2026-10-10T10:00:00Z", true, ELEVATED), snapshot("2026-11-05T15:54:00Z", false, ELEVATED)];
  const result = standingCopy(history, ELEVATED, TODAY);
  assert.equal(result.ok, false);
});

test(`bản offer thường cũ hơn ${MAX_SNAPSHOT_AGE_DAYS} ngày bị từ chối`, () => {
  const history = [snapshot("2026-10-10T10:00:00Z", true, ELEVATED), snapshot("2026-07-01T10:00:00Z", false, STANDING)];
  const result = standingCopy(history, ELEVATED, TODAY);
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.reason : "", /2026-07-01/);
});

test("copyOf từ chối entry thiếu trường hoặc sai kiểu", () => {
  assert.equal(copyOf({ headlineVi: L("x"), editorsTakeVi: L("y") }), null);
  assert.equal(copyOf({ headlineVi: L("x"), editorsTakeVi: L("y"), keyBenefitsVi: L(["a", 3]) }), null);
  assert.deepEqual(copyOf({ headlineVi: L("x"), editorsTakeVi: L("y"), keyBenefitsVi: L(["a"]) }), {
    welcomeBonusVi: "",
    headlineVi: "x",
    keyBenefitsVi: ["a"],
    editorsTakeVi: "y",
  });
});

test("withRebate đổi mọi '$X rebate' sang rebate hiện hành, không đụng số tiền khác", () => {
  const copy = withRebate(STANDING, "$140");
  assert.match(copy.editorsTakeVi, /\$140 rebate/);
  assert.doesNotMatch(copy.editorsTakeVi, /\$100 rebate/);
  assert.match(copy.headlineVi, /\$119/);
  assert.deepEqual(withRebate(STANDING, undefined), STANDING);
});

test("bản khôi phục khớp FinlyWealth → không có lý do chặn", () => {
  assert.deepEqual(standingCopyProblems(withRebate(STANDING, "$140"), SOURCE, TODAY), []);
});

test("ngân hàng đổi luôn offer thường → số welcome bonus không còn trên FinlyWealth", () => {
  const source = { ...SOURCE, offerDetails: SOURCE.offerDetails.replace(/50,000/g, "40,000").replace(/20,000/g, "10,000") };
  const problems = standingCopyProblems(withRebate(STANDING, "$140"), source, TODAY);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /50000/);
});

test("số tiền dưới $1,000 trong headline không bị đòi, nhưng trong nhãn thì có", () => {
  // "$119" (voucher) không có trong nguồn nhưng là giá trị site tự ghi.
  const source = { ...SOURCE, offerDetails: SOURCE.offerDetails };
  assert.deepEqual(standingCopyProblems(withRebate(STANDING, "$140"), source, TODAY), []);
  const cashback = { ...STANDING, welcomeBonusVi: "Cashback 10% (tối đa $200)" };
  const problems = standingCopyProblems(withRebate(cashback, "$140"), source, TODAY);
  assert.ok(problems.some((p) => /10%|200/.test(p)));
});

test("không tự cộng các nấc điểm thành tổng (BMO® không in 70,000; 'up to 50,000' + 30,000 ≠ 80,000)", () => {
  const bmo = {
    ...SOURCE,
    offerDetails:
      "How to earn the welcome bonus 20,000 bonus points after spending $5,000 20,000 bonus points after $9,000 30,000 bonus points after $18,000 Earns rewards on 1x - 3x",
  };
  const copy: OfferCopy = {
    welcomeBonusVi: "70,000 điểm VIPorter®",
    headlineVi: "Welcome bonus lên đến 70,000 điểm VIPorter®.",
    keyBenefitsVi: ["Welcome bonus 70,000 điểm VIPorter® (20,000 sau $5,000 + 20,000 sau $9,000 + 30,000 sau $18,000)"],
    editorsTakeVi: "Thẻ hợp người bay Porter®. HOT TIP: Apply thẻ qua FinlyWealth để nhận thêm $140 rebate.",
  };
  assert.ok(standingCopyProblems(copy, bmo, TODAY).some((p) => /70000/.test(p)), "thẻ kiểu BMO® sửa tay");

  const capped = {
    ...SOURCE,
    offerDetails:
      "How to earn the welcome bonus Get up to 50,000 points 30,000 points on first purchase and the remainder after spending $5,000 Earns rewards on 2x",
  };
  const stale: OfferCopy = {
    welcomeBonusVi: "80,000 điểm WestJet®",
    headlineVi: "Welcome bonus lên đến 80,000 điểm WestJet®.",
    keyBenefitsVi: ["Welcome bonus 80,000 điểm WestJet® (30,000 + 50,000 khi chi $5,000)"],
    editorsTakeVi: "HOT TIP: Apply thẻ qua FinlyWealth để nhận thêm $140 rebate.",
  };
  assert.ok(standingCopyProblems(stale, capped, TODAY).some((p) => /80000/.test(p)));
});

test("nhãn rỗng → chặn (copy viết lúc thẻ chưa có welcome bonus)", () => {
  const problems = standingCopyProblems({ ...withRebate(STANDING, "$140"), welcomeBonusVi: "" }, SOURCE, TODAY);
  assert.ok(problems.some((p) => /nhãn/.test(p)));
});

test("còn nhắc ngày đã qua → chặn; khoảng ngày còn hiệu lực thì không", () => {
  const stale = withRebate(ELEVATED, "$140");
  const problems = standingCopyProblems(stale, { ...SOURCE, offerDetails: `${SOURCE.offerDetails} 70,000 30,000 10,000` }, TODAY);
  assert.ok(problems.some((p) => /4\/11\/2026/.test(p) && /4 tháng 11, 2026/.test(p)), problems.join(" | "));

  const window = {
    ...withRebate(STANDING, "$140"),
    keyBenefitsVi: [`${STANDING.keyBenefitsVi[0]}, cho tài khoản mở từ 02/11/2026 đến 03/01/2027`],
  };
  assert.deepEqual(standingCopyProblems(window, SOURCE, TODAY), []);

  // Ngày tương lai ở mệnh đề khác không che ngày hết hạn (Codex 05/11).
  const clause = {
    ...withRebate(STANDING, "$140"),
    editorsTakeVi: `Ưu đãi chỉ chạy tới ngày 4 tháng 11, 2026; phí mới áp dụng từ 12 tháng 1 năm 2027. ${STANDING.editorsTakeVi}`,
  };
  clause.editorsTakeVi = withRebate(clause, "$140").editorsTakeVi;
  assert.ok(standingCopyProblems(clause, SOURCE, TODAY).some((p) => /4 tháng 11, 2026/.test(p)));
});

test("năm trong ngày không bị đọc thành một con số điểm", () => {
  const copy = {
    ...withRebate(STANDING, "$140"),
    keyBenefitsVi: [`${STANDING.keyBenefitsVi[0]}, mở tới 31/01/2027 (áp dụng từ năm 2026).`],
  };
  assert.deepEqual(standingCopyProblems(copy, SOURCE, TODAY), []);
});

test("rebate: hết rebate mà copy còn hứa → chặn; có HOT TIP mà không đọc ra số → chặn", () => {
  const noRebate = { ...SOURCE, rebate: undefined };
  assert.ok(standingCopyProblems(STANDING, noRebate, TODAY).some((p) => /không còn rebate/.test(p)));

  const unreadable = { ...STANDING, editorsTakeVi: "HOT TIP: Apply thẻ qua FinlyWealth để nhận rebate." };
  assert.ok(standingCopyProblems(unreadable, SOURCE, TODAY).some((p) => /HOT TIP/.test(p)));
});

test("số tiền viết sai định dạng → chặn", () => {
  const copy = { ...withRebate(STANDING, "$140"), editorsTakeVi: "Phí $1,00 mỗi tháng." };
  assert.ok(standingCopyProblems(copy, SOURCE, TODAY).some((p) => /\$1,00/.test(p)));
});

test("datesIn đọc hai kiểu viết ngày, bỏ ngày thiếu năm", () => {
  assert.deepEqual(
    datesIn("đến 4/11/2026, hoặc 18 tháng 11 năm 2026, hoặc 4/11").map((d) => d.iso),
    ["2026-11-04", "2026-11-18"],
  );
});
