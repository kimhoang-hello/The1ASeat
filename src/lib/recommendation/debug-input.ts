/**
 * Sửa một hồ sơ giả bằng dòng `đường.dẫn=giá-trị` — dùng chung cho CLI
 * (`reco:debug what-if --set`) và trang admin (§22 "admin can enter a fake
 * profile").
 *
 * Một hàm cho cả hai: hai trình phân tích cú pháp cho cùng một cú pháp là hai
 * chỗ lệch được, và lệch ở đây là cùng một dòng "nếu như" cho hai kết quả tuỳ
 * admin gõ nó vào đâu.
 */

/**
 * `a.b[2].c=giá-trị`. Giá trị đọc như JSON nếu được (`0`, `null`, `true`,
 * `{"low":1,"high":2}`), không thì là chuỗi. Trả về lỗi dạng chữ thay vì ném:
 * một dòng gõ sai không được làm sập cả trang debugger.
 */
export function applyAssignment(target: unknown, assignment: string): string | null {
  const eq = assignment.indexOf("=");
  if (eq <= 0) return `cần dạng đường.dẫn=giá-trị, nhận được "${assignment}"`;
  const pathText = assignment.slice(0, eq).trim();
  const rawValue = assignment.slice(eq + 1).trim();
  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch {
    value = rawValue;
  }
  const keys = pathText.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  if (keys.length === 0) return `đường dẫn rỗng trong "${assignment}"`;
  // Chặn đường vào prototype: bản sửa chạy trên server, và `__proto__` trong
  // một đường dẫn gõ tay là cách làm bẩn MỌI object của tiến trình.
  if (keys.some((key) => key === "__proto__" || key === "constructor" || key === "prototype")) {
    return `đường dẫn không hợp lệ: "${pathText}"`;
  }
  let node = target as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    const next = node[key];
    if (next === null || typeof next !== "object") return `"${key}" trong "${pathText}" không phải object`;
    node = next as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
  return null;
}

/** Nhiều dòng, bỏ dòng trống và dòng bắt đầu bằng `#`. Trả về các lỗi, theo dòng. */
export function applyAssignments(target: unknown, text: string): string[] {
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;
    const error = applyAssignment(target, trimmed);
    if (error !== null) errors.push(`dòng ${index + 1}: ${error}`);
  });
  return errors;
}
