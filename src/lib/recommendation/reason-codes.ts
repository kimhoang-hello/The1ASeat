/**
 * Từ vựng ĐÓNG của engine: mã lý do, mã cảnh báo, loại hành động, tên thành
 * phần điểm.
 *
 * Spec §27 nói thẳng lý do tồn tại: "logic should emit codes, not hard-coded
 * user-facing prose". Câu tiếng Việt là việc của Phase 5/6; ở đây chỉ có mã.
 * Nhưng lý do nó là một file RIÊNG, và là file đầu tiên của Phase 3, thì khác:
 * mọi module còn lại đều phát ra mã, và nếu mỗi module tự khai chuỗi của mình
 * thì `explain.ts` không bao giờ liệt kê đủ, còn một lần gõ nhầm là một mã
 * biến mất khỏi lời giải thích mà không lỗi nào nổ ra.
 *
 * CƯỠNG CHẾ. Mỗi mã phải có một dòng trong bảng `REASON_CODE_NOTES` nói nó
 * được phát ra KHI NÀO — `Record<ReasonCode, string>` biến việc quên thành lỗi
 * biên dịch nêu đích danh mã bỏ sót. Cùng cơ chế `AssertAllKeys` của Phase 2,
 * và cùng lý do: hai chỗ nói về cùng một danh sách thì phải lệch được lúc biên
 * dịch, không phải lúc chạy.
 *
 * Và cùng kỷ luật với `UserDataGap` của Phase 2: **một mã chỉ được tồn tại nếu
 * có code THẬT SỰ phát ra nó.** Mã chết không im lặng vô hại — nó đi vào bảng
 * dịch của Phase 6 và thành một câu tiếng Việt không bao giờ hiện ra, rồi lần
 * sau ai đó sửa logic cho "khớp với mã đã có".
 */

/* ------------------------------------------------------------------ *
 * Mã lý do (§27)
 * ------------------------------------------------------------------ */

export const REASON_CODES = [
  /* Offer */
  "CURRENT_OFFER_STRONG",
  "CURRENT_OFFER_WEAK",
  "OFFER_ENDING_SOON",
  "OFFER_TERMS_UNKNOWN",
  "WELCOME_BONUS_UNAVAILABLE",
  "WELCOME_BONUS_UNCERTAIN",

  /* Mốc chi (§13) */
  "MIN_SPEND_GOOD_FIT",
  "MIN_SPEND_TIGHT",
  "MIN_SPEND_TOO_HIGH",
  "MIN_SPEND_CAPACITY_UNKNOWN",

  /* Điểm và chuyến đi */
  "POINTS_ALREADY_SUFFICIENT",
  "POINTS_GAP_LARGE",
  "TRIP_PROGRAM_MATCH",
  "TRIP_ROUTE_NOT_PRICED",
  "POINTS_COVERAGE_UNKNOWN",
  "AWARD_PRICE_IS_FLOOR_ONLY",

  /* Danh mục */
  "PORTFOLIO_CONCENTRATED",
  "PORTFOLIO_LACKS_FLEXIBILITY",
  "FLEXIBLE_CURRENCY_VALUABLE",
  "NEW_CURRENCY_EXPOSURE",
  "CASH_VALUE_UNPRICED",

  /* Quyền lợi */
  "EXISTING_BENEFIT_DUPLICATION",
  "LOW_INCREMENTAL_VALUE",
  "BENEFIT_ADDS_NEW_PROVIDER",

  /* Tích điểm hằng ngày */
  "EARNS_WELL_ON_STATED_SPEND",
  "EARN_PROFILE_UNKNOWN",

  /* Điều kiện và phù hợp (§14) */
  "ELIGIBILITY_UNCERTAIN",
  "INCOME_MAY_NOT_QUALIFY",
  "ANNUAL_FEE_ABOVE_TOLERANCE",
  "ANNUAL_FEE_WAIVED_FIRST_YEAR",
  "ANNUAL_FEE_HIGH_TOLERANCE_UNKNOWN",
  "UPGRADE_WITHIN_HELD_FAMILY",

  /* Không hành động (§16 Rule 8) */
  "NO_NEW_CARD_NEEDED",
  "WAIT_FOR_BETTER_OFFER",
  "FOCUS_ON_AWARD_AVAILABILITY",

  /* Chất lượng lượt chạy */
  "GOAL_AMBIGUOUS",
  "GOAL_MISSING",
  "SCORES_NEARLY_TIED",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

/** Mã này được phát ra khi nào, và ở đâu. Bảng bắt buộc — xem đầu file. */
export const REASON_CODE_NOTES: Record<ReasonCode, string> = {
  CURRENT_OFFER_STRONG:
    "offer-quality.ts — percentile lịch sử ≥ 70 so với chính thẻ này (§12).",
  CURRENT_OFFER_WEAK:
    "offer-quality.ts — percentile lịch sử ≤ 30. Đi kèm WAIT_FOR_BETTER_OFFER khi cả thị trường cùng yếu.",
  OFFER_ENDING_SOON: "offer-quality.ts — offer có endDate trong vòng 30 ngày kể từ asOf.",
  OFFER_TERMS_UNKNOWN:
    "offer-quality.ts — offer có headline nhưng không có component nào, tức mức DÙNG ĐƯỢC chưa biết (DataGap offer_terms_unknown).",
  WELCOME_BONUS_UNAVAILABLE:
    "eligibility.ts — luật scope welcome_offer chặn (Amex® once-in-a-lifetime, hoặc mở/đóng/giữ thẻ trong N tháng qua). Thẻ vẫn mở được, bonus thì không.",
  WELCOME_BONUS_UNCERTAIN:
    "eligibility.ts — cửa welcome bonus CHƯA BIẾT (vd. chưa khai thẻ từng giữ, hoặc thẻ đã đóng mà không rõ ngày với luật N tháng). rules.ts trừ nửa mức của WELCOME_BONUS_UNAVAILABLE.",

  MIN_SPEND_GOOD_FIT: "suitability.ts — mốc chi 90 ngày ≤ 70% sức dồn người dùng khai (§13).",
  MIN_SPEND_TIGHT: "suitability.ts — mốc chi nằm trong khoảng 70–100% sức dồn.",
  MIN_SPEND_TOO_HIGH: "suitability.ts — mốc chi vượt sức dồn. Phạt nặng, KHÔNG loại (§13).",
  MIN_SPEND_CAPACITY_UNKNOWN:
    "suitability.ts — người dùng chưa khai minimumSpendCapacity3m, nên §13 không đánh giá được.",

  POINTS_ALREADY_SUFFICIENT:
    "rules.ts Rule 1 — điểm tiếp cận được đã phủ cận trên khoảng điểm chuyến đi cần.",
  POINTS_GAP_LARGE: "scoring/trip.ts — còn thiếu trên 50% số điểm cần.",
  TRIP_PROGRAM_MATCH: "scoring/trip.ts — thẻ kiếm (hoặc chuyển tới được) chương trình định giá chặng này.",
  TRIP_ROUTE_NOT_PRICED:
    "portfolio.ts / normalize.ts — chưa có award strategy cho cặp vùng này (DataGap award_route_uncovered).",
  POINTS_COVERAGE_UNKNOWN:
    "strategies.ts — tỷ lệ phủ chuyến đi là ƯỚC LƯỢNG: có số dư chưa biết, hoặc giá chỉ biết sàn động, nên phần phủ nằm trong một khoảng (xem `tripCoverage`) và engine dùng điểm giữa — đừng đọc là thiếu, cũng đừng đọc là đủ. engine.ts — trên THẺ mà phần phủ sau welcome bonus là ước lượng (scoring/trip.ts `tripGain`).",
  AWARD_PRICE_IS_FLOOR_ONLY:
    "trip-need.ts — chiến lược duy nhất tra được có pricingModel dynamic_floor: chỉ pointsLow có nghĩa, đừng trình bày như một cái giá. engine.ts — cả khi người dùng CÓ điểm ở chương trình chỉ biết sàn, và trên THẺ mà welcome bonus rơi vào chương trình đó (scoring/trip.ts `tripGain`).",

  PORTFOLIO_CONCENTRATED: "rules.ts Rule 3 — một hệ sinh thái chiếm > 70% giá trị danh mục.",
  PORTFOLIO_LACKS_FLEXIBILITY: "needs.ts — flexibilityScore < 0.3 và người dùng có số dư đáng kể.",
  FLEXIBLE_CURRENCY_VALUABLE:
    "scoring/trip.ts, scoring/diversify.ts — thẻ kiếm điểm chuyển được, nên giữ được lựa chọn (§16 Rule 2).",
  NEW_CURRENCY_EXPOSURE: "scoring/diversify.ts — thẻ mở ra một chương trình người dùng chưa có.",
  CASH_VALUE_UNPRICED:
    "rules.ts — mục tiêu `cash`, và đồng điểm của thẻ này có `cashOut: \"unknown\"`: chưa ai tra tỷ lệ rút ra tiền. Giá trị tích mỗi năm và giá trị welcome bonus của nó vì thế ĐỀU bằng 0 trong bảng điểm — không phải vì thẻ tệ, mà vì chưa có số để nhân. Không có mã này thì con số 0 đó trông y hệt con số 0 của một đồng điểm đã kiểm và biết không rút được (vòng Codex 3).",

  EXISTING_BENEFIT_DUPLICATION:
    "benefits.ts (engine) — quyền lợi trùng CẢ benefitId LẪN provider với thẻ đang giữ (§16 Rule 6).",
  LOW_INCREMENTAL_VALUE:
    "rules.ts Rule 6 — phần lớn giá trị quyền lợi của thẻ này người dùng đã có sẵn.",
  BENEFIT_ADDS_NEW_PROVIDER:
    "benefits.ts (engine) — cùng quyền lợi nhưng KHÁC hãng, nên vẫn là giá trị mới (§5.5 bàn giao).",

  EARNS_WELL_ON_STATED_SPEND:
    "earning.ts (engine) — giá trị tích điểm hằng năm trên chi tiêu ĐÃ KHAI nằm trong nhóm dẫn đầu.",
  EARN_PROFILE_UNKNOWN:
    "earning.ts (engine) — người dùng chưa khai hạng mục nào, nên earn fit chạy trên chi tiêu chưa phân bổ.",

  ELIGIBILITY_UNCERTAIN: "eligibility.ts — có luật cứng không đánh giá được (thiếu dữ liệu người dùng).",
  INCOME_MAY_NOT_QUALIFY:
    "eligibility.ts — khoảng thu nhập BẮC QUA ngưỡng (compareToThreshold → straddles). Không loại (§14).",
  ANNUAL_FEE_ABOVE_TOLERANCE: "suitability.ts — phí thực trả năm đầu vượt ngưỡng người dùng khai.",
  ANNUAL_FEE_WAIVED_FIRST_YEAR:
    "suitability.ts — offer miễn phí năm đầu, nên phí năm đầu KHÁC phí thường niên (§5.6 bàn giao).",
  ANNUAL_FEE_HIGH_TOLERANCE_UNKNOWN:
    "suitability.ts — phí cao hơn trung vị thị trường mà người dùng CHƯA khai ngưỡng chịu được. Chưa hỏi không phải là đồng ý.",
  UPGRADE_WITHIN_HELD_FAMILY:
    "suitability.ts — người dùng đã giữ một hạng khác trong cùng họ thẻ; đây là NÂNG HẠNG, không phải thẻ thứ hai.",

  NO_NEW_CARD_NEEDED: "rank.ts — ứng viên NO_NEW_CARD thắng (§16 Rule 8).",
  WAIT_FOR_BETTER_OFFER:
    "strategies.ts — offer của các ứng viên hàng đầu đang ở vùng thấp của chính lịch sử chúng.",
  FOCUS_ON_AWARD_AVAILABILITY:
    "strategies.ts — đủ điểm rồi nhưng chặng khó chỗ; vấn đề là chỗ ngồi, không phải điểm (§16 Rule 1).",

  GOAL_AMBIGUOUS: "normalize.ts — nhiều mục tiêu hoà ưu tiên; engine chạy song song, không chọn bừa.",
  GOAL_MISSING: "normalize.ts — không có mục tiêu nào, nên không hàm chấm điểm nào của §10 áp được.",
  SCORES_NEARLY_TIED: "confidence.ts — khoảng cách hai ứng viên đầu < 0.05, nên độ tin cậy bị hạ (§29).",
};

/* ------------------------------------------------------------------ *
 * Cảnh báo
 * ------------------------------------------------------------------ */

/**
 * Cảnh báo KHÁC mã lý do: mã lý do giải thích thứ hạng, cảnh báo nói ra một
 * điều kiện người đọc phải biết TRƯỚC KHI hành động, kể cả khi nó không đổi
 * thứ hạng. Gộp chung thì lời giải thích của Phase 6 hoặc bỏ mất cảnh báo,
 * hoặc đọc mọi cảnh báo lên như một lý do để chọn thẻ.
 */
export const WARNING_CODES = [
  "SPEND_REQUIREMENT_LIKELY_UNSUITABLE",
  "ANNUAL_FEE_ABOVE_STATED_TOLERANCE",
  "SECOND_YEAR_FEE_APPLIES",
  "WELCOME_BONUS_BLOCKED_BY_PAST_CARD",
  "WELCOME_BONUS_NOT_VERIFIABLE",
  "ELIGIBILITY_NOT_VERIFIABLE",
  "AWARD_ROUTE_NOT_IN_DATASET",
  "AWARD_PRICE_FLOOR_ONLY",
  "POINTS_EXPIRY_NOT_MODELLED",
  "OFFER_TERMS_INCOMPLETE",
  "TRIP_PASSENGERS_UNKNOWN",
  "TRIP_ROUND_TRIP_UNKNOWN",
  "TRIP_CABIN_UNKNOWN",
  "BALANCES_UNDECLARED",
  "CARDS_UNDECLARED",
] as const;

export type WarningCode = (typeof WARNING_CODES)[number];

export const WARNING_CODE_NOTES: Record<WarningCode, string> = {
  SPEND_REQUIREMENT_LIKELY_UNSUITABLE: "suitability.ts — chính câu §13 yêu cầu kèm theo khi phạt nặng.",
  ANNUAL_FEE_ABOVE_STATED_TOLERANCE: "suitability.ts — phí năm đầu vượt ngưỡng người dùng khai.",
  SECOND_YEAR_FEE_APPLIES:
    "suitability.ts — offer miễn phí năm đầu nhưng phí thường niên vẫn tới ở năm thứ hai.",
  WELCOME_BONUS_BLOCKED_BY_PAST_CARD:
    "eligibility.ts — everHeld + luật once-in-a-lifetime (Amex®, BMO®, Neo™, loại thẻ Aeroplan®), hoặc luật N tháng (previous_cardholder_within_months) trượt. Thẻ gây chặn có thể là thẻ KHÁC cùng họ/cùng ngân hàng.",
  WELCOME_BONUS_NOT_VERIFIABLE:
    "eligibility.ts — thiếu dữ liệu người dùng cho luật welcome bonus (danh sách thẻ chưa khai, hoặc ngày mở/đóng của thẻ luật N tháng đếm).",
  ELIGIBILITY_NOT_VERIFIABLE: "eligibility.ts — thiếu dữ liệu người dùng cho một luật cứng.",
  AWARD_ROUTE_NOT_IN_DATASET: "trip-need.ts — cặp vùng chưa có award strategy nào.",
  AWARD_PRICE_FLOOR_ONLY: "trip-need.ts — chỉ có mức sàn của định giá động.",
  POINTS_EXPIRY_NOT_MODELLED:
    "rules.ts Rule 1 — khi kết luận 'đã đủ điểm'. Hạn điểm KHÔNG nằm trong mô hình V1 (§9 bàn giao), nên câu 'bạn đã đủ' phải kèm cảnh báo này.",
  OFFER_TERMS_INCOMPLETE: "offer-quality.ts — offer không có component, mức dùng được chưa biết.",
  TRIP_PASSENGERS_UNKNOWN: "trip-need.ts — thiếu một trong ba thừa số của số điểm cần.",
  TRIP_ROUND_TRIP_UNKNOWN: "trip-need.ts — thiếu thừa số khứ hồi; chênh nhau ĐÚNG GẤP ĐÔI.",
  TRIP_CABIN_UNKNOWN: "trip-need.ts — không biết hạng ghế thì không tra được award strategy.",
  BALANCES_UNDECLARED: "portfolio.ts — declared.balances false: mảng rỗng không phải 'không có điểm'.",
  CARDS_UNDECLARED: "portfolio.ts — declared.cards false: không loại trừ được thẻ đang giữ.",
};

/* ------------------------------------------------------------------ *
 * Loại hành động (§8)
 * ------------------------------------------------------------------ */

export const STRATEGY_TYPES = [
  "USE_EXISTING_POINTS",
  "EARN_FLEXIBLE_POINTS",
  "EARN_SPECIFIC_CURRENCY",
  "DIVERSIFY",
  "WAIT_FOR_BETTER_OFFER",
  "OPEN_CARD",
  "FOCUS_ON_AVAILABILITY",
  "BUILD_POINTS",
  "NO_NEW_CARD",
] as const;

export type StrategyType = (typeof STRATEGY_TYPES)[number];
