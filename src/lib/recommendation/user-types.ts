/**
 * Phase 2 của recommendation engine: TRẠNG THÁI NGƯỜI DÙNG.
 *
 * Phase 1 mô tả thế giới sản phẩm. File này mô tả một CON NGƯỜI trong thế giới
 * đó: họ đang có gì, họ bị ràng buộc bởi cái gì, và họ muốn làm gì. Ba câu hỏi
 * đó là toàn bộ phạm vi — và có một câu hỏi thứ tư CỐ Ý không nằm ở đây:
 *
 *   "Nên khuyên thẻ nào?"
 *
 * Không một trường nào dưới đây được phép trả lời câu đó. Không có
 * `preferredProduct`, không có trọng số chấm điểm, không có danh sách thẻ loại
 * trừ mang lý do biên tập. Lý do không phải sự thanh lịch: khoảnh khắc mô hình
 * người dùng bắt đầu mã hoá kết quả, engine ở Phase 3 hết tất định — nó chỉ
 * đọc lại quyết định mà bảng câu hỏi đã lén đưa ra, và §19 (giải thích được)
 * lẫn Rule 7 (affiliate không ảnh hưởng thứ hạng) đều mất chỗ bám.
 *
 * KHÔNG THU THẬP DỮ LIỆU NHẠY CẢM KHÔNG CẦN THIẾT (spec §4.4). Cụ thể:
 *
 *   - Không có số tài khoản loyalty. Không phải "đừng điền" — mà là KHÔNG CÓ
 *     TRƯỜNG NÀO để điền, kể cả một trường ghi chú tự do. Đây là lý do toàn bộ
 *     file này không có lấy một trường chuỗi tự do: chỗ duy nhất một số tài
 *     khoản có thể lọt vào là một ô chữ không ai kiểm.
 *   - Thu nhập là KHOẢNG, không phải con số (spec §4.1). Điều kiện thu nhập của
 *     ngân hàng là ngưỡng, nên khoảng đã đủ trả lời, và khoảng thì không phải
 *     một dữ kiện tài chính chính xác về một người thật.
 *   - Không có tên, email, ngày sinh. `UserId` là một khoá vô nghĩa; danh tính
 *     nằm ở tầng khác của hệ thống, không nằm trong mô hình khuyến nghị.
 *
 * TRỐNG ≠ BẰNG KHÔNG — và ở dữ liệu người dùng thì luật này nặng hơn ở Phase 1.
 * `grocery: 0` là "đã hỏi, người này không đi siêu thị"; `grocery` vắng mặt là
 * "chưa từng hỏi". Hai thứ đó dẫn tới hai khuyến nghị khác hẳn nhau, và cách
 * duy nhất giữ chúng tách rời là `null`/vắng mặt nghĩa là CHƯA BIẾT, còn số 0
 * là một câu trả lời. `user-gaps.ts` biến mọi chỗ chưa biết thành dữ liệu máy
 * đọc được, để Phase 3 hạ độ tin cậy (§29) và chọn câu hỏi tiếp theo (§30)
 * thay vì âm thầm coi chúng bằng không.
 */

import type { Branded } from "./types.ts";
import type { AwardCabin, PointsProgramId, ProductId, SpendCategory, TripRegion } from "./types.ts";

export type UserId = Branded<"UserId">;
export type UserCardId = Branded<"UserCardId">;
export type GoalId = Branded<"GoalId">;

/* ------------------------------------------------------------------ *
 * Số tiền: một KHOẢNG, không phải một con số
 * ------------------------------------------------------------------ */

/**
 * Một khoản tiền người dùng khai — luôn là KHOẢNG.
 *
 * Người ta không biết mình chi bao nhiêu cho ăn uống. Họ biết "khoảng bốn tới
 * sáu trăm". Bắt họ chọn một con số thì con số đó vẫn là khoảng, chỉ khác là
 * khoảng đã bị giấu đi — và engine mất mất thứ nó cần nhất ở §29: biết mình
 * đang đứng trên đất chắc hay đất mềm.
 *
 * Đây cũng đúng thứ Phase 1 đã chọn cho `AwardStrategy` (low/typical/high thay
 * vì một giá vé bịa). Cùng một luật, hai đầu của cùng một phép so sánh.
 *
 * `high === null` = khoảng MỞ về phía trên ("150K+"). Không phải vô hạn theo
 * nghĩa toán học, mà là "người dùng không nói trần" — nên mọi phép tính phải
 * dừng ở `low` chứ không được tự đặt ra một trần.
 *
 * KHÔNG có trường `typical` hay `precision` lưu sẵn: cả hai suy được từ
 * `low`/`high`, và trường suy được mà lưu sẵn là trường sẽ lệch. Phase 1 đã
 * học đúng bài này ba lần (`affiliateAvailable`, `PROGRAM_RULES`, `gaps`).
 */
export interface EstimatedAmount {
  low: number;
  high: number | null;
}

/** Người dùng khai một con số dứt khoát. */
export function exactAmount(value: number): EstimatedAmount {
  return { low: value, high: value };
}

/** Người dùng khai một khoảng. `high: null` = khoảng mở ("150K+"). */
export function amountRange(low: number, high: number | null): EstimatedAmount {
  return { low, high };
}

export function isExactAmount(amount: EstimatedAmount): boolean {
  return amount.high !== null && amount.high === amount.low;
}

/**
 * Con số Phase 3 dùng khi buộc phải chọn MỘT số.
 *
 * Khoảng mở trả về `low`, không trả về một con số lớn hơn. Với "150K+" thì
 * 150,000 là điều duy nhất người dùng thật sự nói ra; đoán 200,000 là engine
 * tự bịa ra thu nhập cho họ rồi lấy chính con số bịa đó để kết luận họ đủ điều
 * kiện. Luôn ước lượng về phía an toàn khi không có trần.
 */
export function typicalAmount(amount: EstimatedAmount): number {
  if (amount.high === null) return amount.low;
  return (amount.low + amount.high) / 2;
}

/* ------------------------------------------------------------------ *
 * §4.1 user_profiles
 * ------------------------------------------------------------------ */

/**
 * Quốc gia phục vụ được. V1 là Canada (spec §33), và §34 nói thẳng "không
 * Canada + US cùng lúc".
 *
 * Là một DANH SÁCH chứ không phải chuỗi hai ký tự, vì toàn bộ dữ liệu Phase 1
 * là thẻ Canada. Nhận `"US"` vào một trường `string` thì không có gì đỏ lên —
 * engine chỉ lặng lẽ khuyên thẻ Canada cho một người ở Mỹ. Mở rộng V2 là thêm
 * một dòng ở đây, và kiểu sẽ tự bắt mọi chỗ cần xem lại.
 */
export const SUPPORTED_COUNTRIES = ["CA"] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

/**
 * Tỉnh bang. Có mặt vì nó ĐỔI ĐIỀU KHOẢN chứ không phải để thống kê: Quebec có
 * luật bảo vệ người tiêu dùng riêng, và nhiều offer của ngân hàng Canada loại
 * trừ hoặc viết khác cho Quebec.
 */
export const CANADIAN_PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
] as const;
export type CanadianProvince = (typeof CANADIAN_PROVINCES)[number];

export interface UserProfile {
  id: UserId;
  country: CountryCode;
  province: CanadianProvince | null;
  /**
   * Thu nhập CÁ NHÂN năm, CAD. `null` = chưa hỏi hoặc từ chối nói — spec §4.1
   * liệt kê "Prefer not to say" là một lựa chọn thật.
   *
   * Là khoảng nên phép so với `minimum_personal_income` ra BA kết quả chứ
   * không phải hai: chắc chắn đạt (`low >= ngưỡng`), chắc chắn không đạt
   * (`high < ngưỡng`), và CÓ THỂ. Vế thứ ba là vế quan trọng: §14 nói eligibility
   * và suitability phải tách nhau, và loại thẳng một người có thu nhập
   * "60–80K" khỏi thẻ đòi $80K là loại oan đúng nửa số người trong khoảng đó.
   */
  annualPersonalIncome: EstimatedAmount | null;
  /**
   * Thu nhập HỘ GIA ĐÌNH năm, CAD — một con số RIÊNG, không phải cách diễn
   * đạt khác của thu nhập cá nhân.
   *
   * Ngân hàng Canada công bố điều kiện theo cặp nối bằng HOẶC: "$60,000 cá
   * nhân HOẶC $100,000 hộ gia đình", và Phase 1 đã dựng đúng cấu trúc đó
   * (`income()` trong `data/eligibility-rules.ts`, hai dòng cùng `ruleGroup`).
   * Vế hộ gia đình sinh ra để nhận những người có thu nhập cá nhân DƯỚI ngưỡng
   * — nên một trường thu nhập duy nhất làm vế đó thành vô dụng: hoặc engine so
   * cùng một con số với cả hai ngưỡng (giúp đúng những người vốn đã đạt), hoặc
   * nó loại thẳng đúng những người vế kia sinh ra để cứu.
   *
   * `null` = chưa hỏi. Và thường KHÔNG cần hỏi: chỉ khi thu nhập cá nhân không
   * đủ thì vế này mới đổi kết quả, nên nó là một câu hỏi §30 điển hình — hỏi
   * lúc nó quyết định điều gì đó, không hỏi trước.
   */
  annualHouseholdIncome: EstimatedAmount | null;
  /**
   * Người dùng đã TỪ CHỐI nói thu nhập.
   *
   * Spec §4.1 liệt kê "Prefer not to say" là một lựa chọn thật, và nó KHÁC
   * "chưa hỏi" — cả hai đều để hai trường thu nhập ở `null`, nhưng chỉ một
   * trong hai còn đi hỏi được. Không tách ra thì bảng câu hỏi thích ứng của
   * §30 sẽ mãi mãi chọn thu nhập làm câu hỏi đáng giá nhất và hỏi lại đúng
   * điều người dùng vừa từ chối.
   *
   * Cùng một luật với `declared` ở `UserState`, chỉ ở mức trường thay vì mức
   * bộ sưu tập: câu trả lời "tôi không muốn nói" là một câu trả lời.
   */
  incomeDeclined: boolean;
  /**
   * Phí thường niên tối đa chấp nhận được CHO MỘT THẺ, CAD.
   *
   * Spec §4.1 gọi nó là `annual_fee_tolerance` mà không nói mỗi thẻ hay cả ví.
   * Đổi tên vì hai cách hiểu cho hai kết quả khác hẳn, và ví dụ ở §14 ("max
   * annual fee = $200" làm thẻ $799 thành KHÔNG PHÙ HỢP chứ không phải KHÔNG
   * ĐỦ ĐIỀU KIỆN) chỉ có nghĩa với cách hiểu mỗi thẻ. Tổng cả ví thì cộng từ
   * `user_cards` ra được bất cứ lúc nào; điều ngược lại thì không.
   *
   * `0` = chỉ nhận thẻ miễn phí — một câu trả lời. `null` = chưa hỏi. Nhập
   * nhằng hai thứ này sẽ giấu mất toàn bộ thẻ có phí của một người chưa từng
   * được hỏi, hoặc đề xuất thẻ $799 cho một người đã nói không.
   */
  annualFeeTolerancePerCard: number | null;
  /**
   * Có nhận thẻ doanh nghiệp không.
   *
   * `boolean | null` chứ không phải `boolean` như spec §4.1. Mặc định `false`
   * khi chưa hỏi sẽ im lặng giấu 4 trong 34 sản phẩm (Amex® Business Platinum,
   * Business Gold, Aeroplan® Business Reserve, Marriott Bonvoy® Business), mà
   * chúng thường mang welcome offer lớn nhất. Mặc định `true` thì khuyên một
   * thứ người dùng không mở được. Cả hai hướng đều sai, nên không được mặc
   * định — `null` và một `UserDataGap` để §30 hỏi khi câu trả lời thật sự đổi
   * kết quả.
   */
  businessCardsAllowed: boolean | null;
  /**
   * Đang là sinh viên.
   *
   * `EligibilityRule.student_status_required` là luật `hard` và có thật trong
   * bộ dữ liệu (Scotiabank® Scene+™ Visa cho sinh viên). Không có trường này
   * thì engine chỉ còn hai lựa chọn, cả hai đều sai: loại thẻ đó khỏi mọi
   * người (kể cả sinh viên, đúng đối tượng của nó), hoặc khuyên nó cho một
   * người bốn mươi lăm tuổi.
   *
   * `null` = chưa hỏi, và phần lớn thời gian KHÔNG cần hỏi — chỉ khi thẻ sinh
   * viên còn là ứng viên thì câu trả lời mới đổi kết quả. Đúng hình dạng câu
   * hỏi thích ứng của §30.
   *
   * Lưu ý `business_required` KHÔNG có trường riêng: spec §31 hỏi đúng một câu
   * "business cards allowed: yes/no", và `businessCardsAllowed` là câu trả lời
   * cho cả điều kiện lẫn sở thích. Tách ra là thêm một câu hỏi cho một phân
   * biệt V1 chưa dùng tới.
   */
  isStudent: boolean | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ *
 * §4.2 user_spend_profiles
 * ------------------------------------------------------------------ */

/**
 * Chi tiêu hằng tháng.
 *
 * KHOÁ THEO `SpendCategory` của Phase 1, không theo sáu cột spec §4.2 liệt kê.
 * `types.ts` đã nói rõ danh sách hạng mục "là từ vựng chung giữa dữ liệu sản
 * phẩm và hồ sơ chi tiêu người dùng, và một hạng mục chỉ có mặt ở một bên là
 * một hạng mục vô dụng". Sáu cột riêng thì `food_delivery`, `streaming`,
 * `transit`, `foreign_currency` — những chỗ các thẻ trong bộ này khác nhau
 * NHIỀU NHẤT — không có chỗ nào để khai.
 *
 * Hạng mục VẮNG MẶT = chưa biết, KHÔNG phải bằng không.
 */
export interface UserSpendProfile {
  userId: UserId;
  /**
   * Tổng chi tiêu tháng. `null` = chưa biết.
   *
   * Tổng và các hạng mục KHÔNG suy ra được cho nhau. Người khai tổng $2,000 và
   * siêu thị $800 chưa nói gì về mười sáu hạng mục còn lại — $1,200 kia là
   * CHƯA PHÂN BỔ, không phải bằng không rải đều. `unallocatedMonthly` trả về
   * đúng phần đó.
   */
  monthlyTotal: EstimatedAmount | null;
  byCategory: Partial<Record<SpendCategory, EstimatedAmount>>;
  /**
   * Chi tiêu thật sự có thể DỒN sang một thẻ mới trong 3 tháng (spec §4.2).
   *
   * Spec gọi nó "especially important" và có lý do: nó không phải
   * `monthlyTotal × 3`. Phần lớn chi tiêu của một người đã nằm trên thẻ khác,
   * trên tài khoản tự động trừ, hoặc ở chỗ không quẹt thẻ được. Đây là con số
   * §13 (Minimum Spend Fit) so với `Offer.spendPerNinetyDays`, tức con số
   * quyết định một welcome offer là khả thi hay là một lời hứa suông.
   *
   * `null` = chưa biết. KHÔNG suy từ `monthlyTotal`: tỷ lệ dồn được là chuyện
   * của từng người, và suy ra rồi lấy chính con số suy ra để phán "bạn đạt
   * được mốc chi này" là engine tự nói chuyện với chính nó. Chính sách thay
   * thế khi thiếu là việc của Phase 3, không phải của lớp dữ liệu.
   */
  minimumSpendCapacity3m: EstimatedAmount | null;
  updatedAt: string;
}

/* ------------------------------------------------------------------ *
 * §4.3 user_cards
 * ------------------------------------------------------------------ */

/**
 * `active`          — đang giữ.
 * `closed`          — từng giữ, đã đóng, và biết (hoặc có thể biết) đóng khi nào.
 * `previously_held` — từng giữ, không rõ đóng lúc nào.
 *
 * Hai giá trị cuối CÙNG nghĩa là "từng giữ". Đây là cái bẫy im lặng lớn nhất
 * của Phase 2: luật Amex® "once in a lifetime"
 * (`EligibilityRule.previous_cardholder_excluded`, `scope: "welcome_offer"`)
 * mà viết thành `status === "previously_held"` thì mọi thẻ khai `closed` lọt
 * qua — engine hứa một welcome bonus người dùng không thể nhận, và không có
 * lỗi nào nổ ra ở bất cứ đâu.
 *
 * Vì vậy đừng bao giờ so `status` trực tiếp trong logic. Dùng `holdsNow` và
 * `everHeld` trong `user.ts`.
 */
export type UserCardStatus = "active" | "closed" | "previously_held";

export interface UserCard {
  id: UserCardId;
  userId: UserId;
  productId: ProductId;
  status: UserCardStatus;
  openedDate: string | null;
  /**
   * Ngày đóng. Chỉ có nghĩa khi không còn giữ; `null` ở một thẻ đã đóng =
   * KHÔNG BIẾT đóng khi nào.
   *
   * Cần cho những luật "không có bonus nếu từng giữ thẻ này trong N tháng qua"
   * — khác hẳn luật trọn đời của Amex®. Không biết ngày đóng thì luật đó KHÔNG
   * đánh giá được, và câu trả lời đúng là hạ độ tin cậy (`card_closed_date_unknown`),
   * không phải mặc định là đủ điều kiện.
   */
  closedDate: string | null;
}

/* ------------------------------------------------------------------ *
 * §4.4 user_point_balances
 * ------------------------------------------------------------------ */

/**
 * Số dư điểm. KHÔNG có số tài khoản — spec §4.4 cấm, và ở đây điều đó được
 * cưỡng chế bằng việc không tồn tại trường nào chứa nổi nó.
 */
export interface UserPointBalance {
  userId: UserId;
  programId: PointsProgramId;
  /**
   * `null` = người dùng CÓ tài khoản chương trình này nhưng không biết số dư.
   *
   * Khác hẳn việc không có dòng nào: có tài khoản nghĩa là các chặng chuyển
   * điểm tới chương trình này thật sự dùng được, và nghĩa là engine không nên
   * nói "bạn chưa có gì". Chỉ riêng CON SỐ là chưa biết. Đây cũng là chỗ Test C
   * và Test D chỉ khác nhau ở con số chứ không khác nhau ở cấu trúc.
   */
  balance: number | null;
  /** Ngày người dùng cập nhật con số. Số dư cũ là số dư đáng ngờ (§29 nhắc tới
   *  data freshness), nên nó phải mang ngày chứ không được là một con số trần. */
  updatedAt: string;
}

/* ------------------------------------------------------------------ *
 * §5 goals
 * ------------------------------------------------------------------ */

export const GOAL_TYPES = ["next_card", "earn_points", "diversify", "trip"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

interface GoalBase {
  id: GoalId;
  userId: UserId;
  /** 1 = quan trọng nhất. `null` = chưa xếp. Xem `primaryGoal`. */
  priority: number | null;
  createdAt: string;
}

/** "Thẻ tiếp theo nên là gì" — kể cả khi câu trả lời là KHÔNG MỞ THẺ NÀO. */
export interface NextCardGoal extends GoalBase {
  type: "next_card";
}

/** "Tôi muốn tích thêm điểm." `targetProgramId: null` = bất kỳ điểm nào có giá trị. */
export interface EarnPointsGoal extends GoalBase {
  type: "earn_points";
  targetProgramId: PointsProgramId | null;
}

/** "Danh mục của tôi đang dồn hết vào một chỗ." */
export interface DiversifyGoal extends GoalBase {
  type: "diversify";
}

/**
 * Một chuyến đi cụ thể (spec §5.2).
 *
 * VÙNG, không phải sân bay. `award_strategies` của Phase 1 đánh khoá theo
 * (vùng đi, vùng đến, hạng ghế) đúng vì §6 cấm giả vờ chính xác: Aeroplan tính
 * theo tổng quãng đường thật nên cùng một đôi thành phố ra giá khác nhau tuỳ
 * đường nối. Sân bay ở đây là chi tiết để giải thích cho người đọc, KHÔNG phải
 * thứ engine tra cứu — và vì thế nó không bắt buộc, đúng tiêu chí nghiệm thu
 * "trip goals can be represented by region rather than exact airport".
 */
export interface TripGoal extends GoalBase {
  type: "trip";
  /**
   * `null` = suy từ `profile.country` (xem `resolveTripGoal`).
   *
   * Suy được vì nó đã nằm sẵn trong hồ sơ, nên hỏi lại là kéo dài bảng câu hỏi
   * để lấy một thứ mình đã biết. Đối lập với `passengers` bên dưới, thứ không
   * suy được từ đâu cả.
   */
  originRegion: TripRegion | null;
  originAirport: string | null;
  destinationRegion: TripRegion;
  destinationAirport: string | null;
  /** `null` = chưa hỏi. Hạng ghế đổi số điểm cần gấp ba, nên không mặc định. */
  cabin: AwardCabin | null;
  /**
   * Số người bay. `null` = chưa biết, và CỐ Ý không mặc định là 1.
   *
   * Mặc định 1 sai về đúng hướng nguy hiểm: nó chia ba số điểm cần cho một gia
   * đình bốn người, rồi engine kết luận "bạn đã đủ điểm, không cần mở thẻ" —
   * `NO_NEW_CARD` thắng vì một giả định, không vì một dữ kiện. Chưa biết thì
   * nói là chưa biết và để §30 hỏi.
   */
  passengers: number | null;
  travelStart: string | null;
  travelEnd: string | null;
  flexibility: "low" | "medium" | "high" | null;
}

export type Goal = NextCardGoal | EarnPointsGoal | DiversifyGoal | TripGoal;

/* ------------------------------------------------------------------ *
 * Trạng thái người dùng
 * ------------------------------------------------------------------ */

/**
 * Người dùng đã TRẢ LỜI câu hỏi này chưa — tách hẳn khỏi việc mảng có rỗng hay
 * không.
 *
 * Đây là "trống ≠ bằng không" ở mức BỘ SƯU TẬP, và không có nó thì Test A
 * (người mới, thật sự không có thẻ và không có điểm) trông y hệt một người bấm
 * bỏ qua. Nhưng hai người đó cần hai câu trả lời khác nhau: với người mới,
 * "chưa có thẻ nào" là tín hiệu MẠNH dẫn thẳng tới một thẻ khởi đầu đơn giản;
 * với người bấm bỏ qua, engine không biết gì cả và phải nói ra điều đó.
 *
 * Một mảng rỗng không kể được nó thuộc ca nào.
 */
export interface DeclaredCollections {
  cards: boolean;
  balances: boolean;
}

export interface UserState {
  profile: UserProfile;
  /** `null` = người dùng chưa động tới phần chi tiêu. Khác với một hồ sơ chi
   *  tiêu tồn tại mà mọi trường đều `null`, thứ nghĩa là đã mở ra và bỏ trống. */
  spend: UserSpendProfile | null;
  cards: UserCard[];
  balances: UserPointBalance[];
  goals: Goal[];
  declared: DeclaredCollections;
}

/* ------------------------------------------------------------------ *
 * Chỗ chưa biết
 * ------------------------------------------------------------------ */

/**
 * Một chỗ mô hình người dùng KHÔNG BIẾT, khai báo tường minh và máy đọc được.
 *
 * Song song với `DataGap` của Phase 1 và cùng lý do: Phase 3 phải hạ độ tin
 * cậy khi chạm vào chỗ trống (§29) và phải chọn được câu hỏi tiếp theo đáng
 * giá nhất (§30, Test J). Cả hai việc đó không làm được nếu chỗ trống chỉ tồn
 * tại dưới dạng `null` rải rác trong mười bảy trường.
 *
 * KHÔNG mang trường "cái này ảnh hưởng tới phần nào của engine". Câu hỏi nào
 * đáng giá nhất phụ thuộc vào tập ứng viên đang xét — hai thẻ đang hoà nhau ở
 * đâu — nên nó là việc của Phase 3 và đổi theo từng lượt chạy. Ghi sẵn ở đây
 * là chép một bảng tĩnh sẽ lệch.
 */
export interface UserDataGap {
  kind:
    | "goal_missing"
    | "spend_profile_missing"
    | "monthly_total_unknown"
    | "spend_category_unknown"
    | "minimum_spend_capacity_unknown"
    | "annual_fee_tolerance_unknown"
    | "business_cards_preference_unknown"
    | "personal_income_unknown"
    | "household_income_unknown"
    | "income_declined"
    | "student_status_unknown"
    | "province_unknown"
    | "goal_priority_ambiguous"
    | "cards_undeclared"
    | "balances_undeclared"
    | "point_balance_amount_unknown"
    | "card_closed_date_unknown"
    | "trip_cabin_unknown"
    | "trip_passengers_unknown"
    | "trip_dates_unknown"
    | "trip_flexibility_unknown";
  /** Id hoặc khoá của thứ còn thiếu — người dùng, hạng mục, chương trình, thẻ. */
  subject: string;
  /** Dành cho NGƯỜI đọc. Engine dùng `kind`. */
  reason: string;
}
