/**
 * Khoá hợp lệ cho MỌI kho — id lượt chạy, id người dùng, dấu vân tay.
 *
 * Một hàm cho ba backend, vì hai phép kiểm cùng một khái niệm là hai chỗ lệch
 * được (bài học Phase 2). Luật đến từ kho file: id đi vào tên file nguyên vẹn
 * nên không được có `/` hay `..`. Kho MySQL cần đúng luật đó vì lý do khác —
 * collation `_bin` là PAD SPACE (`"a"` bằng `"a "`) và server không strict thì
 * cắt id dài im lặng — nhưng dù lý do nào, hai id khác nhau KHÔNG được trở
 * thành một khoá. Và một id kho này nhận thì kho kia cũng phải nhận: không thì
 * chuyển bản ghi giữa hai kho gãy giữa chừng.
 *
 * Không thay ký tự nào: thay `:` bằng `_` là để hai id khác nhau rơi vào cùng
 * một khoá, và `getRun` trả về lượt chạy của người khác.
 */
export function checkStoreKey(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(value) || value.includes("..")) {
    throw new Error(`${label} không hợp lệ cho kho: ${JSON.stringify(value)}`);
  }
  return value;
}
