/**
 * `score_card_for_cash()` — "tôi muốn điểm quy đổi được thành tiền."
 *
 * **TRỌNG SỐ Ở ĐÂY LÀ LỰA CHỌN CỦA ENGINE, KHÔNG PHẢI CỦA SPEC.** §10 không
 * biết tới ý định này; nó ra đời sau, cùng lúc với cột định giá `cash`
 * (`RedemptionMode`). Nói ra chỗ đó thay vì để bảng trông như bốn bảng có
 * nguồn — `WEIGHT_SOURCE` lặp lại điều này cho debugger.
 *
 * ```
 * 35% Long-term Earn Fit   ← tích được bao nhiêu TIỀN mỗi năm
 * 25% Offer Quality
 * 15% Currency Fit         ← đồng tiền này rút ra tiền tốt tới đâu
 * 10% Fee Drag             ← phí ăn mất bao nhiêu phần tích được
 * 10% Spend Fit
 *  5% Editorial Adjustment ← §15 chưa làm, áp ở `rules.ts`
 * ```
 *
 * GẦN `earning.ts` NHƯNG KHÔNG PHẢI NÓ, và chỗ khác nhau là lý do ý định này
 * tồn tại riêng:
 *
 *   — `long_term_earn_fit` ở đây đọc cột TIỀN MẶT (xem `earnFitComponent` và
 *     `valuationModeFor`). Cùng một thẻ TD® ra hai con số khác nhau ở hai
 *     bảng, và con số thấp hơn mới là con số người hỏi câu này sẽ nhận.
 *   — 35% thay vì 40%, phần chênh dồn sang `offer_quality` (25% thay vì 15%).
 *     Người tích điểm dài hạn sống bằng tỷ lệ hằng ngày; người muốn quy ra
 *     tiền thì welcome bonus LÀ khoản tiền lớn nhất của năm đầu, và nó về
 *     thẳng túi chứ không phải chờ đổi được một chỗ ngồi.
 *   — `currency_fit` chỉ 15%: nhu cầu đồng tiền ở mục tiêu này đã được `needs.ts`
 *     tính từ chính tỷ lệ rút tiền, nên để nó nặng bằng `earning.ts` (20%) là
 *     đếm hai lần cùng một dữ kiện — nó đã nằm trong `long_term_earn_fit` rồi.
 *
 * Không có thành phần "quyền lợi": người hỏi câu này hỏi về tiền, và một
 * phòng chờ sân bay không phải tiền. Phí thì có, vì phí LÀ tiền, và nó đi
 * ngược dấu.
 *
 * GIỚI HẠN ĐÃ BIẾT, nói thẳng (vòng Codex 7). Với một đồng điểm
 * `cashOut: "unknown"`, chỉ `fee_drag` ở đây trung tính hoá; hai thành phần
 * nặng nhất — `long_term_earn_fit` và `offer_quality`, cộng 60% — vẫn nhận
 * đúng 0, vì `earnFitFor` và `offerFacts` không có tỷ lệ nào để nhân. Nên
 * một thẻ chưa tra vẫn chìm, chỉ là chìm ÍT hơn và có mã `CASH_VALUE_UNPRICED`
 * nói ra vì sao.
 *
 * Để nguyên vì hôm nay KHÔNG chương trình nào còn `unknown` (xem
 * `points-programs.ts`), và vì cách sửa đúng là một quyết định sản phẩm chứ
 * không phải một phép tính: hoặc bỏ hẳn hai thành phần đó ra khỏi bảng rồi để
 * §10 chuẩn hoá lại trên phần còn lại — nhưng khi đó thẻ được chấm trên 35%
 * bảng và có thể thắng nhờ đúng những phần nó mạnh — hoặc loại thẻ khỏi mục
 * tiêu này hẳn. Cách thứ hai đã được hỏi và user chọn đường khác: đi lấy tỷ
 * lệ thật. Ngày có chương trình `unknown` tiếp theo thì hỏi lại, đừng chọn
 * thay ở đây.
 */

import { currencyFitComponent, earnFitComponent, offerQualityComponent, spendFitComponent } from "./shared.ts";
import { component } from "./weights.ts";
import type { ScoreComponent } from "../engine-types.ts";
import type { CandidateFacts, ScoringContext } from "./context.ts";

export function scoreCash(candidate: CandidateFacts, ctx: ScoringContext): ScoreComponent[] {
  // Phí so với phần tích RA TIỀN, không so với phần tích ra giá trị đổi vé.
  // Dùng `earn` ở đây sẽ nói thẻ TD® First Class Travel bù được phí bằng điểm
  // mà người này không định đổi vé — tức trả lời bằng một phương án họ vừa nói
  // là không dùng.
  //
  // BA CA, không phải hai (vòng Codex 4). "Chưa tính được" và "tính được, ra
  // $0" là hai chuyện khác hẳn, và gộp chúng vào cùng một 0.5 trung tính thì
  // một thẻ phí $139 tích ra ĐÚNG $0 tiền mặt vẫn được cộng điểm — trong khi
  // đó là ca tệ nhất bảng này biết mô tả. Phân biệt bằng thước `best`: tính
  // được ở đó mà ra 0 ở đây nghĩa là đã có đủ dữ liệu, câu trả lời là 0.
  const annual = candidate.earnCash.annualValueCents;
  const fee = candidate.offer.ongoingFeeCents;
  // Con số 0 ở `earnCash` có HAI nguồn, và chúng dẫn tới hai câu trả lời
  // ngược nhau. Amex® Cobalt® tích $1,900/năm theo thước đổi vé và $0 theo
  // thước tiền mặt — KHÔNG phải vì nó vô dụng, mà vì chưa ai tra Membership
  // Rewards® rút ra tiền theo tỷ lệ nào. Chấm nó 0 (mức nặng nhất bảng này
  // biết) là lại một lần nữa đọc "chưa biết" thành "đã biết là không", đúng
  // cái lỗi mục tiêu này sinh ra để khỏi mắc (vòng Codex 5).
  // `some`, không phải `every`: một thẻ tích ra hai đồng điểm mà một cái chưa
  // tra thì con số tiền mặt của nó là CẬN DƯỚI, và chia phí cho một cận dưới
  // ra một mức phạt nặng hơn sự thật. Hôm nay không thẻ nào trong bộ dữ liệu
  // tích ra quá một đồng điểm, nên đây là lựa chọn cho tương lai — nới tay,
  // đúng hướng an toàn.
  const unpriced = candidate.earnCash.programs.some(
    (programId) => ctx.ix.programById.get(programId)?.cashOut === "unknown",
  );
  const computable = candidate.earn.annualValueCents > 0 && !unpriced;
  const feeDrag = !computable
    ? 0.5
    : annual <= 0
      ? // Không tích ra đồng tiền mặt nào, và điều đó ĐÃ ĐƯỢC KIỂM: phí ăn
        // hết phần tích được, dù phí bao nhiêu. Thẻ không phí thì không ăn gì
        // — và đó là điểm KHÁC BIỆT thật giữa hai thẻ cùng vô dụng cho mục
        // tiêu này.
        fee > 0
        ? 0
        : 1
      : Math.max(0, 1 - fee / annual);

  return [
    earnFitComponent(0.35, candidate, ctx),
    offerQualityComponent(0.25, candidate, ctx),
    currencyFitComponent(0.15, candidate, ctx),
    component(
      "fee_drag",
      0.1,
      feeDrag,
      !computable
        ? unpriced
          ? "chưa tra được đồng điểm này rút ra tiền theo tỷ lệ nào — 0.5 trung tính"
          : "chưa tính được phần tích mỗi năm (chưa khai chi tiêu, hoặc thẻ chưa có tỷ lệ nào) — 0.5 trung tính"
        : annual <= 0
          ? `tích ra $0 tiền mặt, phí $${Math.round(fee / 100)}`
          : `1 − phí $${Math.round(fee / 100)} ÷ rút ra $${Math.round(annual / 100)}/năm`,
    ),
    spendFitComponent(0.1, candidate),
  ];
}
