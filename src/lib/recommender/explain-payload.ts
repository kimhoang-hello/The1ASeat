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

import type { ReasonCode } from "../recommendation/reason-codes.ts";
import { COMPONENT_STRENGTH, NO_CARD_SENTENCE } from "./copy.ts";
import { coverageStatement, formatNeed, formatPoints, vietnameseDate, type ResultView } from "./present.ts";

/**
 * Lý do "ủng hộ" mà engine suy ra từ một ƯỚC LƯỢNG (phần phủ chuyến đi).
 *
 * Câu của chúng nói như dữ kiện — "số điểm bạn đang với tới được đã đủ cho
 * chuyến này" — mà gốc là điểm giữa của một khoảng giá award chart và số dư
 * người dùng tự khai. Để nhãn "Nhận định" trên câu đó là biến ước lượng thành lời
 * bảo đảm (rà đối kháng 17/09/2026). Nên chúng mang nhãn `estimate` và tự nói
 * "theo ước lượng của mình".
 */
const ESTIMATE_REASONS: ReadonlySet<ReasonCode> = new Set<ReasonCode>([
  "POINTS_ALREADY_SUFFICIENT",
  "FOCUS_ON_AWARD_AVAILABILITY",
  "POINTS_GAP_LARGE",
]);

/** Điểm mạnh dựng trên cùng phép tính phủ chuyến đi ước lượng. */
const ESTIMATE_STRENGTHS: ReadonlySet<string> = new Set([
  COMPONENT_STRENGTH.points_gap_reduction,
  COMPONENT_STRENGTH.points_already_sufficient,
]);

const ESTIMATE_PREFIX = "theo ước lượng của mình, ";

/** Câu dựng trên ước lượng → mệnh đề tự nói ra điều đó, không nói hai lần. */
function estimateClause(text: string): string {
  const clause = asClause(text);
  return /ước lượng/u.test(clause) ? clause : ESTIMATE_PREFIX + clause;
}

/**
 * Chuỗi Contentful → giá trị đặt được sau "là". `null` khi rỗng: một mệnh đề
 * "phí thường niên là" không có gì phía sau là một câu hỏng trên trang, và
 * không có giá trị thì không có dữ kiện.
 */
function cleanValue(value: string | null): string | null {
  if (value === null) return null;
  // Ký tự định dạng vô hình (zero-width, BOM…) không phải khoảng trắng với `\s`
  // nhưng vẫn làm "phí thường niên là " trông như có giá trị (Codex, rà đối kháng).
  const flat = value.replace(/\p{Cf}/gu, "").replace(/\s+/gu, " ").trim().replace(/[.;,:]+$/u, "").trim();
  return /[\p{L}\p{N}]/u.test(flat) ? asClause(flat) : null;
}

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

// Nằm ở `present.ts` để trang Phase 5 dùng được mà không import lớp LLM.
export { vietnameseDate };

/**
 * Câu hoàn chỉnh của bảng tra → mệnh đề đứng sau câu dẫn.
 *
 * Hạ chữ đầu trừ khi đó là tên riêng viết hoa liền ("RBC®", "TD®"); bỏ dấu chấm
 * cuối để câu dẫn tự đóng câu.
 */
export function asClause(sentence: string): string {
  const trimmed = sentence.replace(/\s+/gu, " ").trim().replace(/\.$/u, "");
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

  // Lý do "ủng hộ" — cho CẢ hai loại hành động. Bản đầu bỏ chúng ở nhánh
  // `no_new_card` và chỉ giữ câu tổng hợp, nên "mọi lý do phải có mặt" không
  // canh gì ở đó (Codex, rà đối kháng).
  const good = action.reasons.filter((row) => row.tone === "good");
  const addReasons = () =>
    good.forEach((row, index) =>
      ESTIMATE_REASONS.has(row.code)
        ? add(`reason_${index + 1}`, "estimate", "reason", estimateClause(row.text))
        : add(`reason_${index + 1}`, "editorial", "reason", row.text),
    );

  if (action.kind === "no_new_card") {
    // "Đã đủ điểm" là kết luận từ phần phủ ƯỚC LƯỢNG — cùng lý do như `ESTIMATE_REASONS`.
    const sufficient = action.noCardReason === "points_sufficient";
    const sentence = NO_CARD_SENTENCE[action.noCardReason ?? "default"];
    add("no_card", sufficient ? "estimate" : "editorial", "reason", sufficient ? estimateClause(sentence) : sentence);
    addReasons();
  } else {
    addReasons();
    // Điểm mạnh chỉ khi KHÔNG có lý do "ủng hộ" nào — đúng như `DeterministicWhy`.
    // Mọi dữ kiện vai `reason` đều bắt buộc có mặt trong bản dựng, nên tập này
    // phải là đúng tập khối bảng tra sẽ hiện, không hơn.
    if (good.length === 0) {
      action.strengths.forEach((row, index) =>
        ESTIMATE_STRENGTHS.has(row)
          ? add(`strength_${index + 1}`, "estimate", "reason", estimateClause(`bảng điểm của thẻ mạnh ở phần ${row}`))
          : add(`strength_${index + 1}`, "editorial", "reason", `bảng điểm của thẻ mạnh ở phần ${row}`),
      );
    }
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
      const bonus = cleanValue(action.welcomeBonus);
      if (bonus !== null) add("bonus", "verified", "offer", `welcome bonus hiện hành là ${bonus}`);
      // Chưa kiểm được người này còn nhận bonus không: con số vẫn là dữ kiện
      // về OFFER, nhưng nói nó mà không kèm câu này là hứa trọn bonus.
      if (bonus !== null && action.welcomeBonusUncertain) {
        add(
          "bonus_uncertain",
          "editorial",
          "offer",
          "chưa chắc bạn còn nhận được welcome bonus này, vì điều khoản tính theo thẻ bạn từng giữ và lúc bạn mở hay đóng thẻ",
        );
      }
      // KHÔNG có mốc chi: `minSpendPer90Days` là con số QUY ĐỔI về mỗi 90 ngày
      // để so với sức dồn chi tiêu, không phải điều khoản. Một offer đòi $3,000
      // trong 90 ngày VÀ $12,000 trong 365 ngày thì "nhận trọn bonus với $3,000
      // trong 3 tháng" là sai — mà lại mang nhãn "Dữ kiện" (Codex vòng 3).
    }
    const fee = cleanValue(action.annualFee);
    if (fee !== null) add("fee", "verified", "offer", `annual fee là ${fee}`);
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
      trip.passengers === null || trip.passengers < 1 ? null : `${trip.passengers} người`,
      trip.roundTrip === null ? null : trip.roundTrip ? "khứ hồi" : "một chiều",
    ].filter((part): part is string => part !== null);
    add("trip", "verified", "trip", `bạn muốn bay ${parts.join(", ")}`);
    if (trip.routeNotPriced) {
      add(
        "trip_not_priced",
        "editorial",
        "trip",
        // Cùng câu với khối chuyến bay: có hạng ghế thì có thể chỉ HẠNG đó chưa có giá.
        trip.cabin
          ? `chặng này, ${trip.cabin.toLowerCase()}, chưa có trong award chart của site, nên mình chưa tính được số điểm cần`
          : "chặng này chưa có trong award chart của site, nên mình chưa tính được số điểm cần",
      );
    } else {
      const need = formatNeed(trip.needLow, trip.needHigh);
      if (need !== null) {
        add(
          "trip_need",
          "estimate",
          "trip",
          `theo ước lượng từ award chart, chuyến này cần ${trip.needLow !== null && trip.needHigh !== null ? "khoảng " : ""}${need}${trip.needProgram === null ? "" : `, tính bằng điểm ${trip.needProgram}`}, và con số đổi theo ngày bay`,
        );
      }
      if (trip.accessible !== null) {
        add(
          "trip_reach",
          "estimate",
          "trip",
          `theo ước lượng từ số dư bạn khai, bạn gom được ${trip.accessibleIsLowerBound ? "ít nhất " : ""}${formatPoints(trip.accessible)} điểm`,
        );
      }
      // Thiếu 0 điểm không phải "còn thiếu khoảng 0 điểm" — phần phủ nói chuyện đó.
      if (trip.gap !== null && trip.gap > 0) {
        add("trip_gap", "estimate", "trip", `theo ước lượng, bạn còn thiếu khoảng ${formatPoints(trip.gap)} điểm`);
      }
      const coverage = coverageStatement(trip);
      if (coverage !== null) add("trip_coverage", "estimate", "trip", `theo ước lượng, ${coverage}`);
    }
  }

  return {
    action: { kind: action.kind, name: action.kind === "no_new_card" ? "Chưa cần mở thẻ mới" : action.name },
    goal: view.goalTitle,
    facts,
    dataVerifiedAt: view.dataVerifiedAt,
  };
}
