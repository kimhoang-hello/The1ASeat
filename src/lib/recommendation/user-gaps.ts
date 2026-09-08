/**
 * Suy ra những chỗ mô hình người dùng KHÔNG BIẾT.
 *
 * Song song với `gaps.ts` của Phase 1, và cùng một lý do tồn tại: chỗ trống
 * phải là DỮ LIỆU. Rải `null` khắp mười bảy trường thì Phase 3 muốn biết mình
 * đang thiếu gì phải đi dò từng trường một — và cái nó bỏ sót sẽ không báo
 * lỗi, nó chỉ lặng lẽ tính như thể chỗ đó bằng không.
 *
 * SUY RA, không viết tay. Một danh sách chỗ trống duy trì tay chạy song song
 * với dữ liệu là một danh sách sẽ lệch ngay lần sửa thứ hai.
 *
 * Danh sách trả về có THỨ TỰ CỐ ĐỊNH — và điều đó đòi hỏi phải SẮP XẾP các bộ
 * sưu tập trước khi duyệt, không chỉ viết các khối theo thứ tự cố định. `cards`,
 * `balances` và `goals` đến từ một truy vấn database, và truy vấn không hứa thứ
 * tự nào. Duyệt theo thứ tự đó thì hai trạng thái GIỐNG HỆT nhau sinh ra hai
 * danh sách chỗ trống khác nhau — Phase 4 chụp lại đầu vào mỗi lượt chạy (§20)
 * và so hai lượt, nên nó sẽ báo có thay đổi ở nơi không có gì thay đổi, và câu
 * hỏi tiếp theo của §30 cũng đổi theo.
 */

import { SPEND_CATEGORIES } from "./types.ts";
import {
  asArray,
  holdsNow,
  isObject,
  primaryGoal,
  usableBalance,
  usablePassengers,
  usableRoundTrip,
} from "./user.ts";
import type { UserDataGap, UserState } from "./user-types.ts";

export function userGaps(state: UserState): UserDataGap[] {
  const gaps: UserDataGap[] = [];
  /**
   * Hồ sơ VẮNG HẲN cũng phải đọc được.
   *
   * Kiểu hứa `profile` luôn có, nhưng kiểu vắng mặt lúc chạy và dữ liệu tới từ
   * database hoặc JSON — đúng lập luận đã làm `asArray`/`isObject` ra đời cho
   * `cards` và `declared`. Không có phép phòng này thì mọi trường đọc bên dưới
   * NÉM, và vì `engine.ts` gọi thẳng `userGaps`, cả một lượt chạy khuyến nghị
   * đổ vì một dòng hồ sơ thiếu.
   *
   * Object rỗng cho ra đúng thứ nên có: mọi trường `== null`, tức mọi chỗ đều
   * là CHƯA BIẾT. Validator vẫn báo riêng rằng bản ghi hỏng.
   */
  const rawProfile: Partial<UserState["profile"]> = isObject(state?.profile)
    ? (state.profile as Partial<UserState["profile"]>)
    : {};
  // `subject` của mọi chỗ trống cấp hồ sơ là id người dùng, và nó phải là một
  // CHUỖI dùng được — `undefined` ở đó biến chỗ trống thành rác không tra
  // ngược được, đúng lúc engine cần nó nhất. Không có hồ sơ thì mượn id từ
  // bất kỳ bản ghi nào khác của chính người đó; hết cách thì một sentinel ổn
  // định, không phải `undefined`.
  const fallbackId =
    asArray(state?.goals).find((goal) => goal?.userId != null)?.userId ??
    asArray(state?.cards).find((card) => card?.userId != null)?.userId ??
    asArray(state?.balances).find((row) => row?.userId != null)?.userId ??
    state?.spend?.userId ??
    "unknown-user";
  const profile = {
    ...rawProfile,
    id: rawProfile.id ?? fallbackId,
  } as UserState["profile"];
  const spend = state?.spend;

  const primary = primaryGoal(state);
  if (primary.kind === "none") {
    gaps.push({
      kind: "goal_missing",
      subject: profile.id,
      reason: "Chưa biết người này muốn gì. Không mục tiêu thì không có hàm chấm điểm nào áp được (§10).",
    });
  } else if (primary.kind === "ambiguous") {
    gaps.push({
      kind: "goal_priority_ambiguous",
      subject: profile.id,
      reason:
        "Nhiều mục tiêu cùng mức ưu tiên. §10 dùng hàm chấm điểm khác nhau cho từng loại, nên chọn bừa một cái là để id quyết định khuyến nghị. Danh sách ứng viên tra bằng `primaryGoal(state)`.",
    });
  }

  /* --- Hồ sơ --- */

  // KHÔNG có chỗ trống cho `province`. Trường đó vẫn được lưu — điều khoản
  // offer của một số ngân hàng viết khác cho Quebec, và ngày có luật đó thì
  // cần ngay — nhưng HÔM NAY không một dòng dữ liệu nào phụ thuộc vào nó: cả
  // 34 luật `residency` đều là "CA", không luật nào theo tỉnh bang.
  //
  // Một chỗ trống không chặn điều gì mà vẫn khai ra là một câu hỏi cạnh tranh
  // suất với những câu thật sự đổi kết quả (§30), và một điểm trừ độ tin cậy
  // không có lý do (§29). Thêm luật theo tỉnh bang thì thêm lại chỗ trống này.

  // Mọi phép so ở đây dùng `== null` để bắt CẢ `undefined`: một dòng database
  // cũ thiếu trường mới thêm phải sinh ra chỗ trống, chứ không được trượt qua
  // im lặng thành "đã biết". Validator báo riêng rằng trường bị thiếu.
  if (profile.personalIncomeDeclined) {
    // Vẫn là chỗ chưa biết — nhưng là chỗ KHÔNG hỏi được. Phase 3 phải hạ độ
    // tin cậy vĩnh viễn ở đây thay vì xếp nó thành câu hỏi tiếp theo (§30).
    gaps.push({
      kind: "personal_income_declined",
      subject: profile.id,
      reason: "Người dùng từ chối nói thu nhập cá nhân. Đừng hỏi lại; hãy hạ độ tin cậy của kết luận dựa vào điều kiện thu nhập.",
    });
  } else if (profile.annualPersonalIncome == null) {
    gaps.push({
      kind: "personal_income_unknown",
      subject: profile.id,
      reason:
        "Chưa biết khoảng thu nhập cá nhân. Không đánh giá được điều kiện thu nhập, nên phải coi là CHƯA BIẾT chứ không được coi là đạt.",
    });
  }
  if (profile.householdIncomeDeclined) {
    gaps.push({
      kind: "household_income_declined",
      subject: profile.id,
      reason: "Người dùng từ chối nói thu nhập hộ gia đình. Đừng hỏi lại; vế HOẶC của điều kiện thu nhập sẽ không đánh giá được.",
    });
  } else if (profile.annualHouseholdIncome == null) {
    gaps.push({
      kind: "household_income_unknown",
      subject: profile.id,
      reason:
        "Chưa biết thu nhập hộ gia đình. Chỉ đổi kết quả khi thu nhập cá nhân không đủ — vế HOẶC của điều kiện sinh ra để cứu đúng những ca đó.",
    });
  }
  // Nước ở quyết định luật `residency`, và luật đó áp cho MỌI thẻ. Thiếu nó
  // thì `evaluateEligibility` trả `unknown` cho toàn bộ tập ứng viên — mọi thẻ
  // bị phạt và kèm cảnh báo cùng lúc. Không khai chỗ trống này thì §29 không
  // hạ độ tin cậy và §30 đi hỏi những câu chẳng liên quan, trong khi đây là
  // câu DUY NHẤT gỡ được cả bảng.
  if (profile.country == null) {
    gaps.push({
      kind: "country_unknown",
      subject: profile.id,
      reason:
        "Chưa biết người này ở nước nào. Luật cư trú áp cho MỌI thẻ, nên thiếu nó thì cả tập ứng viên đều ở trạng thái chưa đánh giá được.",
    });
  }

  if (profile.isStudent == null) {
    gaps.push({
      kind: "student_status_unknown",
      subject: profile.id,
      reason:
        "Chưa biết có phải sinh viên không. Thẻ sinh viên có điều kiện `hard`; không biết thì không loại mà cũng không khuyên được.",
    });
  }

  if (profile.annualFeeTolerancePerCard == null) {
    gaps.push({
      kind: "annual_fee_tolerance_unknown",
      subject: profile.id,
      reason:
        "Chưa biết mức phí thường niên chấp nhận được. Đây là ranh giới phù-hợp/không-phù-hợp của §14, không phải điều kiện cứng.",
    });
  }

  if (profile.businessCardsAllowed == null) {
    gaps.push({
      kind: "business_cards_preference_unknown",
      subject: profile.id,
      reason:
        "Chưa biết có MUỐN xét thẻ doanh nghiệp không. 4/34 sản phẩm là thẻ doanh nghiệp, nên mặc định theo hướng nào cũng lệch kết quả.",
    });
  }
  if (profile.hasBusiness == null) {
    gaps.push({
      kind: "business_ownership_unknown",
      subject: profile.id,
      reason:
        "Chưa biết có doanh nghiệp không. Đây là ĐIỀU KIỆN (`business_required`, hard, 4 sản phẩm), khác với việc có muốn xét thẻ doanh nghiệp hay không.",
    });
  }

  /* --- Chi tiêu --- */

  if (spend == null) {
    // Gộp làm một chỗ trống thô. Nó đã hàm ý mọi thứ bên dưới — tổng tháng,
    // sức chi 3 tháng, cả mười bảy hạng mục — nên liệt kê thêm chỉ làm danh
    // sách phình ra mà không thêm một dữ kiện nào.
    gaps.push({
      kind: "spend_profile_missing",
      subject: profile.id,
      reason: "Người dùng chưa động tới phần chi tiêu. Chưa biết gì về tổng tháng, hạng mục, hay sức chi 3 tháng.",
    });
  } else {
    if (spend.monthlyTotal == null) {
      gaps.push({
        kind: "monthly_total_unknown",
        subject: profile.id,
        reason: "Chưa biết tổng chi tiêu tháng.",
      });
    }
    if (spend.minimumSpendCapacity3m == null) {
      gaps.push({
        kind: "minimum_spend_capacity_unknown",
        subject: profile.id,
        reason:
          "Chưa biết chi tiêu dồn được sang thẻ mới trong 3 tháng. §13 so chính con số này với mốc chi của welcome offer, và nó KHÔNG suy được từ tổng tháng.",
      });
    }
    for (const category of SPEND_CATEGORIES) {
      if (spend.byCategory?.[category] == null) {
        gaps.push({
          kind: "spend_category_unknown",
          subject: category,
          reason: `Chưa biết chi tiêu cho "${category}". Vắng mặt là chưa hỏi, không phải bằng không.`,
        });
      }
    }
  }

  /* --- Thẻ --- */

  if (!state.declared?.cards) {
    gaps.push({
      kind: "cards_undeclared",
      subject: profile.id,
      reason:
        "Người dùng chưa trả lời câu hỏi thẻ đang giữ. Danh sách rỗng ở đây KHÔNG có nghĩa là không có thẻ nào.",
    });
  }

  for (const card of [...asArray(state.cards)].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (!holdsNow(card) && card.closedDate == null) {
      gaps.push({
        kind: "card_closed_date_unknown",
        subject: card.id,
        reason:
          "Từng giữ thẻ này nhưng không biết đóng khi nào. Luật 'không có bonus nếu từng giữ trong N tháng qua' không đánh giá được; luật trọn đời của Amex® thì vẫn áp bình thường.",
      });
    }
  }

  /* --- Số dư điểm --- */

  if (!state.declared?.balances) {
    gaps.push({
      kind: "balances_undeclared",
      subject: profile.id,
      reason:
        "Người dùng chưa trả lời câu hỏi số dư điểm. Danh sách rỗng ở đây KHÔNG có nghĩa là không có điểm nào.",
    });
  }

  // Gom theo CHƯƠNG TRÌNH, không theo dòng: một chương trình có hai dòng chỉ
  // sinh MỘT chỗ trống, và hai dòng nói hai số khác nhau cũng là "chưa biết"
  // y như một dòng `null`.
  //
  // `usableBalance` là ĐÚNG hàm mà `portfolio.ts` dùng để quyết định số dư có
  // dùng được không. Đọc giá trị thô ở đây thay vì gọi nó thì engine coi một
  // số dư âm là chưa biết trong khi chỗ này báo là đã biết — không sinh chỗ
  // trống, không hạ độ tin cậy, không hỏi lại.
  const balanceByProgram = new Map<string, (number | null)[]>();
  for (const row of asArray(state.balances)) {
    if (row?.programId == null) continue;
    const list = balanceByProgram.get(row.programId) ?? [];
    list.push(usableBalance(row.balance));
    balanceByProgram.set(row.programId, list);
  }
  for (const programId of [...balanceByProgram.keys()].sort()) {
    const values = [...new Set(balanceByProgram.get(programId))];
    if (values.length === 1 && values[0] !== null) continue;
    gaps.push({
      kind: "point_balance_amount_unknown",
      subject: programId,
      reason:
        "Có tài khoản chương trình này nhưng chưa biết số dư (chưa khai, số không hợp lệ, hoặc nhiều dòng nói khác nhau). Chặng chuyển điểm vẫn dùng được; chỉ con số là chưa biết.",
    });
  }

  /* --- Chuyến đi --- */

  for (const goal of [...asArray(state.goals)].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (goal.type !== "trip") continue;
    if (goal.cabin == null) {
      gaps.push({
        kind: "trip_cabin_unknown",
        subject: goal.id,
        reason: "Chưa biết hạng ghế. Cùng một chặng, business tốn gấp đôi tới gấp ba economy.",
      });
    }
    if (usablePassengers(goal.passengers) === null) {
      gaps.push({
        kind: "trip_passengers_unknown",
        subject: goal.id,
        reason:
          "Chưa biết số người bay. Mặc định 1 sẽ chia nhỏ số điểm cần và làm NO_NEW_CARD thắng nhờ một giả định.",
      });
    }
    if (goal.flexibility == null) {
      gaps.push({
        kind: "trip_flexibility_unknown",
        subject: goal.id,
        reason:
          "Chưa biết mức linh hoạt của chuyến đi. §10.2 dành 10% điểm cho Flexibility Value, nên mặc định 'medium' là tự cho điểm một thứ chưa ai nói.",
      });
    }
    if (usableRoundTrip(goal.roundTrip) === null) {
      gaps.push({
        kind: "trip_round_trip_unknown",
        subject: goal.id,
        reason:
          "Chưa biết khứ hồi hay một chiều. Số điểm cần = points × số người × (khứ hồi ? 2 : 1), nên thiếu thừa số này là sai đúng 100%.",
      });
    }
    if (goal.travelStart == null && goal.travelEnd == null) {
      gaps.push({
        kind: "trip_dates_unknown",
        subject: goal.id,
        reason:
          "Chưa biết thời gian đi. Không biết còn bao lâu thì không nói được mốc chi của welcome offer có kịp hay không.",
      });
    }
  }

  return gaps;
}
