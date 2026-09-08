/**
 * §29 — độ tin cậy của KHUYẾN NGHỊ, không phải độ tin cậy của một mô hình ngôn
 * ngữ.
 *
 * Spec nêu đích danh bốn nguồn, và cả bốn được giữ riêng chứ không gộp thành
 * một con số mờ: §22 phải trả lời được "vì sao lượt này chỉ `medium`", và câu
 * trả lời "vì trung bình có trọng số ra 0.62" không giúp ai sửa được gì.
 *
 * VẾ QUAN TRỌNG NHẤT là khoảng cách điểm, và spec đưa luôn hai ví dụ:
 *
 * ```
 * top 0.84 / second 0.83  → thấp
 * top 0.91 / second 0.61  → có thể cao
 * ```
 *
 * Nên khoảng cách không chỉ là một vế được cộng vào — nó ĐẶT TRẦN. Hai thẻ hoà
 * nhau tới phần trăm thứ hai thì dù dữ liệu đầy đủ tới đâu, engine cũng không
 * biết cái nào tốt hơn; nói "cao" ở đó là nói về chất lượng dữ liệu trong khi
 * người đọc nghe thành chất lượng lời khuyên.
 */

import { clamp01 } from "./offer-quality.ts";
import type { Candidate, ConfidenceFactors, GoalContext } from "./engine-types.ts";
import type { UserDataGap } from "./user-types.ts";
import type { DataGap } from "./types.ts";

/** Chỗ trống nào của người dùng thật sự làm khuyến nghị kém chắc chắn. */
const BLOCKING_USER_GAPS: ReadonlySet<UserDataGap["kind"]> = new Set([
  "spend_profile_missing",
  "minimum_spend_capacity_unknown",
  "personal_income_unknown",
  "cards_undeclared",
  "balances_undeclared",
  "point_balance_amount_unknown",
  "trip_passengers_unknown",
  "trip_round_trip_unknown",
  "trip_cabin_unknown",
  "goal_priority_ambiguous",
]);

/** Số `DataGap["kind"]` mà lớp dữ liệu có thể phát ra — xem `types.ts`. */
const DATA_GAP_KINDS = 6;

/** Số ngày kể từ `verifiedAt` mà một dữ kiện còn coi là tươi. */
const FRESH_DAYS = 90;
/** Quá mốc này thì coi như đã cũ hẳn. */
const STALE_DAYS = 365;

export interface ConfidenceInput {
  ranked: readonly Candidate[];
  goal: GoalContext;
  userGaps: readonly UserDataGap[];
  dataGaps: readonly DataGap[];
  /** Ngày kiểm lại cũ nhất trong các bản ghi lượt chạy này dựa vào. */
  oldestVerifiedAt: string | null;
  asOf: string;
}

function goalSpecificity(goal: GoalContext): { value: number; note: string } {
  switch (goal.goal.type) {
    case "trip": {
      const trip = goal.trip;
      if (trip === null) return { value: 0.4, note: "mục tiêu chuyến đi chưa giải được" };
      let value = 1;
      const missing: string[] = [];
      if (trip.cabin == null) {
        value -= 0.3;
        missing.push("hạng ghế");
      }
      if (trip.passengers == null) {
        value -= 0.25;
        missing.push("số người");
      }
      if (trip.roundTrip == null) {
        value -= 0.25;
        missing.push("khứ hồi");
      }
      // Vùng khởi hành suy từ hồ sơ là một dữ kiện ĐÃ BIẾT ở chỗ khác, không
      // phải một chỗ trống — nên nó không trừ điểm. Xem `resolveTripGoal`.
      return {
        value: clamp01(value),
        note: missing.length === 0 ? "chuyến đi đã đủ ba thừa số" : `thiếu: ${missing.join(", ")}`,
      };
    }
    case "earn_points":
      return goal.goal.targetProgramId === null
        ? // "Tôi muốn tích điểm" là một câu trả lời hợp lệ, không phải chỗ
          // trống — nhưng nó rộng, và khuyến nghị rút ra từ nó kém chắc chắn
          // hơn một mục tiêu có tên chương trình.
          { value: 0.6, note: "chưa chỉ định chương trình đích" }
        : { value: 0.9, note: "có chương trình đích cụ thể" };
    case "diversify":
      return { value: 0.8, note: "mục tiêu đa dạng hoá đọc trực tiếp từ danh mục" };
    case "next_card":
      return { value: 0.75, note: "mục tiêu rộng: thẻ tiếp theo" };
  }
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function computeConfidence(input: ConfidenceInput): ConfidenceFactors {
  const notes: string[] = [];

  /* ---- Độ đầy đủ ------------------------------------------------- */
  // Đếm số LOẠI, không đếm số DÒNG — và bản đầu nói đúng điều đó trong chú
  // thích rồi làm ngược lại trong công thức. Người có năm tài khoản điểm chưa
  // nhớ số dư sinh năm dòng cùng một `kind`, và phép đếm dòng hạ độ tin cậy
  // của họ năm lần chỉ vì họ có nhiều tài khoản hơn.
  const blockingKinds = new Set(
    input.userGaps.filter((gap) => BLOCKING_USER_GAPS.has(gap.kind)).map((gap) => gap.kind),
  );
  const userCompleteness = clamp01(1 - blockingKinds.size / BLOCKING_USER_GAPS.size);
  if (blockingKinds.size > 0) {
    notes.push(`${blockingKinds.size} loại chỗ trống ảnh hưởng kết quả: ${[...blockingKinds].sort().join(", ")}`);
  }

  // Chỗ trống của LỚP DỮ LIỆU cũng phải kéo độ đầy đủ xuống, không chỉ để lại
  // một dòng ghi chú. Một lượt chạy chạm vào điều khoản offer chưa biết, điều
  // kiện chưa biết hay chặng bay chưa có giá mà vẫn báo "high" là engine tự
  // tin đúng ở chỗ nó không có quyền tự tin.
  const dataKinds = new Set(input.dataGaps.map((gap) => gap.kind));
  const dataCompleteness = clamp01(1 - dataKinds.size / DATA_GAP_KINDS);
  if (dataKinds.size > 0) {
    notes.push(`${dataKinds.size} loại chỗ trống của lớp dữ liệu: ${[...dataKinds].sort().join(", ")}`);
  }

  // Trung bình có trọng số nghiêng về phía người dùng: thiếu dữ liệu người
  // dùng thường đổi kết quả mạnh hơn thiếu một mảnh dữ liệu sản phẩm.
  const completeness = 0.65 * userCompleteness + 0.35 * dataCompleteness;

  /* ---- Độ tươi ---------------------------------------------------- */
  let freshness = 1;
  if (input.oldestVerifiedAt !== null) {
    const age = daysBetween(input.oldestVerifiedAt, input.asOf);
    freshness =
      age <= FRESH_DAYS
        ? 1
        : age >= STALE_DAYS
          ? 0
          : 1 - (age - FRESH_DAYS) / (STALE_DAYS - FRESH_DAYS);
    if (freshness < 1) notes.push(`dữ kiện cũ nhất đã ${age} ngày`);
  }

  /* ---- Độ cụ thể của mục tiêu ------------------------------------- */
  const specificity = goalSpecificity(input.goal);
  if (specificity.value < 1) notes.push(specificity.note);

  /* ---- Khoảng cách điểm ------------------------------------------- */
  const top = input.ranked[0]?.score ?? 0;
  const second = input.ranked[1]?.score ?? 0;
  const gap = Math.max(0, top - second);
  // 0.20 trở lên là tách bạch; dưới 0.02 là hoà. Hai mốc đến từ chính hai ví
  // dụ của §29 (0.30 → cao, 0.01 → thấp).
  const separation = clamp01((gap - 0.02) / (0.2 - 0.02));
  if (gap < 0.05 && input.ranked.length > 1) {
    notes.push(`hai ứng viên đầu chỉ cách nhau ${gap.toFixed(3)}`);
  }

  const blended =
    0.3 * completeness + 0.2 * freshness + 0.25 * specificity.value + 0.25 * separation;

  // Khoảng cách điểm ĐẶT TRẦN, không chỉ góp một phần — xem đầu file.
  let level: ConfidenceFactors["level"] =
    blended >= 0.75 ? "high" : blended >= 0.5 ? "medium" : "low";
  if (input.ranked.length > 1) {
    if (gap < 0.05) level = "low";
    else if (gap < 0.12 && level === "high") level = "medium";
  }

  return {
    dataCompleteness: completeness,
    dataFreshness: freshness,
    goalSpecificity: specificity.value,
    scoreSeparation: separation,
    level,
    notes,
  };
}
