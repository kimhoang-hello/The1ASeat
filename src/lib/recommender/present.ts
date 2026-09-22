/**
 * Một bản ghi lượt chạy (§20) → thứ trang hiển thị.
 *
 * Ranh giới: file này KHÔNG chạy engine, không xếp lại thứ hạng, không cộng
 * điểm. Nó đọc `outputSnapshot` — đúng những gì đã được lưu — và dịch sang câu
 * chữ. Nghĩa là trang và bản ghi trong kho không thể nói hai chuyện khác nhau,
 * và một khiếu nại "khuyến nghị này sai" tra lại được bằng `reco:debug` trên
 * đúng `runId` người dùng nhìn thấy.
 *
 * AFFILIATE (§16 Rule 7). Ở đây có đúng MỘT chỗ đọc `affiliateAvailable`: dựng
 * nút "Đăng ký ngay". Thứ tự, điểm số, lý do, cảnh báo đều lấy nguyên từ bản
 * ghi. `present.test.ts` đổi cờ affiliate của mọi thẻ rồi đòi mọi thứ trừ nút
 * CTA giữ nguyên từng chữ.
 */

import { isReferralUrl } from "../affiliate-links.ts";
import type { CreditCardOffer } from "../content/types.ts";
import type { Candidate } from "../recommendation/engine-types.ts";
import type { RecommendationRunRecord } from "../recommendation/runs.ts";
import type { ReasonCode, WarningCode } from "../recommendation/reason-codes.ts";
import { requiredSpendOf } from "../recommendation/spend.ts";
import type {
  OfferComponent,
  PointsProgramId,
  RecommendationDataset,
  SpendCategory,
} from "../recommendation/types.ts";
import type { GoalType, UserState } from "../recommendation/user-types.ts";
import {
  COMPONENT_LABEL,
  COMPONENT_STRENGTH,
  CONFIDENCE_BY_CAUSE,
  CONFIDENCE_LABEL,
  REASON_COVERED_BY_WARNING,
  REASON_TEXT,
  STRATEGY_TEXT,
  WARNING_TEXT,
  type ReasonText,
} from "./copy.ts";
import {
  CABIN_LABEL,
  CATEGORY_LABEL,
  publicQuestionKey,
  questionKey,
  REGION_LABEL,
} from "./questions.ts";

/**
 * Một lý do đã dịch, KÈM mã gốc. Trang chỉ đọc `text`/`tone`; mã có mặt để lớp
 * giải thích Phase 6 biết lý do nào dựng trên ƯỚC LƯỢNG ("đã đủ điểm") mà không
 * phải đoán ngược từ câu chữ.
 */
export interface ReasonRow extends ReasonText {
  code: ReasonCode;
}

export interface ActionView {
  kind: "open_card" | "no_new_card";
  slug: string | null;
  name: string;
  /** Ảnh thẻ từ Contentful — vắng khi thẻ chưa có entry. */
  image: string | null;
  welcomeBonus: string | null;
  annualFee: string | null;
  /** Link đăng ký, và link đó có phải link affiliate không. */
  apply: { url: string; affiliate: boolean } | null;
  reasons: ReasonRow[];
  warnings: string[];
  /** Cho phần "cách tính" — người đọc kỹ mới mở ra. */
  score: number;
  /**
   * Trọng số đã chia lại cho TỔNG trọng số các dòng (cộng đủ 100%). Engine chừa
   * 5% cho `editorial` mà không có dòng nào, nên in trọng số thô là bảng cộng
   * ra 95%.
   */
  components: { label: string; weight: number; raw: number; contribution: number }[];
  /**
   * Điểm cuối trừ điểm nền — các luật phạt/thưởng sau công thức. Không in dòng
   * này thì "Tổng" không khớp các dòng bên trên.
   */
  adjustment: number;
  /** Ngân hàng có thể vẫn từ chối — nói ra khi engine chưa kiểm được điều kiện. */
  eligibilityUncertain: boolean;
  /**
   * Câu nói thẻ này KHÁC hành động chính ở chỗ nào — chỉ có ở lựa chọn thay
   * thế.
   *
   * Lấy lý do đầu tiên mà hành động chính KHÔNG có. Không có câu riêng thì để
   * `null`: ba dòng giống hệt nhau dưới ba cái tên khác nhau không giúp ai
   * chọn, mà còn làm người đọc tưởng mình đọc nhầm.
   */
  lead: string | null;
  /**
   * Hai dòng điểm đóng góp nhiều nhất — dùng khi engine không phát ra mã lý do
   * "ủng hộ" nào.
   *
   * Có những thẻ thắng mà không có mã nào nói ra vì sao: chúng thắng bằng tổng
   * điểm, không bằng một đặc điểm nổi bật. Im lặng ở đó là để người đọc nhìn
   * một cái tên không kèm lý do — nên nói thẳng cái đã đẩy nó lên đầu, bằng
   * chính các dòng của bảng điểm.
   */
  strengths: string[];
  /**
   * Mốc chi của toàn bộ offer, QUY ĐỔI về 90 ngày (đô la) — con số engine đem
   * so với sức dồn chi tiêu.
   *
   * KHÔNG phải điều khoản và KHÔNG được in cho người đọc như một lời hứa:
   * TD® Aeroplan® Visa Infinite* đòi $3,000/90 ngày RỒI $12,000/12 tháng, và
   * con số quy đổi của nó ($3,000) nói như thể chi $3,000 là đủ. Câu cho người
   * đọc nằm ở `spendSentence`. `null` = offer không có mốc chi nào dựng được —
   * KHÁC với "không đòi chi tiêu gì".
   */
  minSpendPer90Days: number | null;
  /**
   * Câu "việc phải làm sau khi mở thẻ", liệt kê ĐÚNG các mốc chi và thời hạn
   * của offer. `null` khi không dựng được mốc nào — trang khi đó không hứa gì
   * về welcome bonus. Xem `spendSentenceOf`.
   */
  spendSentence: string | null;
  /**
   * Vì sao "chưa mở thẻ" lại thắng — chỉ có ở ứng viên `no_new_card`.
   *
   * Bốn lý do khác hẳn nhau: đã đủ điểm, ví đã che được nhu cầu, thị trường
   * offer đang thấp, hoặc KHÔNG THẺ NÀO với tới được (điều kiện và ngưỡng phí
   * của chính người dùng). In chung một câu "ví bạn đã đủ" cho cả bốn là nói
   * sai với người thứ tư — họ không đủ gì cả, chỉ là chưa có lựa chọn nào hợp.
   */
  noCardReason: "points_sufficient" | "portfolio_covers" | "offers_weak" | "nothing_fits" | null;
  /**
   * Người này KHÔNG nhận được welcome bonus của thẻ (Amex® once-in-a-lifetime).
   *
   * Thẻ vẫn có thể là lựa chọn đúng — vì tỷ lệ tích điểm, vì quyền lợi — nhưng
   * câu "chi $2,959 trong 3 tháng để nhận trọn welcome bonus" thì thành một lời
   * hứa ngân hàng sẽ không giữ.
   */
  welcomeBonusBlocked: boolean;
  /**
   * CHƯA BIẾT người này còn nhận được welcome bonus không — luật "trong N
   * tháng qua" gặp thẻ đã đóng không rõ ngày, hoặc chưa khai thẻ từng giữ.
   * Luôn `false` khi `welcomeBonusBlocked`. Engine chỉ tính nửa phần bonus,
   * nên thẻ vẫn có thể đứng đầu — và khi đó trang KHÔNG được in con số bonus
   * như một điều chắc chắn (vòng Codex 1, 21/09/2026).
   */
  welcomeBonusUncertain: boolean;
}

export interface TripNumbersView {
  /** Những thừa số còn thiếu, kèm khoá câu hỏi để hỏi thẳng. */
  missing: { label: string; questionKey: string }[];
  /**
   * Chặng này CHƯA CÓ trong award chart của site.
   *
   * Khác hẳn "còn thiếu vài câu trả lời": người dùng trả lời thêm bao nhiêu
   * câu cũng không ra con số. Nói nhầm hai thứ này là bắt họ điền một form vô
   * ích rồi vẫn không có kết quả.
   */
  routeNotPriced: boolean;
  destination: string;
  cabin: string | null;
  passengers: number | null;
  roundTrip: boolean | null;
  needLow: number | null;
  needTypical: number | null;
  needHigh: number | null;
  accessible: number | null;
  accessibleIsLowerBound: boolean;
  gap: number | null;
  /** 0..1 — phần chuyến đi mà số điểm hiện tại phủ được. */
  coverage: number | null;
  coverageIsEstimate: boolean;
}

export interface ResultView {
  runId: string;
  asOf: string;
  engineVersion: string;
  goalType: GoalType;
  goalTitle: string;
  strategy: string;
  primary: ActionView;
  alternatives: ActionView[];
  /** `null` khi "chưa mở thẻ" CHÍNH LÀ hành động chính. */
  noAction: ActionView | null;
  warnings: string[];
  confidence: { level: "high" | "medium" | "low"; label: string; sentence: string };
  trip: TripNumbersView | null;
  /**
   * Ngày kiểm của dòng dữ liệu CŨ NHẤT mà lượt chạy này dựa vào.
   *
   * Phân biệt "số mình tự ước lượng" với "số chép từ trang của ngân hàng và
   * kiểm ngày nào" là việc của trang: người đọc sắp mang con số này đi quyết
   * định tiền bạc, và một con số không có ngày thì không kiểm lại được.
   */
  dataVerifiedAt: string | null;
}

/* ------------------------------------------------------------------ *
 * Lý do và cảnh báo
 * ------------------------------------------------------------------ */

const TONE_ORDER = { good: 0, caution: 1, info: 2 } as const;

/**
 * Mã → câu, bỏ trùng, và xếp theo: ủng hộ → cần cân nhắc → ngữ cảnh.
 *
 * Thứ tự này là một quyết định biên tập: người đọc phải thấy lý do CHỌN trước,
 * nhưng không bao giờ được thấy nó mà không có phần "nhưng". Cả hai nhóm nằm
 * trên cùng một danh sách, không có nhóm nào gập lại.
 */
export function reasonsOf(
  codes: readonly ReasonCode[],
  /** Cảnh báo sẽ hiện ở khối riêng — lý do trùng nội dung với chúng thì bỏ. */
  warnings: readonly WarningCode[] = [],
): ReasonRow[] {
  const shownWarnings = new Set(warnings);
  const seen = new Set<string>();
  const rows: ReasonRow[] = [];
  for (const code of codes) {
    const twin = REASON_COVERED_BY_WARNING[code];
    if (twin !== undefined && shownWarnings.has(twin)) continue;
    const row = REASON_TEXT[code];
    if (row === undefined || seen.has(row.text)) continue;
    seen.add(row.text);
    rows.push({ ...row, code });
  }
  return rows.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

export function warningsOf(codes: readonly WarningCode[]): string[] {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const code of codes) {
    const text = WARNING_TEXT[code];
    if (text === undefined || seen.has(text)) continue;
    seen.add(text);
    rows.push(text);
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * Một ứng viên → một hành động
 * ------------------------------------------------------------------ */

interface CardLookup {
  offers: Map<string, CreditCardOffer>;
  /** Dữ kiện offer engine ĐÃ ĐỌC, theo slug — nguồn của con số mốc chi. */
  facts: Map<string, { minSpendPer90Days: number | null; spendSentence: string | null }>;
}

function lookup(
  record: RecommendationRunRecord,
  dataset: RecommendationDataset,
  offers: readonly CreditCardOffer[],
): CardLookup {
  const components = new Map(dataset.offerComponents.map((row) => [row.id as string, row]));
  return {
    offers: new Map(offers.map((offer) => [offer.slug, offer])),
    facts: new Map(
      record.derivedState.candidates.map((row) => {
        // Đúng những thành phần engine đã đọc (id ghi trong bản ghi), tra trong
        // đúng bộ dữ liệu của lượt chạy. Thiếu một id là không kể được trọn
        // điều khoản — thà không nói gì còn hơn nói thiếu một mốc.
        const own = row.offer.componentIds.map((id) => components.get(id));
        const complete = own.every((component) => component !== undefined);
        return [
          row.productSlug,
          {
            // Mốc của TOÀN BỘ offer, không phải của phần người này với tới được.
            minSpendPer90Days: row.offer.fullRequiredPerNinetyDays,
            spendSentence: complete ? spendSentenceOf(own as OfferComponent[]) : null,
          },
        ];
      }),
    ),
  };
}

/* ------------------------------------------------------------------ *
 * Điều khoản chi tiêu của welcome bonus
 * ------------------------------------------------------------------ */

const usd = (amount: number) => `$${amount.toLocaleString("en-US")}`;

/**
 * Thời hạn một cửa sổ, nói theo cách điều khoản nói.
 *
 * `spendWindowText` thắng con số ngày mỗi khi có: số ngày ở những mốc đó là
 * quy đổi của engine ("4 kỳ sao kê đầu tiên" → 120 ngày), và in quy đổi ra
 * trang là đúng cái lỗi câu này sinh ra để sửa.
 */
function periodOf(from: number, days: number, text: string | null = null): string {
  if (text !== null && text.trim().length > 0) return text.trim();
  if (from === 0) {
    return days % 365 === 0 ? `trong ${(days / 365) * 12} tháng đầu` : `trong ${days} ngày đầu`;
  }
  // Cửa sổ mở muộn (Amex®: "tháng thứ 13", "tháng 15–17"): đếm theo tháng
  // kể từ ngày mở thẻ.
  const first = Math.round((from / 365) * 12) + 1;
  const last = Math.max(first, Math.round(((from + days) / 365) * 12));
  return first === last ? `trong tháng thứ ${first}` : `trong khoảng tháng ${first}–${last}`;
}

/**
 * Câu "mở thẻ rồi làm gì" dựng từ CHÍNH các thành phần offer, không từ con số
 * quy đổi `minSpendPer90Days`.
 *
 * Con số quy đổi là thước đo sức dồn — mốc NẶNG NHẤT sau khi chia về 90 ngày.
 * In nó thành "chi $X trong 3 tháng đầu để nhận trọn welcome bonus" là hứa
 * sai với mọi offer nhiều mốc: TD® Aeroplan® Visa Infinite* quy ra $3,000,
 * trong khi 25,000 trong 50,000 điểm nằm sau mốc $12,000 trong 12 tháng.
 *
 * Chỉ nói "nhận trọn" khi offer có ĐÚNG MỘT mốc chi và không phần nào trả
 * muộn. Nhiều mốc thì liệt kê từng mốc với thời hạn thật, theo thứ tự người
 * dùng gặp. Cửa sổ chồng nhau dùng chung tiền (xem `totalSpend` ở
 * `spend.ts`), nên mốc chứa trọn một mốc trước nói "tổng cộng"; mốc rời hẳn
 * phía sau nói "thêm".
 */
/** "2026-09-07" → "07/09/2026" — ngày in cho người đọc, không in dạng ISO. */
export function vietnameseDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function spendSentenceOf(components: readonly OfferComponent[]): string | null {
  const ordered = [...components].sort((a, b) => a.sequence - b.sequence);
  const windows: { from: number; to: number }[] = [];
  /** `period` tách riêng để gộp được khi mọi mốc cùng một thời hạn. */
  const steps: { text: string; period: string | null }[] = [];
  let spendSteps = 0;
  for (const component of ordered) {
    const from = component.windowStartsAfterDays;
    const days = component.spendWindowDays ?? 90;
    const needed = requiredSpendOf(component);
    if (needed === null) {
      // Điều kiện không phải chi tiêu nhưng mở muộn (Amex®: quẹt một giao dịch
      // ở tháng 15–17) vẫn là một mốc người đọc phải biết.
      if (from > 0 && component.componentType !== "fee_waiver") {
        const note = component.conditionText?.trim();
        steps.push({
          text: note
            ? note.charAt(0).toLocaleLowerCase("vi") + note.slice(1)
            : `một điều kiện riêng ${periodOf(from, days, component.spendWindowText)}`,
          period: null,
        });
      }
      continue;
    }
    spendSteps += 1;
    const to = from + days;
    if (component.componentType === "monthly_spend") {
      const per = usd(component.spendRequirement as number);
      steps.push({
        text: `chi ${per} mỗi chu kỳ sao kê, suốt ${component.repeatCount ?? 1} chu kỳ đầu`,
        period: null,
      });
    } else {
      const containsEarlier = windows.some((w) => w.from >= from && w.to <= to);
      const afterAll = windows.length > 0 && windows.every((w) => w.to <= from);
      const prefix = containsEarlier ? "tổng cộng " : afterAll ? "thêm " : "";
      steps.push({
        text: `chi ${prefix}${usd(needed)}`,
        period: periodOf(from, days, component.spendWindowText),
      });
    }
    windows.push({ from, to });
  }
  if (spendSteps === 0) return null;

  const paidLater = ordered.some(
    (component) => component.componentType === "anniversary" || component.windowStartsAfterDays > 0,
  );
  const keepCard = paidLater
    ? " Phần bonus trả từ mốc anniversary trở đi chỉ về khi bạn còn giữ thẻ tới lúc đó."
    : "";
  // Mọi mốc cùng một thời hạn (CIBC® Aventura®: cả hai "trong 4 kỳ sao kê đầu
  // tiên") thì nói thời hạn MỘT lần ở cuối. Lặp lại y nguyên cụm đó sau mỗi
  // con số làm câu đọc như máy đọc, và tệ hơn: nó trông như hai thời hạn khác
  // nhau vừa tình cờ giống nhau.
  const shared = steps[0].period;
  const sharedPeriod =
    shared !== null && steps.every((step) => step.period === shared) ? shared : null;
  const parts = steps.map((step) =>
    step.period === null || step.period === sharedPeriod ? step.text : `${step.text} ${step.period}`,
  );
  const tail = sharedPeriod === null ? "" : ` ${sharedPeriod}`;

  if (parts.length === 1) {
    // Một mốc chi mà vẫn còn phần trả muộn (thưởng gia hạn): nói đúng việc
    // phải làm, không hứa "trọn".
    return paidLater
      ? `Mở thẻ này, rồi ${parts[0]}${tail}.${keepCard}`
      : `Mở thẻ này, rồi ${parts[0]}${tail}, để nhận trọn welcome bonus.`;
  }
  const list = `${parts.slice(0, -1).join(", ")}, rồi ${parts[parts.length - 1]}`;
  return `Mở thẻ này. Welcome bonus trả theo từng mốc: ${list}${tail}.${keepCard}`;
}

/**
 * Dòng điểm nào đưa `NO_NEW_CARD` lên đầu — bảng điểm riêng của nó ở `rank.ts`.
 *
 * "ĐÃ ĐỦ ĐIỂM" chỉ được nói khi ENGINE nói, tức khi có mã
 * `POINTS_ALREADY_SUFFICIENT` (phủ ≥ 1, và chính lúc đó engine cũng phát cảnh
 * báo điểm hết hạn). Dòng `points_already_sufficient` có thể là dòng đóng góp
 * NHIỀU NHẤT ở mức phủ 0.976 — `u_japan_funded` là đúng ca đó — và câu "số điểm
 * bạn đang có đã đủ cho mục tiêu này" ở mức 97.6% là nói người đọc đủ điểm khi
 * họ còn thiếu, lại không kèm cảnh báo nào (rà production 17/09/2026).
 */
function noCardReasonOf(candidate: Candidate): ActionView["noCardReason"] {
  const sufficient = candidate.reasonCodes.includes("POINTS_ALREADY_SUFFICIENT");
  if (sufficient) return "points_sufficient";
  const top = [...candidate.components]
    .filter((row) => row.contribution > 0 && row.key !== "points_already_sufficient")
    .sort((a, b) => b.contribution - a.contribution)[0];
  switch (top?.key) {
    case "points_already_sufficient":
      return "points_sufficient";
    case "portfolio_already_covers":
      return "portfolio_covers";
    case "offer_climate_weak":
      return "offers_weak";
    case "no_reachable_candidate":
      return "nothing_fits";
    default:
      return null;
  }
}

function actionOf(
  candidate: Candidate,
  cards: CardLookup,
  /** Lý do của hành động chính — để lựa chọn thay thế nói ra chỗ KHÁC. */
  primaryReasons: ReadonlySet<string> = new Set(),
  /**
   * Cảnh báo SẼ ĐƯỢC HIỆN cho chính hành động này — chỉ hành động chính có.
   *
   * Chỉ bỏ lý do trùng với cảnh báo khi cảnh báo đó thật sự xuất hiện trên
   * màn hình. Lựa chọn thay thế không có khối cảnh báo, nên bỏ lý do ở đó là
   * xoá vế cảnh báo duy nhất của nó: một thẻ người dùng từng giữ sẽ mất câu
   * "bạn không nhận được welcome bonus" rồi rơi xuống câu quảng cáo chính con
   * số bonus đó (Codex, vòng UX).
   */
  shownWarnings: readonly WarningCode[] = [],
): ActionView {
  const slug = candidate.productSlug;
  const offer = slug === null ? undefined : cards.offers.get(slug);
  return {
    kind: candidate.kind,
    slug,
    name: candidate.productName ?? "Chưa mở thẻ mới",
    image: offer?.cardImage ?? offer?.image ?? null,
    welcomeBonus: offer?.welcomeBonus ?? null,
    annualFee: offer?.annualFee ?? null,
    // CHỖ DUY NHẤT đọc affiliate. Không có link apply thì không có nút — và
    // `affiliateAvailable` chỉ đổi thuộc tính `rel`, không đổi việc có nút hay
    // không (thẻ nào cũng đáng có đường đăng ký).
    // Cờ affiliate đọc từ CHÍNH link sắp render, không từ bản chụp: bản ghi có
    // thể là của sáng nay, còn link thì lấy từ Contentful lúc này. Một link
    // vừa đổi thành link có hoa hồng mà bản chụp nói "không" sẽ ra một nút
    // thiếu `rel="sponsored"` và thiếu câu disclosure (Codex vòng 2).
    apply:
      offer?.applyUrl === undefined
        ? null
        : { url: offer.applyUrl, affiliate: isReferralUrl(offer.applyUrl) },
    // Câu đầu thẻ "chưa mở thẻ" đã nói "số điểm bạn đang có đã đủ" (xem
    // `NO_CARD_SENTENCE`), nên để `POINTS_ALREADY_SUFFICIENT` lại trong danh
    // sách lý do là in gần y hệt một câu hai lần.
    reasons: reasonsOf(candidate.reasonCodes, shownWarnings).filter(
      (row) =>
        !(
          candidate.kind === "no_new_card" &&
          row.code === "POINTS_ALREADY_SUFFICIENT" &&
          noCardReasonOf(candidate) === "points_sufficient"
        ),
    ),
    warnings: warningsOf(candidate.warnings),
    score: candidate.score,
    components: (() => {
      const total = candidate.components.reduce((sum, row) => sum + row.weight, 0);
      const share = (value: number) => (total > 0 ? value / total : 0);
      return candidate.components.map((row) => ({
        label: COMPONENT_LABEL[row.key],
        weight: share(row.weight),
        raw: row.raw,
        contribution: share(row.contribution),
      }));
    })(),
    adjustment: candidate.score - candidate.baseScore,
    eligibilityUncertain: candidate.eligibility?.status === "unknown",
    // Câu của lựa chọn thay thế ưu tiên vế CẦN CÂN NHẮC: một thẻ $799 hiện ra
    // dưới dòng "kiếm điểm linh hoạt" trong khi điều người đọc cần biết là
    // "phí cao hơn mức bạn nói" thì dòng đó đang bán hàng.
    lead: (() => {
      const own = reasonsOf(candidate.reasonCodes, shownWarnings).filter(
        (row) => !primaryReasons.has(row.text),
      );
      return (own.find((row) => row.tone === "caution") ?? own[0])?.text ?? null;
    })(),
    // Điểm mạnh chỉ nói ra những dòng THẬT SỰ mạnh, và chỉ cho thẻ.
    //
    // Hai bộ lọc, mỗi cái vá một câu nói dối: dòng dưới 0.6 không phải "điểm
    // mạnh" (nó chỉ là dòng đóng góp nhiều nhất trong một bảng yếu), và
    // `spend_fit` bằng 1 theo QUY ƯỚC khi offer không có mốc chi nào biết được
    // — in "mốc chi vừa sức bạn" ở đó là khẳng định một thứ chưa ai biết.
    strengths:
      candidate.kind === "no_new_card"
        ? []
        : [...candidate.components]
            .filter((row) => row.raw >= 0.6 && row.contribution > 0 && row.key !== "editorial")
            .filter(
              (row) =>
                row.key !== "spend_fit" ||
                (slug !== null && cards.facts.get(slug)?.minSpendPer90Days != null),
            )
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, 2)
            .map((row) => COMPONENT_STRENGTH[row.key]),
    minSpendPer90Days: slug === null ? null : (cards.facts.get(slug)?.minSpendPer90Days ?? null),
    spendSentence: slug === null ? null : (cards.facts.get(slug)?.spendSentence ?? null),
    noCardReason: candidate.kind === "no_new_card" ? noCardReasonOf(candidate) : null,
    welcomeBonusBlocked: candidate.eligibility?.welcomeOfferBlocked === true,
    welcomeBonusUncertain:
      candidate.eligibility?.welcomeOfferBlocked !== true && candidate.eligibility?.welcomeOfferUncertain === true,
  };
}

/* ------------------------------------------------------------------ *
 * Mục tiêu và chuyến đi
 * ------------------------------------------------------------------ */

const GOAL_TITLE: Record<GoalType, string> = {
  next_card: "Thẻ nên mở tiếp theo",
  trip: "Chuyến bay bạn đang nhắm",
  earn_points: "Tích thêm điểm hằng ngày",
  cash: "Tích điểm quy đổi được thành tiền",
  diversify: "Trải điểm ra nhiều chương trình",
};

function tripView(record: RecommendationRunRecord, index: number): TripNumbersView | null {
  const trace = record.derivedState.goals[index];
  const result = record.outputSnapshot.results[index];
  const trip = trace?.goal.trip;
  if (trip == null || result === undefined) return null;
  const coverage = trace.tripCoverage;
  const balancesUndeclared = (record.outputSnapshot.warnings as string[]).includes("BALANCES_UNDECLARED");
  const goalId = trace.goalId ?? "";
  const missing: { label: string; questionKey: string }[] = [];
  if (trip.cabin === null) missing.push({ label: "hạng ghế", questionKey: `trip_cabin_unknown:${goalId}` });
  if (trip.passengers === null) {
    missing.push({ label: "số người", questionKey: `trip_passengers_unknown:${goalId}` });
  }
  if (trip.roundTrip === null) {
    missing.push({ label: "khứ hồi hay một chiều", questionKey: `trip_round_trip_unknown:${goalId}` });
  }
  return {
    missing,
    routeNotPriced: (result.warnings as string[]).includes("AWARD_ROUTE_NOT_IN_DATASET"),
    destination: REGION_LABEL[trip.destinationRegion],
    cabin: trip.cabin === null ? null : CABIN_LABEL[trip.cabin],
    passengers: trip.passengers,
    roundTrip: trip.roundTrip,
    needLow: result.numbers.tripNeedLow,
    needTypical: result.numbers.tripNeedTypical,
    needHigh: result.numbers.tripNeedHigh,
    // Chưa khai số dư (bỏ qua câu "có điểm ở đâu"): engine xếp hạng như thể 0
    // điểm, nhưng trang KHÔNG được in "gom được 0 điểm · còn thiếu X · phủ 0%"
    // — ba câu khẳng định dựng trên một câu người dùng chưa trả lời, ngay dưới
    // cảnh báo "bạn chưa khai điểm đang có".
    accessible: balancesUndeclared ? null : result.numbers.accessiblePoints,
    accessibleIsLowerBound: balancesUndeclared ? false : result.numbers.accessiblePointsIsLowerBound,
    gap: balancesUndeclared ? null : result.numbers.pointsGapTypical,
    coverage: balancesUndeclared ? null : (coverage?.coverage ?? null),
    // "Ước lượng" nói ra rằng con số phủ là điểm giữa của một khoảng — số dư
    // chưa biết, hoặc chương trình chỉ công bố giá sàn. Trình bày nó như một
    // con số chắc chắn là đúng lỗi §29 sinh ra để tránh.
    coverageIsEstimate: coverage !== null && coverage.coverageKnown === false,
  };
}

/* ------------------------------------------------------------------ *
 * Độ chắc chắn
 * ------------------------------------------------------------------ */

/**
 * Độ chắc chắn: nói NGUYÊN NHÂN NÀO NGƯỜI DÙNG LÀM GÌ ĐƯỢC, rồi mới tới nguyên
 * nhân yếu nhất về mặt số học.
 *
 * Trên bộ dữ liệu hiện tại, `scoreSeparation` gần như luôn là yếu tố thấp nhất
 * — các thẻ tốt ở Canada chênh nhau rất ít. Nếu chỉ lấy yếu tố thấp nhất thì
 * MỌI hồ sơ đều nhận đúng một câu "hai lựa chọn ngang nhau", kể cả người chưa
 * khai gì — và câu đó che mất thứ họ sửa được ngay: trả lời thêm.
 */
function confidenceOf(
  factors: {
    dataCompleteness: number;
    dataFreshness: number;
    goalSpecificity: number;
    scoreSeparation: number;
    level: "high" | "medium" | "low";
  },
  hasFollowUp: boolean,
): { level: "high" | "medium" | "low"; label: string; sentence: string } {
  if (factors.level === "high") {
    return {
      level: factors.level,
      label: CONFIDENCE_LABEL.high,
      sentence: "Không còn chỗ nào mình phải đoán.",
    };
  }
  const WEAK = 0.75;
  const weak = (
    [
      ["dataCompleteness", factors.dataCompleteness],
      ["goalSpecificity", factors.goalSpecificity],
      ["dataFreshness", factors.dataFreshness],
      ["scoreSeparation", factors.scoreSeparation],
    ] as const
  )
    .filter(([, value]) => value < WEAK)
    .sort((a, b) => a[1] - b[1]);

  // Còn câu để hỏi và dữ liệu còn thiếu → nói điều đó trước: đó là thứ người
  // đọc bấm một cái là sửa được.
  const actionable = hasFollowUp && factors.dataCompleteness < WEAK ? "dataCompleteness" : null;
  const lead = actionable ?? weak[0]?.[0] ?? "scoreSeparation";
  const tied = lead !== "scoreSeparation" && factors.scoreSeparation < WEAK;
  const base = CONFIDENCE_BY_CAUSE[lead];
  return {
    level: factors.level,
    label: base.label,
    sentence: tied
      ? `${base.sentence} Hai thẻ đứng đầu cũng đang gần như ngang điểm nhau.`
      : base.sentence,
  };
}

/* ------------------------------------------------------------------ *
 * Ráp lại
 * ------------------------------------------------------------------ */

/**
 * Bao nhiêu lựa chọn khác thì đủ.
 *
 * Ba: đủ để thấy mình có lựa chọn, ít để còn quyết định được. Engine đã cắt
 * `alternatives` theo luật của nó; đây chỉ là trần của trang.
 */
const MAX_ALTERNATIVES = 3;

export function presentRun(
  record: RecommendationRunRecord,
  dataset: RecommendationDataset,
  offers: readonly CreditCardOffer[],
  goalIndex = 0,
): ResultView | null {
  const result = record.outputSnapshot.results[goalIndex];
  if (result === undefined) return null;
  const cards = lookup(record, dataset, offers);
  const runWarnings = [...result.warnings, ...record.outputSnapshot.warnings];
  const primary = actionOf(result.primaryAction, cards, new Set(), runWarnings);
  const primaryReasons = new Set(primary.reasons.map((row) => row.text));
  const noActionIsPrimary = result.primaryAction.kind === "no_new_card";

  return {
    runId: record.id,
    asOf: record.dataSnapshotAt,
    engineVersion: record.engineVersion,
    goalType: result.goalType,
    goalTitle: GOAL_TITLE[result.goalType],
    strategy: STRATEGY_TEXT[result.strategy.strategy],
    primary,
    // Mỗi lựa chọn thay thế phải nói một câu KHÁC nhau: ba dòng giống hệt dưới
    // ba cái tên không giúp ai chọn. Câu đã dùng thì thẻ sau lấy câu kế tiếp.
    alternatives: (() => {
      const used = new Set(primaryReasons);
      return result.alternatives.slice(0, MAX_ALTERNATIVES).map((row) => {
        // KHÔNG truyền cảnh báo: hàng thay thế không có khối cảnh báo nào để
        // truyền sang.
        const view = actionOf(row, cards, used);
        if (view.lead !== null) used.add(view.lead);
        return view;
      });
    })(),
    // "Chưa mở thẻ nào" luôn là một ứng viên (§16 Rule 8), nên nó luôn hiện ra
    // — như một lựa chọn thật, không phải như một dòng chữ an ủi ở cuối trang.
    noAction: noActionIsPrimary ? null : actionOf(result.noAction, cards, primaryReasons),
    // Cảnh báo trùng câu với một lý do đã hiện ngay trên thẻ thì bỏ: người đọc
    // gặp đúng một câu hai lần, và khối "lưu ý" loãng đi vì nó.
    warnings: warningsOf(runWarnings).filter(
      (text) => !primary.reasons.some((reason) => reason.text === text),
    ),
    confidence: confidenceOf(result.confidence, record.outputSnapshot.followUp !== null),
    trip: tripView(record, goalIndex),
    dataVerifiedAt: record.derivedState.goals[goalIndex]?.confidenceInputs.oldestVerifiedAt ?? null,
  };
}

/*
 * Câu chữ về welcome bonus trên thẻ gợi ý. Nằm ở đây — hàm thuần — chứ không
 * viết thẳng trong `result.tsx`, để test khoá được đúng chữ người đọc thấy:
 * bản đầu của cờ `welcomeBonusUncertain` chỉ có trong component, và gỡ nó đi
 * thì không test nào đỏ (vòng Codex 3, 21/09/2026).
 */
export const BONUS_UNCERTAIN_NOTE = "chưa chắc bạn nhận được";

/** Câu mở đầu của thẻ gợi ý chính (hành động `open_card`). */
export function openCardSentence(action: ActionView): string {
  if (action.welcomeBonusBlocked) {
    return "Mở thẻ này cho tỷ lệ tích điểm và quyền lợi của nó — welcome bonus thì bạn không nhận được, vì những thẻ bạn đã từng giữ.";
  }
  // Không dùng `spendSentence` ("… để nhận trọn welcome bonus"): đó là lời
  // hứa cho một bonus mình chưa kiểm được.
  if (action.welcomeBonusUncertain) {
    return "Mở thẻ này là bước đáng làm tiếp theo — nhưng chưa chắc bạn còn nhận được welcome bonus, xem lưu ý bên dưới.";
  }
  return action.spendSentence ?? "Mở thẻ này là bước đáng làm tiếp theo.";
}

/**
 * Câu giới thiệu của một thẻ thay thế khi engine không kèm lý do riêng.
 * Không lấy welcome bonus làm câu giới thiệu cho thẻ người dùng KHÔNG còn nhận
 * được nó — đó đúng là câu quảng cáo sai đối tượng.
 */
export function alternativeBonusLead(action: ActionView): string | null {
  if (action.welcomeBonusBlocked) return "Theo điều khoản, thẻ bạn từng giữ khiến bạn không có welcome bonus.";
  if (!action.welcomeBonus) return null;
  return `Welcome bonus ${action.welcomeBonus}${action.welcomeBonusUncertain ? ` (${BONUS_UNCERTAIN_NOTE})` : ""}${action.annualFee ? `, annual fee ${action.annualFee}` : ""}`;
}

/** Số điểm, dấu phẩy ngăn nghìn — quy ước số của site. */
export function formatPoints(points: number): string {
  return points.toLocaleString("en-US");
}

/**
 * Câu nói phần phủ chuyến đi, hoặc `null` khi không nên nói.
 *
 * Hai luật, dùng chung cho trang và lời giải thích (rà đối kháng Phase 6):
 * phần phủ ≥ 1 thì không in phần trăm vượt 100 ("phủ khoảng 140%" đọc như lời
 * hứa dư dả); và phần phủ ≥ 1 mà vẫn còn thiếu điểm là hai ước lượng mâu thuẫn
 * — giữ con số thiếu, bỏ câu phủ.
 */
export function coverageStatement(trip: Pick<TripNumbersView, "coverage" | "gap">): string | null {
  if (trip.coverage === null || trip.coverage < 0) return null;
  if (trip.coverage >= 1) return trip.gap !== null && trip.gap > 0 ? null : "điểm hiện tại phủ được cả chuyến này";
  return `điểm hiện tại phủ khoảng ${Math.round(trip.coverage * 100)}% chuyến này`;
}

/**
 * Số điểm một chuyến bay cần, nói ĐÚNG cái đã biết.
 *
 * Chỉ biết một đầu thì nói ra là đầu nào: "60,000" trần cho một chặng chỉ biết
 * giá sàn là nói thấp đi con số thật (rà đối kháng Phase 6, 17/09/2026). Dùng
 * chung cho ô số trên trang và mệnh đề của lời giải thích — hai chỗ không được
 * nói hai chuyện.
 */
export function formatNeed(low: number | null, high: number | null): string | null {
  if (low !== null && high !== null) {
    return low === high ? `${formatPoints(low)} điểm` : `${formatPoints(low)} – ${formatPoints(high)} điểm`;
  }
  if (low !== null) return `ít nhất ${formatPoints(low)} điểm (chưa biết mức cao nhất)`;
  if (high !== null) return `tối đa ${formatPoints(high)} điểm (chưa biết mức thấp nhất)`;
  return null;
}

export function programName(dataset: RecommendationDataset, id: PointsProgramId): string {
  return dataset.pointsPrograms.find((row) => row.id === id)?.name ?? (id as string);
}

/* ------------------------------------------------------------------ *
 * "Mình đang dựa vào những gì bạn đã nói"
 * ------------------------------------------------------------------ */

export interface AnsweredRow {
  label: string;
  value: string;
  /** Khoá câu hỏi để sửa lại — `null` khi không sửa được (mục tiêu, nước ở). */
  questionKey: string | null;
}

function amountText(amount: { low: number; high: number | null } | null): string | null {
  if (amount === null) return null;
  const money = (n: number) => `$${n.toLocaleString("en-US")}`;
  if (amount.high === null) return `${money(amount.low)} trở lên`;
  if (amount.high === amount.low) return money(amount.low);
  // In lại đúng nhãn người dùng đã bấm (xem `bands` trong questions.ts): nấc
  // đầu "Dưới $60,000" lưu thành [0, 59,999].
  if (amount.low === 0) return `Dưới ${money(amount.high % 1000 === 999 ? amount.high + 1 : amount.high)}`;
  return `${money(amount.low)} – ${money(amount.high)}`;
}

/**
 * Những gì người dùng ĐÃ nói, đúng thứ engine đọc.
 *
 * Có mặt vì một khuyến nghị dựa trên hồ sơ mà người đọc không thấy được là một
 * hộp đen: họ không kiểm được mình có gõ nhầm không, và không sửa được khi gõ
 * nhầm. Mỗi dòng mang theo khoá câu hỏi, nên "Sửa" mở lại đúng câu đó.
 */
export function answeredRows(state: UserState, dataset: RecommendationDataset): AnsweredRow[] {
  const rows: AnsweredRow[] = [];
  const id = state.profile.id as string;
  /** Câu hỏi về chính người dùng — khoá không mang id phiên. */
  const self = (kind: Parameters<typeof publicQuestionKey>[0]) => publicQuestionKey(kind, id, id);
  const goal = state.goals[0];
  if (goal !== undefined) {
    rows.push({
      label: "Mục tiêu",
      value:
        goal.type === "trip"
          ? `Bay ${REGION_LABEL[goal.destinationRegion]}`
          : GOAL_TITLE[goal.type],
      questionKey: null,
    });
  }
  if (goal?.type === "trip") {
    if (goal.cabin !== null) {
      rows.push({ label: "Hạng ghế", value: CABIN_LABEL[goal.cabin], questionKey: questionKey("trip_cabin_unknown", goal.id as string) });
    }
    if (goal.passengers !== null) {
      rows.push({ label: "Số người", value: `${goal.passengers}`, questionKey: questionKey("trip_passengers_unknown", goal.id as string) });
    }
    if (goal.roundTrip !== null) {
      rows.push({
        label: "Loại vé",
        value: goal.roundTrip ? "Khứ hồi" : "Một chiều",
        questionKey: questionKey("trip_round_trip_unknown", goal.id as string),
      });
    }
    if (goal.flexibility !== null) {
      rows.push({
        label: "Ngày bay linh hoạt",
        value: { low: "Cố định", medium: "Xê dịch được vài ngày", high: "Rất linh hoạt" }[
          goal.flexibility
        ],
        questionKey: questionKey("trip_flexibility_unknown", goal.id as string),
      });
    }
    if (goal.travelStart !== null) {
      rows.push({
        label: "Thời gian bay",
        value: `Tháng ${Number(goal.travelStart.slice(5, 7))}/${goal.travelStart.slice(0, 4)}`,
        questionKey: questionKey("trip_dates_unknown", goal.id as string),
      });
    }
  }
  if (state.declared.cards) {
    const nameOf = (productId: string) =>
      dataset.products.find((product) => product.id === productId)?.name;
    const named = (status: (card: UserState["cards"][number]) => boolean) =>
      state.cards
        .filter(status)
        .map((card) => nameOf(card.productId as string))
        .filter((name): name is string => name !== undefined);
    const held = named((card) => card.status === "active");
    rows.push({
      label: "Thẻ đang giữ",
      value: held.length === 0 ? "Chưa có thẻ nào" : held.join(", "),
      questionKey: self("cards_undeclared"),
    });
    const closed = named((card) => card.status !== "active");
    if (closed.length > 0) {
      rows.push({
        label: "Thẻ từng giữ",
        value: closed.join(", "),
        questionKey: self("cards_undeclared"),
      });
    }
    // Tháng đóng thẻ đổi được cửa welcome bonus, nên nó phải sửa được — mỗi
    // thẻ một dòng, vì mỗi thẻ là một câu hỏi riêng.
    for (const card of state.cards) {
      if (card.status === "active" || card.closedDate === null) continue;
      const [year, month] = card.closedDate.split("-").map(Number);
      rows.push({
        label: `Tháng đóng ${nameOf(card.productId as string) ?? "thẻ"}`,
        value: `${month}/${year}`,
        questionKey: questionKey("card_closed_date_unknown", card.id as string),
      });
    }
  }
  if (state.declared.balances) {
    rows.push({
      label: "Điểm đang có",
      value:
        state.balances.length === 0
          ? "Chưa có điểm nào"
          : state.balances.map((row) => programName(dataset, row.programId)).join(", "),
      questionKey: self("balances_undeclared"),
    });
    // Mỗi số dư ĐÃ KHAI một dòng riêng: con số đó quyết định "còn thiếu bao
    // nhiêu điểm", nên gõ nhầm một chữ số phải sửa được mà không phải khai lại
    // cả danh sách.
    for (const row of state.balances) {
      if (row.balance === null) continue;
      rows.push({
        label: `Số điểm ${programName(dataset, row.programId)}`,
        value: formatPoints(row.balance),
        questionKey: questionKey("point_balance_amount_unknown", row.programId as string),
      });
    }
  }
  const capacity = amountText(state.spend?.minimumSpendCapacity3m ?? null);
  if (capacity !== null) {
    rows.push({
      label: "Spend dồn được trong 3 tháng",
      value: capacity,
      questionKey: self("minimum_spend_capacity_unknown"),
    });
  }
  const monthly = amountText(state.spend?.monthlyTotal ?? null);
  if (monthly !== null) {
    rows.push({
      label: "Spend mỗi tháng",
      value: monthly,
      questionKey: self("monthly_total_unknown"),
    });
  }
  // Chi tiêu theo hạng mục: engine hỏi từng hạng mục một, nên sửa cũng từng
  // hạng mục một.
  for (const [category, amount] of Object.entries(state.spend?.byCategory ?? {})) {
    const text = amountText(amount ?? null);
    if (text === null) continue;
    rows.push({
      label: `Chi cho ${CATEGORY_LABEL[category as SpendCategory]}`,
      value: text,
      questionKey: questionKey("spend_category_unknown", category as string),
    });
  }
  const income = amountText(state.profile.annualPersonalIncome);
  if (income !== null || state.profile.personalIncomeDeclined) {
    rows.push({
      label: "Thu nhập cá nhân",
      value: income ?? "Không muốn trả lời",
      questionKey: self("personal_income_unknown"),
    });
  }
  const household = amountText(state.profile.annualHouseholdIncome);
  if (household !== null || state.profile.householdIncomeDeclined) {
    rows.push({
      label: "Thu nhập hộ gia đình",
      value: household ?? "Không muốn trả lời",
      questionKey: self("household_income_unknown"),
    });
  }
  const fee = state.profile.annualFeeTolerancePerCard;
  if (fee !== null) {
    rows.push({
      label: "Annual fee chấp nhận được",
      value: fee >= 10_000 ? "Bao nhiêu cũng được nếu đáng" : `Tới $${fee.toLocaleString("en-US")}`,
      questionKey: self("annual_fee_tolerance_unknown"),
    });
  }
  const yesNo = (value: boolean) => (value ? "Có" : "Không");
  if (state.profile.businessCardsAllowed !== null) {
    rows.push({
      label: "Xét thẻ doanh nghiệp",
      value: yesNo(state.profile.businessCardsAllowed),
      questionKey: self("business_cards_preference_unknown"),
    });
  }
  if (state.profile.hasBusiness !== null) {
    rows.push({
      label: "Có doanh nghiệp / tự doanh",
      value: yesNo(state.profile.hasBusiness),
      questionKey: self("business_ownership_unknown"),
    });
  }
  if (state.profile.isStudent !== null) {
    rows.push({
      label: "Đang là sinh viên",
      value: yesNo(state.profile.isStudent),
      questionKey: self("student_status_unknown"),
    });
  }
  return rows;
}
