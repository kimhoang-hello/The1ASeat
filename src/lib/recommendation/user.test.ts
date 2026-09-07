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
  advancedCollector,
  highSpendLowCapacity,
  studentStarter,
  vagueEarner,
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
  spendFor,
  statedCategories,
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

test("trường lạ bị chặn LÚC CHẠY, ở mọi tầng — kể cả vật chứa", () => {
  // Kiểu dữ liệu chặn được người viết TypeScript. Dòng JSON từ database thì
  // không ai chặn, và đó là nơi hai lời hứa lớn nhất của mô hình thật sự bị
  // thử: spec §4.4 cấm số tài khoản loyalty, và mô hình không được mã hoá thẻ
  // nào nên được khuyên.
  const spots: [string, (s: UserState) => object][] = [
    ["gốc UserState", (s) => s],
    ["declared", (s) => s.declared],
    ["profile", (s) => s.profile],
    ["spend", (s) => s.spend as object],
    ["card", (s) => s.cards[0]],
    ["balance", (s) => s.balances[0]],
    ["goal", (s) => s.goals[0]],
  ];
  for (const [label, pick] of spots) {
    for (const smuggled of ["loyaltyAccountNumber", "preferredProductId"]) {
      const state = broken(advancedCollector, (s) => {
        (pick(s) as Record<string, unknown>)[smuggled] = "x";
      });
      assert.ok(
        errorsIn(state).some((message) => message.includes(`Trường lạ "${smuggled}"`)),
        `${label}: "${smuggled}" lọt qua validator`,
      );
    }
  }
});

test("vật chứa SAI HÌNH DẠNG: báo lỗi, không ném, và không đọc thành rỗng", () => {
  // Hai hướng hỏng khác nhau, và bản vá `?? []` chỉ đỡ được một:
  //   `cards: null`     — khoá có mặt nên không phải "thiếu trường", rồi `?? []`
  //                       lặng lẽ đọc thành "không có thẻ nào". Đúng luật
  //                       trống-≠-bằng-không, thủng ở tầng vật chứa.
  //   `declared: false` — `key in false` NÉM, phá hợp đồng "không bao giờ ném".
  const shapes: [string, unknown, string][] = [
    ["cards", null, "cards phải là mảng"],
    ["cards", "abc", "cards phải là mảng"],
    ["balances", 0, "balances phải là mảng"],
    ["goals", { a: 1 }, "goals phải là mảng"],
    ["declared", false, "declared phải là object"],
    ["declared", "x", "declared phải là object"],
    ["spend", 5, "spend phải là object hoặc null"],
  ];
  for (const [key, value, expected] of shapes) {
    const state = broken(advancedCollector, (s) => {
      (s as unknown as Record<string, unknown>)[key] = value;
    });
    assert.doesNotThrow(() => validateUserState(state, data), `${key}=${String(value)} làm validator ném`);
    assert.doesNotThrow(() => userGaps(state), `${key}=${String(value)} làm userGaps ném`);
    assert.doesNotThrow(() => heldProductIds(state), `${key}=${String(value)} làm heldProductIds ném`);
    assert.ok(
      errorsIn(state).some((message) => message.includes(expected)),
      `${key}=${String(value)} không báo "${expected}"`,
    );
  }

  // Và phần tử rác trong mảng cũng không được làm sập.
  const junkRow = broken(advancedCollector, (s) => {
    (s.cards as unknown[]).push(null, "x");
    (s.balances as unknown[]).push(null);
    (s.goals as unknown[]).push(null);
  });
  assert.doesNotThrow(() => validateUserState(junkRow, data));
  assert.doesNotThrow(() => userGaps(junkRow));
  assert.ok(errorsIn(junkRow).some((message) => message.includes("không phải object")));
});

test("gốc UserState không phải object thì trả lỗi chứ không ném", () => {
  for (const junk of [null, "x", 5, []]) {
    assert.doesNotThrow(() => validateUserState(junk as never, data));
    assert.ok(validateUserState(junk as never, data).length > 0);
  }
  assert.ok(
    validateUserState({ profile: "x" } as never, data).some((issue) =>
      issue.message.includes("profile không phải object"),
    ),
  );
});

test("vật chứa vắng mặt không làm hàm nào ném", () => {
  for (const key of ["cards", "balances", "goals", "declared", "spend"]) {
    const state = broken(advancedCollector, (s) => {
      delete (s as unknown as Record<string, unknown>)[key];
    });
    assert.doesNotThrow(() => validateUserState(state, data), `thiếu ${key} làm validator ném`);
    assert.doesNotThrow(() => userGaps(state), `thiếu ${key} làm userGaps ném`);
    assert.doesNotThrow(() => heldProductIds(state), `thiếu ${key} làm heldProductIds ném`);
    assert.doesNotThrow(() => primaryGoal(state), `thiếu ${key} làm primaryGoal ném`);
    assert.ok(errorsIn(state).some((message) => message.includes(`Thiếu trường "${key}"`)));
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

test("xoá BẤT KỲ trường nào cũng ra lỗi, và không hàm nào NÉM", () => {
  // Phép kiểm hệ thống thay cho một test mỗi trường — và danh sách khoá lấy
  // TỪ CHÍNH fixture, nên một trường mới thêm tự động được kiểm mà không ai
  // phải nhớ cập nhật test.
  //
  // Hai vế, và vế thứ hai là vế bản vá trước làm hỏng: validator không được
  // NÉM (nó chạy trên dữ liệu chưa đáng tin), nhưng cũng không được IM LẶNG
  // nuốt một trường vắng mặt — đổi hàng loạt sang `== null` đã ngăn exception
  // xong lại để `createdAt` thiếu hẳn mà vẫn trượt qua sạch.
  const base = japanTripShortfall;
  const targets: [string, () => UserState, (s: UserState) => object][] = [
    ["profile", () => base, (s) => s.profile],
    ["spend", () => base, (s) => s.spend as object],
    ["card", () => flexiblePointsSufficient, (s) => s.cards[1]],
    ["balance", () => aeroplanHeavy, (s) => s.balances[0]],
    ["goal", () => base, (s) => s.goals[0]],
  ];

  for (const [label, fixture, pick] of targets) {
    for (const key of Object.keys(pick(fixture()))) {
      const state = broken(fixture(), (s) => {
        delete (pick(s) as Record<string, unknown>)[key];
      });
      assert.doesNotThrow(() => validateUserState(state, data), `${label}.${key} làm validator ném`);
      assert.doesNotThrow(() => userGaps(state), `${label}.${key} làm userGaps ném`);
      assert.ok(
        errorsIn(state).length > 0,
        `${label}.${key} vắng mặt mà validator không báo gì`,
      );
    }
  }
});

test("trường vắng mặt vẫn ra đúng chỗ trống, không thành 'đã biết'", () => {
  const cardMissing = broken(flexiblePointsSufficient, (s) => {
    delete (s.cards[1] as Partial<(typeof s.cards)[1]>).closedDate;
  });
  assert.deepEqual(lastClosed(cardMissing, productIdFor("amex-gold-rewards")), { kind: "unknown" });

  const balanceMissing = broken(aeroplanHeavy, (s) => {
    delete (s.balances[0] as Partial<(typeof s.balances)[0]>).balance;
  });
  assert.ok(gapKinds(balanceMissing).includes("point_balance_amount_unknown"));
});

test("hạng mục chi tiêu biến mất không làm phép cộng khoảng ném", () => {
  const state = broken(japanTripShortfall, (s) => {
    delete (s.spend as unknown as Record<string, unknown>).byCategory;
  });
  assert.doesNotThrow(() => unallocatedMonthly(state.spend!));
  assert.doesNotThrow(() => statedCategories(state.spend!));
  assert.equal(spendFor(state, "grocery"), null);
});


/* ------------------------------------------------------------------ *
 * Mười hai kiểu người dùng KHÁC HẲN NHAU
 *
 * Đây là phép thử nghiệm thu của Phase 2 nói thành test: Phase 3 có suy luận
 * được về những người rất khác nhau bằng mô hình này không, mà không cần một
 * bảng câu hỏi dài. Mỗi test dưới đây đòi ĐẶC ĐIỂM PHÂN BIỆT của một kiểu
 * người dùng đọc ra được — không phải chỉ "dữ liệu hợp lệ".
 * ------------------------------------------------------------------ */

test("kiểu 1+6: người mới, ngại phí — 'chưa có gì' là câu trả lời, không phải chỗ trống", () => {
  assert.equal(everHeldProductIds(beginnerNoCards).size, 0);
  assert.equal(beginnerNoCards.balances.length, 0);
  assert.ok(beginnerNoCards.declared.cards && beginnerNoCards.declared.balances);
  assert.equal(beginnerNoCards.profile.annualFeeTolerancePerCard, 120);
  const kinds = gapKinds(beginnerNoCards);
  assert.ok(!kinds.includes("cards_undeclared"));
  assert.ok(!kinds.includes("annual_fee_tolerance_unknown"));
});

test("kiểu 2+3+5: người chơi lâu năm — nhiều thẻ, nhiều loại điểm, danh mục đọc được", () => {
  assert.equal(heldProductIds(advancedCollector).size, 4);
  assert.equal(everHeldProductIds(advancedCollector).size, 6);
  assert.equal(advancedCollector.balances.length, 5);

  // Năm loại điểm, và mọi chương trình đều tra được sang Phase 1 — nếu không
  // thì Portfolio Analyzer không quy đổi được gì.
  const programs = new Set(data.pointsPrograms.map((row) => row.id as string));
  for (const row of advancedCollector.balances) {
    assert.ok(programs.has(row.programId), `${row.programId} không có trong Phase 1`);
  }
  // Mô hình lưu số dư TRỰC TIẾP, không lưu "số dư tiếp cận được" — quy đổi qua
  // chặng chuyển là việc của §7, và tính sẵn ở đây là đếm trùng điểm chuyển
  // được ngay tại lớp dữ liệu.
  assert.ok(data.transferPaths.length > 0);
});

test("kiểu 4: thẻ từng giữ — ba trạng thái đóng phân biệt được", () => {
  assert.deepEqual(lastClosed(advancedCollector, productIdFor("td-aeroplan-visa-infinite")), {
    kind: "closed",
    date: "2023-02-28",
  });
  // Không nhớ đóng khi nào → KHÔNG được coi là đã hết hạn chờ.
  assert.deepEqual(lastClosed(advancedCollector, productIdFor("amex-gold-rewards")), {
    kind: "unknown",
  });
  assert.deepEqual(lastClosed(advancedCollector, productIdFor("amex-cobalt")), {
    kind: "never_closed",
  });
  // Và cả ba thẻ Amex® đó đều dính luật once-in-a-lifetime, nên phân biệt này
  // quyết định welcome bonus chứ không phải chuyện trang trí.
  const once = data.eligibilityRules.filter(
    (rule) =>
      rule.ruleType === "previous_cardholder_excluded" &&
      everHeldProductIds(advancedCollector).has(rule.productId),
  );
  assert.ok(once.length >= 2);
  assert.ok(once.every((rule) => rule.scope === "welcome_offer"));
});

test("kiểu 7: thẻ doanh nghiệp — SỞ THÍCH và ĐIỀU KIỆN là hai trường", () => {
  // Người có doanh nghiệp và muốn xét: cả hai vế đúng.
  assert.equal(advancedCollector.profile.businessCardsAllowed, true);
  assert.equal(advancedCollector.profile.hasBusiness, true);

  // Người MUỐN xét nhưng KHÔNG có doanh nghiệp — trạng thái có thật, và gộp
  // hai khái niệm vào một trường thì nó không tồn tại. `business_required` là
  // luật `hard`, nên engine phải loại thẻ đó vì ĐIỀU KIỆN, không phải vì sở
  // thích (§14).
  const willingNoBusiness = broken(advancedCollector, (s) => {
    s.profile.hasBusiness = false;
  });
  assert.deepEqual(errorsIn(willingNoBusiness), []);
  const businessRules = data.eligibilityRules.filter((rule) => rule.ruleType === "business_required");
  assert.equal(businessRules.length, 4);
  assert.ok(businessRules.every((rule) => rule.severity === "hard"));

  // Và người từ chối thẳng.
  assert.equal(beginnerNoCards.profile.businessCardsAllowed, false);
});

test("kiểu 8+9: sức dồn chi tiêu không suy được từ tổng tháng, theo cả hai hướng", () => {
  // Chi ÍT, dồn được gần hết.
  const low = lowSpendCapacity.spend!;
  assert.equal(typicalAmount(low.monthlyTotal!) * 3, 7_500);
  assert.equal(typicalAmount(low.minimumSpendCapacity3m!), 3_000);

  // Chi NHIỀU, dồn được rất ít — ca §4.2 gọi là "especially important".
  const high = highSpendLowCapacity.spend!;
  assert.equal(typicalAmount(high.monthlyTotal!) * 3, 36_000);
  assert.equal(typicalAmount(high.minimumSpendCapacity3m!), 2_000);
  // Tỷ lệ dồn được của hai người chênh nhau 7 lần. Bất kỳ hệ số suy nào cũng
  // sai nặng ở ít nhất một trong hai.
  assert.ok(3_000 / 7_500 > 5 * (2_000 / 36_000));
  assert.deepEqual(errorsIn(highSpendLowCapacity), []);
});

test("hồ sơ TRỐNG NHẤT có thể vẫn hợp lệ — không có bảng câu hỏi bắt buộc", () => {
  // Tiêu chí nghiệm thu của Phase 2 nói thẳng: không được bắt người dùng đi
  // qua một bảng câu hỏi dài. Test này đo điều đó — dựng một trạng thái với
  // MỌI trường tuỳ chọn để trống và đòi nó hợp lệ.
  //
  // Thứ duy nhất còn bắt buộc là: người này muốn gì. Mọi thứ khác — thu nhập,
  // phí chấp nhận được, thẻ đang giữ, số dư, chi tiêu — đều bỏ trống được, và
  // mỗi chỗ trống tự khai ra để §30 hỏi khi nó thật sự đổi kết quả.
  const bare: UserState = {
    profile: {
      id: id("u_bare"),
      country: "CA",
      province: null,
      annualPersonalIncome: null,
      annualHouseholdIncome: null,
      personalIncomeDeclined: false,
      householdIncomeDeclined: false,
      annualFeeTolerancePerCard: null,
      businessCardsAllowed: null,
      hasBusiness: null,
      isStudent: null,
      createdAt: "2026-09-08",
      updatedAt: "2026-09-08",
    },
    spend: null,
    cards: [],
    balances: [],
    goals: [
      {
        id: id("goal_bare"),
        userId: id("u_bare"),
        type: "next_card",
        priority: null,
        createdAt: "2026-09-08",
      },
    ],
    declared: { cards: false, balances: false },
  };
  assert.deepEqual(errorsIn(bare), []);
  assert.equal(primaryGoal(bare).kind, "resolved");
  assert.ok(userGaps(bare).length > 0, "hồ sơ trống mà không khai chỗ trống nào");
});

test("kiểu 10: hồ sơ dở dang vẫn hợp lệ, và nói đúng nó thiếu gì", () => {
  for (const state of [beginnerUndeclared, nearlyEmpty, vagueEarner]) {
    assert.deepEqual(errorsIn(state), [], `${state.profile.id} có lỗi`);
    assert.ok(userGaps(state).length > 0, `${state.profile.id} không khai chỗ trống nào`);
  }
  // Và hồ sơ dở dang nhất vẫn trả lời được câu "người này muốn gì".
  assert.equal(primaryGoal(vagueEarner).kind, "resolved");
});

test("kiểu 11+12: mục tiêu cụ thể và mục tiêu mơ hồ đều biểu diễn được", () => {
  const trip = japanTripShortfall.goals[0] as TripGoal;
  assert.equal(trip.destinationRegion, "JAPAN");
  assert.equal(trip.cabin, "business");
  assert.equal(trip.passengers, 2);

  const vague = vagueEarner.goals[0];
  assert.equal(vague.type, "earn_points");
  assert.equal(vague.type === "earn_points" ? vague.targetProgramId : "x", null);
  // "Bất kỳ loại điểm nào" là một CÂU TRẢ LỜI, không phải chỗ trống — §30
  // không được đem nó ra hỏi lại.
  assert.ok(!gapKinds(vagueEarner).some((kind) => kind.startsWith("trip_")));
});

test("cả bốn loại mục tiêu đều có nhân vật dùng tới", () => {
  // Hai hàm chấm điểm của §10 từng chưa có lấy một đầu vào để chạy thử.
  const used = new Set(USER_FIXTURES.flatMap((state) => state.goals.map((goal) => goal.type)));
  assert.deepEqual([...used].sort(), ["diversify", "earn_points", "next_card", "trip"]);
});

test("không hỏi thứ không ai dùng: tỉnh bang không sinh chỗ trống", () => {
  // `province` vẫn được LƯU — điều khoản offer của một số ngân hàng viết khác
  // cho Quebec, và ngày có luật đó thì cần ngay. Nhưng hôm nay không dòng dữ
  // liệu nào phụ thuộc vào nó, nên khai nó thành chỗ trống là chiếm suất câu
  // hỏi của những thứ thật sự đổi kết quả (§30) và trừ độ tin cậy không lý do
  // (§29).
  assert.equal(nearlyEmpty.profile.province, null);
  assert.ok(!gapKinds(nearlyEmpty).some((kind) => kind.startsWith("province")));

  const residency = data.eligibilityRules.filter((rule) => rule.ruleType === "residency");
  assert.ok(residency.length > 0);
  assert.deepEqual([...new Set(residency.map((rule) => rule.value))], ["CA"]);
});

test("mọi chỗ trống đều ứng với một thứ Phase 3 THẬT SỰ đọc", () => {
  // Chốt ngược của test trên, ở dạng tổng quát: một `kind` chỉ được tồn tại
  // nếu có dữ liệu hoặc quy tắc chấm điểm phụ thuộc vào nó. Danh sách này là
  // chỗ đặt câu hỏi đó cho từng cái.
  const justified: Record<UserDataGap["kind"], string> = {
    goal_missing: "§10 chọn hàm chấm điểm theo loại mục tiêu",
    goal_priority_ambiguous: "§10 dùng hàm khác nhau cho từng loại",
    spend_profile_missing: "§10.1 Spend Fit",
    monthly_total_unknown: "§10.1 Spend Fit",
    spend_category_unknown: "earning_rates theo hạng mục",
    minimum_spend_capacity_unknown: "§13 Minimum Spend Fit",
    annual_fee_tolerance_unknown: "§14 suitability",
    business_cards_preference_unknown: "§14 suitability, 4 sản phẩm",
    business_ownership_unknown: "eligibility business_required, 4 sản phẩm",
    personal_income_unknown: "eligibility minimum_personal_income",
    household_income_unknown: "eligibility minimum_household_income",
    personal_income_declined: "như trên, nhưng không hỏi lại được",
    household_income_declined: "như trên, nhưng không hỏi lại được",
    student_status_unknown: "eligibility student_status_required",
    cards_undeclared: "§7 Portfolio Analyzer",
    balances_undeclared: "§7 Portfolio Analyzer",
    point_balance_amount_unknown: "§7 số dư trực tiếp",
    card_closed_date_unknown: "eligibility previous_cardholder_excluded theo thời gian",
    trip_cabin_unknown: "award_strategies khoá theo cabin",
    trip_passengers_unknown: "§10.2 Points Gap Reduction nhân theo số người",
    trip_dates_unknown: "§13 mốc chi có kịp trước chuyến đi không",
    trip_flexibility_unknown: "§10.2 dành 10% cho Flexibility Value",
  };
  // Mọi kind mà `userGaps` sinh ra phải có mặt trong bảng biện minh, và ngược
  // lại — thêm một kind mà không nói được ai đọc nó là làm dài bảng câu hỏi.
  const emitted = new Set(USER_FIXTURES.flatMap((state) => gapKinds(state)));
  for (const kind of emitted) {
    assert.ok(justified[kind] !== undefined, `chỗ trống "${kind}" không có lý do tồn tại`);
  }
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
