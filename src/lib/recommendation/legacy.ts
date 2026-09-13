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
 * Trường sinh sau mà KHÔNG suy được từ bản ghi cũ: vắng nghĩa là "engine lúc
 * ấy không ghi", không phải một giá trị. So bản cũ với bản mới thì bỏ chúng ở
 * CẢ HAI phía — giữ lại là báo "khác" cho một điều bản cũ chưa từng nói.
 */
const UNINFERABLE = ["unknownCause", "basis", "flipShare", "uncertainFloorOnlyPrograms"] as const;

/** Có phán quyết điều kiện nào ở hình dạng trước 4.20.0 không. */
function hasLegacyVerdict(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasLegacyVerdict);
  const row = value as Record<string, unknown>;
  if (Array.isArray(row.rules) && "failedRuleIds" in row && !("welcomeFailedRuleIds" in row)) return true;
  return Object.values(row).some(hasLegacyVerdict);
}

function hasKey(value: unknown, key: string): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key));
  return key in value || Object.values(value).some((item) => hasKey(item, key));
}

/**
 * Hai bản ghi ở CÙNG một hình dạng, để phép so chỉ thấy khác biệt của engine
 * và dữ liệu, không thấy khác biệt của lược đồ. Trả về bản sao.
 */
export function alignRecords(
  a: RecommendationRunRecord,
  b: RecommendationRunRecord,
): [RecommendationRunRecord, RecommendationRunRecord] {
  const results = (r: RecommendationRunRecord) => ({ d: r.derivedState, o: r.outputSnapshot });
  const drop = UNINFERABLE.filter((key) => hasKey(results(a), key) !== hasKey(results(b), key));
  // Đường nhanh: cả hai đã ở hình dạng hiện tại — trường hợp của mọi phép so
  // giữa hai lượt chạy cùng đời, và của bài vét cạn (hàng trăm lần so).
  if (drop.length === 0 && !hasLegacyVerdict(results(a)) && !hasLegacyVerdict(results(b))) return [a, b];
  const reshape = (record: RecommendationRunRecord): RecommendationRunRecord => {
    const copy = JSON.parse(JSON.stringify(record), (key, value) =>
      (drop as readonly string[]).includes(key) ? undefined : value,
    ) as RecommendationRunRecord;
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
    return copy;
  };
  return [reshape(a), reshape(b)];
}
