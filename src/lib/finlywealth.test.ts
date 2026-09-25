import assert from "node:assert/strict";
import test from "node:test";

import { rebateAmountInTitle } from "./finlywealth.ts";

// Con số đọc ra từ đây được GHI THẲNG lên site: `check-rebates` sửa `rebateVi`
// cộng câu HOT TIP rồi publish, `scripts/check-bank-rebates.mts` sửa
// `bank-accounts.ts` rồi commit. Đọc nhầm là hứa sai tiền với người đọc mà
// không gate nào đỏ — nên những bất biến dưới đây phải ở dạng test, không phải
// ở dạng chú thích.
//
// Mười bốn ca này là hai vòng review ngày 19/09/2026 gộp lại: vòng đầu tìm ra
// lỗi lấy nhầm con số `$` đầu tiên, vòng phản biện bắt bản vá đầu tiên mở ra
// ba lỗ mới (số đứng SAU cụm nhận diện, `$75abc`, và cách ngăn nghìn `$2 000`).

test("đọc đúng con số của mọi dạng tiêu đề FinlyWealth đang dùng", () => {
  assert.equal(
    rebateAmountInTitle("$200 BMO® VIPorter® World Elite Rebate from FinlyWealth"),
    "$200",
  );
  assert.equal(
    rebateAmountInTitle("$100 National Bank World Elite® Mastercard® Rebate from FinlyWealth"),
    "$100",
  );
  assert.equal(rebateAmountInTitle("$1,500 Something Big Rebate from FinlyWealth"), "$1,500");
});

test("giữ hai dạng tiêu đề đã được ghi nhận là hợp lệ", () => {
  // `check-bank-rebates.mts` ghi rõ dạng này phải đọc được, không được coi là
  // "rebate đã gỡ".
  assert.equal(
    rebateAmountInTitle("Up to $75 Tangerine® Savings Account Rebate from FinlyWealth"),
    "$75",
  );
  // Hậu tố SEO: neo cuối chuỗi sẽ làm đỏ cả 39 trang trong đúng một đêm.
  assert.equal(
    rebateAmountInTitle("$200 BMO® VIPorter® World Elite Rebate from FinlyWealth | Credit Cards"),
    "$200",
  );
});

test("từ chối tiêu đề mơ hồ thay vì đoán", () => {
  // Lỗi gốc: lấy con số `$` ĐẦU TIÊN, tức hứa dư $500 cho người đọc.
  assert.equal(
    rebateAmountInTitle("$700 in welcome value plus $200 BMO® Rebate from FinlyWealth"),
    null,
  );
  // Dấu phẩy sai chỗ — không biết là $2 hay $200 hay $2,000.
  assert.equal(rebateAmountInTitle("$2,00 BMO® VIPorter® Rebate from FinlyWealth"), null);
  // Con số đứng SAU cụm nhận diện là một con số khác, không phải rebate.
  assert.equal(rebateAmountInTitle("Rebate from FinlyWealth | Annual fee $120"), null);
  // Ngăn nghìn bằng khoảng trắng: đọc thành $2 là hụt 998 đô.
  assert.equal(rebateAmountInTitle("$2 000 BMO® VIPorter® Rebate from FinlyWealth"), null);
  // Không được ăn phần chữ số rồi bỏ phần đuôi lạ.
  assert.equal(rebateAmountInTitle("$75abc Tangerine® Rebate from FinlyWealth"), null);
  // Xu: chưa từng xuất hiện, và bản cũ cũng từ chối.
  assert.equal(rebateAmountInTitle("$1.25 Something Rebate from FinlyWealth"), null);
});

test("trả null cho mọi trang không phải trang rebate", () => {
  // FinlyWealth chưa điền số — `check-bank-rebates.mts` tự phân biệt ca này
  // với "đã gỡ" bằng tiền tố `null`, nên ở đây chỉ cần không đọc ra số.
  assert.equal(rebateAmountInTitle("null EQ Personal Account Rebate from FinlyWealth"), null);
  assert.equal(rebateAmountInTitle("Not Found"), null);
  assert.equal(rebateAmountInTitle("Service Unavailable"), null);
  assert.equal(rebateAmountInTitle(""), null);
});
