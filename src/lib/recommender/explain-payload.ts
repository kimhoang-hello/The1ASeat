/**
 * Phase 6 — thứ DUY NHẤT Claude được đọc khi dựng lời giải thích.
 *
 * Ranh giới (spec §28): LLM chỉ là lớp kể lại. Engine đã chọn hành động, đã xếp
 * hạng, đã phát mã; `present.ts` đã dịch mã thành câu. File này gói những câu
 * đó thành DỮ KIỆN: mỗi dữ kiện là một MỆNH ĐỀ tiếng Việt viết sẵn, có id, có
 * nhãn, có vai trò.
 *
 * CLAUDE KHÔNG VIẾT CHỮ. Nó chỉ chọn dữ kiện, gom và sắp thứ tự, kèm một câu
 * dẫn lấy từ danh sách đóng (`explain-check.ts`); trang ghép câu từ đúng các
 * mệnh đề dưới đây. Vì sao không cho viết tự do: hai vòng Codex chứng minh một
 * cửa kiểm văn bản không chứng minh được NGHĨA — đổi chỗ hai con số, dời một
 * chữ "không", ghép hai dữ kiện thành một lời hứa đều đi qua mọi phép so chữ.
 * Chỉ khi chữ trên trang là chữ viết sẵn thì "LLM không bịa được" mới là một
 * tính chất của cấu trúc, không phải của may mắn.
 *
 * BA NHÃN, và vì sao mỗi dữ kiện mang nhãn đó:
 *
 *  `verified`  — chép từ trang của ngân hàng (welcome bonus, phí thường niên) kèm
 *                ngày kiểm, hoặc điều CHÍNH người dùng đã khai (chuyến bay).
 *  `estimate`  — số engine tự tính mà chưa ai kiểm được: điểm một chuyến bay
 *                cần, điểm với tới được, phần thiếu, phần phủ. Mệnh đề của
 *                chúng tự mang chữ "ước lượng", nên nhãn không mất được.
 *  `editorial` — phán đoán của Ghế 1A: lý do, điểm mạnh, hướng đi.
 *
 * KHÔNG CÓ Ở ĐÂY, và phải giữ như vậy:
 *
 *  - hồ sơ người dùng, số dư từng dòng, id phiên, `runId` — log của nhà cung cấp
 *    LLM không được thành bản sao hồ sơ tài chính của người đọc;
 *  - lựa chọn thay thế, điểm số, bảng điểm — không có gì để chọn lại hay xếp lại;
 *  - link đăng ký và cờ affiliate (§16 Rule 7) — `explain.test.ts` đổi cờ
 *    affiliate của mọi thẻ và đòi payload y hệt từng byte;
 *  - cảnh báo, điều cần cân nhắc, độ chắc chắn — trang in chúng nguyên văn bằng
 *    bảng tra, ngoài tầm tay của Claude.
 *
 * Hàm thuần: cùng `ResultView` → cùng payload. Xoá cả Phase 6 thì `presentRun`
 * vẫn cho ra đúng trang Phase 5.
 */

import { NO_CARD_SENTENCE } from "./copy.ts";
import { formatPoints, formatPointsRange, type ResultView } from "./present.ts";

export type FactBasis = "verified" | "estimate" | "editorial";

/**
 * Dữ kiện nói về CHUYỆN GÌ — quyết định câu dẫn nào được giới thiệu nó. "Những
 * điểm mình cân nhắc cho thẻ này:" chỉ đứng trước điều engine đã cân nhắc, không
 * trước phí thường niên: ghép sai vai là dựng một quan hệ không ai nói.
 */
export type FactRole = "reason" | "offer" | "trip" | "context";

export interface ExplanationFact {
  /** Ngắn, ổn định giữa các lượt — Claude trả về id, không trả về chữ. */
  id: string;
  basis: FactBasis;
  role: FactRole;
  /**
   * Mệnh đề HIỆN NGUYÊN VĂN trên trang, sau một câu dẫn: chữ thường đầu câu
   * (trừ tên riêng), không dấu chấm cuối, nói với người đọc là "bạn".
   */
  text: string;
}

export interface ExplanationPayload {
  /** Hành động chính — đã chọn, không bàn lại. */
  action: { kind: "open_card" | "no_new_card"; name: string };
  goal: string;
  facts: ExplanationFact[];
  /** Ngày kiểm của dòng dữ liệu cũ nhất — chú thích nhãn "Dữ kiện" mang ngày này. */
  dataVerifiedAt: string | null;
}

/** "2026-09-16" → "16/09/2026", cách site viết ngày. */
export function vietnameseDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Câu hoàn chỉnh của bảng tra → mệnh đề đứng sau câu dẫn.
 *
 * Hạ chữ đầu trừ khi đó là tên riêng viết hoa liền ("RBC®", "TD®"); bỏ dấu chấm
 * cuối để câu dẫn tự đóng câu.
 */
export function asClause(sentence: string): string {
  const trimmed = sentence.trim().replace(/\.$/u, "");
  const [first, second] = [...trimmed];
  if (first === undefined) return trimmed;
  const acronym = second !== undefined && second !== second.toLowerCase();
  return acronym ? trimmed : first.toLowerCase() + trimmed.slice(first.length);
}

export function explanationPayload(view: ResultView): ExplanationPayload {
  const action = view.primary;
  const facts: ExplanationFact[] = [];
  const add = (id: string, basis: FactBasis, role: FactRole, text: string) =>
    facts.push({ id, basis, role, text: asClause(text) });

  if (action.kind === "no_new_card") {
    add("no_card", "editorial", "reason", NO_CARD_SENTENCE[action.noCardReason ?? "default"]);
  } else {
    action.reasons
      .filter((row) => row.tone === "good")
      .forEach((row, index) => add(`reason_${index + 1}`, "editorial", "reason", row.text));
    action.strengths.forEach((row, index) =>
      add(`strength_${index + 1}`, "editorial", "reason", `bảng điểm của thẻ mạnh ở phần ${row}`),
    );
    // Bonus bị chặn thì con số bonus KHÔNG vào payload — không có mệnh đề nào
    // để ghép thành lời hứa.
    if (action.welcomeBonusBlocked) {
      add(
        "bonus_blocked",
        "verified",
        "offer",
        "theo điều khoản của ngân hàng và những thẻ bạn đã khai, bạn không nhận được welcome bonus của thẻ này",
      );
    } else {
      if (action.welcomeBonus !== null) {
        add("bonus", "verified", "offer", `welcome bonus hiện hành là ${action.welcomeBonus}`);
      }
      // KHÔNG có mốc chi: `minSpendPer90Days` là con số QUY ĐỔI về mỗi 90 ngày
      // để so với sức dồn chi tiêu, không phải điều khoản. Một offer đòi $3,000
      // trong 90 ngày VÀ $12,000 trong 365 ngày thì "nhận trọn bonus với $3,000
      // trong 3 tháng" là sai — mà lại mang nhãn "Dữ kiện" (Codex vòng 3).
    }
    if (action.annualFee !== null) {
      add("fee", "verified", "offer", `phí thường niên là ${action.annualFee}`);
    }
    if (action.eligibilityUncertain) {
      add(
        "eligibility_unknown",
        "editorial",
        "context",
        "mình chưa kiểm được hết điều kiện mở thẻ của ngân hàng với thông tin bạn đã cho, nên ngân hàng vẫn có thể từ chối",
      );
    }
  }

  add("strategy", "editorial", "context", `hướng đi mình chọn cho mục tiêu này là: ${asClause(view.strategy)}`);

  const trip = view.trip;
  if (trip !== null) {
    const parts = [
      trip.destination,
      trip.cabin?.toLowerCase() ?? null,
      trip.passengers === null ? null : `${trip.passengers} người`,
      trip.roundTrip === null ? null : trip.roundTrip ? "khứ hồi" : "một chiều",
    ].filter((part): part is string => part !== null);
    add("trip", "verified", "trip", `bạn muốn bay ${parts.join(", ")}`);
    if (trip.routeNotPriced) {
      add(
        "trip_not_priced",
        "editorial",
        "trip",
        "chặng này chưa có trong award chart của site, nên mình chưa tính được số điểm cần",
      );
    } else {
      const need = formatPointsRange(trip.needLow, trip.needHigh);
      if (need !== null) {
        add(
          "trip_need",
          "estimate",
          "trip",
          `theo ước lượng từ award chart, chuyến này cần khoảng ${need} điểm, và con số đổi theo ngày bay`,
        );
      }
      if (trip.accessible !== null) {
        add(
          "trip_reach",
          "estimate",
          "trip",
          `theo ước lượng từ số dư bạn khai, bạn với tới được ${trip.accessibleIsLowerBound ? "ít nhất " : ""}${formatPoints(trip.accessible)} điểm`,
        );
      }
      if (trip.gap !== null) {
        add("trip_gap", "estimate", "trip", `theo ước lượng, bạn còn thiếu khoảng ${formatPoints(trip.gap)} điểm`);
      }
      if (trip.coverage !== null) {
        add(
          "trip_coverage",
          "estimate",
          "trip",
          `theo ước lượng, điểm hiện tại phủ khoảng ${Math.round(trip.coverage * 100)}% chuyến này`,
        );
      }
    }
  }

  return {
    action: { kind: action.kind, name: action.kind === "no_new_card" ? "Chưa cần mở thẻ mới" : action.name },
    goal: view.goalTitle,
    facts,
    dataVerifiedAt: view.dataVerifiedAt,
  };
}
