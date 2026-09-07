// Kiểm ba phép tính tiền của welcome offer.
//
//   npm run test:reco
//
// Mỗi ca "đã sai" dưới đây là một bản vá thật, không phải một tình huống nghĩ
// ra: chỗ này sai ba lần liên tiếp (SUM, rồi MAX, rồi gom liên thông) và lần
// nào cũng trông hiển nhiên đúng cho tới khi có người dựng đúng phản ví dụ.
// Giữ lại chúng để lần thứ tư không phải phát hiện lại từ đầu.

import assert from "node:assert/strict";
import { test } from "node:test";
import { longestWindowMonths, spendPerNinetyDays, totalSpend } from "./spend.ts";

test("không có mốc chi nào thì không có con số nào", () => {
  assert.equal(totalSpend([]), null);
  assert.equal(spendPerNinetyDays([]), null);
  assert.equal(longestWindowMonths([]), null);
});

test("cửa sổ lồng nhau dùng chung tiền — KHÔNG cộng", () => {
  // TD® Aeroplan® Visa Infinite Privilege*: $12,000 trong 180 ngày rồi
  // $24,000 trong 12 tháng, cả hai tính từ ngày mở thẻ. $12,000 đầu nằm TRONG
  // $24,000. Bản dùng SUM ra $36,000 và loại oan thẻ.
  assert.equal(
    totalSpend([
      { from: 0, to: 180, needed: 12000 },
      { from: 0, to: 365, needed: 24000 },
    ]),
    24000,
  );
});

test("cửa sổ rời nhau KHÔNG dùng lại được tiền — phải cộng", () => {
  // Amex® Aeroplan®* Reserve: $7,500 trong 90 ngày đầu, rồi $2,500 ở tháng
  // thứ 13. Bản dùng MAX ra $7,500, tức nói 25,000 điểm kỷ niệm là miễn phí.
  assert.equal(
    totalSpend([
      { from: 0, to: 90, needed: 7500 },
      { from: 365, to: 395, needed: 2500 },
    ]),
    10000,
  );
});

test("chồng lấn một phần vẫn là dùng chung tiền", () => {
  // Bản gom theo NGÀY MỞ BẰNG NHAU coi hai cửa sổ này là rời nhau vì mở khác
  // ngày, ra $13,000.
  assert.equal(
    totalSpend([
      { from: 0, to: 180, needed: 5000 },
      { from: 30, to: 395, needed: 8000 },
    ]),
    8000,
  );
});

test("chồng lấn theo dây chuyền: đầu và cuối vẫn rời nhau", () => {
  // Bản gom liên thông nối cả ba thành một cụm rồi giữ đúng một mốc, ra $100.
  // Nhưng [0,10) và [19,30) không giao nhau, nên không đồng nào đếm cho cả
  // hai — sàn thật là $200.
  assert.equal(
    totalSpend([
      { from: 0, to: 10, needed: 100 },
      { from: 9, to: 20, needed: 100 },
      { from: 19, to: 30, needed: 100 },
    ]),
    200,
  );
});

test("chọn tập rời nhau NẶNG NHẤT, không phải tập nhiều phần tử nhất", () => {
  // Hai mốc nhỏ rời nhau ($100) thua một mốc lớn giao cả hai ($900). Thuật
  // toán tham lam theo số lượng sẽ chọn nhầm.
  assert.equal(
    totalSpend([
      { from: 0, to: 10, needed: 50 },
      { from: 20, to: 30, needed: 50 },
      { from: 5, to: 25, needed: 900 },
    ]),
    900,
  );
});

test("cửa sổ chạm đầu đuôi nhau là RỜI, không phải chồng", () => {
  // `to` là mốc kết thúc (nửa mở), nên [0,90) và [90,180) không có ngày chung.
  assert.equal(
    totalSpend([
      { from: 0, to: 90, needed: 1000 },
      { from: 90, to: 180, needed: 1000 },
    ]),
    2000,
  );
});

test("quy về 90 ngày: cửa sổ dài thì nhẹ đi", () => {
  // TD® First Class: $7,500 nhưng cho 180 ngày → $3,750 mỗi quý.
  assert.equal(spendPerNinetyDays([{ from: 0, to: 180, needed: 7500 }]), 3750);
  // Scotiabank® Passport®: tầng $40,000/năm nặng hơn tầng $2,000/90 ngày,
  // nhưng chỉ sau khi quy đổi mới thấy — số tuyệt đối thì $40,000 áp đảo.
  assert.equal(
    spendPerNinetyDays([
      { from: 0, to: 90, needed: 2000 },
      { from: 0, to: 365, needed: 40000 },
    ]),
    9863,
  );
});

test("quy về 90 ngày: Cobalt trải 12 chu kỳ nên nhẹ", () => {
  // $750 mỗi chu kỳ × 12 = $9,000 trải trên 365 ngày ≈ $2,219 mỗi quý. So
  // thẳng $9,000 với sức chi 3 tháng sẽ loại người thừa sức đạt.
  assert.equal(spendPerNinetyDays([{ from: 0, to: 365, needed: 9000 }]), 2219);
});

test("thời lượng offer tính cả độ trễ của mốc kỷ niệm", () => {
  // Chỉ nhìn độ dài cửa sổ thì Reserve hiện "3 tháng"; thật ra phải giữ thẻ
  // qua mốc kỷ niệm, tức sang năm thứ hai của annual fee.
  assert.equal(longestWindowMonths([{ to: 90 }, { to: 395 }]), 13);
  assert.equal(longestWindowMonths([{ to: 90 }]), 3);
});
