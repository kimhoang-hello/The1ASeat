/**
 * §9 Needs Engine — chuẩn hoá "người này CẦN gì" thành các con số 0..1.
 *
 * Câu cuối của §9 là ràng buộc quan trọng nhất của cả file:
 *
 * > The questionnaire should feed the Needs Engine. It should not directly
 * > choose cards.
 *
 * Nên ở đây **không có tên sản phẩm nào**, y như `strategies.ts`. Nhu cầu được
 * phát biểu bằng ĐỒNG TIỀN, QUYỀN LỢI và HÌNH DẠNG DANH MỤC; việc thẻ nào đáp
 * ứng được nhu cầu đó là việc của `scoring/*`. Trộn hai tầng lại thì mỗi lần
 * thêm một thẻ mới lại phải sửa lớp nhu cầu, và câu hỏi bảng khảo sát sẽ dần
 * biến thành câu hỏi về sản phẩm.
 *
 * Thang đo: 0 = không liên quan, 1 = cực kỳ hữu ích.
 */

import { centsPerPoint, flexibilityReach, isFlexibleInPractice } from "./portfolio.ts";
import { activeAt } from "./temporal.ts";
import { clamp01 } from "./offer-quality.ts";
import {
  CONCENTRATION_THRESHOLD,
  LOW_FLEXIBILITY_THRESHOLD,
  newCardNeed,
  tripCoverage,
} from "./strategies.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { PointsProgramId, RecommendationDataset } from "./types.ts";
import type { UserState } from "./user-types.ts";
import type { GoalContext, Needs, PortfolioAnalysis, StrategyScore } from "./engine-types.ts";

/**
 * Nhu cầu của một đồng điểm ĐÃ KIỂM và biết là không rút ra tiền được.
 *
 * Cùng mức sàn với đồng tiền lạc đề ở mục tiêu chuyến đi, và cùng lý do: nó
 * không trả lời được câu đang hỏi, nhưng nó vẫn là một đồng điểm có giá — hạ
 * hẳn về 0 là nói Aeroplan® vô giá trị, một câu sai ở mọi ngữ cảnh khác.
 */
const CASH_FLOOR_NEED = 0.05;

export interface NeedsInput {
  state: UserState;
  data: RecommendationDataset;
  ix: DatasetIndex;
  asOf: string;
  portfolio: PortfolioAnalysis;
  goal: GoalContext;
  strategies: readonly StrategyScore[];
}

/**
 * Tỷ trọng GIÁ TRỊ người dùng đang có ở một chương trình.
 *
 * Dùng `direct` chứ không dùng `accessible`: câu hỏi ở đây là "người này đã có
 * bao nhiêu ở đây rồi", và trả lời nó bằng điểm tiếp cận được sẽ kết luận
 * người giữ Membership Rewards® đã có đủ Aeroplan®, Avios®, Flying Blue® và
 * Asia Miles® cùng lúc — đúng phép đếm trùng §7 cấm.
 */
function directShare(
  portfolio: PortfolioAnalysis,
  ix: DatasetIndex,
  programId: PointsProgramId,
  asOf: string,
): number {
  if (portfolio.knownValueCents <= 0) return 0;
  const entry = portfolio.direct.get(programId);
  if (entry === undefined || entry.kind !== "known") return 0;
  const cpp = centsPerPoint(ix, programId, asOf);
  if (cpp === null) return 0;
  return (entry.points * cpp) / portfolio.knownValueCents;
}

/** Đồng tiền này có với tới được `target` không (một chặng, không qua trung gian). */
function reaches(
  ix: DatasetIndex,
  source: PointsProgramId,
  target: PointsProgramId,
  asOf: string,
): boolean {
  if (source === target) return true;
  return activeAt(ix.pathsBySource.get(source) ?? [], asOf).some(
    (path) => path.destinationProgramId === target && path.requiresTier === null,
  );
}

export function computeNeeds(input: NeedsInput): Needs {
  const { state, data, ix, asOf, portfolio, goal, strategies } = input;

  /* ---- Nhu cầu về đồng tiền --------------------------------------- */
  const currency = new Map<PointsProgramId, number>();
  /**
   * Tỷ lệ rút-ra-tiền TỐT NHẤT trong bảng — mẫu số của mục tiêu `cash`.
   *
   * Chuẩn hoá theo bảng chứ không theo một hằng số (ví dụ "1 cent = 1.0"): nếu
   * ngày nào đó không còn đồng điểm nào rút được trọn 1 cent, thang điểm vẫn
   * phải phân biệt được 0.625 với 0.25. Một hằng số thì ép cả hai xuống thấp
   * cùng lúc và làm thành phần này thôi xếp hạng.
   */
  let maxCashCpp = 0;
  let minCashCpp = Infinity;
  for (const program of data.pointsPrograms) {
    const cpp = centsPerPoint(ix, program.id, asOf, "cash");
    if (cpp === null) continue;
    maxCashCpp = Math.max(maxCashCpp, cpp);
    minCashCpp = Math.min(minCashCpp, cpp);
  }
  /**
   * Nhu cầu của một đồng điểm CHƯA AI KIỂM đường ra tiền (`cashOut: "unknown"`).
   *
   * Hai thứ tự phải giữ cùng lúc, và con số này là chỗ duy nhất giữ được cả hai:
   *
   *   sàn (đã kiểm, KHÔNG rút được)  <  chưa kiểm  <  mọi đồng điểm đã kiểm và
   *                                                   biết rút được
   *
   * Vế trái vì "chưa biết" không được rơi xuống ngang "đã biết là không" —
   * engine sẽ khẳng định một điều chưa ai xác lập, đúng thứ `CashOutStatus`
   * sinh ra để khỏi phải làm. Vế phải vì chiều ngược lại cũng sai: một đồng
   * điểm đã tra và biết rút được 0.5 cent phải đứng trên một đồng điểm chưa ai
   * tra, nếu không thì THIẾU DỮ LIỆU thành một lợi thế và engine thưởng cho
   * việc chưa làm việc (vòng Codex 2 của mục tiêu này, mục 2).
   *
   * Điểm giữa của hai mốc đó, và cả hai mốc đều đọc từ dữ liệu — không có hằng
   * số nào ở đây là ý kiến của ai. `cash_out_unknown` nói ra chỗ trống này
   * trong chính lượt chạy, và cách sửa THẬT là đi tra tỷ lệ, không phải chỉnh
   * con số này.
   */
  const unknownCashNeed =
    minCashCpp === Infinity ? CASH_FLOOR_NEED : (CASH_FLOOR_NEED + minCashCpp / maxCashCpp) / 2;
  const tripPrograms = goal.tripNeed?.programs ?? [];
  const tripGap =
    goal.tripNeed === null
      ? null
      : (() => {
          const { coverage } = tripCoverage(state, ix, asOf, goal.tripNeed);
          return coverage === null ? null : 1 - coverage;
        })();

  for (const program of data.pointsPrograms) {
    const share = directShare(portfolio, ix, program.id, asOf);
    let need: number;

    switch (goal.goal.type) {
      case "trip": {
        if (tripPrograms.length === 0) {
          // Chặng chưa có award strategy nào. KHÔNG được để mọi đồng tiền tụt
          // xuống 0.05 cùng lúc: làm vậy thì một chỗ trống của lớp dữ liệu
          // biến thành "không đồng tiền nào hữu ích", và thẻ thắng cuộc được
          // chọn bằng những thành phần còn lại — tức bằng tiếng ồn. Rơi về
          // đúng công thức của mục tiêu rộng (`next_card`) và để §29 hạ độ
          // tin cậy, vì thứ ta thiếu là GIÁ, không phải mục tiêu.
          need = clamp01(
            0.5 * (0.7 + 0.3 * flexibilityReach(ix, program.id, asOf)) + 0.5 * (1 - share),
          );
          break;
        }
        const pricesRoute = tripPrograms.includes(program.id);
        const reachesRoute =
          !pricesRoute &&
          isFlexibleInPractice(ix, program.id, asOf) &&
          tripPrograms.some((target) => reaches(ix, program.id, target, asOf));
        // Còn thiếu bao nhiêu điểm thì nhu cầu đúng bấy nhiêu. Đủ rồi thì đồng
        // tiền đó thôi cấp bách — §16 Rule 1 phát biểu ở mức đồng tiền.
        const gapWeight = tripGap ?? 0.6;
        need = pricesRoute ? gapWeight : reachesRoute ? gapWeight * 0.85 : 0.05;
        break;
      }
      case "earn_points": {
        const target = goal.goal.targetProgramId;
        if (target === null) {
          // "Tôi muốn tích điểm", không nói loại nào. Đó là một CÂU TRẢ LỜI,
          // không phải chỗ trống — nên không đi hỏi lại, và mọi đồng tiền có
          // giá đều hữu ích, đồng tiền chuyển được thì hơn.
          need = 0.55 + 0.35 * flexibilityReach(ix, program.id, asOf);
        } else {
          need = program.id === target ? 1 : reaches(ix, program.id, target, asOf) ? 0.8 : 0.1;
        }
        break;
      }
      case "cash": {
        // Đo bằng CHÍNH tỷ lệ rút ra tiền, chia cho tỷ lệ tốt nhất đang có
        // trong bảng. Không đo bằng `programType`: `fixed_value` gồm cả
        // Scene+™ (1 cent vào sao kê) lẫn VIPorter® (chỉ đổi được vé Porter®),
        // và gộp hai thứ đó lại là trả lời câu hỏi bằng một cái nhãn thay vì
        // bằng con số người dùng sẽ nhận.
        if (maxCashCpp <= 0) {
          // KHÔNG đồng điểm nào trong bảng có tỷ lệ rút tiền. Đó là một chỗ
          // trống của LỚP DỮ LIỆU, không phải câu trả lời "không đồng điểm nào
          // hữu ích" — và hạ tất cả xuống sàn cùng lúc thì thẻ thắng cuộc được
          // chọn bằng những thành phần còn lại, tức bằng tiếng ồn. Rơi về đúng
          // công thức của mục tiêu rộng, y như nhánh `trip` khi chặng chưa có
          // giá, và để §29 hạ độ tin cậy.
          need = clamp01(
            0.5 * (0.7 + 0.3 * flexibilityReach(ix, program.id, asOf)) + 0.5 * (1 - share),
          );
          break;
        }
        const cash = centsPerPoint(ix, program.id, asOf, "cash");
        if (cash !== null) {
          need = clamp01(cash / maxCashCpp);
          break;
        }
        // Không có dòng định giá cash — hai ca KHÁC HẲN nhau (xem `CashOutStatus`).
        // "Đã kiểm, không rút được" là một dữ kiện: Aeroplan® không trả lời
        // được câu đang hỏi, cho nó mức sàn 0.05 như đồng tiền lạc đề ở mục
        // tiêu chuyến đi. "Chưa ai kiểm" thì cho mức giữa: hạ nó xuống sàn là
        // biến một chỗ trống của lớp dữ liệu thành một phán quyết về đồng
        // điểm, và ở đây chỗ trống đó đang che Membership Rewards® — đồng điểm
        // nhiều thẻ mạnh nhất Canada kiếm ra. §29 hạ độ tin cậy, §30 đi hỏi;
        // không chỗ nào trong hai chỗ đó là ở đây.
        need = program.cashOut === "unknown" ? unknownCashNeed : CASH_FLOOR_NEED;
        break;
      }
      case "diversify":
        // Đã có nhiều thì cần ít. Đây là định nghĩa của đa dạng hoá, viết
        // thẳng ra thay vì suy từ điểm số ở tầng sau.
        need = clamp01(1 - share / CONCENTRATION_THRESHOLD);
        break;
      case "next_card":
        // Không có mục tiêu hẹp: một nửa là giá trị chung của đồng tiền, một
        // nửa là "người này chưa có nhiều ở đây".
        need = clamp01(
          0.5 * (0.7 + 0.3 * flexibilityReach(ix, program.id, asOf)) + 0.5 * (1 - share),
        );
        break;
    }

    currency.set(program.id, clamp01(need));
  }

  /* ---- Nhu cầu về quyền lợi --------------------------------------- */
  // Khoá là `BenefitId`, và "đã có" được đo bằng CẢ hãng cấp — xem
  // `benefit-fit.ts`. Ở đây chỉ cần biết người dùng đã có quyền lợi đó ở BẤT
  // KỲ hãng nào chưa, vì nhu cầu là câu về người dùng, không phải về một thẻ.
  const heldBenefitIds = new Set<string>();
  for (const product of portfolio.heldProducts) {
    for (const row of activeAt(ix.benefitsByProduct.get(product.id) ?? [], asOf)) {
      heldBenefitIds.add(row.benefitId as string);
    }
  }

  const benefit = new Map<string, number>();
  const travelGoal = goal.goal.type === "trip";
  for (const row of data.benefits) {
    const already = heldBenefitIds.has(row.id as string);
    // `duplicatesAcrossCards: false` = cái thứ hai vẫn có giá (travel credit
    // cộng dồn). Cờ đó nằm trong dữ liệu vì engine không tự đoán được.
    const base = already ? (row.duplicatesAcrossCards ? 0.1 : 0.7) : 1;
    // Mục tiêu chuyến đi thì quyền lợi đi lại đáng hơn; mục tiêu khác thì mọi
    // quyền lợi đáng như nhau.
    const relevance =
      travelGoal && (row.category === "airline" || row.category === "airport") ? 1 : 0.7;
    benefit.set(row.id as string, clamp01(base * relevance));
  }

  /* ---- Nhu cầu về hình dạng danh mục ------------------------------ */
  const topShare = portfolio.concentration[0]?.share ?? 0;
  const hasSomething = portfolio.knownValueCents > 0;

  const diversification = !hasSomething
    ? // Chưa có gì thì không có gì để đa dạng hoá. Trả về một con số cao ở đây
      // sẽ đẩy một người mới vào lời khuyên "hãy đa dạng hoá danh mục" trong
      // khi họ chưa có danh mục nào.
      0
    : goal.goal.type === "diversify"
      ? Math.max(0.8, topShare)
      : clamp01((topShare - 0.4) / (1 - 0.4));

  const flexibility = !hasSomething
    ? 0.6
    : clamp01((LOW_FLEXIBILITY_THRESHOLD + 0.4 - portfolio.flexibilityScore) / (LOW_FLEXIBILITY_THRESHOLD + 0.4));

  return {
    currency,
    benefit,
    portfolio: { diversification, flexibility },
    action: { newCard: newCardNeed(strategies) },
  };
}

/** Nhu cầu về một đồng tiền, 0 khi chương trình không có trong bảng. */
export function currencyNeed(needs: Needs, programId: PointsProgramId | null): number {
  if (programId === null) return 0;
  return needs.currency.get(programId) ?? 0;
}

/**
 * Đồng tiền của một chương trình khi CHUYỂN được sang chỗ đang cần.
 *
 * Một thẻ kiếm Membership Rewards® phục vụ được nhu cầu Aeroplan®, và bỏ qua
 * điều đó là bắt engine chỉ khuyên thẻ đồng thương hiệu. Nhưng phần chuyển
 * được bị chiết khấu: chuyển là một bước nữa, thường một chiều, và tỷ lệ có
 * thể xấu đi bất cứ lúc nào.
 */
export function bestCurrencyNeedVia(
  needs: Needs,
  ix: DatasetIndex,
  programId: PointsProgramId | null,
  asOf: string,
): number {
  return bestCurrencyNeedDetail(needs, ix, programId, asOf).need;
}

/**
 * Như `bestCurrencyNeedVia`, kèm chương trình ĐÃ cho con số đó — chính nó hay
 * một đích qua chặng chuyển. Không có trường này thì ghi chú chỉ nói "nhu cầu
 * đồng tiền, kể cả qua chặng chuyển", và admin không biết điểm đến từ nhu cầu
 * Aeroplan® hay nhu cầu Avios® (vòng rà Phase 4).
 */
export function bestCurrencyNeedDetail(
  needs: Needs,
  ix: DatasetIndex,
  programId: PointsProgramId | null,
  asOf: string,
): { need: number; via: PointsProgramId | null } {
  if (programId === null) return { need: 0, via: null };
  let best = currencyNeed(needs, programId);
  let via: PointsProgramId | null = null;
  if (!isFlexibleInPractice(ix, programId, asOf)) return { need: best, via };
  for (const path of activeAt(ix.pathsBySource.get(programId) ?? [], asOf)) {
    if (path.requiresTier !== null) continue;
    const reached = currencyNeed(needs, path.destinationProgramId) * 0.85;
    if (reached > best) {
      best = reached;
      via = path.destinationProgramId;
    }
  }
  return { need: best, via };
}
