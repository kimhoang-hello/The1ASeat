/**
 * Mã của engine → câu tiếng Việt cho người đọc.
 *
 * Engine phát MÃ, không phát chữ (spec §27), và `REASON_CODE_NOTES` trong
 * `reason-codes.ts` là ghi chú cho DEV: nó nói mã được phát ra ở file nào, dòng
 * nào. Đem nguyên nó ra trang là đưa cho người đọc một câu như "offer-quality.ts
 * — percentile lịch sử ≥ 70". Bảng dưới đây là lớp dịch, và nó nằm NGOÀI
 * `src/lib/recommendation/` vì đó là ranh giới: engine không được biết mình sẽ
 * được kể lại bằng câu chữ nào.
 *
 * `Record<ReasonCode, …>` chứ không phải `Partial`: thêm một mã trong engine mà
 * quên câu tiếng Việt là LỖI BIÊN DỊCH nêu đích danh mã bỏ sót — cùng cơ chế
 * `REASON_CODE_NOTES` dùng, và cùng lý do (một mã không có câu thì lặng lẽ biến
 * mất khỏi trang).
 *
 * GIỌNG: xưng "mình", gọi người đọc là "bạn"; giữ nguyên tiếng Anh những từ
 * người chơi điểm vẫn dùng (welcome bonus, offer, transfer); số ngăn nghìn bằng
 * dấu phẩy; `$` là CAD.
 */

import type { ReasonCode, StrategyType, WarningCode } from "../recommendation/reason-codes.ts";
import type { ConfidenceLevel, ScoreComponentKey } from "../recommendation/engine-types.ts";

/**
 * Một lý do NGHIÊNG VỀ ĐÂU.
 *
 * Cùng một danh sách mã vừa chứa "offer đang cao" vừa chứa "bạn sẽ không nhận
 * được bonus", và trộn chúng vào một khối "vì sao hợp với bạn" là bán hàng chứ
 * không phải tư vấn. Trang tách làm hai khối theo đúng trường này.
 *
 *  `good`    — lý do ủng hộ lựa chọn này.
 *  `caution` — điều người đọc phải biết trước khi bấm đăng ký.
 *  `info`    — ngữ cảnh: phần lớn là "chỗ này mình chưa biết".
 */
export type ReasonTone = "good" | "caution" | "info";

export interface ReasonText {
  tone: ReasonTone;
  text: string;
}

export const REASON_TEXT: Record<ReasonCode, ReasonText> = {
  CURRENT_OFFER_STRONG: {
    tone: "good",
    text: "Welcome bonus đang ở mức cao so với chính lịch sử của thẻ này.",
  },
  CURRENT_OFFER_WEAK: {
    tone: "caution",
    text: "Welcome bonus đang thấp hơn mức thẻ này thường có.",
  },
  OFFER_ENDING_SOON: { tone: "caution", text: "Offer này sắp hết hạn." },
  OFFER_TERMS_UNKNOWN: {
    tone: "info",
    text: "Điều khoản offer chưa đầy đủ, nên chưa rõ phải chi bao nhiêu mới nhận đủ bonus.",
  },
  WELCOME_BONUS_UNAVAILABLE: {
    tone: "caution",
    text: "Bạn từng giữ thẻ này, nên theo điều khoản sẽ không nhận được welcome bonus.",
  },
  WELCOME_BONUS_UNCERTAIN: {
    tone: "info",
    text: "Chưa chắc bạn còn nhận được welcome bonus — mình chưa biết bạn từng giữ những thẻ nào.",
  },

  MIN_SPEND_GOOD_FIT: {
    tone: "good",
    text: "Mốc chi để nhận bonus nằm trong khả năng bạn khai.",
  },
  MIN_SPEND_TIGHT: {
    tone: "caution",
    text: "Mốc chi sát với mức bạn dồn được — đạt được, nhưng không dư dả.",
  },
  MIN_SPEND_TOO_HIGH: {
    tone: "caution",
    text: "Mốc chi cao hơn mức bạn dồn được trong 3 tháng.",
  },
  MIN_SPEND_CAPACITY_UNKNOWN: {
    tone: "info",
    text: "Mình chưa biết bạn dồn được bao nhiêu chi tiêu sang thẻ mới trong 3 tháng.",
  },

  POINTS_ALREADY_SUFFICIENT: {
    tone: "good",
    text: "Số điểm bạn đang với tới được đã đủ cho chuyến này.",
  },
  POINTS_GAP_LARGE: { tone: "info", text: "Bạn còn thiếu hơn một nửa số điểm cần." },
  TRIP_PROGRAM_MATCH: {
    tone: "good",
    text: "Thẻ này kiếm (hoặc chuyển được) đúng loại điểm dùng cho chặng bạn muốn bay.",
  },
  TRIP_ROUTE_NOT_PRICED: {
    tone: "caution",
    text: "Chặng này chưa có trong award chart của site, nên mình chưa tính được số điểm cần.",
  },
  POINTS_COVERAGE_UNKNOWN: {
    tone: "info",
    text: "Phần chuyến đi mà điểm của bạn phủ được mới là ước lượng, chưa phải con số chắc.",
  },
  AWARD_PRICE_IS_FLOOR_ONLY: {
    tone: "caution",
    text: "Chương trình này chỉ công bố mức sàn, nên giá thật có thể cao hơn.",
  },

  PORTFOLIO_CONCENTRATED: {
    tone: "info",
    text: "Điểm của bạn đang dồn phần lớn vào một hệ sinh thái.",
  },
  PORTFOLIO_LACKS_FLEXIBILITY: {
    tone: "info",
    text: "Phần lớn điểm của bạn không chuyển sang chương trình khác được.",
  },
  FLEXIBLE_CURRENCY_VALUABLE: {
    tone: "good",
    text: "Thẻ này kiếm loại điểm chuyển được sang nhiều hãng, nên bạn giữ được lựa chọn.",
  },
  NEW_CURRENCY_EXPOSURE: {
    tone: "good",
    text: "Thẻ này mở ra một chương trình điểm bạn chưa có.",
  },

  EXISTING_BENEFIT_DUPLICATION: {
    tone: "caution",
    text: "Một số quyền lợi của thẻ này trùng với thẻ bạn đang giữ.",
  },
  LOW_INCREMENTAL_VALUE: {
    tone: "caution",
    text: "Phần lớn giá trị quyền lợi của thẻ này bạn đã có sẵn ở thẻ khác.",
  },
  BENEFIT_ADDS_NEW_PROVIDER: {
    tone: "good",
    text: "Quyền lợi tương tự nhưng của hãng khác, nên vẫn dùng thêm được.",
  },

  EARNS_WELL_ON_STATED_SPEND: {
    tone: "good",
    text: "Thẻ này tích điểm tốt trên đúng phần chi tiêu bạn đã khai.",
  },
  EARN_PROFILE_UNKNOWN: {
    tone: "info",
    text: "Bạn chưa khai chi tiêu theo hạng mục, nên phần tích điểm hằng ngày chỉ là ước lượng.",
  },

  ELIGIBILITY_UNCERTAIN: {
    tone: "info",
    text: "Còn một điều kiện của ngân hàng mình chưa kiểm được với thông tin bạn đã cho.",
  },
  INCOME_MAY_NOT_QUALIFY: {
    tone: "caution",
    text: "Khoảng thu nhập bạn khai nằm ngay quanh ngưỡng của thẻ — có thể đạt, có thể không.",
  },
  ANNUAL_FEE_ABOVE_TOLERANCE: {
    tone: "caution",
    text: "Phí năm đầu cao hơn mức bạn nói là chấp nhận được.",
  },
  ANNUAL_FEE_WAIVED_FIRST_YEAR: { tone: "good", text: "Miễn phí thường niên năm đầu." },
  ANNUAL_FEE_HIGH_TOLERANCE_UNKNOWN: {
    tone: "info",
    text: "Phí thẻ này cao hơn mức thường gặp, mà bạn chưa nói mình chịu được tới đâu.",
  },
  UPGRADE_WITHIN_HELD_FAMILY: {
    tone: "info",
    text: "Đây là nâng hạng trong họ thẻ bạn đang giữ, không phải mở thêm một thẻ khác.",
  },

  NO_NEW_CARD_NEEDED: {
    tone: "good",
    text: "Với mục tiêu này, mở thêm thẻ chưa mang lại gì đáng kể.",
  },
  WAIT_FOR_BETTER_OFFER: {
    tone: "good",
    text: "Offer của những thẻ đáng mở đang ở vùng thấp — đợi thêm thì lợi hơn.",
  },
  FOCUS_ON_AWARD_AVAILABILITY: {
    tone: "good",
    text: "Bạn đủ điểm rồi; việc khó còn lại là tìm chỗ trống, không phải kiếm thêm điểm.",
  },

  GOAL_AMBIGUOUS: {
    tone: "info",
    text: "Bạn đang có nhiều mục tiêu ngang nhau, nên mình tính cho từng mục tiêu một.",
  },
  GOAL_MISSING: { tone: "info", text: "Chưa có mục tiêu nào để tính." },
  SCORES_NEARLY_TIED: {
    tone: "info",
    text: "Hai lựa chọn đầu gần như ngang điểm — chọn cái nào cũng hợp lý.",
  },
};

/**
 * Cảnh báo — thứ người đọc phải biết TRƯỚC KHI hành động, kể cả khi nó không
 * đổi thứ hạng. Tách khỏi mã lý do đúng như `reason-codes.ts` tách chúng.
 */
export const WARNING_TEXT: Record<WarningCode, string> = {
  SPEND_REQUIREMENT_LIKELY_UNSUITABLE:
    "Nhiều khả năng bạn không kịp đạt mốc chi của welcome offer này.",
  ANNUAL_FEE_ABOVE_STATED_TOLERANCE: "Phí năm đầu vượt ngưỡng phí bạn đã khai.",
  SECOND_YEAR_FEE_APPLIES: "Năm đầu được miễn phí, nhưng từ năm thứ hai phí thường niên vẫn tính.",
  WELCOME_BONUS_BLOCKED_BY_PAST_CARD:
    "Bạn từng giữ thẻ này, nên theo điều khoản bạn sẽ không nhận được welcome bonus.",
  WELCOME_BONUS_NOT_VERIFIABLE:
    "Mình chưa kiểm được bạn còn đủ điều kiện nhận welcome bonus hay không — bạn chưa khai thẻ từng giữ.",
  ELIGIBILITY_NOT_VERIFIABLE:
    "Mình chưa kiểm được hết điều kiện của ngân hàng với thông tin hiện có. Ngân hàng vẫn là bên quyết định.",
  AWARD_ROUTE_NOT_IN_DATASET: "Chặng bay này chưa có trong award chart của site.",
  AWARD_PRICE_FLOOR_ONLY: "Chương trình chỉ công bố giá sàn, nên số điểm thật có thể cao hơn.",
  POINTS_EXPIRY_NOT_MODELLED:
    "Mình chưa tính hạn của điểm — kiểm lại xem điểm bạn đang có còn hạn không.",
  OFFER_TERMS_INCOMPLETE: "Điều khoản của offer này chưa đầy đủ trong dữ liệu của site.",
  TRIP_PASSENGERS_UNKNOWN: "Chưa biết chuyến đi có mấy người.",
  TRIP_ROUND_TRIP_UNKNOWN: "Chưa biết khứ hồi hay một chiều — số điểm chênh nhau đúng gấp đôi.",
  TRIP_CABIN_UNKNOWN: "Chưa biết bạn muốn bay hạng nào.",
  BALANCES_UNDECLARED: "Bạn chưa khai điểm đang có, nên mình chưa tính được phần điểm đó.",
  CARDS_UNDECLARED: "Bạn chưa khai thẻ đang giữ, nên gợi ý có thể trùng thẻ bạn đã có.",
};

/**
 * Mã lý do và mã cảnh báo nói CÙNG một chuyện.
 *
 * Engine cố ý phát cả hai (một cái giải thích thứ hạng, một cái là điều phải
 * biết trước khi hành động), nhưng trên trang chúng thành hai câu gần giống
 * nhau cách nhau ba dòng. Cảnh báo thắng: nó nằm trong khối "đọc kỹ trước khi
 * đăng ký", đúng chỗ người đọc cần thấy.
 */
export const REASON_COVERED_BY_WARNING: Partial<Record<ReasonCode, WarningCode>> = {
  ELIGIBILITY_UNCERTAIN: "ELIGIBILITY_NOT_VERIFIABLE",
  WELCOME_BONUS_UNAVAILABLE: "WELCOME_BONUS_BLOCKED_BY_PAST_CARD",
  WELCOME_BONUS_UNCERTAIN: "WELCOME_BONUS_NOT_VERIFIABLE",
  MIN_SPEND_TOO_HIGH: "SPEND_REQUIREMENT_LIKELY_UNSUITABLE",
  ANNUAL_FEE_ABOVE_TOLERANCE: "ANNUAL_FEE_ABOVE_STATED_TOLERANCE",
  AWARD_PRICE_IS_FLOOR_ONLY: "AWARD_PRICE_FLOOR_ONLY",
  TRIP_ROUTE_NOT_PRICED: "AWARD_ROUTE_NOT_IN_DATASET",
  OFFER_TERMS_UNKNOWN: "OFFER_TERMS_INCOMPLETE",
};

/** Cách tiếp cận (§8) — hiện ở phần "cách tính" cho người đọc kỹ. */
export const STRATEGY_TEXT: Record<StrategyType, string> = {
  USE_EXISTING_POINTS: "Dùng số điểm đang có",
  EARN_FLEXIBLE_POINTS: "Tích thêm điểm linh hoạt",
  EARN_SPECIFIC_CURRENCY: "Tích đúng loại điểm chuyến đi cần",
  DIVERSIFY: "Đa dạng hoá chương trình điểm",
  WAIT_FOR_BETTER_OFFER: "Đợi offer tốt hơn",
  OPEN_CARD: "Mở thêm một thẻ",
  FOCUS_ON_AVAILABILITY: "Tập trung tìm chỗ trống",
  BUILD_POINTS: "Xây điểm từ đầu",
  NO_NEW_CARD: "Chưa mở thẻ mới",
};

/** Tên từng dòng điểm (§10) — bảng "cách tính". */
export const COMPONENT_LABEL: Record<ScoreComponentKey, string> = {
  offer_quality: "Welcome offer đang tốt tới đâu",
  spend_fit: "Mốc chi có vừa sức bạn không",
  long_term_earn_fit: "Tích điểm hằng ngày",
  currency_fit: "Đúng loại điểm bạn cần",
  benefits_fit: "Quyền lợi thêm được",
  diversification: "Đa dạng hoá danh mục",
  trip_currency_utility: "Dùng được cho chuyến đi",
  points_gap_reduction: "Rút ngắn khoảng còn thiếu",
  flexibility_value: "Điểm linh hoạt",
  travel_benefits: "Quyền lợi du lịch",
  new_currency_exposure: "Chương trình điểm mới",
  transfer_flexibility: "Chuyển điểm được nhiều nơi",
  fee_drag: "Phí kéo lại",
  editorial: "Điều chỉnh biên tập",
  points_already_sufficient: "Điểm đã đủ",
  portfolio_already_covers: "Danh mục đã che được nhu cầu",
  no_reachable_candidate: "Không thẻ nào với tới được",
  offer_climate_weak: "Thị trường offer đang yếu",
};

/**
 * Cùng những dòng điểm đó, nhưng viết như một ĐIỂM MẠNH.
 *
 * `COMPONENT_LABEL` là tiêu đề cột trong bảng ("welcome offer đang tốt tới
 * đâu") — đọc như một câu hỏi, vì trong bảng nó đứng cạnh một con số. Nhét
 * nguyên nó vào câu "thẻ này lên đầu nhờ …" thì ra "lên đầu nhờ welcome offer
 * đang tốt tới đâu". Hai chỗ dùng, hai cách viết.
 */
export const COMPONENT_STRENGTH: Record<ScoreComponentKey, string> = {
  offer_quality: "welcome offer đang mạnh",
  spend_fit: "mốc chi vừa sức bạn",
  long_term_earn_fit: "tỷ lệ tích điểm hằng ngày",
  currency_fit: "đúng loại điểm bạn cần",
  benefits_fit: "quyền lợi thêm được",
  diversification: "giúp danh mục đỡ dồn một chỗ",
  trip_currency_utility: "đúng loại điểm cho chuyến bay của bạn",
  points_gap_reduction: "rút ngắn được khoảng còn thiếu",
  flexibility_value: "điểm linh hoạt",
  travel_benefits: "quyền lợi du lịch",
  new_currency_exposure: "mở ra một chương trình điểm mới",
  transfer_flexibility: "chuyển điểm được sang nhiều hãng",
  fee_drag: "phí thấp so với những thẻ cùng nhóm",
  editorial: "điều chỉnh biên tập",
  points_already_sufficient: "điểm bạn có đã đủ",
  portfolio_already_covers: "ví hiện tại đã che được nhu cầu",
  no_reachable_candidate: "chưa thẻ nào với tới được",
  offer_climate_weak: "thị trường offer đang yếu",
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "Chắc chắn",
  medium: "Tương đối chắc",
  low: "Còn nhiều chỗ chưa chắc",
};

/**
 * Nhãn độ chắc chắn theo NGUYÊN NHÂN, không theo mức.
 *
 * Mức một mình nói sai: hai thẻ hay nhất chênh nhau 0.02 điểm cũng kéo độ tin
 * cậy xuống `low`, và người đọc thấy "Còn nhiều chỗ chưa chắc" thì hiểu là
 * công cụ không biết gì — trong khi sự thật là CẢ HAI đều tốt. Một trạng thái
 * tốt bị viết như một lời thú nhận.
 */
export const CONFIDENCE_BY_CAUSE: Record<
  "dataCompleteness" | "dataFreshness" | "goalSpecificity" | "scoreSeparation",
  { label: string; sentence: string }
> = {
  scoreSeparation: {
    label: "Hai lựa chọn ngang nhau",
    sentence: "Thẻ đứng đầu và thẻ kế tiếp gần như ngang điểm — chọn cái nào cũng hợp lý.",
  },
  dataCompleteness: {
    label: "Còn thiếu thông tin",
    sentence: "Trả lời thêm vài câu là gợi ý này chắc hơn hẳn.",
  },
  dataFreshness: {
    label: "Dữ liệu cần kiểm lại",
    sentence: "Vài dòng dữ liệu đã lâu chưa kiểm lại, nên đối chiếu với trang của ngân hàng trước khi đăng ký.",
  },
  goalSpecificity: {
    label: "Mục tiêu còn chung chung",
    sentence: "Nói rõ hơn bạn muốn gì (chuyến bay nào, loại điểm nào) thì mình chọn sát hơn.",
  },
};

/**
 * Vì sao độ chắc chắn ở mức đó — theo YẾU TỐ THẤP NHẤT trong bốn yếu tố §29.
 *
 * Bốn yếu tố có bốn cách chữa khác nhau: thiếu thông tin thì trả lời thêm, hai
 * thẻ sát nhau thì chọn cái nào cũng được, dữ liệu cũ thì đợi mình kiểm lại,
 * mục tiêu chung chung thì nói rõ hơn. In một câu chung ("độ tin cậy trung
 * bình") không nói được nên làm gì tiếp.
 */
export const CONFIDENCE_REASON: Record<
  "dataCompleteness" | "dataFreshness" | "goalSpecificity" | "scoreSeparation",
  string
> = {
  dataCompleteness: "vì bạn còn vài thông tin chưa khai",
  dataFreshness: "vì vài dòng dữ liệu đã lâu chưa kiểm lại",
  goalSpecificity: "vì mục tiêu còn chung chung",
  scoreSeparation: "vì hai lựa chọn đầu gần như ngang nhau",
};

/**
 * Bốn cách "chưa mở thẻ" thắng, bốn câu khác nhau.
 *
 * `nothing_fits` là ca dễ nói sai nhất: người dùng đặt ngưỡng phí $0 và thu
 * nhập chưa tới ngưỡng thẻ nào — ví họ KHÔNG đủ gì cả, nên câu "ví bạn đã đủ"
 * vừa sai vừa làm họ tưởng không cần làm gì nữa.
 *
 * Nằm ở đây chứ không trong component: lời giải thích Phase 6 đưa CHÍNH câu
 * này cho Claude làm dữ kiện, nên trang và prompt không được giữ hai bản.
 */
export const NO_CARD_SENTENCE: Record<string, string> = {
  points_sufficient:
    "Số điểm bạn đang có đã đủ cho mục tiêu này — mở thêm thẻ lúc này không rút ngắn được gì.",
  portfolio_covers:
    "Ví hiện tại của bạn đã che được nhu cầu này, nên thẻ mới không thêm được bao nhiêu.",
  offers_weak:
    "Offer của những thẻ đáng mở đang ở vùng thấp — đợi thêm một thời gian thì được nhiều hơn.",
  nothing_fits:
    "Chưa thẻ nào vừa với điều kiện bạn đặt ra (ngưỡng phí, điều kiện của ngân hàng). Nới một trong hai là danh sách mở ra ngay.",
  default: "Mở thêm thẻ lúc này chưa mang lại gì đáng kể cho mục tiêu của bạn.",
};
