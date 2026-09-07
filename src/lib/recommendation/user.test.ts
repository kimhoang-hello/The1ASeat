// Kiểm mô hình trạng thái người dùng của Phase 2.
//
// Câu hỏi những test này trả lời KHÔNG phải "code có chạy không" mà là tiêu
// chí nghiệm thu thật của Phase 2: mô hình có kể nổi câu chuyện của những
// người dùng khác hẳn nhau không, và có giữ được những phân biệt mà mất đi
// thì engine sẽ sai ÂM THẦM không.
//
//   npm run test:reco

import assert from "node:assert/strict";
import { test } from "node:test";
import { offlineDataset } from "./data/index.ts";
import { id } from "./types.ts";
import { productIdFor } from "./data/products.ts";
import {
  aeroplanHeavy,
  beginnerNoCards,
  beginnerUndeclared,
  duplicateBagBenefit,
  flexiblePointsSufficient,
  japanTripFunded,
  japanTripShortfall,
  lowSpendCapacity,
  nearlyEmpty,
  studentStarter,
  USER_FIXTURES,
} from "./data/user-fixtures.ts";
import { userGaps } from "./user-gaps.ts";
import { inMemoryUserStore } from "./user-source.ts";
import { validateUserState } from "./user-validate.ts";
import {
  amountRange,
  exactAmount,
  isExactAmount,
  typicalAmount,
  type UserCardId,
  type UserDataGap,
  type UserState,
} from "./user-types.ts";
import {
  compareToThreshold,
  everHeldProductIds,
  heldProductIds,
  lastClosed,
  primaryGoal,
  resolveTripGoal,
  sortedGoals,
  unallocatedMonthly,
} from "./user.ts";
import type { TripGoal } from "./user-types.ts";

const data = offlineDataset();

function errorsIn(state: UserState): string[] {
  return validateUserState(state, data)
    .filter((issue) => issue.level === "error")
    .map((issue) => issue.message);
}

function broken(base: UserState, mutate: (state: UserState) => void): UserState {
  const copy = structuredClone(base);
  mutate(copy);
  return copy;
}

// Kiểu trả về là union của `kind`, KHÔNG phải `string[]`. Đổi tên một `kind`
// mà quên sửa test thì `includes("ten_cu")` sẽ là lỗi biên dịch chứ không phải
// một phép so luôn-sai chạy xanh mãi mãi — đúng chuyện đã xảy ra khi
// `income_unknown` tách làm hai.
function gapKinds(state: UserState): UserDataGap["kind"][] {
  return userGaps(state).map((gap) => gap.kind);
}

/* ------------------------------------------------------------------ *
 * Mọi nhân vật đều hợp lệ
 * ------------------------------------------------------------------ */

test("mọi nhân vật mẫu đều không có lỗi", () => {
  for (const state of USER_FIXTURES) {
    assert.deepEqual(errorsIn(state), [], `${state.profile.id} có lỗi`);
  }
});

test("mỗi nhân vật có một id riêng", () => {
  const ids = USER_FIXTURES.map((state) => state.profile.id);
  assert.equal(new Set(ids).size, ids.length);
});

/* ------------------------------------------------------------------ *
 * Trống ≠ bằng không, ở mức bộ sưu tập
 * ------------------------------------------------------------------ */

test("mảng rỗng đã khai khác mảng rỗng chưa khai", () => {
  // Hai trạng thái này có `cards` và `balances` giống hệt nhau. Nếu mô hình
  // không phân biệt được thì Test A (người mới) và một người bấm bỏ qua sẽ
  // nhận cùng một khuyến nghị.
  assert.deepEqual(beginnerNoCards.cards, beginnerUndeclared.cards);
  assert.deepEqual(beginnerNoCards.balances, beginnerUndeclared.balances);

  assert.ok(!gapKinds(beginnerNoCards).includes("cards_undeclared"));
  assert.ok(!gapKinds(beginnerNoCards).includes("balances_undeclared"));
  assert.ok(gapKinds(beginnerUndeclared).includes("cards_undeclared"));
  assert.ok(gapKinds(beginnerUndeclared).includes("balances_undeclared"));
});

test("mảng có dòng mà cờ đã-khai nói false là mâu thuẫn", () => {
  const state = broken(aeroplanHeavy, (s) => {
    s.declared.cards = false;
  });
  assert.ok(errorsIn(state).some((message) => message.includes("declared.cards")));
});

test("hồ sơ chi tiêu chưa mở khác hồ sơ chi tiêu mở ra rồi bỏ trống", () => {
  assert.equal(beginnerUndeclared.spend, null);
  assert.ok(gapKinds(beginnerUndeclared).includes("spend_profile_missing"));
  // `nearlyEmpty` ĐÃ mở phần chi tiêu, nên chỗ trống của nó chi tiết hơn: từng
  // hạng mục một. Đây là thứ §30 cần để chọn câu hỏi tiếp theo cho đúng người.
  assert.ok(!gapKinds(nearlyEmpty).includes("spend_profile_missing"));
  assert.ok(gapKinds(nearlyEmpty).includes("spend_category_unknown"));
});

test("hồ sơ chưa mở KHÔNG sinh 17 chỗ trống hạng mục", () => {
  assert.ok(!gapKinds(beginnerUndeclared).includes("spend_category_unknown"));
});

test("số dư null là ca thứ ba, khác không có tài khoản và khác 0 điểm", () => {
  const balance = nearlyEmpty.balances[0];
  assert.equal(balance.balance, null);
  assert.ok(gapKinds(nearlyEmpty).includes("point_balance_amount_unknown"));
});

/* ------------------------------------------------------------------ *
 * Từng giữ vs đang giữ — cái bẫy im lặng
 * ------------------------------------------------------------------ */

test("thẻ closed vẫn là TỪNG GIỮ", () => {
  const gold = productIdFor("amex-gold-rewards");
  assert.ok(!heldProductIds(flexiblePointsSufficient).has(gold));
  assert.ok(everHeldProductIds(flexiblePointsSufficient).has(gold));
});

test("phép so status === 'previously_held' bỏ sót thẻ closed", () => {
  // Ghi lại chính cái bẫy: đây là phép so ai cũng viết, và nó cho kết quả
  // KHÁC `everHeldProductIds`. Luật Amex® once-in-a-lifetime chỉ chặn welcome
  // bonus chứ không chặn đơn, nên hậu quả không phải lỗi — là một khuyến nghị
  // trông hợp lý hứa một khoản bonus ngân hàng sẽ từ chối.
  const naive = new Set(
    flexiblePointsSufficient.cards
      .filter((card) => card.status === "previously_held")
      .map((card) => card.productId),
  );
  assert.equal(naive.size, 0);
  assert.equal(everHeldProductIds(flexiblePointsSufficient).size, 2);
});

test("ngày đóng biết thì tra được, không biết thì thành chỗ trống", () => {
  assert.deepEqual(lastClosed(flexiblePointsSufficient, productIdFor("amex-gold-rewards")), {
    kind: "closed",
    date: "2024-08-15",
  });
  assert.deepEqual(lastClosed(nearlyEmpty, productIdFor("amex-green")), { kind: "unknown" });
  assert.deepEqual(lastClosed(beginnerNoCards, productIdFor("amex-green")), { kind: "never_closed" });
  assert.ok(gapKinds(nearlyEmpty).includes("card_closed_date_unknown"));
});

test("một quãng không rõ ngày làm cả câu trả lời thành CHƯA BIẾT", () => {
  // Hai lần giữ cùng một thẻ: một lần biết ngày đóng, một lần không. Trả về
  // ngày đã biết là trình bày một ngày CŨ như thể nó là lần đóng gần nhất —
  // và luật "không có bonus nếu từng giữ trong N tháng qua" sẽ kết luận đã hết
  // hạn chờ.
  const state = broken(flexiblePointsSufficient, (s) => {
    s.cards.push({
      ...structuredClone(s.cards[1]),
      id: id<UserCardId>(`${s.cards[1].id}_lan_truoc`),
      status: "previously_held",
      openedDate: null,
      closedDate: null,
    });
  });
  assert.deepEqual(errorsIn(state), []);
  assert.deepEqual(lastClosed(state, productIdFor("amex-gold-rewards")), { kind: "unknown" });
});

test("mở lại sau khi đóng là hợp lệ; hai dòng đang-giữ thì không", () => {
  const reopened = broken(flexiblePointsSufficient, (s) => {
    s.cards.push({
      ...structuredClone(s.cards[1]),
      id: id<UserCardId>(`${s.cards[1].id}_again`),
      status: "active",
      closedDate: null,
      openedDate: "2026-01-05",
    });
  });
  assert.deepEqual(errorsIn(reopened), []);

  const twice = broken(aeroplanHeavy, (s) => {
    s.cards.push({ ...structuredClone(s.cards[0]), id: id<UserCardId>(`${s.cards[0].id}_dup`) });
  });
  assert.ok(errorsIn(twice).some((message) => message.includes("Hai dòng đang-giữ")));
});

test("thẻ đang giữ mà có closedDate là lỗi", () => {
  const state = broken(aeroplanHeavy, (s) => {
    s.cards[0].closedDate = "2026-01-01";
  });
  assert.ok(errorsIn(state).some((message) => message.includes("closedDate")));
});

/* ------------------------------------------------------------------ *
 * Quyền lợi tra từ THẺ, không chép sẵn vào người dùng
 * ------------------------------------------------------------------ */

test("Test G: quyền lợi trùng tra ra được từ thẻ đang giữ, kèm nhà cung cấp", () => {
  const held = heldProductIds(duplicateBagBenefit);
  const bags = data.productBenefits.filter(
    (row) => held.has(row.productId) && row.benefitId === "free-checked-bag",
  );
  assert.equal(bags.length, 1);
  // `provider` là thứ phân biệt miễn hành lý Air Canada® với United®. Nếu
  // trạng thái người dùng chép sẵn "đã có miễn hành lý" thì phân biệt này mất
  // ngay tại đây, và thẻ United® bị triệt tiêu giá trị một cách vô lý.
  assert.ok(bags[0].provider !== null && bags[0].provider.length > 0);
});

test("không một trường nào ngoài cards nhắc tới một sản phẩm", () => {
  // Chốt cấu trúc cho luật "mô hình người dùng KHÔNG được mã hoá thẻ nào nên
  // được khuyên". Thêm một `preferredProductId` vào hồ sơ sẽ làm test này đỏ.
  const productIds = data.products.map((product) => product.id as string);
  for (const state of USER_FIXTURES) {
    const withoutCards = JSON.stringify({ ...state, cards: [] });
    for (const productId of productIds) {
      assert.ok(
        !withoutCards.includes(productId),
        `${state.profile.id} nhắc tới ${productId} ngoài danh sách thẻ`,
      );
    }
  }
});

test("dòng số dư không có chỗ nào nhét được số tài khoản", () => {
  // Spec §4.4 cấm lưu số tài khoản loyalty. Cưỡng chế bằng cách không có
  // trường nào chứa nổi nó — kể cả một ô ghi chú tự do.
  for (const state of USER_FIXTURES) {
    for (const row of state.balances) {
      assert.deepEqual(Object.keys(row).sort(), ["balance", "programId", "updatedAt", "userId"]);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Chuyến đi: vùng, không phải sân bay
 * ------------------------------------------------------------------ */

test("trip goal biểu diễn được chỉ bằng vùng", () => {
  const goal = japanTripFunded.goals[0] as TripGoal;
  assert.equal(goal.destinationAirport, null);
  assert.equal(goal.originAirport, null);
  assert.equal(goal.destinationRegion, "JAPAN");

  const resolved = resolveTripGoal(japanTripFunded.profile, goal);
  assert.equal(resolved.originRegion, "CANADA_US");
  assert.ok(resolved.originRegionInferred);

  // Và vùng đã đủ để tra `award_strategies` của Phase 1 — thử trên cặp vùng
  // Phase 1 CÓ dựng dữ liệu.
  const toVietnam = resolveTripGoal(japanTripFunded.profile, {
    ...goal,
    destinationRegion: "SEA_VIETNAM",
  });
  const strategies = data.awardStrategies.filter(
    (row) =>
      row.originRegion === toVietnam.originRegion &&
      row.destinationRegion === toVietnam.destinationRegion &&
      row.cabin === toVietnam.cabin,
  );
  assert.ok(strategies.length > 0, "không tra được award strategy chỉ bằng vùng");
});

test("vùng chưa có bảng giá là chỗ trống ĐÃ KHAI, không phải im lặng", () => {
  // Nhật là một trong bốn vùng Phase 1 chưa dựng award strategy. Trạng thái
  // người dùng biểu diễn chuyến đi này hoàn toàn bình thường; việc engine
  // chưa định giá được là chuyện của lớp dữ liệu sản phẩm, và nó NÓI RA.
  const goal = japanTripFunded.goals[0] as TripGoal;
  const resolved = resolveTripGoal(japanTripFunded.profile, goal);
  const strategies = data.awardStrategies.filter(
    (row) =>
      row.originRegion === resolved.originRegion &&
      row.destinationRegion === resolved.destinationRegion,
  );
  assert.equal(strategies.length, 0);
  assert.ok(
    data.gaps.some(
      (gap) =>
        gap.kind === "award_route_uncovered" &&
        gap.subjectId === `${resolved.originRegion}|${resolved.destinationRegion}`,
    ),
    "Phase 3 phải nói 'chưa có dữ liệu' chứ không phải 'không có phương án'",
  );
});

test("vùng khởi hành do người dùng nói thì không bị coi là suy ra", () => {
  const goal = japanTripShortfall.goals[0] as TripGoal;
  const resolved = resolveTripGoal(japanTripShortfall.profile, goal);
  assert.equal(resolved.originRegion, "CANADA_US");
  assert.ok(!resolved.originRegionInferred);
});

test("số người bay KHÔNG được mặc định là 1", () => {
  const goal = structuredClone(japanTripFunded.goals[0]) as TripGoal;
  goal.passengers = null;
  const resolved = resolveTripGoal(japanTripFunded.profile, goal);
  assert.equal(resolved.passengers, null);

  const state = broken(japanTripFunded, (s) => {
    (s.goals[0] as TripGoal).passengers = null;
  });
  assert.ok(gapKinds(state).includes("trip_passengers_unknown"));
});

test("Test C và Test D khác nhau ở DỮ LIỆU, không ở cấu trúc", () => {
  const funded = japanTripFunded.goals[0] as TripGoal;
  const shortfall = japanTripShortfall.goals[0] as TripGoal;
  assert.equal(funded.destinationRegion, shortfall.destinationRegion);
  assert.equal(funded.cabin, shortfall.cabin);
  assert.notEqual(funded.passengers, shortfall.passengers);
  assert.equal(japanTripFunded.balances[0].balance, 200_000);
  assert.equal(japanTripShortfall.balances[0].balance, 20_000);
});

test("mã sân bay phải là IATA 3 chữ hoa", () => {
  const state = broken(japanTripShortfall, (s) => {
    (s.goals[0] as TripGoal).originAirport = "Toronto Pearson";
  });
  assert.ok(errorsIn(state).some((message) => message.includes("IATA")));
});

/* ------------------------------------------------------------------ *
 * Chi tiêu
 * ------------------------------------------------------------------ */

test("Test E: sức chi 3 tháng không suy được từ tổng tháng", () => {
  const spend = lowSpendCapacity.spend;
  assert.ok(spend !== null);
  assert.equal(typicalAmount(spend.minimumSpendCapacity3m!), 3_000);
  assert.equal(typicalAmount(spend.monthlyTotal!) * 3, 7_500);
});

test("phần chưa phân bổ là phần CHƯA BIẾT, không phải bằng không", () => {
  const allocated = unallocatedMonthly(beginnerNoCards.spend!);
  assert.deepEqual(allocated, { low: 0, high: 0 });

  // `nearlyEmpty` khai tổng $2,000–4,000 và không hạng mục nào: toàn bộ chưa
  // phân bổ. Coi mười bảy hạng mục là 0 sẽ kết luận người này không đi du
  // lịch, từ một câu chưa ai hỏi.
  assert.deepEqual(unallocatedMonthly(nearlyEmpty.spend!), { low: 2_000, high: 4_000 });
});

test("phép trừ khoảng giữ đúng chiều bất định", () => {
  const spend = structuredClone(nearlyEmpty.spend!);
  spend.byCategory = { grocery: amountRange(500, 900) };
  // [2000,4000] − [500,900] = [1100, 3500]
  assert.deepEqual(unallocatedMonthly(spend), { low: 1_100, high: 3_500 });
});

test("tổng cận dưới các hạng mục vượt cận trên của tổng tháng là lỗi", () => {
  const state = broken(beginnerNoCards, (s) => {
    s.spend!.byCategory.travel = exactAmount(900);
  });
  assert.ok(errorsIn(state).some((message) => message.includes("vượt cận trên")));
});

test("sức chi 3 tháng vượt xa 3× tổng tháng chỉ cảnh báo, không chặn", () => {
  const state = broken(beginnerNoCards, (s) => {
    s.spend!.minimumSpendCapacity3m = exactAmount(20_000);
  });
  assert.deepEqual(errorsIn(state), []);
  const warnings = validateUserState(state, data).filter((issue) => issue.level === "warning");
  assert.ok(warnings.some((issue) => issue.message.includes("3× tổng tháng")));
});

/* ------------------------------------------------------------------ *
 * Khoảng tiền
 * ------------------------------------------------------------------ */

test("khoảng mở lấy cận dưới, không tự bịa ra một trần", () => {
  const open = amountRange(150_000, null);
  assert.equal(typicalAmount(open), 150_000);
  assert.ok(!isExactAmount(open));
  assert.ok(isExactAmount(exactAmount(0)));
});

test("so khoảng với ngưỡng cho BA kết quả", () => {
  assert.equal(compareToThreshold(amountRange(80_000, 150_000), 80_000), "at_or_above");
  assert.equal(compareToThreshold(amountRange(30_000, 60_000), 80_000), "below");
  // Vế quyết định: "60–80K" so với ngưỡng $80,000 là CÓ THỂ. Trả về "không
  // đạt" ở đây là loại oan đúng những người mà khoảng đó bao trùm.
  assert.equal(compareToThreshold(amountRange(60_000, 80_000), 80_000), "straddles");
  assert.equal(compareToThreshold(amountRange(150_000, null), 200_000), "straddles");
});

test("cận trên nhỏ hơn cận dưới là lỗi", () => {
  const state = broken(beginnerNoCards, (s) => {
    s.profile.annualPersonalIncome = { low: 90_000, high: 60_000 };
  });
  assert.ok(errorsIn(state).some((message) => message.includes("nhỏ hơn cận dưới")));
});

test("vế HOẶC của điều kiện thu nhập biểu diễn được", () => {
  // Phase 1 dựng "$60,000 cá nhân HOẶC $100,000 hộ gia đình" thành hai dòng
  // cùng `ruleGroup`. Vế hộ gia đình sinh ra để nhận người có thu nhập cá nhân
  // DƯỚI ngưỡng — nên một trường thu nhập duy nhất làm nó vô dụng.
  const profile = lowSpendCapacity.profile;
  assert.equal(compareToThreshold(profile.annualPersonalIncome!, 60_000), "below");
  assert.equal(compareToThreshold(profile.annualHouseholdIncome!, 100_000), "at_or_above");
});

test("thu nhập hộ gia đình thấp hơn thu nhập cá nhân là lỗi", () => {
  const state = broken(lowSpendCapacity, (s) => {
    s.profile.annualHouseholdIncome = amountRange(10_000, 20_000);
  });
  assert.ok(errorsIn(state).some((message) => message.includes("hộ gia đình")));
});

test("status gõ sai bị bắt, thay vì làm thẻ biến mất im lặng", () => {
  const state = broken(aeroplanHeavy, (s) => {
    s.cards[0].status = "actve" as never;
  });
  // Không có phép kiểm này thì `holdsNow` và `everHeld` cùng trả false: thẻ
  // rơi khỏi cả danh mục lẫn lịch sử, và welcome bonus của nó được hứa lại.
  assert.equal(heldProductIds(state).size, 1);
  assert.equal(everHeldProductIds(state).size, 1);
  assert.ok(errorsIn(state).some((message) => message.includes("status không tồn tại")));
});

test("sinh viên là một trường riêng, không suy từ đâu được", () => {
  assert.equal(beginnerNoCards.profile.isStudent, false);
  assert.equal(nearlyEmpty.profile.isStudent, null);
  assert.ok(gapKinds(nearlyEmpty).includes("student_status_unknown"));
  assert.ok(!gapKinds(beginnerNoCards).includes("student_status_unknown"));
});

/* ------------------------------------------------------------------ *
 * Mục tiêu
 * ------------------------------------------------------------------ */

test("mục tiêu sắp tất định: priority nhỏ trước, chưa xếp xuống cuối", () => {
  const state = broken(nearlyEmpty, (s) => {
    s.goals.push(
      { ...structuredClone(s.goals[0]), id: "goal_b", priority: 2 } as never,
      { ...structuredClone(s.goals[0]), id: "goal_a", priority: null } as never,
    );
  });
  const order = sortedGoals(state).map((goal) => goal.id);
  assert.equal(order[0], "goal_b");
  // Hai mục tiêu chưa xếp phá hoà bằng id, không bằng thứ tự mảng — thứ tự
  // mảng đến từ database và không phải là một cam kết.
  assert.deepEqual(order.slice(1), ["goal_a", "goal_u_sparse_next_card"]);
});

test("không mục tiêu nào thì primaryGoal nói 'none' và có chỗ trống", () => {
  const state = broken(beginnerNoCards, (s) => {
    s.goals = [];
  });
  assert.deepEqual(primaryGoal(state), { kind: "none" });
  assert.ok(gapKinds(state).includes("goal_missing"));
});

test("nhiều mục tiêu cùng mức ưu tiên là AMBIGUOUS, không phải chọn theo id", () => {
  // Tất định không phải là đúng: lấy id nhỏ nhất nghĩa là một chuỗi sinh lúc
  // lưu quyết định hàm chấm điểm nào chạy (§10 dùng hàm khác nhau cho từng
  // loại mục tiêu), trong khi người dùng chưa hề xếp thứ tự.
  const state = broken(nearlyEmpty, (s) => {
    s.goals.push({ ...structuredClone(s.goals[0]), id: "goal_a", type: "diversify" } as never);
  });
  const primary = primaryGoal(state);
  assert.equal(primary.kind, "ambiguous");
  assert.ok(gapKinds(state).includes("goal_priority_ambiguous"));

  const ranked = broken(state, (s) => {
    s.goals[0].priority = 1;
    s.goals[1].priority = 2;
  });
  assert.equal(primaryGoal(ranked).kind, "resolved");
  assert.ok(!gapKinds(ranked).includes("goal_priority_ambiguous"));
});

/** Trạng thái có NHIỀU dòng sinh chỗ trống ở cả ba vòng lặp. Bản `nearlyEmpty`
 *  gốc chỉ có một dòng mỗi loại, nên đảo nó lại không chứng minh được gì —
 *  phép kiểm thứ tự sẽ xanh cả khi bỏ hết lệnh sắp xếp. */
function manyGapRows(): UserState {
  return broken(nearlyEmpty, (state) => {
    for (const slug of ["amex-cobalt", "td-aeroplan-visa-infinite"]) {
      state.cards.push({
        id: id<UserCardId>(`uc_u_sparse_${slug}`),
        userId: state.profile.id,
        productId: productIdFor(slug),
        status: "previously_held",
        openedDate: null,
        closedDate: null,
      });
    }
    for (const program of ["amex-mr", "avios"]) {
      state.balances.push({
        userId: state.profile.id,
        programId: id(program),
        balance: null,
        updatedAt: "2026-09-08",
      });
    }
    for (const [suffix, region] of [
      ["a", "EUROPE"],
      ["b", "EAST_ASIA"],
    ] as const) {
      state.goals.push({
        id: id(`goal_trip_${suffix}`),
        userId: state.profile.id,
        type: "trip",
        priority: null,
        createdAt: "2026-09-08",
        originRegion: null,
        originAirport: null,
        destinationRegion: region,
        destinationAirport: null,
        cabin: null,
        passengers: null,
        travelStart: null,
        travelEnd: null,
        flexibility: null,
      });
    }
  });
}

test("chỗ trống không đổi khi database trả về các dòng theo thứ tự khác", () => {
  // `userGaps` hứa thứ tự cố định. Nếu nó duyệt theo thứ tự mảng thì lời hứa
  // đó chỉ đúng khi truy vấn tình cờ trả về cùng một thứ tự — và Phase 4 sẽ
  // báo có thay đổi ở nơi không có gì thay đổi.
  const base = manyGapRows();
  const shuffled = broken(base, (s) => {
    s.cards.reverse();
    s.balances.reverse();
    s.goals.reverse();
  });
  assert.deepEqual(userGaps(shuffled), userGaps(base));
});

test("chỗ trống của mỗi bộ sưu tập ra theo thứ tự khoá đã sắp", () => {
  // Phép kiểm thật sự chặn việc bỏ lệnh sắp xếp: so với chính danh sách đã
  // sắp, chứ không chỉ so hai lần chạy với nhau.
  const gaps = userGaps(manyGapRows());
  for (const kind of [
    "card_closed_date_unknown",
    "point_balance_amount_unknown",
    "trip_cabin_unknown",
  ] as const) {
    const subjects = gaps.filter((gap) => gap.kind === kind).map((gap) => gap.subject);
    assert.ok(subjects.length >= 2, `${kind} phải có ít nhất 2 dòng thì phép kiểm mới có nghĩa`);
    assert.deepEqual(subjects, [...subjects].sort(), `${kind} ra không đúng thứ tự`);
  }
});

/* ------------------------------------------------------------------ *
 * Toàn vẹn tham chiếu
 * ------------------------------------------------------------------ */

test("productId và programId không tồn tại thì bị bắt", () => {
  const badProduct = broken(aeroplanHeavy, (s) => {
    s.cards[0].productId = "prd_khong-co-that" as never;
  });
  assert.ok(badProduct.cards.length > 0);
  assert.ok(errorsIn(badProduct).some((message) => message.includes("không tồn tại")));

  const badProgram = broken(aeroplanHeavy, (s) => {
    s.balances[0].programId = "khong-co-that" as never;
  });
  assert.ok(errorsIn(badProgram).some((message) => message.includes("không tồn tại")));
});

test("hai dòng số dư cho cùng một chương trình bị bắt", () => {
  const state = broken(aeroplanHeavy, (s) => {
    s.balances.push(structuredClone(s.balances[0]));
  });
  assert.ok(errorsIn(state).some((message) => message.includes("Hai dòng số dư")));
});

test("trộn dữ liệu của người khác vào bị bắt", () => {
  const state = broken(aeroplanHeavy, (s) => {
    s.spend!.userId = "u_nguoi_khac" as never;
    s.cards[0].userId = "u_nguoi_khac" as never;
  });
  const errors = errorsIn(state);
  assert.ok(errors.some((message) => message.includes("không khớp hồ sơ")));
  assert.ok(errors.length >= 2);
});

test("tỉnh bang và số dư âm bị bắt", () => {
  const state = broken(aeroplanHeavy, (s) => {
    s.profile.province = "XX" as never;
    s.balances[0].balance = -1;
  });
  const errors = errorsIn(state);
  assert.ok(errors.some((message) => message.includes("Tỉnh bang")));
  assert.ok(errors.some((message) => message.includes("số dư không hợp lệ")));
});

test("ngày không có thật bị bắt", () => {
  const state = broken(aeroplanHeavy, (s) => {
    s.cards[0].openedDate = "2026-02-31";
  });
  assert.ok(errorsIn(state).some((message) => message.includes("không phải ngày")));
});

/* ------------------------------------------------------------------ *
 * Chỗ trống là dữ liệu tất định
 * ------------------------------------------------------------------ */

test("cùng một trạng thái cho cùng một danh sách chỗ trống", () => {
  for (const state of USER_FIXTURES) {
    assert.deepEqual(userGaps(state), userGaps(structuredClone(state)));
  }
});

test("hồ sơ đầy đủ nhất vẫn nói ra đúng chỗ nó thiếu", () => {
  const kinds = gapKinds(aeroplanHeavy);
  assert.ok(!kinds.includes("personal_income_unknown"));
  assert.ok(!kinds.includes("annual_fee_tolerance_unknown"));
  assert.ok(!kinds.includes("business_cards_preference_unknown"));
  // Vẫn thiếu phần lớn hạng mục chi tiêu — và nói ra.
  assert.ok(kinds.includes("spend_category_unknown"));
});

test("giá trị boolean gõ sai bị bắt, không đi qua bằng truthiness", () => {
  const state = broken(aeroplanHeavy, (s) => {
    s.profile.isStudent = "false" as never;
    s.declared.balances = "false" as never;
  });
  const errors = errorsIn(state);
  assert.ok(errors.some((message) => message.includes("isStudent")));
  assert.ok(errors.some((message) => message.includes("declared.cards và declared.balances")));
});

test("trường thu nhập vắng mặt cho ra LỖI DỮ LIỆU, không phải TypeError", () => {
  // Dữ liệu từ database hay JSON thiếu một trường mới thêm sẽ là `undefined`,
  // và `undefined !== null` là đúng — phép so nghiêm ngặt sẽ đi tiếp rồi ném.
  const state = broken(aeroplanHeavy, (s) => {
    delete (s.profile as Partial<typeof s.profile>).annualHouseholdIncome;
  });
  assert.doesNotThrow(() => validateUserState(state, data));
});

test("từ chối nói thu nhập khác chưa hỏi thu nhập", () => {
  assert.ok(gapKinds(studentStarter).includes("personal_income_declined"));
  assert.ok(gapKinds(studentStarter).includes("household_income_declined"));
  // Và KHÔNG sinh chỗ trống hỏi được, nếu không §30 sẽ hỏi lại mãi đúng điều
  // người dùng vừa từ chối.
  assert.ok(!gapKinds(studentStarter).includes("personal_income_unknown"));
  assert.ok(!gapKinds(studentStarter).includes("household_income_unknown"));
  assert.ok(gapKinds(nearlyEmpty).includes("personal_income_unknown"));

  const contradictory = broken(studentStarter, (s) => {
    s.profile.annualPersonalIncome = amountRange(20_000, 30_000);
  });
  assert.ok(errorsIn(contradictory).some((message) => message.includes("personalIncomeDeclined")));
});

test("khai thu nhập cá nhân rồi từ chối câu hộ gia đình là hợp lệ", () => {
  // Đây là hình dạng thật của bảng câu hỏi thích ứng: hộ gia đình chỉ đáng hỏi
  // SAU KHI biết thu nhập cá nhân không đủ. Một cờ chung thì trạng thái này
  // hoặc bị từ chối, hoặc phải để cờ false rồi bị hỏi lại mãi.
  const state = broken(lowSpendCapacity, (s) => {
    s.profile.annualHouseholdIncome = null;
    s.profile.householdIncomeDeclined = true;
  });
  assert.deepEqual(errorsIn(state), []);
  const kinds = gapKinds(state);
  assert.ok(kinds.includes("household_income_declined"));
  assert.ok(!kinds.includes("household_income_unknown"));
  assert.ok(!kinds.includes("personal_income_declined"));
});

test("trường vắng mặt là LỖI và vẫn sinh chỗ trống, không thành 'đã biết'", () => {
  // `undefined` trượt qua mọi phép so `=== null`: validator im, gaps im, và dữ
  // liệu THIẾU được trình bày như dữ liệu ĐẦY ĐỦ.
  const state = broken(aeroplanHeavy, (s) => {
    delete (s.profile as Partial<typeof s.profile>).annualHouseholdIncome;
    delete (s.profile as Partial<typeof s.profile>).isStudent;
  });
  const errors = errorsIn(state);
  assert.ok(errors.some((message) => message.includes('Thiếu trường "annualHouseholdIncome"')));
  assert.ok(errors.some((message) => message.includes('Thiếu trường "isStudent"')));
  const kinds = gapKinds(state);
  assert.ok(kinds.includes("household_income_unknown"));
  assert.ok(kinds.includes("student_status_unknown"));
});

test("nhánh ĐỦ điều kiện của luật sinh viên biểu diễn được", () => {
  assert.equal(studentStarter.profile.isStudent, true);
  const rule = data.eligibilityRules.find(
    (row) =>
      row.productId === productIdFor("scotiabank-scene-plus-visa-students") &&
      row.ruleType === "student_status_required",
  );
  assert.ok(rule !== undefined, "luật student_status_required phải có trong seed");
  assert.equal(rule.severity, "hard");
});

test("mức linh hoạt chưa biết là chỗ trống — §10.2 cho nó 10% điểm", () => {
  const state = broken(japanTripFunded, (s) => {
    (s.goals[0] as TripGoal).flexibility = null;
  });
  assert.ok(gapKinds(state).includes("trip_flexibility_unknown"));
  assert.ok(!gapKinds(japanTripFunded).includes("trip_flexibility_unknown"));
});

/* ------------------------------------------------------------------ *
 * Cửa đọc dữ liệu
 * ------------------------------------------------------------------ */

test("store trả về BẢN SAO, không trả về chính object gốc", async () => {
  const store = inMemoryUserStore(USER_FIXTURES);
  const first = await store.getUserState(aeroplanHeavy.profile.id);
  assert.ok(first !== null);
  first.cards.pop();
  const second = await store.getUserState(aeroplanHeavy.profile.id);
  // Một database luôn trả về bản sao. Nếu chỗ này trả về object gốc thì engine
  // lỡ tay sửa sẽ chạy đúng ở đây và hỏng khi đổi backend.
  assert.equal(second!.cards.length, aeroplanHeavy.cards.length);
});

test("không có người dùng này thì trả null, khác với hồ sơ trống", async () => {
  const store = inMemoryUserStore(USER_FIXTURES);
  assert.equal(await store.getUserState("u_khong-co-that"), null);
  assert.notEqual(await store.getUserState(beginnerUndeclared.profile.id), null);
});
