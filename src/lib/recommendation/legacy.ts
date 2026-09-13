/**
 * Đọc bản ghi §20 của MỌI version Phase 4 — một chỗ duy nhất biết các trường
 * nào sinh sau.
 *
 * §20 hứa đọc được mọi lượt chạy đã lưu, và Phase 4 thêm trường qua nhiều
 * version. Hai chỗ từng tự xoay xở riêng: debugger nổ `TypeError` trên bản ghi
 * trước 4.20 (vòng Codex 19), và phép so giữa bản cũ với bản mới báo tầng điều
 * kiện "khác" chỉ vì trường mới vắng (vòng Codex 20). CHỈ ĐỌC — không hàm nào
 * ở đây sửa bản ghi được truyền vào: replay so dấu vân tay trên bản gốc.
 */

import type { EligibilityVerdict } from "./engine-types.ts";
import type { RecommendationRunRecord } from "./runs.ts";

/**
 * Danh sách luật của MỘT cửa. Bản ghi trước 4.20.0 chung một cặp danh sách
 * cho hai cửa: chia lại theo `scope` của từng luật trong trace — không phải
 * `?? []`, thứ làm mất nguyên nhân của cửa bonus đã lưu.
 */
export function gateRuleIds(
  verdict: EligibilityVerdict,
  gate: "application" | "welcome_offer",
): { failed: string[]; unknown: string[] } {
  if (verdict.welcomeFailedRuleIds !== undefined && verdict.welcomeUnknownRuleIds !== undefined) {
    return gate === "application"
      ? { failed: verdict.failedRuleIds, unknown: verdict.unknownRuleIds }
      : { failed: verdict.welcomeFailedRuleIds, unknown: verdict.welcomeUnknownRuleIds };
  }
  const scopeOf = new Map(verdict.rules.map((rule) => [rule.ruleId, rule.scope]));
  // Chỗ trống của lớp dữ liệu (`gap:`) luôn thuộc cửa mở thẻ.
  const inGate = (id: string) => (scopeOf.get(id) ?? "application") === gate;
  return { failed: verdict.failedRuleIds.filter(inGate), unknown: verdict.unknownRuleIds.filter(inGate) };
}

/** Phán quyết điều kiện ở hình dạng hiện tại — trường suy được thì suy. */
function currentVerdict(verdict: EligibilityVerdict): EligibilityVerdict {
  const application = gateRuleIds(verdict, "application");
  const welcome = gateRuleIds(verdict, "welcome_offer");
  return {
    ...verdict,
    // Trước 4.20.0 engine không mô hình hoá cửa bonus CHƯA BIẾT — nó chưa bao
    // giờ ra `true`. `false` là đúng điều engine lúc ấy đã nói.
    welcomeOfferUncertain: verdict.welcomeOfferUncertain ?? false,
    failedRuleIds: application.failed,
    unknownRuleIds: application.unknown,
    welcomeFailedRuleIds: welcome.failed,
    welcomeUnknownRuleIds: welcome.unknown,
  };
}

/**
 * Hai bản ghi ở CÙNG một hình dạng, để phép so chỉ thấy khác biệt của engine
 * và dữ liệu, không thấy khác biệt của lược đồ. Trả về bản sao.
 *
 * Hai bước, và bước hai là thứ làm lời hứa "mọi version" đứng được:
 *
 *   1. Trường SUY ĐƯỢC thì suy (danh sách luật theo cửa, `welcomeOfferUncertain`,
 *      cả bản sao `excluded[].failedRuleIds` từng trộn luật bonus).
 *   2. Khoá chỉ có ở MỘT phía, tại CÙNG đường dẫn, thì bỏ ở phía có nó. Kiểu
 *      của lượt chạy không có trường tuỳ chọn nào và mọi "bản đồ" đều là mảng,
 *      nên một khoá lệch như vậy chỉ có thể là lược đồ đổi giữa hai version —
 *      không phải một khác biệt engine hay dữ liệu. Bản trước liệt kê tay bốn
 *      trường đời sau và bỏ sót cả chục trường sinh ở 4.2–4.12 (vòng Codex 21).
 *
 * Cùng version thì cùng lược đồ: trả nguyên, không sao chép.
 */
export function alignRecords(
  a: RecommendationRunRecord,
  b: RecommendationRunRecord,
): [RecommendationRunRecord, RecommendationRunRecord] {
  if (a.engineVersion === b.engineVersion) return [a, b];
  const [x, y] = [upgrade(a), upgrade(b)];
  dropOneSidedKeys({ d: x.derivedState, o: x.outputSnapshot }, { d: y.derivedState, o: y.outputSnapshot });
  return [x, y];
}

function upgrade(record: RecommendationRunRecord): RecommendationRunRecord {
  const copy = JSON.parse(JSON.stringify(record)) as RecommendationRunRecord;
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const row = value as Record<string, unknown>;
    if (row.eligibility !== null && typeof row.eligibility === "object" && Array.isArray((row.eligibility as EligibilityVerdict).rules)) {
      row.eligibility = currentVerdict(row.eligibility as EligibilityVerdict);
    }
    Object.values(row).forEach(visit);
  };
  visit(copy.derivedState);
  visit(copy.outputSnapshot);
  // `excluded[]` mang BẢN SAO danh sách luật đã chặn — trước 4.20.0 nó trộn
  // cả luật chỉ chặn bonus. Chia theo scope của luật trong dữ kiện ứng viên.
  const scopes = new Map<string, string>();
  for (const row of copy.derivedState.candidates ?? []) {
    for (const rule of row.eligibility.rules) scopes.set(rule.ruleId, rule.scope);
  }
  for (const row of copy.derivedState.excluded ?? []) {
    row.failedRuleIds = row.failedRuleIds.filter((id) => scopes.get(id) !== "welcome_offer");
  }
  return copy;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function dropOneSidedKeys(a: unknown, b: unknown): void {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) dropOneSidedKeys(a[i], b[i]);
    return;
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return;
  for (const key of Object.keys(a)) if (!(key in b)) delete a[key];
  for (const key of Object.keys(b)) if (!(key in a)) delete b[key];
  for (const key of Object.keys(a)) dropOneSidedKeys(a[key], b[key]);
}
