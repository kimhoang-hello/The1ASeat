/**
 * Phase 6 — thứ DUY NHẤT Claude được đọc khi viết lời giải thích.
 *
 * Ranh giới (spec §28): LLM chỉ là lớp kể lại. Engine đã chọn hành động, đã xếp
 * hạng, đã phát mã; `present.ts` đã dịch mã thành câu. File này gói đúng những
 * câu đó thành DỮ KIỆN có id và có NHÃN, để:
 *
 *  - Claude chỉ nói được điều có trong dữ kiện, và phải trích id cho mỗi câu;
 *  - `explain-check.ts` đối chiếu từng câu Claude viết với đúng dữ kiện nó trích
 *    (con số, nhãn, tên sản phẩm) — một câu dặn trong prompt không phải cửa kiểm;
 *  - trang hiện được nhãn "đã kiểm / ước lượng / nhận định" cạnh từng câu.
 *
 * BA NHÃN, và vì sao mỗi dữ kiện mang nhãn đó:
 *
 *  `verified`  — chép từ trang của ngân hàng (welcome bonus, phí, mốc chi) kèm
 *                ngày kiểm, hoặc điều CHÍNH người dùng đã khai (chuyến bay).
 *  `estimate`  — số engine tự tính mà chưa ai kiểm được: điểm một chuyến bay
 *                cần (award chart, đổi theo ngày bay), điểm với tới được, phần
 *                thiếu, phần phủ.
 *  `editorial` — phán đoán của Ghế 1A: lý do, điểm mạnh, hướng đi.
 *                Đúng theo luật của engine, nhưng là nhận định, không phải dữ kiện.
 *
 * KHÔNG CÓ Ở ĐÂY, và phải giữ như vậy:
 *
 *  - hồ sơ người dùng, số dư từng dòng, id phiên, `runId` — log của nhà cung cấp
 *    LLM không được thành bản sao hồ sơ tài chính của người đọc;
 *  - lựa chọn thay thế — Claude không được biết thẻ nào đứng thứ hai thì không
 *    "chọn lại" được;
 *  - điểm số và bảng điểm — không có gì để xếp lại;
 *  - link đăng ký và cờ affiliate (§16 Rule 7) — `explain.test.ts` đổi cờ
 *    affiliate của mọi thẻ và đòi payload y hệt từng byte.
 *
 * Hàm thuần: cùng `ResultView` → cùng payload. Không đọc môi trường, không gọi
 * mạng — xoá cả Phase 6 thì `presentRun` vẫn cho ra đúng trang Phase 5.
 */

import { NO_CARD_SENTENCE } from "./copy.ts";
import { formatPoints, formatPointsRange, type ResultView } from "./present.ts";

export type FactBasis = "verified" | "estimate" | "editorial";

export interface ExplanationFact {
  /** Ngắn, ổn định giữa các lượt — Claude trích nó, cửa kiểm tra theo nó. */
  id: string;
  basis: FactBasis;
  text: string;
}

export interface ExplanationPayload {
  /** Hành động chính — đã chọn, không bàn lại. */
  action: { kind: "open_card" | "no_new_card"; name: string };
  goal: string;
  /** Dữ kiện được TRÍCH. Mỗi câu Claude viết phải dựa trên ít nhất một cái. */
  facts: ExplanationFact[];
  /**
   * Cảnh báo và điều cần cân nhắc — trang hiện NGUYÊN VĂN ngay dưới lời giải
   * thích. Đưa cho Claude chỉ để nó không viết câu nào ngược lại chúng; nó
   * không được trích, không được nhắc lại, nên cũng không diễn đạt lại nhẹ đi
   * được.
   */
  cautions: string[];
  /** Ngày kiểm của dòng dữ liệu cũ nhất — nhãn `verified` trên trang mang ngày này. */
  dataVerifiedAt: string | null;
}

/** "2026-09-16" → "16/09/2026", cách site viết ngày. */
export function vietnameseDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function explanationPayload(view: ResultView): ExplanationPayload {
  const action = view.primary;
  const facts: ExplanationFact[] = [];
  const add = (id: string, basis: FactBasis, text: string) => facts.push({ id, basis, text });
  const checked = view.dataVerifiedAt === null ? "" : ` (kiểm ngày ${vietnameseDate(view.dataVerifiedAt)})`;

  add("goal", "editorial", `Mục tiêu người dùng chọn: ${view.goalTitle}.`);
  add("strategy", "editorial", `Hướng đi Ghế 1A chọn cho mục tiêu này: ${view.strategy}.`);

  if (action.kind === "no_new_card") {
    add("no_card", "editorial", NO_CARD_SENTENCE[action.noCardReason ?? "default"]);
  } else {
    // Bonus bị chặn thì con số bonus KHÔNG vào payload: không có trong dữ kiện
    // thì cửa kiểm số chặn được mọi câu hứa nó.
    if (action.welcomeBonusBlocked) {
      add(
        "bonus_blocked",
        "verified",
        "Theo điều khoản của ngân hàng và những thẻ người dùng đã khai, người dùng KHÔNG nhận được welcome bonus của thẻ này.",
      );
    } else {
      if (action.welcomeBonus !== null) {
        add("bonus", "verified", `Welcome bonus hiện hành của thẻ: ${action.welcomeBonus}${checked}.`);
      }
      if (action.minSpendPer90Days !== null) {
        add(
          "min_spend",
          "verified",
          `Mốc chi để nhận trọn welcome bonus, quy về 3 tháng: $${action.minSpendPer90Days.toLocaleString("en-US")}${checked}.`,
        );
      }
    }
    if (action.annualFee !== null) {
      add("fee", "verified", `Phí thường niên: ${action.annualFee}${checked}.`);
    }
    // Chỉ lý do ỦNG HỘ được trích. Lý do cần cân nhắc đi vào `cautions`: trang
    // in chúng nguyên văn, và một đoạn văn "vì sao hợp" không được là nơi
    // chúng bị nói nhẹ đi.
    action.reasons
      .filter((row) => row.tone === "good")
      .forEach((row, index) => add(`reason_${index + 1}`, "editorial", row.text));
    action.strengths.forEach((row, index) =>
      add(`strength_${index + 1}`, "editorial", `Một thế mạnh trong bảng điểm của thẻ: ${row}.`),
    );
    if (action.eligibilityUncertain) {
      add(
        "eligibility_unknown",
        "editorial",
        "Ghế 1A chưa kiểm được hết điều kiện mở thẻ của ngân hàng với thông tin người dùng đã cho; ngân hàng vẫn có thể từ chối.",
      );
    }
  }

  // Độ chắc chắn KHÔNG vào dữ kiện: trang in nó nguyên văn ngay dưới, và một
  // câu văn diễn đạt lại "mức tin cậy" rất dễ trượt thành "chắc chắn được"
  // — đúng lời hứa §28 cấm.

  const trip = view.trip;
  if (trip !== null) {
    const parts = [
      trip.destination,
      trip.cabin?.toLowerCase() ?? null,
      trip.passengers === null ? null : `${trip.passengers} người`,
      trip.roundTrip === null ? null : trip.roundTrip ? "khứ hồi" : "một chiều",
    ].filter((part): part is string => part !== null);
    add("trip", "verified", `Chuyến bay người dùng khai: bay ${parts.join(", ")}.`);
    if (trip.routeNotPriced) {
      add("trip_not_priced", "editorial", "Chặng này chưa có trong award chart của site, nên chưa tính được số điểm cần.");
    } else {
      const need = formatPointsRange(trip.needLow, trip.needHigh);
      if (need !== null) {
        add(
          "trip_need",
          "estimate",
          `Số điểm chuyến bay cần, ước lượng theo award chart và đổi theo ngày bay: ${need} điểm.`,
        );
      }
      if (trip.accessible !== null) {
        add(
          "trip_reach",
          "estimate",
          `Số điểm người dùng với tới được, ước lượng từ số dư đã khai: ${formatPoints(trip.accessible)} điểm${trip.accessibleIsLowerBound ? " (ít nhất)" : ""}.`,
        );
      }
      if (trip.gap !== null) {
        add("trip_gap", "estimate", `Phần điểm còn thiếu, ước lượng: ${formatPoints(trip.gap)} điểm.`);
      }
      if (trip.coverage !== null) {
        add(
          "trip_coverage",
          "estimate",
          `Điểm hiện tại phủ khoảng ${Math.round(trip.coverage * 100)}% chuyến này (ước lượng).`,
        );
      }
    }
  }

  return {
    action: { kind: action.kind, name: action.kind === "no_new_card" ? "Chưa cần mở thẻ mới" : action.name },
    goal: view.goalTitle,
    facts,
    cautions: [
      ...action.reasons.filter((row) => row.tone !== "good").map((row) => row.text),
      ...view.warnings,
    ],
    dataVerifiedAt: view.dataVerifiedAt,
  };
}
