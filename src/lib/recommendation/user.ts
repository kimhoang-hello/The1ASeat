/**
 * Đọc trạng thái người dùng cho đúng.
 *
 * Mọi hàm ở đây là hàm THUẦN suy ra từ `UserState`. Không có phân tích danh
 * mục, không có chấm điểm, không có luật eligibility — những thứ đó là Phase 3
 * (§7 Portfolio Analyzer, §14, §16), và trộn chúng vào lớp dữ liệu là cách
 * chắc chắn nhất để mô hình người dùng bắt đầu mã hoá kết quả.
 *
 * Việc của file này chỉ là: những phép đọc mà viết tay ở chỗ gọi thì SAI ÂM
 * THẦM. `everHeld` là ví dụ điển hình — xem chú thích của nó.
 */

import type { PointsProgramId, ProductId, SpendCategory, TripRegion } from "./types.ts";
import type {
  EstimatedAmount,
  Goal,
  TripGoal,
  UserCard,
  UserPointBalance,
  UserProfile,
  UserSpendProfile,
  UserState,
} from "./user-types.ts";

/**
 * Đọc một bộ sưu tập cho an toàn: phải là mảng, và chỉ giữ những DÒNG là object.
 *
 * `?? []` chỉ đỡ được `null`/`undefined`. Dữ liệu tới từ database hay JSON còn
 * hỏng theo hai cách nữa: cả bộ sưu tập không phải mảng (`cards` là một chuỗi
 * thì spread ra thành từng ký tự, và mọi phép đọc phía sau vẫn "chạy", chỉ là
 * trên rác), hoặc một DÒNG bên trong là `null` — thứ làm `a.priority` ném ở một
 * phép sắp xếp trông vô hại.
 *
 * `validateUserState` là chỗ BÁO những thứ đó thành lỗi. Các hàm đọc ở đây thì
 * đơn giản coi rác là KHÔNG CÓ DỮ LIỆU, chứ không đoán và không ném.
 */
export function asArray<T>(value: T[] | undefined): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is T => isObject(row));
}

/**
 * Object thật: không phải `null`, không phải mảng, không phải giá trị nguyên
 * thuỷ.
 *
 * MỘT định nghĩa dùng cho cả `asArray` lẫn `validateUserState`. Trước đó là
 * hai phép kiểm viết riêng, và chúng đã lệch ngay lần đầu: `typeof [] ===
 * "object"` nên bản trong `asArray` GIỮ LẠI một dòng `[]`, trong khi validator
 * loại nó. Hậu quả không phải một exception mà là hai lớp nói khác nhau về
 * cùng một dữ liệu — `primaryGoal` trả về `resolved` với một mảng rỗng làm mục
 * tiêu, còn `userGaps` sinh chỗ trống mang `subject: undefined`.
 *
 * Hai phép kiểm cùng một khái niệm thì phải là MỘT hàm, không phải hai dòng
 * giống nhau.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* ------------------------------------------------------------------ *
 * Thẻ đang giữ và thẻ từng giữ
 * ------------------------------------------------------------------ */

/** Đang giữ thẻ này. Dùng cho danh mục, tích điểm, và trùng quyền lợi. */
export function holdsNow(card: UserCard): boolean {
  return card?.status === "active";
}

/**
 * ĐÃ TỪNG giữ thẻ này — kể cả đang giữ.
 *
 * Tồn tại vì `status === "previously_held"` là phép so ai cũng viết và nó BỎ
 * SÓT `closed`. Hai giá trị đó cùng nghĩa "từng giữ", và luật quyết định phụ
 * thuộc vào chúng — Amex® "once in a lifetime" — chỉ chặn WELCOME BONUS chứ
 * không chặn đơn (`EligibilityRule.scope === "welcome_offer"`). Nên hậu quả
 * của việc bỏ sót không phải một lỗi: là một khuyến nghị trông hoàn toàn hợp
 * lý, hứa một khoản bonus mà ngân hàng sẽ từ chối.
 *
 * Bao gồm cả thẻ đang giữ vì "once in a lifetime" tính cả lần này.
 */
export function everHeld(card: UserCard): boolean {
  const status = card?.status;
  return status === "active" || status === "closed" || status === "previously_held";
}

export function heldProductIds(state: UserState): Set<ProductId> {
  return new Set(asArray(state.cards).filter(holdsNow).map((card) => card.productId));
}

export function everHeldProductIds(state: UserState): Set<ProductId> {
  return new Set(asArray(state.cards).filter(everHeld).map((card) => card.productId));
}

/**
 * Lần gần nhất người dùng THÔI giữ sản phẩm này.
 *
 * `never_closed` — chưa từng đóng thẻ này. Gồm cả chưa từng giữ (tra bằng
 *                  `everHeldProductIds`) lẫn đang giữ liên tục từ đầu.
 * `closed`       — biết ngày đóng gần nhất.
 * `unknown`      — từng đóng, không biết khi nào.
 *
 * BA trạng thái chứ không phải `string | null`, và đây là chỗ một `null` gộp
 * hai nghĩa sẽ trả giá: người dùng có hai lần giữ thẻ này, một lần biết ngày
 * đóng và một lần không, thì trả về ngày đã biết là trình bày một ngày CŨ như
 * thể nó là lần đóng gần nhất. Luật "không có bonus nếu từng giữ trong N tháng
 * qua" đọc vào đó sẽ kết luận đã hết hạn chờ — và hứa một khoản bonus ngân
 * hàng sẽ từ chối. Chỉ cần MỘT quãng không rõ ngày là cả câu trả lời không
 * chắc chắn nữa.
 */
export type ClosureLookup =
  | { kind: "never_closed" }
  | { kind: "closed"; date: string }
  | { kind: "unknown" };

export function lastClosed(state: UserState, productId: ProductId): ClosureLookup {
  const past = asArray(state.cards).filter((card) => card.productId === productId && !holdsNow(card));
  if (past.length === 0) return { kind: "never_closed" };
  if (past.some((card) => card.closedDate == null)) return { kind: "unknown" };
  const latest = past
    .map((card) => card.closedDate as string)
    .reduce((newest, day) => (day > newest ? day : newest));
  return { kind: "closed", date: latest };
}

/**
 * Câu hỏi "đóng thẻ khi nào": các lựa chọn và cách dịch câu trả lời thành
 * NGÀY. Một chỗ duy nhất cho cả trang (`recommender/questions.ts`) lẫn phép
 * thử của §30 (`sensitivity.ts`) — thử bằng một phép dịch khác trang là đo một
 * câu hỏi không ai được hỏi.
 *
 * Hỏi THÁNG, không hỏi NĂM. Bản hỏi năm ghi mọi năm cũ thành 30/06, và luật
 * "trong 24 tháng qua" đọc ngày đó như ngày thật: người đóng Scotiabank® tháng
 * 12/2024, trả lời "2024", được kết luận ngoài cửa sổ và được hứa bonus ngân
 * hàng sẽ từ chối (vòng Codex 1, 21/09/2026). Một năm luôn có thể nằm vắt qua
 * ngày cắt; một tháng thì chỉ trong đúng tháng cắt.
 *
 * Ngày ghi là ngày MUỘN NHẤT câu trả lời cho phép — cuối tháng, không quá hôm
 * nay. Nghiêng về phía "không hứa": luật đếm ngày đóng thấy thẻ còn trong cửa
 * sổ lâu nhất có thể, và phép suy "đóng trước ngày cắt ⇒ mở trước ngày cắt"
 * chỉ chạy khi cả tháng đã nằm trước ngày cắt. Sai số còn lại chỉ có một
 * chiều (chặn nhầm người đóng đầu tháng cắt) và không quá một tháng.
 */
export const CLOSED_MONTHS_BACK = 36;
export const CLOSED_EARLIER = "earlier";

function shiftMonth(year: number, month: number, by: number): [number, number] {
  const index = year * 12 + (month - 1) + by;
  return [Math.floor(index / 12), (index % 12) + 1];
}

function monthEnd(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** Tháng này và `CLOSED_MONTHS_BACK` tháng trước, mới nhất trước, rồi "trước đó". */
export function closedMonthChoices(today: string): { value: string; label: string }[] {
  const [year, month] = today.split("-").map(Number);
  const rows = Array.from({ length: CLOSED_MONTHS_BACK + 1 }, (_, i) => {
    const [y, m] = shiftMonth(year, month, -i);
    return { value: `${y}-${String(m).padStart(2, "0")}`, label: `Tháng ${m}/${y}` };
  });
  const [ey, em] = shiftMonth(year, month, -CLOSED_MONTHS_BACK);
  rows.push({ value: CLOSED_EARLIER, label: `Trước tháng ${em}/${ey}` });
  return rows;
}

/**
 * Câu trả lời → `closedDate`, hoặc `null` khi câu trả lời không thuộc danh
 * sách. "Trước đó" ghi ngày cuối của tháng liền trước tháng sớm nhất được
 * liệt kê — ngoài mọi cửa sổ hiện có (dài nhất 24 tháng); luật nào dài hơn
 * `CLOSED_MONTHS_BACK` thì phải nới danh sách này trước.
 */
export function closedDateFromAnswer(answer: string, today: string): string | null {
  const [year, month] = today.split("-").map(Number);
  if (answer === CLOSED_EARLIER) {
    const [y, m] = shiftMonth(year, month, -CLOSED_MONTHS_BACK - 1);
    return monthEnd(y, m);
  }
  if (!closedMonthChoices(today).some((row) => row.value === answer)) return null;
  const [y, m] = answer.split("-").map(Number);
  const end = monthEnd(y, m);
  return end > today ? today : end;
}

/* ------------------------------------------------------------------ *
 * Chi tiêu
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Giá trị DÙNG ĐƯỢC
 *
 * Ba hàm dưới đây trả lời đúng một câu: giá trị này có dùng được không, hay
 * phải coi là CHƯA BIẾT. Chúng ở đây — trong lớp đọc dữ liệu người dùng — chứ
 * không nằm rải trong engine, vì mọi tầng phải trả lời GIỐNG NHAU.
 *
 * Bài học đã trả giá hai lần: `isObject` từng là hai phép kiểm viết riêng và
 * chúng lệch nhau. Rồi ở Phase 3, engine tự lọc số dư âm và số người không
 * hợp lệ thành "chưa biết" trong khi `userGaps` và `goalSpecificity` vẫn đọc
 * giá trị THÔ — nên engine coi là chưa biết, còn phần siêu dữ liệu lại báo là
 * đã biết đủ: không sinh chỗ trống, không hạ độ tin cậy, không hỏi lại.
 * ------------------------------------------------------------------ */

/** Số dư dùng được, hoặc `null`. Số âm và số không hữu hạn là dữ liệu hỏng. */
export function usableBalance(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Số người dùng được: SỐ NGUYÊN DƯƠNG. `0` và số âm không phải một chuyến đi. */
export function usablePassengers(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** Khứ hồi dùng được: boolean THẬT. Chuỗi `"false"` là truthy — xem README. */
export function usableRoundTrip(value: boolean | null | undefined): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** `null` = chưa biết. KHÔNG phải bằng không — xem đầu `user-types.ts`. */
export function spendFor(state: UserState, category: SpendCategory): EstimatedAmount | null {
  return state.spend?.byCategory?.[category] ?? null;
}

/** Các hạng mục người dùng ĐÃ trả lời. Phần bù là phần chưa biết. */
export function statedCategories(spend: UserSpendProfile): SpendCategory[] {
  // SẮP, không trả thứ tự khoá. Thứ tự khoá của một object là thứ tự CHÈN —
  // tức thứ tự database hay JSON trả về — và các tầng sau cộng dồn số thực
  // theo đúng thứ tự này. Phép cộng số thực không kết hợp: cùng một hồ sơ với
  // hai thứ tự khoá cho `earn_fit` lệch ở chữ số thứ 16. Nhỏ, nhưng §35 hứa
  // "cùng đầu vào = cùng đầu ra", và chính debugger Phase 4 bắt được nó khi
  // chạy lại một lượt chạy đã lưu (JSON chuẩn hoá sắp khoá).
  return (Object.keys(spend.byCategory ?? {}) as SpendCategory[]).sort();
}

/**
 * Phần chi tiêu tháng CHƯA PHÂN BỔ vào hạng mục nào.
 *
 * Người khai tổng $2,000 và siêu thị $800 chưa nói gì về mười sáu hạng mục còn
 * lại. Coi chúng bằng không là engine kết luận người này không đi du lịch, và
 * kết luận đó đến từ một câu chưa ai hỏi. Con số trả về ở đây là phần còn lại
 * đó — nó thuộc về đâu thì vẫn chưa biết.
 *
 * Phép trừ trên KHOẢNG: `[a,b] − [c,d] = [a−d, b−c]`. Cận dưới không âm, và
 * tổng mở (`high: null`) ở bất kỳ vế nào lan sang kết quả.
 */
export function unallocatedMonthly(spend: UserSpendProfile): EstimatedAmount | null {
  const total = spend.monthlyTotal;
  if (total == null) return null;
  // Cùng thứ tự với `statedCategories` — xem lý do ở đó.
  const stated = statedCategories(spend)
    .map((category) => spend.byCategory?.[category])
    .filter((amount): amount is EstimatedAmount => amount != null);
  let sumLow = 0;
  let sumHigh: number | null = 0;
  for (const amount of stated) {
    sumLow += amount.low;
    if (sumHigh !== null) sumHigh = amount.high == null ? null : sumHigh + amount.high;
  }
  const low = sumHigh === null ? 0 : Math.max(0, total.low - sumHigh);
  const high = total.high == null ? null : Math.max(0, total.high - sumLow);
  return { low, high };
}

/* ------------------------------------------------------------------ *
 * Số dư điểm
 * ------------------------------------------------------------------ */

/**
 * Dòng số dư của một chương trình, nếu người dùng có khai.
 *
 * Trả về CẢ DÒNG chứ không trả về con số: dòng tồn tại với `balance: null`
 * nghĩa là "có tài khoản, không biết bao nhiêu", còn không có dòng nào nghĩa
 * là "không có tài khoản". Trả về `number | null` sẽ gộp hai thứ đó làm một,
 * và Portfolio Analyzer mất khả năng nói "chặng chuyển này bạn dùng được".
 */
export function balanceRowFor(
  state: UserState,
  programId: PointsProgramId,
): UserPointBalance | null {
  return asArray(state.balances).find((row) => row.programId === programId) ?? null;
}

/* ------------------------------------------------------------------ *
 * Mục tiêu
 * ------------------------------------------------------------------ */

/**
 * Mục tiêu sắp theo thứ tự ưu tiên: số nhỏ trước, chưa xếp thì xuống cuối.
 *
 * Hoà thì phá bằng `id` chứ không giữ nguyên thứ tự mảng — thứ tự mảng đến từ
 * thứ tự database trả về, và một lượt chạy phải cho cùng một kết quả với cùng
 * đầu vào (§35 Phase 3: "same input + same version = same output"). Một phép
 * sắp xếp không tất định ở đây là chỗ rò rỉ tính tất định sớm nhất có thể.
 */
export function sortedGoals(state: UserState): Goal[] {
  return [...asArray(state.goals)].sort((a, b) => {
    const pa = a.priority ?? Number.POSITIVE_INFINITY;
    const pb = b.priority ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Mục tiêu dẫn dắt lượt chạy — hoặc lời thú nhận rằng chưa xác định được.
 *
 * KHÔNG trả về `sortedGoals(state)[0]`. Phép sắp xếp đó tất định, nhưng tất
 * định không phải là đúng: khi nhiều mục tiêu cùng `priority: null` thì thứ
 * quyết định người thắng là `GoalId` — một chuỗi sinh ra lúc lưu, không phải
 * điều gì người dùng nói. Và §10 dùng HÀM CHẤM ĐIỂM KHÁC NHAU cho từng loại
 * mục tiêu, nên id đó đổi luôn cả khuyến nghị.
 *
 * `ambiguous` để Phase 3 xử lý đúng cách: hỏi người dùng xếp thứ tự (§30),
 * hoặc chạy cả hai rồi trình bày song song. Cả hai đều tốt hơn việc bí mật
 * chọn một cái.
 */
export type PrimaryGoal =
  | { kind: "none" }
  | { kind: "resolved"; goal: Goal }
  | { kind: "ambiguous"; candidates: Goal[] };

export function primaryGoal(state: UserState): PrimaryGoal {
  const ordered = sortedGoals(state);
  if (ordered.length === 0) return { kind: "none" };
  const top = ordered[0];
  const tied = ordered.filter(
    (goal) => (goal.priority ?? null) === (top.priority ?? null),
  );
  if (tied.length > 1) return { kind: "ambiguous", candidates: tied };
  return { kind: "resolved", goal: top };
}

/* ------------------------------------------------------------------ *
 * Chuyến đi
 * ------------------------------------------------------------------ */

/** Nước ở → vùng khởi hành. V1 chỉ có Canada, và mọi award strategy trong bộ
 *  dữ liệu đều đi từ `CANADA_US`. */
const ORIGIN_REGION_BY_COUNTRY: Record<"CA", TripRegion> = {
  CA: "CANADA_US",
};

/**
 * Chuyến đi với vùng khởi hành đã điền — thứ `award_strategies` tra được.
 *
 * `passengers` và `cabin` CỐ Ý vẫn có thể `null`. Chúng không suy được từ đâu,
 * và điền bừa một giá trị ở đây là giấu chỗ trống khỏi `user-gaps.ts` — engine
 * sẽ tự tin đúng ở chỗ nó không có quyền tự tin.
 */
export interface ResolvedTripGoal extends Omit<TripGoal, "originRegion"> {
  originRegion: TripRegion;
  /** Vùng khởi hành đến từ hồ sơ chứ không do người dùng nói ra. */
  originRegionInferred: boolean;
}

/**
 * Điền vùng khởi hành từ `profile.country` khi mục tiêu không nói.
 *
 * Suy được thì đừng hỏi lại (§30: "do not force users through a 25-question
 * form") — nước ở đã nằm trong hồ sơ rồi. Khác hẳn `passengers`: nó không suy
 * được từ dữ kiện nào cả, nên nó vẫn phải đi hỏi. Ranh giới là "đã biết ở chỗ
 * khác" chứ không phải "đoán được".
 */
export function resolveTripGoal(
  profile: UserProfile | null | undefined,
  goal: TripGoal,
): ResolvedTripGoal {
  const inferred = goal.originRegion == null;
  // Hồ sơ thiếu hẳn, hoặc nước ở không nằm trong bảng, thì KHÔNG được ném:
  // dữ liệu tới từ database, và cả module này đã chọn đường "rác là chưa
  // biết" thay vì đường ngoại lệ (xem `asArray`, `isObject`). V1 chỉ có
  // Canada, nên `CANADA_US` vừa là suy luận đúng vừa là mặc định an toàn —
  // và `originRegionInferred` nói ra rằng nó được suy chứ không được khai.
  const fromCountry =
    profile?.country != null ? ORIGIN_REGION_BY_COUNTRY[profile.country] : undefined;
  return {
    ...goal,
    // Làm sạch NGAY tại đây, không để mỗi tầng tự lọc: `GoalContext.trip`,
    // `confidence.goalSpecificity` và `trip-need.ts` đều đọc object này, và
    // ba nơi tự quyết định "hợp lệ" là ba nơi lệch được.
    passengers: usablePassengers(goal.passengers),
    roundTrip: usableRoundTrip(goal.roundTrip),
    originRegion: goal.originRegion ?? fromCountry ?? "CANADA_US",
    originRegionInferred: inferred,
  };
}

/* ------------------------------------------------------------------ *
 * So một khoảng với một ngưỡng
 * ------------------------------------------------------------------ */

/**
 * Một khoảng so với một ngưỡng cho BA kết quả, không phải hai.
 *
 * `straddles` là vế quan trọng: thu nhập khai "60–80K" so với thẻ đòi $80,000
 * không phải "không đạt". Trả về `false` ở đó là loại oan đúng những người mà
 * khoảng đó bao trùm, mà §14 lại nói eligibility và suitability phải tách
 * nhau và §4.1 lại khuyến khích hỏi bằng khoảng. Hai điều đó chỉ đứng chung
 * được nếu phép so biết nói "có thể".
 *
 * Đây là phép so THUẦN. Xử lý `straddles` thế nào — loại, phạt điểm, hay hỏi
 * thêm — là chính sách của Phase 3.
 */
export function compareToThreshold(
  amount: EstimatedAmount,
  threshold: number,
): "at_or_above" | "below" | "straddles" {
  if (amount.low >= threshold) return "at_or_above";
  if (amount.high != null && amount.high < threshold) return "below";
  return "straddles";
}
