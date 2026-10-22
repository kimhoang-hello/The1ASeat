import assert from "node:assert/strict";
import test from "node:test";

import { mentionsFirstYearWaiver, promisesBonus } from "./audit-text.ts";

/*
 * Bảng ca HAI CHIỀU: mỗi ca "phải nhận" đi cạnh ca "không được nhận" gần nó
 * nhất. Năm lần sai của khuôn này (21/10/2026) đều là một chiều bị bỏ quên.
 */

test("miễn phí năm đầu: nhận đúng các cách site viết", () => {
  for (const text of [
    "miễn phí năm đầu",
    "$139/năm (miễn phí năm đầu; thẻ phụ: $50/năm, tối đa 3 thẻ)",
    "Miễn annual fee $139 năm đầu cho thẻ chính cộng $50 mỗi thẻ cho tối đa 3 thẻ phụ",
    "Miễn annual fee $120 trong năm đầu, kể cả thẻ phụ",
    "Welcome bonus lên đến 20,000 điểm Aeroplan® kèm miễn annual fee năm đầu",
    "Miễn annual fee $1,000 năm đầu",
    "năm đầu được miễn annual fee",
    "năm đầu được miễn annual fee $139.",
    "năm đầu được miễn phí cho thẻ chính",
    "năm đầu được miễn annual fee $139 cho thẻ chính",
    "Năm đầu miễn phí thường niên $139",
    "Không có welcome bonus, nhưng miễn phí năm đầu",
  ]) {
    assert.equal(mentionsFirstYearWaiver(text), true, text);
  }
});

test("miễn phí năm đầu: không nhận phủ định, có điều kiện, hay miễn một khoản khác", () => {
  for (const text of [
    "không còn miễn phí năm đầu",
    "không còn được miễn phí năm đầu",
    "không miễn phí năm đầu",
    "$139/năm, không miễn năm đầu",
    "chưa được miễn phí năm đầu",
    "hết miễn annual fee năm đầu",
    "hết được miễn annual fee năm đầu",
    "bỏ miễn phí năm đầu",
    "năm đầu không được miễn",
    "năm đầu không được miễn annual fee",
    "miễn phí giao dịch ngoại tệ trong năm đầu",
    "năm đầu được miễn phí giao dịch ngoại tệ",
    "miễn phí thẻ phụ năm đầu",
    "năm đầu miễn phí thẻ phụ",
    "thẻ phụ: $50/năm, tối đa 3 thẻ, cũng miễn năm đầu",
    "miễn annual fee năm đầu nếu giữ số dư $6,000",
    "miễn phí năm đầu khi chi $5,000",
    "Năm đầu được miễn annual fee $139 nếu giữ số dư $6,000",
    "năm đầu được miễn annual fee nếu giữ số dư $6,000",
  ]) {
    assert.equal(mentionsFirstYearWaiver(text), false, text);
  }
});

test("welcome bonus: trống hay câu phủ định không phải lời hứa", () => {
  for (const [text, promised] of [
    ["70,000 điểm VIPorter®", true],
    ["Cashback 15% (tối đa $300)", true],
    ["Nhân đôi toàn bộ cashback năm đầu", true],
    ["Không có welcome bonus", false],
    ["Chưa có welcome bonus", false],
    ["   ", false],
    [undefined, false],
  ] as const) {
    assert.equal(promisesBonus(text), promised, String(text));
  }
});
