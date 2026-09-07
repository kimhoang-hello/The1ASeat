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
 * Danh sách trả về có THỨ TỰ CỐ ĐỊNH. Phase 4 chụp lại trạng thái đầu vào của
 * mỗi lượt chạy (§20) và so hai lượt với nhau; một thứ tự đổi theo thứ tự khoá
 * của object sẽ làm hai lượt giống hệt nhau trông như đã khác đi.
 */

import { SPEND_CATEGORIES } from "./types.ts";
import { holdsNow } from "./user.ts";
import type { UserDataGap, UserState } from "./user-types.ts";

export function userGaps(state: UserState): UserDataGap[] {
  const gaps: UserDataGap[] = [];
  const { profile, spend } = state;

  if (state.goals.length === 0) {
    gaps.push({
      kind: "goal_missing",
      subject: profile.id,
      reason: "Chưa biết người này muốn gì. Không mục tiêu thì không có hàm chấm điểm nào áp được (§10).",
    });
  }

  /* --- Hồ sơ --- */

  if (profile.province === null) {
    gaps.push({
      kind: "province_unknown",
      subject: profile.id,
      reason: "Chưa biết tỉnh bang. Điều khoản offer của một số ngân hàng viết khác cho Quebec.",
    });
  }

  if (profile.annualIncome === null) {
    gaps.push({
      kind: "income_unknown",
      subject: profile.id,
      reason:
        "Chưa biết khoảng thu nhập. Không đánh giá được điều kiện thu nhập, nên phải coi là CHƯA BIẾT chứ không được coi là đạt.",
    });
  }

  if (profile.annualFeeTolerancePerCard === null) {
    gaps.push({
      kind: "annual_fee_tolerance_unknown",
      subject: profile.id,
      reason:
        "Chưa biết mức phí thường niên chấp nhận được. Đây là ranh giới phù-hợp/không-phù-hợp của §14, không phải điều kiện cứng.",
    });
  }

  if (profile.businessCardsAllowed === null) {
    gaps.push({
      kind: "business_cards_preference_unknown",
      subject: profile.id,
      reason:
        "Chưa biết có nhận thẻ doanh nghiệp không. 4/34 sản phẩm là thẻ doanh nghiệp, nên mặc định theo hướng nào cũng lệch kết quả.",
    });
  }

  /* --- Chi tiêu --- */

  if (spend === null) {
    // Gộp làm một chỗ trống thô. Nó đã hàm ý mọi thứ bên dưới — tổng tháng,
    // sức chi 3 tháng, cả mười bảy hạng mục — nên liệt kê thêm chỉ làm danh
    // sách phình ra mà không thêm một dữ kiện nào.
    gaps.push({
      kind: "spend_profile_missing",
      subject: profile.id,
      reason: "Người dùng chưa động tới phần chi tiêu. Chưa biết gì về tổng tháng, hạng mục, hay sức chi 3 tháng.",
    });
  } else {
    if (spend.monthlyTotal === null) {
      gaps.push({
        kind: "monthly_total_unknown",
        subject: profile.id,
        reason: "Chưa biết tổng chi tiêu tháng.",
      });
    }
    if (spend.minimumSpendCapacity3m === null) {
      gaps.push({
        kind: "minimum_spend_capacity_unknown",
        subject: profile.id,
        reason:
          "Chưa biết chi tiêu dồn được sang thẻ mới trong 3 tháng. §13 so chính con số này với mốc chi của welcome offer, và nó KHÔNG suy được từ tổng tháng.",
      });
    }
    for (const category of SPEND_CATEGORIES) {
      if (spend.byCategory[category] === undefined) {
        gaps.push({
          kind: "spend_category_unknown",
          subject: category,
          reason: `Chưa biết chi tiêu cho "${category}". Vắng mặt là chưa hỏi, không phải bằng không.`,
        });
      }
    }
  }

  /* --- Thẻ --- */

  if (!state.declared.cards) {
    gaps.push({
      kind: "cards_undeclared",
      subject: profile.id,
      reason:
        "Người dùng chưa trả lời câu hỏi thẻ đang giữ. Danh sách rỗng ở đây KHÔNG có nghĩa là không có thẻ nào.",
    });
  }

  for (const card of state.cards) {
    if (!holdsNow(card) && card.closedDate === null) {
      gaps.push({
        kind: "card_closed_date_unknown",
        subject: card.id,
        reason:
          "Từng giữ thẻ này nhưng không biết đóng khi nào. Luật 'không có bonus nếu từng giữ trong N tháng qua' không đánh giá được; luật trọn đời của Amex® thì vẫn áp bình thường.",
      });
    }
  }

  /* --- Số dư điểm --- */

  if (!state.declared.balances) {
    gaps.push({
      kind: "balances_undeclared",
      subject: profile.id,
      reason:
        "Người dùng chưa trả lời câu hỏi số dư điểm. Danh sách rỗng ở đây KHÔNG có nghĩa là không có điểm nào.",
    });
  }

  for (const row of state.balances) {
    if (row.balance === null) {
      gaps.push({
        kind: "point_balance_amount_unknown",
        subject: row.programId,
        reason:
          "Có tài khoản chương trình này nhưng chưa biết số dư. Chặng chuyển điểm vẫn dùng được; chỉ con số là chưa biết.",
      });
    }
  }

  /* --- Chuyến đi --- */

  for (const goal of state.goals) {
    if (goal.type !== "trip") continue;
    if (goal.cabin === null) {
      gaps.push({
        kind: "trip_cabin_unknown",
        subject: goal.id,
        reason: "Chưa biết hạng ghế. Cùng một chặng, business tốn gấp đôi tới gấp ba economy.",
      });
    }
    if (goal.passengers === null) {
      gaps.push({
        kind: "trip_passengers_unknown",
        subject: goal.id,
        reason:
          "Chưa biết số người bay. Mặc định 1 sẽ chia nhỏ số điểm cần và làm NO_NEW_CARD thắng nhờ một giả định.",
      });
    }
    if (goal.travelStart === null && goal.travelEnd === null) {
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
