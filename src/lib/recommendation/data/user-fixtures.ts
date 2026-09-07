/**
 * Người dùng mẫu — phép thử nghiệm thu thật sự của Phase 2.
 *
 * Tiêu chí nghiệm thu của Phase 2 không phải "có đủ bảng chưa" mà là: Phase 3
 * có suy luận được về những người dùng KHÁC HẲN NHAU bằng mô hình này không,
 * mà không cần một bảng câu hỏi dài và không cần dựng lại nền. Cách duy nhất
 * trả lời là viết ra những người đó rồi xem mô hình có kể nổi câu chuyện của
 * họ không.
 *
 * Nên các nhân vật dưới đây bám sát bộ test bắt buộc ở spec §32. Chúng CHƯA
 * phải là bài test của §32 — những bài đó cần engine, và engine là Phase 3/4.
 * Ở đây chúng chứng minh phần khác: mỗi tình huống của §32 biểu diễn được, và
 * hai tình huống khác nhau thì trạng thái cũng khác nhau chứ không sập vào
 * cùng một hình dạng.
 *
 * Test F (affiliate không đổi thứ hạng) và Test I (offer đổi) KHÔNG có nhân
 * vật riêng: cả hai giữ nguyên người dùng và đổi phía sản phẩm. Chúng dùng lại
 * bất kỳ nhân vật nào ở đây, và việc chúng không cần thêm gì vào mô hình người
 * dùng chính là điều đáng ghi lại.
 */

import { id, type PointsProgramId } from "../types.ts";
import { productIdFor } from "./products.ts";
import {
  amountRange,
  exactAmount,
  type EstimatedAmount,
  type Goal,
  type GoalId,
  type UserCard,
  type UserCardId,
  type UserId,
  type UserPointBalance,
  type UserProfile,
  type UserSpendProfile,
  type UserState,
} from "../user-types.ts";
import type { SpendCategory } from "../types.ts";

const TODAY = "2026-09-08";

const AEROPLAN = id<PointsProgramId>("aeroplan");
const AMEX_MR = id<PointsProgramId>("amex-mr");

function profileOf(slug: string, overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: id<UserId>(slug),
    country: "CA",
    province: "ON",
    annualPersonalIncome: null,
    annualHouseholdIncome: null,
    annualFeeTolerancePerCard: null,
    businessCardsAllowed: null,
    isStudent: null,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...overrides,
  };
}

function spendOf(
  userSlug: string,
  fields: {
    monthlyTotal?: EstimatedAmount | null;
    byCategory?: Partial<Record<SpendCategory, EstimatedAmount>>;
    minimumSpendCapacity3m?: EstimatedAmount | null;
  },
): UserSpendProfile {
  return {
    userId: id<UserId>(userSlug),
    monthlyTotal: fields.monthlyTotal ?? null,
    byCategory: fields.byCategory ?? {},
    minimumSpendCapacity3m: fields.minimumSpendCapacity3m ?? null,
    updatedAt: TODAY,
  };
}

function cardOf(
  userSlug: string,
  productSlug: string,
  status: UserCard["status"],
  dates: { opened?: string; closed?: string } = {},
): UserCard {
  return {
    id: id<UserCardId>(`uc_${userSlug}_${productSlug}`),
    userId: id<UserId>(userSlug),
    productId: productIdFor(productSlug),
    status,
    openedDate: dates.opened ?? null,
    closedDate: dates.closed ?? null,
  };
}

function balanceOf(
  userSlug: string,
  programId: PointsProgramId,
  balance: number | null,
): UserPointBalance {
  return { userId: id<UserId>(userSlug), programId, balance, updatedAt: TODAY };
}

/** `Omit` trên một union hợp nhất các nhánh lại rồi vứt mất trường riêng của
 *  từng nhánh. Phải phân phối qua từng nhánh thì `TripGoal` mới giữ được
 *  `originRegion`. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type GoalDraft = DistributiveOmit<Goal, "id" | "userId" | "createdAt">;

function goalOf(userSlug: string, goal: GoalDraft): Goal {
  return {
    ...goal,
    id: id<GoalId>(`goal_${userSlug}_${goal.type}`),
    userId: id<UserId>(userSlug),
    createdAt: TODAY,
  } as Goal;
}

/* ------------------------------------------------------------------ *
 * Test A — người mới
 * ------------------------------------------------------------------ */

/**
 * Không thẻ, không điểm, chi $2K/tháng, chịu phí thấp, muốn bắt đầu.
 *
 * Chỗ quan trọng nhất của nhân vật này KHÔNG phải mấy con số mà là
 * `declared: { cards: true, balances: true }`. Mảng rỗng ở đây là một CÂU TRẢ
 * LỜI — "tôi chưa có gì" — và đó là tín hiệu mạnh nhất dẫn tới một thẻ khởi
 * đầu đơn giản. So với `beginnerUndeclared` bên dưới, thứ có mảng rỗng y hệt
 * mà không nói gì cả.
 */
export const beginnerNoCards: UserState = {
  profile: profileOf("u_beginner", {
    annualPersonalIncome: amountRange(60_000, 80_000),
    annualFeeTolerancePerCard: 120,
    businessCardsAllowed: false,
    isStudent: false,
  }),
  spend: spendOf("u_beginner", {
    monthlyTotal: exactAmount(2_000),
    byCategory: {
      grocery: exactAmount(600),
      dining: exactAmount(300),
      gas: exactAmount(200),
      transit: exactAmount(100),
      everything_else: exactAmount(800),
    },
    minimumSpendCapacity3m: exactAmount(3_000),
  }),
  cards: [],
  balances: [],
  goals: [goalOf("u_beginner", { type: "next_card", priority: 1 })],
  declared: { cards: true, balances: true },
};

/**
 * Cùng một mảng rỗng, khác một điều: chưa ai hỏi.
 *
 * Tồn tại để chứng minh mô hình phân biệt được hai ca đó. Nếu `UserState`
 * không có `declared` thì nhân vật này và `beginnerNoCards` là hai object
 * giống hệt nhau — và engine sẽ tự tin khuyên một thẻ khởi đầu cho một người
 * có thể đang giữ năm cái thẻ.
 */
export const beginnerUndeclared: UserState = {
  profile: profileOf("u_undeclared"),
  spend: null,
  cards: [],
  balances: [],
  goals: [goalOf("u_undeclared", { type: "next_card", priority: 1 })],
  declared: { cards: false, balances: false },
};

/* ------------------------------------------------------------------ *
 * Test B — danh mục dồn hết vào Aeroplan®
 * ------------------------------------------------------------------ */

/** 300K Aeroplan®, 50K MR, hai thẻ Aeroplan® đang giữ, hỏi thẻ tiếp theo. */
export const aeroplanHeavy: UserState = {
  profile: profileOf("u_aeroplan_heavy", {
    annualPersonalIncome: amountRange(150_000, null),
    annualFeeTolerancePerCard: 700,
    businessCardsAllowed: true,
  }),
  spend: spendOf("u_aeroplan_heavy", {
    monthlyTotal: exactAmount(6_000),
    byCategory: {
      grocery: exactAmount(1_200),
      dining: exactAmount(900),
      travel: exactAmount(800),
      everything_else: exactAmount(1_500),
    },
    minimumSpendCapacity3m: exactAmount(9_000),
  }),
  cards: [
    cardOf("u_aeroplan_heavy", "td-aeroplan-visa-infinite", "active", { opened: "2024-03-01" }),
    cardOf("u_aeroplan_heavy", "cibc-aeroplan-visa-infinite", "active", { opened: "2025-06-15" }),
  ],
  balances: [
    balanceOf("u_aeroplan_heavy", AEROPLAN, 300_000),
    balanceOf("u_aeroplan_heavy", AMEX_MR, 50_000),
  ],
  goals: [goalOf("u_aeroplan_heavy", { type: "next_card", priority: 1 })],
  declared: { cards: true, balances: true },
};

/* ------------------------------------------------------------------ *
 * Test C / D — chuyến Nhật, đủ điểm và thiếu điểm
 * ------------------------------------------------------------------ */

/**
 * 200K Membership Rewards®, muốn bay Nhật hạng business.
 *
 * Mục tiêu chỉ nói VÙNG, không nói sân bay, và không nói vùng khởi hành —
 * `resolveTripGoal` điền `CANADA_US` từ `profile.country`. Đó là tiêu chí
 * nghiệm thu "trip goals can be represented by region rather than exact
 * airport", và cũng là một câu hỏi ít hơn phải đi hỏi.
 */
export const japanTripFunded: UserState = {
  profile: profileOf("u_japan_funded", {
    annualPersonalIncome: amountRange(80_000, 150_000),
    annualFeeTolerancePerCard: 250,
    businessCardsAllowed: false,
  }),
  spend: null,
  cards: [cardOf("u_japan_funded", "amex-cobalt", "active", { opened: "2023-01-10" })],
  balances: [balanceOf("u_japan_funded", AMEX_MR, 200_000)],
  goals: [
    goalOf("u_japan_funded", {
      type: "trip",
      priority: 1,
      originRegion: null,
      originAirport: null,
      destinationRegion: "JAPAN",
      destinationAirport: null,
      cabin: "business",
      passengers: 1,
      travelStart: "2027-03-01",
      travelEnd: "2027-05-31",
      flexibility: "high",
    }),
  ],
  declared: { cards: true, balances: true },
};

/**
 * Cùng chuyến đi, 20K điểm, hai người bay.
 *
 * Khác `japanTripFunded` ở đúng hai con số. Cấu trúc y hệt — và đó là điều
 * cần chứng minh: khoảng cách giữa "đã đủ điểm" và "thiếu xa" là DỮ LIỆU, chứ
 * không phải hai hình dạng trạng thái khác nhau.
 */
export const japanTripShortfall: UserState = {
  profile: profileOf("u_japan_gap", {
    annualPersonalIncome: amountRange(80_000, 150_000),
    annualFeeTolerancePerCard: 400,
    businessCardsAllowed: true,
  }),
  spend: spendOf("u_japan_gap", {
    monthlyTotal: exactAmount(4_500),
    byCategory: { grocery: exactAmount(900), dining: exactAmount(600) },
    minimumSpendCapacity3m: exactAmount(8_000),
  }),
  cards: [],
  balances: [balanceOf("u_japan_gap", AEROPLAN, 20_000)],
  goals: [
    goalOf("u_japan_gap", {
      type: "trip",
      priority: 1,
      originRegion: "CANADA_US",
      originAirport: "YYZ",
      destinationRegion: "JAPAN",
      destinationAirport: null,
      cabin: "business",
      passengers: 2,
      travelStart: "2027-04-01",
      travelEnd: "2027-04-30",
      flexibility: "medium",
    }),
  ],
  declared: { cards: true, balances: true },
};

/* ------------------------------------------------------------------ *
 * Test E — mốc chi không với tới
 * ------------------------------------------------------------------ */

/**
 * Dồn được $3,000 trong 3 tháng.
 *
 * Điểm cần chú ý: `monthlyTotal` là $2,500 nên ba tháng chi tiêu là $7,500,
 * mà sức DỒN chỉ $3,000. Hai con số đó không suy ra nhau được, và spec §4.2
 * gọi con số thứ hai là "especially important" đúng vì thế. Thẻ đòi mốc chi
 * $10,000 vẫn là ứng viên (§13 nói đừng làm nó thành pass/fail), chỉ là bị
 * phạt nặng và kèm cảnh báo.
 */
export const lowSpendCapacity: UserState = {
  profile: profileOf("u_low_capacity", {
    // Cá nhân DƯỚI ngưỡng $60,000 của Scotiabank® Momentum, hộ gia đình thì
    // vượt $100,000. Đây chính là ca vế HOẶC của `income()` sinh ra để cứu, và
    // một trường thu nhập duy nhất không kể nổi.
    annualPersonalIncome: amountRange(45_000, 55_000),
    annualHouseholdIncome: amountRange(110_000, 130_000),
    annualFeeTolerancePerCard: 200,
    businessCardsAllowed: false,
  }),
  spend: spendOf("u_low_capacity", {
    monthlyTotal: exactAmount(2_500),
    byCategory: { grocery: exactAmount(800), dining: exactAmount(250) },
    minimumSpendCapacity3m: exactAmount(3_000),
  }),
  cards: [],
  balances: [],
  goals: [goalOf("u_low_capacity", { type: "next_card", priority: 1 })],
  declared: { cards: true, balances: true },
};

/* ------------------------------------------------------------------ *
 * Test G — quyền lợi trùng
 * ------------------------------------------------------------------ */

/**
 * Đang giữ TD® Aeroplan® Visa Infinite, tức đã có miễn hành lý ký gửi trên
 * Air Canada®.
 *
 * Mô hình người dùng KHÔNG lưu "người này đã có miễn hành lý". Nó lưu thẻ, và
 * quyền lợi tra ra từ `product_benefits` của Phase 1 — nơi mỗi quyền lợi mang
 * cả `provider`. Nhờ vậy engine phân biệt được miễn hành lý của Air Canada®
 * với của United®, thay vì triệt tiêu giá trị thẻ United® chỉ vì hai bên trùng
 * tên quyền lợi. Nếu trạng thái người dùng chép sẵn danh sách quyền lợi thì
 * phân biệt đó mất ngay tại đây.
 */
export const duplicateBagBenefit: UserState = {
  profile: profileOf("u_dup_benefit", {
    annualPersonalIncome: amountRange(80_000, 150_000),
    annualFeeTolerancePerCard: 150,
    businessCardsAllowed: false,
  }),
  spend: spendOf("u_dup_benefit", {
    monthlyTotal: exactAmount(3_000),
    byCategory: { travel: exactAmount(500) },
    minimumSpendCapacity3m: exactAmount(4_000),
  }),
  cards: [cardOf("u_dup_benefit", "td-aeroplan-visa-infinite", "active", { opened: "2024-11-01" })],
  balances: [balanceOf("u_dup_benefit", AEROPLAN, 45_000)],
  goals: [goalOf("u_dup_benefit", { type: "next_card", priority: 1 })],
  declared: { cards: true, balances: true },
};

/* ------------------------------------------------------------------ *
 * Test H — đã đủ điểm linh hoạt
 * ------------------------------------------------------------------ */

/**
 * Nhiều Membership Rewards®, và MỘT thẻ Amex® đã đóng.
 *
 * Thẻ đã đóng là phần đáng giá nhất của nhân vật này: `status: "closed"` vẫn
 * là TỪNG GIỮ, nên luật Amex® "once in a lifetime" phải chặn welcome bonus của
 * chính thẻ đó. Viết `status === "previously_held"` ở Phase 3 sẽ để nó lọt, và
 * hậu quả không phải một lỗi — là một khuyến nghị trông hợp lý hứa một khoản
 * bonus ngân hàng sẽ từ chối. Xem `everHeld`.
 *
 * `closedDate` biết, nên những luật tính theo "N tháng qua" cũng đánh giá được.
 */
export const flexiblePointsSufficient: UserState = {
  profile: profileOf("u_flexible", {
    annualPersonalIncome: amountRange(150_000, null),
    annualFeeTolerancePerCard: 800,
    businessCardsAllowed: true,
  }),
  spend: spendOf("u_flexible", {
    monthlyTotal: exactAmount(8_000),
    byCategory: { dining: exactAmount(1_500), travel: exactAmount(2_000) },
    minimumSpendCapacity3m: exactAmount(15_000),
  }),
  cards: [
    cardOf("u_flexible", "amex-cobalt", "active", { opened: "2022-05-01" }),
    cardOf("u_flexible", "amex-gold-rewards", "closed", {
      opened: "2021-02-01",
      closed: "2024-08-15",
    }),
  ],
  balances: [
    balanceOf("u_flexible", AMEX_MR, 240_000),
    balanceOf("u_flexible", AEROPLAN, 15_000),
  ],
  goals: [
    goalOf("u_flexible", {
      type: "trip",
      priority: 1,
      originRegion: null,
      originAirport: null,
      destinationRegion: "EUROPE",
      destinationAirport: null,
      cabin: "business",
      passengers: 2,
      travelStart: null,
      travelEnd: null,
      flexibility: "high",
    }),
  ],
  declared: { cards: true, balances: true },
};

/* ------------------------------------------------------------------ *
 * Test J — thiếu dữ liệu
 * ------------------------------------------------------------------ */

/**
 * Có mục tiêu, có một con số chi tiêu, và một thẻ cũ không nhớ đóng khi nào.
 *
 * Hồ sơ chi tiêu TỒN TẠI nhưng gần như trống — khác với `beginnerUndeclared`
 * (`spend: null`, chưa mở ra bao giờ). Phân biệt này quyết định câu hỏi tiếp
 * theo đáng giá nhất ở §30: người đã mở phần chi tiêu ra thì hỏi thêm một hạng
 * mục là hợp lý; người chưa động tới thì hỏi hạng mục là hỏi sai chỗ.
 *
 * Số dư Aeroplan® khai `null` — có tài khoản, không nhớ bao nhiêu. Lại là một
 * ca thứ ba, khác cả "không có tài khoản" lẫn "có 0 điểm".
 */
export const nearlyEmpty: UserState = {
  profile: profileOf("u_sparse", { province: null }),
  spend: spendOf("u_sparse", { monthlyTotal: amountRange(2_000, 4_000) }),
  cards: [cardOf("u_sparse", "amex-green", "previously_held")],
  balances: [balanceOf("u_sparse", AEROPLAN, null)],
  goals: [goalOf("u_sparse", { type: "next_card", priority: null })],
  declared: { cards: true, balances: true },
};

/** Mọi nhân vật, để test quét một lượt. */
export const USER_FIXTURES: UserState[] = [
  beginnerNoCards,
  beginnerUndeclared,
  aeroplanHeavy,
  japanTripFunded,
  japanTripShortfall,
  lowSpendCapacity,
  duplicateBagBenefit,
  flexiblePointsSufficient,
  nearlyEmpty,
];
