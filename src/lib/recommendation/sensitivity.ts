/**
 * §30 đo bằng THỰC NGHIỆM: một câu hỏi đáng hỏi khi câu trả lời của nó ĐỔI
 * ĐƯỢC khuyến nghị.
 *
 * `explain.ts` từng chọn câu hỏi tiếp theo chỉ bằng một bảng ưu tiên tĩnh cộng
 * vài luật khẩn — và chính file đó nói giá trị của một câu hỏi "không cố định,
 * nó phụ thuộc thẻ nào đang thắng". Debugger Phase 4 đo thật trên 15 nhân vật
 * và thấy bảng tĩnh chọn một câu KHÔNG đổi được gì ở 4 trong 8 ca có câu đổi
 * được: hỏi khứ hồi cho một chặng chưa có giá (khứ hồi hay một chiều thì cũng
 * không tính được), hỏi thu nhập hộ gia đình khi hạng nhì là thẻ doanh nghiệp
 * cách người thắng 0.038 và câu "có doanh nghiệp không" lật được thứ tự.
 *
 * Cách đo: lấp chỗ trống bằng vài câu trả lời ĐIỂN HÌNH, mỗi lần một câu, chạy
 * lại CHÍNH engine trên hồ sơ đó, và đếm số lần người thắng đổi. Tất định:
 * cùng đầu vào, cùng các câu trả lời thử, cùng thứ tự.
 *
 * Câu trả lời thử là giá trị điển hình, không phải mọi giá trị có thể — phép
 * thử nói "câu hỏi này CÓ THỂ đổi kết quả", không chứng minh được "nó KHÔNG
 * thể". Ba mức cho mỗi con số — thấp, giữa, cao — đủ để lộ ra một ngưỡng.
 *
 * File này KHÔNG import engine: nó nhận một hàm chạy lại từ `engine.ts`. Import
 * ngược sẽ là một vòng `engine → sensitivity → engine`.
 */

import { asArray, isObject } from "./user.ts";
import type { PointsProgramId, SpendCategory } from "./types.ts";
import type { EstimatedAmount, UserDataGap, UserSpendProfile, UserState } from "./user-types.ts";

interface Answer {
  label: string;
  apply: (state: UserState) => void;
}

const exact = (value: number): EstimatedAmount => ({ low: value, high: value });
const band = (low: number, high: number | null): EstimatedAmount => ({ low, high });

/** Hồ sơ chi tiêu tối thiểu khi người dùng CHƯA mở phần chi tiêu ra. */
function ensureSpend(state: UserState): UserSpendProfile {
  if (!isObject(state.spend)) {
    state.spend = {
      userId: state.profile.id,
      monthlyTotal: null,
      byCategory: {},
      minimumSpendCapacity3m: null,
      updatedAt: state.profile.updatedAt,
    };
  }
  if (!isObject(state.spend.byCategory)) state.spend.byCategory = {};
  return state.spend;
}

function tripGoal(state: UserState, goalId: string) {
  const goal = asArray(state.goals).find((row) => row.id === goalId);
  return goal?.type === "trip" ? goal : null;
}

/**
 * Câu trả lời thử cho một chỗ trống — rỗng khi chỗ trống đó không có câu trả
 * lời chung nào mà không phải bịa.
 *
 * Vắng mặt CÓ CHỦ Ý: `*_income_declined` (thử lấp là thử đúng điều người dùng
 * vừa từ chối nói — cùng lý do §30 không hỏi lại), những chỗ trống cần một
 * NGÀY cụ thể, và mục tiêu (không có "mục tiêu điển hình" nào).
 *
 * `cards_undeclared` / `balances_undeclared` cũng vắng: câu trả lời có giá trị
 * là "tôi đang giữ thẻ X", và không có thẻ X điển hình nào. Thử "chỉ có chừng
 * này" thì gần như không bao giờ đổi được gì — và đem kết quả đó ra kết luận
 * câu hỏi vô giá trị là sai. Chúng giữ chỗ theo bảng ưu tiên tĩnh.
 */
export function answersFor(gap: UserDataGap): Answer[] {
  switch (gap.kind) {
    case "personal_income_unknown":
      return [
        { label: "$30,000–40,000", apply: (s) => void (s.profile.annualPersonalIncome = band(30_000, 40_000)) },
        { label: "$60,000–80,000", apply: (s) => void (s.profile.annualPersonalIncome = band(60_000, 80_000)) },
        { label: "$150,000+", apply: (s) => void (s.profile.annualPersonalIncome = band(150_000, null)) },
      ];
    case "household_income_unknown":
      return [
        { label: "$40,000–50,000", apply: (s) => void (s.profile.annualHouseholdIncome = band(40_000, 50_000)) },
        { label: "$100,000–120,000", apply: (s) => void (s.profile.annualHouseholdIncome = band(100_000, 120_000)) },
        { label: "$250,000+", apply: (s) => void (s.profile.annualHouseholdIncome = band(250_000, null)) },
      ];
    case "minimum_spend_capacity_unknown":
      return [1_500, 5_000, 15_000].map((value) => ({
        label: `$${value.toLocaleString("en-US")}/3 tháng`,
        apply: (s) => void (ensureSpend(s).minimumSpendCapacity3m = exact(value)),
      }));
    case "monthly_total_unknown":
    case "spend_profile_missing":
      return [1_500, 4_000, 10_000].map((value) => ({
        label: `$${value.toLocaleString("en-US")}/tháng`,
        apply: (s) => void (ensureSpend(s).monthlyTotal = exact(value)),
      }));
    case "spend_category_unknown":
      return [0, 400, 1_200].map((value) => ({
        label: `${gap.subject} $${value.toLocaleString("en-US")}/tháng`,
        apply: (s) => void (ensureSpend(s).byCategory[gap.subject as SpendCategory] = exact(value)),
      }));
    case "annual_fee_tolerance_unknown":
      return [0, 150, 700].map((value) => ({
        label: `phí tối đa $${value}`,
        apply: (s) => void (s.profile.annualFeeTolerancePerCard = value),
      }));
    case "business_cards_preference_unknown":
      return [true, false].map((value) => ({
        label: `xét thẻ doanh nghiệp: ${value ? "có" : "không"}`,
        apply: (s) => void (s.profile.businessCardsAllowed = value),
      }));
    case "business_ownership_unknown":
      return [true, false].map((value) => ({
        label: `có doanh nghiệp: ${value ? "có" : "không"}`,
        apply: (s) => void (s.profile.hasBusiness = value),
      }));
    case "student_status_unknown":
      return [true, false].map((value) => ({
        label: `sinh viên: ${value ? "có" : "không"}`,
        apply: (s) => void (s.profile.isStudent = value),
      }));
    case "point_balance_amount_unknown":
      return [0, 60_000, 200_000].map((value) => ({
        label: `${gap.subject} ${value.toLocaleString("en-US")}`,
        apply: (s) => {
          for (const row of asArray(s.balances)) {
            if (row.programId === (gap.subject as PointsProgramId)) row.balance = value;
          }
        },
      }));
    case "trip_passengers_unknown":
      return [1, 2, 4].map((value) => ({
        label: `${value} người`,
        apply: (s) => {
          const goal = tripGoal(s, gap.subject);
          if (goal !== null) goal.passengers = value;
        },
      }));
    case "trip_round_trip_unknown":
      return [true, false].map((value) => ({
        label: value ? "khứ hồi" : "một chiều",
        apply: (s) => {
          const goal = tripGoal(s, gap.subject);
          if (goal !== null) goal.roundTrip = value;
        },
      }));
    case "trip_cabin_unknown":
      return (["economy", "business"] as const).map((value) => ({
        label: `hạng ${value}`,
        apply: (s) => {
          const goal = tripGoal(s, gap.subject);
          if (goal !== null) goal.cabin = value;
        },
      }));
    case "goal_missing":
    case "goal_priority_ambiguous":
    case "country_unknown":
    case "cards_undeclared":
    case "balances_undeclared":
    case "personal_income_declined":
    case "household_income_declined":
    case "card_closed_date_unknown":
    case "trip_dates_unknown":
    case "trip_flexibility_unknown":
      return [];
  }
}

export interface ProbeOutcome {
  label: string;
  winner: string | null;
  /** Người thắng khác người thắng hiện tại. */
  flipsWinner: boolean;
}

/** Kết quả đo một chỗ trống — đi vào `derived_state` để admin thấy §30 đã cân gì. */
export interface GapProbe {
  gapKind: UserDataGap["kind"];
  subject: string;
  outcomes: ProbeOutcome[];
  /** Số câu trả lời thử làm đổi người thắng. */
  flips: number;
}

/**
 * Đo một chỗ trống. `null` khi không đo được — không có câu trả lời thử, hoặc
 * hồ sơ hỏng tới mức không có chỗ để ghi câu trả lời.
 *
 * `winnerAfter` là lượt chạy lại của engine trên hồ sơ đã lấp; nó nhận một BẢN
 * SAO, nên một câu trả lời thử không bao giờ rò sang câu tiếp theo.
 */
export function probeGap(
  gap: UserDataGap,
  state: UserState,
  winner: string | null,
  winnerAfter: (state: UserState) => string | null,
): GapProbe | null {
  const answers = answersFor(gap);
  if (answers.length === 0 || !isObject(state.profile)) return null;
  const outcomes = answers.map((answer) => {
    const copy = structuredClone(state);
    answer.apply(copy);
    const after = winnerAfter(copy);
    return { label: answer.label, winner: after, flipsWinner: after !== winner };
  });
  return {
    gapKind: gap.kind,
    subject: gap.subject,
    outcomes,
    flips: outcomes.filter((row) => row.flipsWinner).length,
  };
}
