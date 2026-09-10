import { test } from "node:test";
import assert from "node:assert/strict";
import { isTransient } from "./job-retry.ts";

// Phép phân loại này quyết định job có đốt thêm hai lượt đọc FinlyWealth hay
// không, và nó đọc CHUỖI lỗi — thứ đổi lặng lẽ khi ai đó sửa câu `throw` trong
// `finlywealth.ts` hay `contentful-cma.ts`. Các chuỗi dưới đây chép NGUYÊN VĂN
// từ hai file đó; test đỏ nghĩa là câu lỗi đã đổi và phân loại đang trượt.

test("lỗi mạng và hết giờ thì chạy lại", () => {
  // `AbortSignal.timeout` trong `fetchPage`.
  assert.equal(isTransient(new Error("The operation was aborted due to timeout")), true);
  // `fetch` của Node khi DNS/kết nối hỏng.
  assert.equal(isTransient(new TypeError("fetch failed")), true);
});

test("5xx và 429 thì chạy lại", () => {
  assert.equal(isTransient(new Error("503 Service Unavailable")), true);
  assert.equal(isTransient(new Error("429 Too Many Requests")), true);
  assert.equal(isTransient(new Error("408 Request Timeout")), true);
  assert.equal(isTransient(new Error("Update failed: 500 {}")), true);
});

test("409 VersionMismatch của Contentful thì CHẠY LẠI", () => {
  // Entry đổi version giữa lúc `listEntries` đọc và `updateEntry` PUT — thường
  // là có người đang sửa trong Contentful đúng lúc job chạy. Lượt sau đọc lại
  // version mới nên có cơ thành công.
  assert.equal(isTransient(new Error("Update failed: 409 VersionMismatch")), true);
});

test("4xx thì KHÔNG chạy lại — chạy lại mười lượt vẫn ra đúng câu đó", () => {
  assert.equal(isTransient(new Error("404 Not Found")), false);
  assert.equal(isTransient(new Error("403 Forbidden")), false);
  // `updateEntry` khi token sai hoặc chưa Authorize cho org.
  assert.equal(isTransient(new Error("Update failed: 401 {\"message\":\"…\"}")), false);
});

test("FinlyWealth đổi markup thì KHÔNG chạy lại — cần người sửa rebateFromTitle", () => {
  assert.equal(isTransient(new Error("no <title> on the page")), false);
  assert.equal(
    isTransient(new Error("no rebate in title: Scotiabank Gold American Express")),
    false,
  );
});

test("không đọc ra hình dạng nào thì mặc định CHẠY LẠI", () => {
  // Mất một lượt đọc FinlyWealth rẻ hơn mất cả lượt kiểm rồi chờ 12 tiếng.
  assert.equal(isTransient(new Error("something nobody has seen before")), true);
  assert.equal(isTransient("not even an Error"), true);
});
