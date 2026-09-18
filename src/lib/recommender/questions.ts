/**
 * Bảng câu hỏi THÍCH ỨNG: một chỗ trống của engine → một câu hỏi tiếng Việt,
 * và câu trả lời → một `UserState` mới.
 *
 * KHÔNG có danh sách câu hỏi cố định, và đó là cả điểm của Phase 5: engine đã
 * đo câu nào đổi được kết quả (§30) và trả về đúng MỘT chỗ trống ở
 * `run.followUp`. File này chỉ biết cách hỏi một chỗ trống, không biết thứ tự —
 * thứ tự là việc của engine, và hai bảng thứ tự sẽ lệch nhau.
 *
 * HAI LUẬT, và cả hai đều có test đỏ canh:
 *
 *  1. **Mọi câu trả lời phải cho ra hồ sơ HỢP LỆ.** `validateUserState` là cùng
 *     một cửa mà engine và phép đo §30 đi qua; một lựa chọn sinh ra hồ sơ hỏng
 *     là một lựa chọn người dùng bấm vào rồi thấy trang lỗi.
 *  2. **Trả lời xong thì chỗ trống đó phải BIẾN MẤT.** Nếu không, engine hỏi
 *     lại đúng câu vừa trả lời và bảng câu hỏi thành vòng lặp. Đây là lý do mọi
 *     lựa chọn đều ghi một giá trị THẬT chứ không có nhánh nào "để nguyên".
 *
 * Câu trả lời KHÔNG BAO GIỜ bịa: người dùng không biết thì bấm "Bỏ qua" (tầng
 * trang nhớ, xem `skipped`), chứ không có lựa chọn mặc định nào được ghi thay
 * họ. Mặc định là cách `NO_NEW_CARD` thắng nhờ một giả định (xem `TripGoal`).
 */

import type {
  PointsProgramId,
  ProductId,
  RecommendationDataset,
  SpendCategory,
  TripRegion,
} from "../recommendation/types.ts";
import { SPEND_CATEGORIES } from "../recommendation/types.ts";
import type {
  EstimatedAmount,
  Goal,
  GoalId,
  TripGoal,
  UserCard,
  UserCardId,
  UserDataGap,
  UserId,
  UserState,
} from "../recommendation/user-types.ts";
import { amountRange } from "../recommendation/user-types.ts";

/* ------------------------------------------------------------------ *
 * Kiểu
 * ------------------------------------------------------------------ */

export interface ChoiceOption {
  value: string;
  label: string;
  /** Một dòng phụ khi nhãn thôi chưa đủ rõ. */
  hint?: string;
  /**
   * Lựa chọn KHÔNG ghi được gì vào hồ sơ — `applyAnswer` từ chối nó, và tầng
   * trang xử lý riêng.
   *
   * Hôm nay có đúng một câu như vậy: "mình ở nước khác". Mô hình chỉ có Canada
   * (`SUPPORTED_COUNTRIES`), nên câu trả lời trung thực duy nhất là nói với
   * người dùng rằng công cụ này chưa phục vụ họ — không phải lặng lẽ ghi "CA"
   * rồi khuyên thẻ họ không mở được.
   */
  terminal?: true;
}

export type QuestionInput =
  | { type: "choice"; name: "answer"; options: ChoiceOption[] }
  /** Danh sách thẻ, chọn nhiều: `holding` (đang giữ) và `closed` (đã đóng). */
  | { type: "cards"; groups: { issuer: string; cards: ChoiceOption[] }[] }
  /** Danh sách chương trình điểm, chọn nhiều: `programs`. */
  | { type: "programs"; programs: ChoiceOption[] }
  /** Một con số nguyên — số điểm. */
  | { type: "number"; name: "answer"; min: number; max: number; placeholder: string }
  /** Tháng/năm: `month` (YYYY-MM). */
  | { type: "month"; months: ChoiceOption[] };

export interface QuestionSpec {
  /** `kind:subject` — id ổn định, đi qua form và qua danh sách đã bỏ qua. */
  key: string;
  kind: UserDataGap["kind"];
  subject: string;
  title: string;
  /** Vì sao câu này đáng hỏi, bằng ngôn ngữ người đọc (KHÔNG phải `gap.reason`,
   *  thứ viết cho dev). */
  help: string;
  input: QuestionInput;
}

export interface QuestionContext {
  dataset: RecommendationDataset;
  /** Hôm nay theo giờ site, `YYYY-MM-DD` — cho câu hỏi ngày bay và `updatedAt`. */
  today: string;
}

/** Đủ dùng cho `FormData`, nhưng không kéo DOM vào một module thuần. */
export interface AnswerForm {
  get(name: string): string | null;
  getAll(name: string): string[];
}

export type ApplyResult =
  | { ok: true; state: UserState }
  | { ok: false; error: string };

/**
 * Chủ thể của những câu hỏi về CHÍNH người dùng.
 *
 * `userGaps` đặt `subject = profile.id` cho các câu hồ sơ, mà `profile.id`
 * chính là id phiên nằm trong cookie — thứ mở được toàn bộ hồ sơ. Đưa nó vào
 * `?sua=` là gửi id đó vào lịch sử trình duyệt, access log và Google Analytics
 * (Codex vòng 2, Phase 5 UI). Khoá dùng ngoài giao diện vì vậy mang chữ "toi",
 * và `questionFromKey` dịch ngược lại bằng hồ sơ đang đăng nhập — người khác
 * cầm URL cũng chỉ mở được hồ sơ của chính họ.
 */
export const SELF_SUBJECT = "toi";

export function questionKey(kind: UserDataGap["kind"], subject: string): string {
  return `${kind}:${subject}`;
}

/** Khoá AN TOÀN để đặt lên URL: chủ thể là chính người dùng thì giấu id đi. */
export function publicQuestionKey(
  kind: UserDataGap["kind"],
  subject: string,
  userId: string,
): string {
  return questionKey(kind, subject === userId ? SELF_SUBJECT : subject);
}

/**
 * Loại chỗ trống hợp lệ, kiểm được LÚC CHẠY.
 *
 * `key` đi qua URL (`?sua=…`) và qua form, tức là qua tay người lạ. Một phép ép
 * kiểu `as` không kiểm gì cả: `"linh-tinh:x"` sẽ lọt vào `questionFor`, rơi hết
 * mọi nhánh `switch` và trả về `undefined` — thứ mà chỗ gọi đọc là "có câu
 * hỏi", rồi trang nổ (Codex vòng 1, Phase 5 UI).
 *
 * `Record<…, true>` chứ không phải mảng: thêm một `kind` trong Phase 2 mà quên
 * ở đây là lỗi biên dịch nêu đích danh.
 */
const QUESTION_KINDS: Record<UserDataGap["kind"], true> = {
  goal_missing: true,
  goal_priority_ambiguous: true,
  spend_profile_missing: true,
  monthly_total_unknown: true,
  spend_category_unknown: true,
  minimum_spend_capacity_unknown: true,
  annual_fee_tolerance_unknown: true,
  business_cards_preference_unknown: true,
  business_ownership_unknown: true,
  personal_income_unknown: true,
  household_income_unknown: true,
  personal_income_declined: true,
  household_income_declined: true,
  student_status_unknown: true,
  country_unknown: true,
  cards_undeclared: true,
  balances_undeclared: true,
  point_balance_amount_unknown: true,
  card_closed_date_unknown: true,
  trip_cabin_unknown: true,
  trip_passengers_unknown: true,
  trip_dates_unknown: true,
  trip_flexibility_unknown: true,
  trip_round_trip_unknown: true,
};

export function isQuestionKind(value: string): value is UserDataGap["kind"] {
  return Object.hasOwn(QUESTION_KINDS, value);
}

/** `kind:subject` → câu hỏi, đã kiểm cả hai vế. `null` = khoá lạ hoặc không hỏi được. */
export function questionFromKey(
  key: string,
  state: UserState,
  ctx: QuestionContext,
): QuestionSpec | null {
  const separator = key.indexOf(":");
  if (separator < 1) return null;
  const kind = key.slice(0, separator);
  const raw = key.slice(separator + 1);
  const subject = raw === SELF_SUBJECT ? (state.profile.id as string) : raw;
  if (!isQuestionKind(kind) || subject.length === 0) return null;
  return questionFor({ kind, subject }, state, ctx);
}

/* ------------------------------------------------------------------ *
 * Chữ cho từ vựng của lớp dữ liệu
 * ------------------------------------------------------------------ */

export const CATEGORY_LABEL: Record<SpendCategory, string> = {
  grocery: "siêu thị",
  dining: "nhà hàng, quán ăn",
  food_delivery: "đặt đồ ăn giao tận nơi",
  gas: "xăng",
  ev_charging: "sạc xe điện",
  travel: "du lịch đặt qua đại lý (vé, tour, combo)",
  airline_direct: "vé mua thẳng từ hãng bay",
  hotel: "khách sạn",
  car_rental: "thuê xe",
  drugstore: "nhà thuốc",
  recurring: "hoá đơn định kỳ (điện, nước, internet, điện thoại)",
  streaming: "streaming (Netflix, Spotify…)",
  transit: "phương tiện công cộng",
  rideshare: "Uber, taxi",
  entertainment: "giải trí (vé xem phim, sự kiện)",
  foreign_currency: "chi tiêu bằng ngoại tệ",
  everything_else: "mọi thứ còn lại",
};

export const CABIN_LABEL = {
  economy: "Phổ thông (economy)",
  premium_economy: "Phổ thông đặc biệt (premium economy)",
  business: "Thương gia (business)",
  first: "Hạng nhất (first)",
} as const;

export const REGION_LABEL: Record<TripRegion, string> = {
  CANADA_US: "trong Canada / Mỹ",
  EUROPE: "châu Âu",
  JAPAN: "Nhật Bản",
  // Kê thẳng bốn điểm đến thay vì "Đông Á": vùng này CÓ Trung Quốc, và cái
  // tên cũ giấu mất điều đó — Hong Kong còn là chỗ đẻ ra con số rẻ nhất của cả
  // vùng (Asia Miles® 27,000 economy, vì HKG là hub của chính Cathay).
  EAST_ASIA: "Hàn – Đài – Trung – Hong Kong",
  SEA_VIETNAM: "Việt Nam / Đông Nam Á",
};

/**
 * "Không giới hạn" cho ngưỡng phí.
 *
 * Trường là một CON SỐ (phí tối đa chấp nhận được), nên "bao nhiêu cũng được"
 * phải là một con số cao hơn mọi phí đang có trên thị trường — thẻ đắt nhất
 * trong bộ dữ liệu là $799. Không dùng `null`: `null` nghĩa là CHƯA HỎI, và
 * dùng nó ở đây thì §30 hỏi lại mãi đúng câu vừa trả lời.
 */
export const FEE_TOLERANCE_UNLIMITED = 100_000;

/* ------------------------------------------------------------------ *
 * Các dải tiền
 * ------------------------------------------------------------------ */

interface Band {
  value: string;
  label: string;
  amount: EstimatedAmount;
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

function bands(edges: number[]): Band[] {
  const rows: Band[] = [];
  for (let i = 0; i < edges.length; i += 1) {
    const low = i === 0 ? 0 : edges[i - 1];
    const high = edges[i];
    rows.push({
      value: `${low}-${high}`,
      label: i === 0 ? `Dưới ${money(high)}` : `${money(low)} – ${money(high)}`,
      amount: amountRange(low, high),
    });
  }
  const last = edges[edges.length - 1];
  rows.push({ value: `${last}-`, label: `${money(last)} trở lên`, amount: amountRange(last, null) });
  return rows;
}

const MONTHLY_SPEND = bands([1_000, 2_500, 5_000, 10_000]);
const CAPACITY_3M = bands([1_500, 3_000, 6_000, 12_000]);
const INCOME = bands([60_000, 80_000, 150_000]);
const CATEGORY_SPEND: Band[] = [
  { value: "0", label: "Gần như không chi", amount: amountRange(0, 0) },
  ...bands([200, 500, 1_000]),
];

function bandOptions(rows: Band[]): ChoiceOption[] {
  return rows.map((row) => ({ value: row.value, label: row.label }));
}

function bandByValue(rows: Band[], value: string | null): EstimatedAmount | null {
  return rows.find((row) => row.value === value)?.amount ?? null;
}

/* ------------------------------------------------------------------ *
 * Dựng câu hỏi
 * ------------------------------------------------------------------ */

const YES_NO: ChoiceOption[] = [
  { value: "yes", label: "Có" },
  { value: "no", label: "Không" },
];

function productOptions(ctx: QuestionContext): { issuer: string; cards: ChoiceOption[] }[] {
  const issuerName = new Map(ctx.dataset.issuers.map((issuer) => [issuer.id as string, issuer.name]));
  const groups = new Map<string, ChoiceOption[]>();
  for (const product of ctx.dataset.products) {
    const issuer = issuerName.get(product.issuerId as string) ?? "Khác";
    const list = groups.get(issuer) ?? [];
    list.push({ value: product.slug, label: product.name });
    groups.set(issuer, list);
  }
  return [...groups.entries()]
    .map(([issuer, cards]) => ({
      issuer,
      cards: cards.sort((a, b) => a.label.localeCompare(b.label, "vi")),
    }))
    .sort((a, b) => a.issuer.localeCompare(b.issuer, "vi"));
}

function programOptions(ctx: QuestionContext): ChoiceOption[] {
  return [...ctx.dataset.pointsPrograms]
    .map((program) => ({ value: program.id as string, label: program.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

function programName(ctx: QuestionContext, programId: string): string {
  return ctx.dataset.pointsPrograms.find((row) => row.id === programId)?.name ?? programId;
}

function cardName(state: UserState, ctx: QuestionContext, cardId: string): string {
  const card = state.cards.find((row) => row.id === cardId);
  const product = ctx.dataset.products.find((row) => row.id === card?.productId);
  return product?.name ?? "thẻ này";
}

/** 18 tháng tới — đủ xa cho một chuyến bay bằng điểm, đủ gần để còn nghĩa. */
function monthOptions(today: string): ChoiceOption[] {
  const [year, month] = today.split("-").map(Number);
  const rows: ChoiceOption[] = [];
  for (let i = 0; i < 18; i += 1) {
    const m = ((month - 1 + i) % 12) + 1;
    const y = year + Math.floor((month - 1 + i) / 12);
    rows.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: `Tháng ${m}/${y}` });
  }
  return rows;
}

/** Năm đóng thẻ — 10 năm gần nhất, mới nhất trước. */
function closedYearOptions(today: string): ChoiceOption[] {
  const year = Number(today.slice(0, 4));
  return Array.from({ length: 10 }, (_, i) => ({
    value: String(year - i),
    label: String(year - i),
  }));
}

/**
 * Câu hỏi cho một chỗ trống — `null` khi chỗ trống đó KHÔNG hỏi được.
 *
 * Hai loại không hỏi được, và cả hai đều đúng: chỗ trống người dùng đã từ chối
 * trả lời (`*_declined`), và chỗ trống của một lượt chạy nhiều mục tiêu mà giao
 * diện này không tạo ra (`goal_priority_ambiguous` — trang chỉ dựng một mục
 * tiêu mỗi lần).
 */
export function questionFor(
  gap: { kind: UserDataGap["kind"]; subject: string },
  state: UserState,
  ctx: QuestionContext,
): QuestionSpec | null {
  const key = questionKey(gap.kind, gap.subject);
  const base = { key, kind: gap.kind, subject: gap.subject };

  switch (gap.kind) {
    case "goal_missing":
      return {
        ...base,
        title: "Bạn đang muốn làm gì?",
        help: "Mình chấm điểm thẻ theo đúng mục tiêu này, nên nó quyết định mọi thứ phía sau.",
        input: { type: "choice", name: "answer", options: GOAL_OPTIONS },
      };

    case "country_unknown":
      return {
        ...base,
        title: "Bạn đang sống ở Canada chứ?",
        help: "Mọi thẻ ở đây là thẻ Canada, và điều kiện cư trú áp cho tất cả — đây là câu gỡ được cả danh sách.",
        input: {
          type: "choice",
          name: "answer",
          options: [
            { value: "ca", label: "Đúng, mình ở Canada" },
            { value: "other", label: "Không, mình ở nước khác", terminal: true },
          ],
        },
      };

    case "cards_undeclared":
      return {
        ...base,
        title: "Bạn đang có thẻ nào rồi?",
        help: "Không biết bạn có gì thì mình có thể gợi ý đúng cái thẻ bạn đang cầm trong ví — và welcome bonus thì mỗi người chỉ nhận một lần.",
        input: { type: "cards", groups: productOptions(ctx) },
      };

    case "balances_undeclared":
      return {
        ...base,
        title: "Bạn đang có điểm ở chương trình nào?",
        help: "Chỉ cần chọn tên chương trình. Số điểm cụ thể mình chỉ hỏi khi nó thật sự đổi kết quả.",
        input: { type: "programs", programs: programOptions(ctx) },
      };

    case "point_balance_amount_unknown":
      return {
        ...base,
        title: `Bạn đang có khoảng bao nhiêu điểm ${programName(ctx, gap.subject)}?`,
        help: "Con số này quyết định bạn còn thiếu bao nhiêu cho chuyến bay — gõ áng chừng cũng được.",
        input: {
          type: "number",
          name: "answer",
          min: 0,
          max: 10_000_000,
          placeholder: "ví dụ 60000",
        },
      };

    case "minimum_spend_capacity_unknown":
      return {
        ...base,
        title: "Trong 3 tháng tới, bạn dồn được khoảng bao nhiêu chi tiêu sang một thẻ mới?",
        help: "Đây không phải tổng chi tiêu của bạn — chỉ phần thật sự quẹt được bằng thẻ mới. Nó quyết định welcome bonus có khả thi hay chỉ là con số trên giấy.",
        input: { type: "choice", name: "answer", options: bandOptions(CAPACITY_3M) },
      };

    case "spend_profile_missing":
    case "monthly_total_unknown":
      return {
        ...base,
        title: "Mỗi tháng bạn chi khoảng bao nhiêu qua thẻ?",
        help: "Để mình ước lượng bạn tích được bao nhiêu điểm mỗi năm.",
        input: { type: "choice", name: "answer", options: bandOptions(MONTHLY_SPEND) },
      };

    case "spend_category_unknown":
      return {
        ...base,
        title: `Mỗi tháng bạn chi khoảng bao nhiêu cho ${CATEGORY_LABEL[gap.subject as SpendCategory]}?`,
        help: "Các thẻ khác nhau nhiều nhất ở đúng những hạng mục này.",
        input: { type: "choice", name: "answer", options: bandOptions(CATEGORY_SPEND) },
      };

    case "personal_income_unknown":
      return {
        ...base,
        title: "Thu nhập cá nhân một năm của bạn khoảng bao nhiêu?",
        help: "Vài thẻ có ngưỡng thu nhập tối thiểu (thấp nhất $15,000, cao nhất $150,000). Mình chỉ cần khoảng, không cần con số chính xác.",
        input: {
          type: "choice",
          name: "answer",
          options: [...bandOptions(INCOME), { value: "decline", label: "Không muốn trả lời" }],
        },
      };

    case "household_income_unknown": {
      // Điều kiện thu nhập của ngân hàng Canada nối bằng HOẶC, và vế hộ gia
      // đình không thể thấp hơn thu nhập cá nhân đã khai — validator từ chối,
      // nên bỏ hẳn những lựa chọn đó khỏi danh sách thay vì để người dùng bấm
      // vào rồi nhận lỗi.
      const personalLow = state.profile.annualPersonalIncome?.low ?? 0;
      const options = INCOME.filter((row) => row.amount.high === null || row.amount.high >= personalLow);
      return {
        ...base,
        title: "Thu nhập của cả hộ gia đình một năm khoảng bao nhiêu?",
        help: "Điều kiện của ngân hàng Canada thường là \"thu nhập cá nhân $X HOẶC hộ gia đình $Y\" — vài thẻ cao cấp đòi $200,000 của cả hộ. Trả lời câu này có thể mở ra những thẻ đang bị loại.",
        input: {
          type: "choice",
          name: "answer",
          options: [...bandOptions(options), { value: "decline", label: "Không muốn trả lời" }],
        },
      };
    }

    case "annual_fee_tolerance_unknown":
      return {
        ...base,
        title: "Annual fee tới bao nhiêu thì bạn còn chấp nhận cho một thẻ?",
        help: "Phí cao thường đi kèm quyền lợi lớn hơn, nhưng chỉ đáng khi bạn dùng tới. Trả lời để mình khỏi gợi ý thứ bạn không muốn.",
        input: {
          type: "choice",
          name: "answer",
          options: [
            { value: "0", label: "Chỉ thẻ miễn phí" },
            { value: "150", label: "Tới $150" },
            { value: "400", label: "Tới $400" },
            { value: "800", label: "Tới $800" },
            { value: "unlimited", label: "Bao nhiêu cũng được nếu đáng" },
          ],
        },
      };

    case "business_cards_preference_unknown":
      return {
        ...base,
        title: "Bạn có muốn mình xét cả thẻ doanh nghiệp không?",
        help: "Thẻ doanh nghiệp thường có welcome bonus lớn nhất, nhưng phải có doanh nghiệp hoặc thu nhập tự doanh mới mở được.",
        input: { type: "choice", name: "answer", options: YES_NO },
      };

    case "business_ownership_unknown":
      return {
        ...base,
        title: "Bạn có doanh nghiệp hoặc thu nhập tự doanh không?",
        help: "Đây là điều kiện bắt buộc của thẻ doanh nghiệp — khác với việc bạn có muốn xét loại thẻ đó hay không.",
        input: { type: "choice", name: "answer", options: YES_NO },
      };

    case "student_status_unknown":
      return {
        ...base,
        title: "Bạn có đang là sinh viên không?",
        help: "Có vài thẻ chỉ dành cho sinh viên, điều kiện duyệt dễ hơn hẳn.",
        input: { type: "choice", name: "answer", options: YES_NO },
      };

    case "trip_cabin_unknown":
      return {
        ...base,
        title: "Bạn muốn bay hạng nào?",
        help: "Cùng một chặng, hạng thương gia tốn gấp đôi tới gấp ba hạng phổ thông.",
        input: {
          type: "choice",
          name: "answer",
          options: (["economy", "premium_economy", "business", "first"] as const).map((cabin) => ({
            value: cabin,
            label: CABIN_LABEL[cabin],
          })),
        },
      };

    case "trip_passengers_unknown":
      return {
        ...base,
        title: "Chuyến này bay mấy người?",
        help: "Số điểm cần nhân THẲNG với số người, nên đây là con số đổi kết quả nhiều nhất. Gõ đúng số người, kể cả khi đông.",
        // Số chính xác, không phải dải: "6 trở lên" ghi thành 6 sẽ tính thiếu
        // điểm cho một đoàn bảy người — và tính thiếu ở đây làm engine kết
        // luận "bạn đủ điểm rồi" (Codex vòng 1, Phase 5 UI).
        input: {
          type: "number",
          name: "answer",
          min: 1,
          max: 12,
          placeholder: "ví dụ 2",
        },
      };

    case "trip_round_trip_unknown":
      return {
        ...base,
        title: "Bạn cần vé khứ hồi hay một chiều?",
        help: "Khứ hồi tốn đúng gấp đôi số điểm.",
        input: {
          type: "choice",
          name: "answer",
          options: [
            { value: "round", label: "Khứ hồi" },
            { value: "one_way", label: "Một chiều" },
          ],
        },
      };

    case "trip_flexibility_unknown":
      return {
        ...base,
        title: "Ngày bay của bạn linh hoạt tới đâu?",
        help: "Vé thưởng có chỗ trống thất thường; linh hoạt càng cao thì càng dễ đặt được.",
        input: {
          type: "choice",
          name: "answer",
          options: [
            { value: "low", label: "Cố định", hint: "Phải đúng ngày đó" },
            { value: "medium", label: "Xê dịch được vài ngày" },
            { value: "high", label: "Rất linh hoạt", hint: "Tháng nào cũng được" },
          ],
        },
      };

    case "trip_dates_unknown":
      return {
        ...base,
        title: "Bạn định bay khoảng tháng nào?",
        help: "Để mình biết bạn còn bao nhiêu thời gian đạt mức spend của welcome offer.",
        input: { type: "month", months: monthOptions(ctx.today) },
      };

    case "card_closed_date_unknown":
      return {
        ...base,
        title: `Bạn đóng thẻ ${cardName(state, ctx, gap.subject)} vào năm nào?`,
        help: "Vài ngân hàng chỉ chặn welcome bonus trong một số tháng sau khi đóng, nên năm đóng có thể mở lại bonus cho bạn.",
        input: {
          type: "choice",
          name: "answer",
          options: closedYearOptions(ctx.today),
        },
      };

    // Người dùng đã từ chối: §30 cố ý không hỏi lại.
    case "personal_income_declined":
    case "household_income_declined":
    // Giao diện này chỉ dựng MỘT mục tiêu mỗi lượt, nên không bao giờ hoà.
    case "goal_priority_ambiguous":
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Mục tiêu — câu hỏi đầu tiên, và là câu duy nhất bắt buộc
 * ------------------------------------------------------------------ */

/**
 * Lựa chọn mục tiêu, viết theo việc người đọc muốn làm chứ không theo tên loại
 * mục tiêu của engine. Chuyến đi tách theo vùng đến vì `TripGoal` bắt buộc có
 * vùng đến — hỏi "bạn muốn bay đâu" trong cùng một lần bấm thay vì hai bước.
 */
export const GOAL_OPTIONS: ChoiceOption[] = [
  { value: "next_card", label: "Tìm thẻ nên mở tiếp theo", hint: "Kể cả khi câu trả lời là chưa nên mở thẻ nào" },
  { value: "trip:SEA_VIETNAM", label: "Gom điểm bay về Việt Nam" },
  { value: "trip:JAPAN", label: "Gom điểm bay đi Nhật" },
  { value: "trip:EAST_ASIA", label: "Gom điểm bay đi Hàn – Đài – Trung – Hong Kong" },
  { value: "trip:EUROPE", label: "Gom điểm bay đi châu Âu" },
  { value: "trip:CANADA_US", label: "Gom điểm bay trong Canada / Mỹ" },
  { value: "earn_points", label: "Tích thêm điểm từ chi tiêu hằng ngày" },
  { value: "diversify", label: "Điểm đang dồn một chỗ, muốn đa dạng hơn" },
];

const TRIP_REGION_VALUES = new Set<string>([
  "CANADA_US",
  "EUROPE",
  "JAPAN",
  "EAST_ASIA",
  "SEA_VIETNAM",
]);

/**
 * Hồ sơ rỗng của một người vừa mở trang: chưa biết gì trừ mục tiêu và nước ở.
 *
 * `country` là THAM SỐ BẮT BUỘC, không phải mặc định "CA". Hai lý do, và cả
 * hai đều cứng: `validateUserState` từ chối hồ sơ không có nước ở (nên không
 * tồn tại trạng thái "chưa hỏi" hợp lệ), và mô hình chỉ có Canada — đoán hộ
 * người đang ở nước khác là khuyên họ những thẻ họ không mở được. Màn hình đầu
 * hỏi thẳng, và chỉ dựng hồ sơ khi đã có câu trả lời.
 */
export function newUserState(
  userId: string,
  now: string,
  country: UserState["profile"]["country"],
): UserState {
  return {
    profile: {
      id: userId as UserId,
      country,
      province: null,
      annualPersonalIncome: null,
      annualHouseholdIncome: null,
      personalIncomeDeclined: false,
      householdIncomeDeclined: false,
      annualFeeTolerancePerCard: null,
      businessCardsAllowed: null,
      hasBusiness: null,
      isStudent: null,
      createdAt: now,
      updatedAt: now,
    },
    spend: null,
    cards: [],
    balances: [],
    goals: [],
    declared: { cards: false, balances: false },
  };
}

/** Mục tiêu từ một giá trị của `GOAL_OPTIONS`. `null` = giá trị lạ. */
export function goalFrom(value: string, userId: string, now: string): Goal | null {
  const id = "g_1" as GoalId;
  const shared = { id, userId: userId as UserId, priority: 1, createdAt: now };
  if (value === "next_card") return { ...shared, type: "next_card" };
  if (value === "earn_points") return { ...shared, type: "earn_points", targetProgramId: null };
  if (value === "diversify") return { ...shared, type: "diversify" };
  if (value.startsWith("trip:")) {
    const region = value.slice("trip:".length);
    if (!TRIP_REGION_VALUES.has(region)) return null;
    const trip: TripGoal = {
      ...shared,
      type: "trip",
      originRegion: null,
      originAirport: null,
      destinationRegion: region as TripRegion,
      destinationAirport: null,
      cabin: null,
      passengers: null,
      roundTrip: null,
      travelStart: null,
      travelEnd: null,
      flexibility: null,
    };
    return trip;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Áp câu trả lời
 * ------------------------------------------------------------------ */

function clone(state: UserState, now: string): UserState {
  const next = structuredClone(state);
  next.profile.updatedAt = now;
  return next;
}

function ensureSpend(state: UserState, now: string) {
  if (state.spend == null) {
    state.spend = {
      userId: state.profile.id,
      monthlyTotal: null,
      byCategory: {},
      minimumSpendCapacity3m: null,
      updatedAt: now,
    };
  }
  state.spend.updatedAt = now;
  return state.spend;
}

function tripGoalOf(state: UserState, goalId: string): TripGoal | null {
  const goal = state.goals.find((row) => row.id === goalId);
  return goal?.type === "trip" ? goal : null;
}

const BAD = (what: string): ApplyResult => ({ ok: false, error: `Câu trả lời không hợp lệ: ${what}` });

/**
 * Áp một câu trả lời lên hồ sơ. KHÔNG sửa `state` được truyền vào.
 *
 * Không tự kiểm hợp lệ toàn hồ sơ — đó là việc của `validateUserState` ở tầng
 * gọi, với bộ dữ liệu của đúng ngày chạy. Ở đây chỉ từ chối những giá trị
 * không thuộc danh sách lựa chọn: form gửi lên là thứ ai cũng sửa được.
 */
/**
 * Áp câu trả lời RỒI kiểm hồ sơ với bộ dữ liệu của ngày chạy.
 *
 * Phải là một hàm, và phải là hàm mà tầng trang gọi: một câu trả lời hợp lệ
 * đứng riêng vẫn dựng được hồ sơ MÂU THUẪN (đổi thu nhập cá nhân lên trên
 * khoảng hộ gia đình đã khai). Ghi hồ sơ đó xuống database rồi mới phát hiện
 * thì người dùng kẹt: mọi lần mở trang sau đó đều nổ trên chính hàng đã lưu
 * (Codex vòng 1, Phase 5 UI).
 */
export function applyAnswerChecked(
  state: UserState,
  spec: QuestionSpec,
  form: AnswerForm,
  ctx: QuestionContext,
  validate: (state: UserState) => { level: string; message: string }[],
): ApplyResult {
  const applied = applyAnswer(state, spec, form, ctx);
  if (!applied.ok) return applied;
  const errors = validate(applied.state).filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    // KHÔNG kèm câu của validator: nó chứa chính con số thu nhập / chi tiêu,
    // và thông báo lỗi đi qua query string (lịch sử trình duyệt, log, GA).
    return {
      ok: false,
      error: "Câu trả lời này ngược với một câu bạn đã trả lời trước đó — sửa câu đó trước đã.",
    };
  }
  return applied;
}

export function applyAnswer(
  state: UserState,
  spec: QuestionSpec,
  form: AnswerForm,
  ctx: QuestionContext,
): ApplyResult {
  const next = clone(state, ctx.today);
  const answer = form.get("answer");

  switch (spec.kind) {
    case "goal_missing": {
      const goal = answer === null ? null : goalFrom(answer, state.profile.id as string, ctx.today);
      if (goal === null) return BAD("mục tiêu");
      next.goals = [goal];
      return { ok: true, state: next };
    }

    case "country_unknown": {
      if (answer !== "ca") return BAD("nước cư trú");
      next.profile.country = "CA";
      return { ok: true, state: next };
    }

    case "cards_undeclared": {
      // Nút "Mình chưa có thẻ nào" gửi cờ `none`: câu trả lời là KHÔNG CÓ GÌ,
      // kể cả khi vài ô còn đang tick trong cùng form.
      const none = form.get("none") === "1";
      const holding = none ? [] : form.getAll("holding");
      const closed = none ? [] : form.getAll("closed");
      const bySlug = new Map(ctx.dataset.products.map((product) => [product.slug, product]));
      const cards: UserCard[] = [];
      for (const [list, status] of [
        [holding, "active"],
        [closed, "closed"],
      ] as const) {
        for (const slug of list) {
          const product = bySlug.get(slug);
          if (product === undefined) return BAD(`thẻ "${slug}"`);
          // Cùng một thẻ vừa đang giữ vừa đã đóng: giữ vế ĐANG GIỮ. Hai dòng
          // đang-giữ cho một sản phẩm là lỗi validator, và "đang giữ" là câu
          // trả lời mạnh hơn.
          if (cards.some((row) => row.productId === product.id)) continue;
          cards.push({
            id: `uc_${product.slug}` as UserCardId,
            userId: next.profile.id,
            productId: product.id as ProductId,
            status,
            openedDate: null,
            closedDate: null,
          });
        }
      }
      next.cards = cards;
      next.declared.cards = true;
      return { ok: true, state: next };
    }

    case "balances_undeclared": {
      const programs = form.get("none") === "1" ? [] : form.getAll("programs");
      const known = new Set(ctx.dataset.pointsPrograms.map((row) => row.id as string));
      const seen = new Set<string>();
      const balances = [];
      for (const programId of programs) {
        if (!known.has(programId)) return BAD(`chương trình "${programId}"`);
        if (seen.has(programId)) continue;
        seen.add(programId);
        balances.push({
          userId: next.profile.id,
          programId: programId as PointsProgramId,
          // `null` = CÓ tài khoản, chưa nói số dư. Engine hỏi con số sau, và
          // chỉ khi nó đổi được kết quả.
          balance: null,
          updatedAt: ctx.today,
        });
      }
      next.balances = balances;
      next.declared.balances = true;
      return { ok: true, state: next };
    }

    case "point_balance_amount_unknown": {
      const points = Number(answer);
      if (!Number.isInteger(points) || points < 0 || points > 10_000_000) return BAD("số điểm");
      let touched = false;
      for (const row of next.balances) {
        if (row.programId === spec.subject) {
          row.balance = points;
          row.updatedAt = ctx.today;
          touched = true;
        }
      }
      if (!touched) return BAD("chương trình điểm");
      return { ok: true, state: next };
    }

    case "minimum_spend_capacity_unknown": {
      const amount = bandByValue(CAPACITY_3M, answer);
      if (amount === null) return BAD("mức chi tiêu");
      ensureSpend(next, ctx.today).minimumSpendCapacity3m = amount;
      return { ok: true, state: next };
    }

    case "spend_profile_missing":
    case "monthly_total_unknown": {
      const amount = bandByValue(MONTHLY_SPEND, answer);
      if (amount === null) return BAD("mức chi tiêu");
      ensureSpend(next, ctx.today).monthlyTotal = amount;
      return { ok: true, state: next };
    }

    case "spend_category_unknown": {
      const amount = bandByValue(CATEGORY_SPEND, answer);
      const category = spec.subject as SpendCategory;
      if (amount === null || !SPEND_CATEGORIES.includes(category)) return BAD("hạng mục chi tiêu");
      ensureSpend(next, ctx.today).byCategory[category] = amount;
      return { ok: true, state: next };
    }

    case "personal_income_unknown": {
      // Cờ "từ chối" và con số là HAI VẾ của cùng một câu trả lời: validator
      // cấm khai cả hai. Đổi ý phải xoá vế kia, nếu không người dùng kẹt vĩnh
      // viễn ở câu này (Codex vòng 2, Phase 5 UI).
      if (answer === "decline") {
        next.profile.personalIncomeDeclined = true;
        next.profile.annualPersonalIncome = null;
        return { ok: true, state: next };
      }
      const amount = bandByValue(INCOME, answer);
      if (amount === null) return BAD("thu nhập");
      next.profile.annualPersonalIncome = amount;
      next.profile.personalIncomeDeclined = false;
      return { ok: true, state: next };
    }

    case "household_income_unknown": {
      if (answer === "decline") {
        next.profile.householdIncomeDeclined = true;
        next.profile.annualHouseholdIncome = null;
        return { ok: true, state: next };
      }
      const amount = bandByValue(INCOME, answer);
      if (amount === null) return BAD("thu nhập hộ gia đình");
      next.profile.annualHouseholdIncome = amount;
      next.profile.householdIncomeDeclined = false;
      return { ok: true, state: next };
    }

    case "annual_fee_tolerance_unknown": {
      if (answer === "unlimited") {
        next.profile.annualFeeTolerancePerCard = FEE_TOLERANCE_UNLIMITED;
        return { ok: true, state: next };
      }
      const fee = Number(answer);
      if (![0, 150, 400, 800].includes(fee)) return BAD("ngưỡng phí");
      next.profile.annualFeeTolerancePerCard = fee;
      return { ok: true, state: next };
    }

    case "business_cards_preference_unknown":
    case "business_ownership_unknown":
    case "student_status_unknown": {
      if (answer !== "yes" && answer !== "no") return BAD("lựa chọn có/không");
      const value = answer === "yes";
      if (spec.kind === "business_cards_preference_unknown") next.profile.businessCardsAllowed = value;
      else if (spec.kind === "business_ownership_unknown") next.profile.hasBusiness = value;
      else next.profile.isStudent = value;
      return { ok: true, state: next };
    }

    case "trip_cabin_unknown": {
      const goal = tripGoalOf(next, spec.subject);
      if (goal === null) return BAD("chuyến đi");
      if (answer !== "economy" && answer !== "premium_economy" && answer !== "business" && answer !== "first") {
        return BAD("hạng ghế");
      }
      goal.cabin = answer;
      return { ok: true, state: next };
    }

    case "trip_passengers_unknown": {
      const goal = tripGoalOf(next, spec.subject);
      if (goal === null) return BAD("chuyến đi");
      const passengers = Number(answer);
      if (!Number.isInteger(passengers) || passengers < 1 || passengers > 12) return BAD("số người");
      goal.passengers = passengers;
      return { ok: true, state: next };
    }

    case "trip_round_trip_unknown": {
      const goal = tripGoalOf(next, spec.subject);
      if (goal === null) return BAD("chuyến đi");
      if (answer !== "round" && answer !== "one_way") return BAD("loại vé");
      goal.roundTrip = answer === "round";
      return { ok: true, state: next };
    }

    case "trip_flexibility_unknown": {
      const goal = tripGoalOf(next, spec.subject);
      if (goal === null) return BAD("chuyến đi");
      if (answer !== "low" && answer !== "medium" && answer !== "high") return BAD("mức linh hoạt");
      goal.flexibility = answer;
      return { ok: true, state: next };
    }

    case "trip_dates_unknown": {
      const goal = tripGoalOf(next, spec.subject);
      if (goal === null) return BAD("chuyến đi");
      const month = form.get("month");
      if (month === null || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return BAD("tháng bay");
      // Cả THÁNG, không phải một ngày: người ta chọn "tháng 6/2027" thì ngày
      // cụ thể chưa có, và bịa ra ngày 1 làm hạn chót của mốc chi sớm đi 29
      // ngày. Khoảng này nói đúng thứ người dùng vừa nói.
      const [year, mm] = month.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year, mm, 0)).getUTCDate();
      goal.travelStart = `${month}-01`;
      goal.travelEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
      return { ok: true, state: next };
    }

    case "card_closed_date_unknown": {
      const card = next.cards.find((row) => row.id === spec.subject);
      if (card === undefined) return BAD("thẻ");
      const year = Number(answer);
      const thisYear = Number(ctx.today.slice(0, 4));
      if (!Number.isInteger(year) || year < thisYear - 9 || year > thisYear) return BAD("năm đóng thẻ");
      // Giữa năm: người dùng chỉ nhớ năm, và cả hai đầu năm đều là một lời
      // khẳng định mạnh hơn thứ họ vừa nói. Ngày mở thẻ thì để trống — không
      // suy ra được.
      card.closedDate = year === thisYear ? ctx.today : `${year}-06-30`;
      return { ok: true, state: next };
    }

    case "personal_income_declined":
    case "household_income_declined":
    case "goal_priority_ambiguous":
      return BAD("câu hỏi này không trả lời được");
  }
}
