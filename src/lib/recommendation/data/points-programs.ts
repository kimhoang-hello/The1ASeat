import {
  id,
  makeId,
  type PointsProgram,
  type PointsProgramId,
  type ProgramValuation,
  type ProgramValuationId,
  type RedemptionMode,
} from "../types.ts";

const VALUED_ON = "2026-09-07";

/**
 * Ngày cột định giá TIỀN MẶT được đưa vào kho.
 *
 * Tách khỏi `VALUED_ON` vì `recordedAt` và `effectiveFrom` là HAI TRỤC khác
 * nhau (xem `Temporal` / `Sourced`): tỷ lệ 1 cent của Scene+™ đã đúng từ lâu
 * — nên `effectiveFrom` vẫn là `VALUED_ON` và một lượt chạy dựng lại cho ngày
 * 10/09 vẫn có giá để đọc — nhưng mình chỉ BIẾT nó ngày 20/09. Ghi
 * `recordedAt` là `VALUED_ON` sẽ làm `datasetAt(..., { knownAt })` cho một
 * lượt chạy của quá khứ đọc được một dòng chưa tồn tại lúc đó, đúng thứ
 * `recordedAt` sinh ra để chặn.
 */
const CASH_RECORDED_ON = "2026-09-20";

/**
 * Các chương trình điểm engine cần biết ở V1.
 *
 * `defaultCurrencyValue` là định giá TƯƠNG ĐỐI, chỉ để engine so phương án
 * này với phương án kia. Nó KHÔNG được hiện ra trước mặt người đọc như một
 * tuyên bố về CPP (spec §3.3) — trang calculator đã có bộ định giá riêng cho
 * việc đó trong `lib/points-programs.ts`, và ba con số ở đó (1.8 / 1.6 / 1.9)
 * là những con số site thật sự đứng sau. Ở đây chúng được lặp lại y nguyên
 * cho ba chương trình đó để hai chỗ không nói hai giá khác nhau về cùng một
 * đồng điểm; `audit:reco-data` bắt nếu chúng lệch.
 *
 * Điểm giá cố định (TD Rewards, Aventura, WestJet) thì định giá KHÔNG phải
 * ước lượng: nhà phát hành công bố tỷ lệ đổi, nên nó là dữ kiện.
 */
export const POINTS_PROGRAMS: PointsProgram[] = [
  {
    id: id<PointsProgramId>("amex-mr"),
    slug: "amex-mr",
    name: "Amex Membership Rewards®",
    programType: "flexible_bank",
    transferable: true,
    cashOut: "redeemable",
    calculatorProgramId: "amex-mr",
    cardFilterProgramId: "amex-mr",
    awardChartProgramId: null,
    contentPattern: /membership rewards|amex mr\b/i,
  },
  {
    id: id<PointsProgramId>("avion"),
    slug: "avion",
    name: "RBC Avion®",
    programType: "flexible_bank",
    transferable: true,
    cashOut: "redeemable",
    calculatorProgramId: "rbc-avion",
    cardFilterProgramId: "avion",
    awardChartProgramId: null,
    contentPattern: /avion/i,
  },
  {
    id: id<PointsProgramId>("aeroplan"),
    slug: "aeroplan",
    name: "Air Canada® Aeroplan®",
    programType: "airline",
    transferable: false,
    cashOut: "none",
    calculatorProgramId: "aeroplan",
    cardFilterProgramId: "aeroplan",
    awardChartProgramId: "aeroplan",
    contentPattern: /aeroplan/i,
  },
  {
    // Avios là ĐỒNG TIỀN mà British Airways, Qatar, Iberia và Aer Lingus dùng
    // chung — không phải tên chương trình của riêng hãng nào. Cùng cách gọi
    // với `award-charts.ts`.
    id: id<PointsProgramId>("avios"),
    slug: "avios",
    // Tên hiện cho người đọc lấy hãng phổ biến nhất ở Canada làm mốc — "Avios®"
    // trần thì người mới không biết đó là điểm của hãng nào (user chốt 18/09/2026).
    name: "British Airways® Avios®",
    programType: "airline",
    transferable: false,
    cashOut: "none",
    calculatorProgramId: null,
    cardFilterProgramId: null,
    awardChartProgramId: null,
    contentPattern: null,
  },
  {
    id: id<PointsProgramId>("flying-blue"),
    slug: "flying-blue",
    name: "Air France KLM® Flying Blue®",
    programType: "airline",
    transferable: false,
    cashOut: "none",
    calculatorProgramId: null,
    cardFilterProgramId: null,
    awardChartProgramId: null,
    contentPattern: null,
  },
  {
    id: id<PointsProgramId>("asia-miles"),
    slug: "asia-miles",
    name: "Cathay Pacific® Asia Miles®",
    programType: "airline",
    transferable: false,
    cashOut: "none",
    calculatorProgramId: null,
    cardFilterProgramId: null,
    awardChartProgramId: "asia-miles",
    contentPattern: null,
  },
  {
    id: id<PointsProgramId>("aadvantage"),
    slug: "aadvantage",
    name: "American Airlines® AAdvantage®",
    programType: "airline",
    transferable: false,
    cashOut: "none",
    calculatorProgramId: null,
    cardFilterProgramId: null,
    awardChartProgramId: "aadvantage",
    contentPattern: null,
  },
  {
    id: id<PointsProgramId>("bonvoy"),
    slug: "marriott-bonvoy",
    name: "Marriott Bonvoy®",
    programType: "hotel",
    transferable: true,
    cashOut: "none",
    calculatorProgramId: null,
    cardFilterProgramId: "bonvoy",
    awardChartProgramId: null,
    contentPattern: /bonvoy/i,
  },
  {
    id: id<PointsProgramId>("scene-plus"),
    slug: "scene-plus",
    name: "Scene+™",
    programType: "fixed_value",
    transferable: false,
    cashOut: "redeemable",
    calculatorProgramId: null,
    cardFilterProgramId: "scene-plus",
    awardChartProgramId: null,
    contentPattern: /scene\s*\+/i,
  },
  {
    // 200 điểm = $1 tiền vé qua Expedia® For TD, và KHÔNG chuyển sang hãng
    // nào — chính là điều làm nó khác Aeroplan về bản chất, không chỉ về giá.
    id: id<PointsProgramId>("td-rewards"),
    slug: "td-rewards",
    name: "TD Rewards®",
    programType: "fixed_value",
    transferable: false,
    cashOut: "redeemable",
    calculatorProgramId: null,
    cardFilterProgramId: "td-rewards",
    awardChartProgramId: null,
    contentPattern: /td rewards/i,
  },
  {
    id: id<PointsProgramId>("aventura"),
    slug: "aventura",
    name: "CIBC Aventura®",
    programType: "fixed_value",
    transferable: false,
    cashOut: "redeemable",
    calculatorProgramId: null,
    cardFilterProgramId: "aventura",
    awardChartProgramId: null,
    contentPattern: /aventura/i,
  },
  {
    id: id<PointsProgramId>("westjet"),
    slug: "westjet",
    name: "WestJet® Rewards",
    programType: "fixed_value",
    transferable: false,
    cashOut: "none",
    calculatorProgramId: null,
    cardFilterProgramId: "westjet",
    awardChartProgramId: null,
    contentPattern: /westjet/i,
  },
  {
    id: id<PointsProgramId>("viporter"),
    slug: "viporter",
    name: "VIPorter®",
    programType: "fixed_value",
    transferable: false,
    cashOut: "none",
    calculatorProgramId: null,
    cardFilterProgramId: "viporter",
    awardChartProgramId: null,
    contentPattern: /viporter/i,
  },
  {
    id: id<PointsProgramId>("mileageplus"),
    slug: "mileageplus",
    name: "United® MileagePlus®",
    programType: "airline",
    transferable: false,
    cashOut: "none",
    calculatorProgramId: null,
    cardFilterProgramId: "mileageplus",
    awardChartProgramId: null,
    contentPattern: /mileageplus/i,
  },
  {
    id: id<PointsProgramId>("a-la-carte"),
    slug: "a-la-carte",
    name: "À la carte™",
    programType: "fixed_value",
    transferable: false,
    cashOut: "none",
    calculatorProgramId: null,
    cardFilterProgramId: "a-la-carte",
    awardChartProgramId: null,
    contentPattern: /à la carte/i,
  },
  {
    // Đồng tiền giả cho thẻ cashback, để engine so thẳng 4% hoàn tiền với 2x
    // điểm mà không cần một nhánh riêng trong mọi phép tính.
    //
    // ĐƠN VỊ: một "điểm" ở đây là MỘT CENT, nên `defaultCurrencyValue` là 1 và
    // `multiplier` trong `earning-rates.ts` là phần trăm đọc thành số (4% → 4).
    // Nhân ra: $1 chi tiêu × 4 = 4 điểm = 4 cent, đúng bằng 4%. Đặt giá trị
    // thành 100 ("một điểm là một đô") thì cùng phép nhân đó ra $4 cho mỗi $1
    // chi — sai gấp trăm lần, và sai theo hướng làm mọi thẻ cashback thắng.
    id: id<PointsProgramId>("cash-back"),
    slug: "cash-back",
    name: "Cash back",
    programType: "cash_back",
    transferable: false,
    cashOut: "redeemable",
    calculatorProgramId: null,
    cardFilterProgramId: "cash-back",
    awardChartProgramId: null,
    contentPattern: /hoàn tiền|cash\s?back/i,
  },
];

/**
 * Định giá điểm, có hiệu lực theo thời gian.
 *
 * Devalue = ĐÓNG dòng cũ rồi thêm dòng mới, không sửa số tại chỗ. Đây là con
 * số mọi hàm chấm điểm nhân vào, nên ghi đè nó là làm mọi khuyến nghị cũ không
 * giải thích lại được — chúng sẽ được "giải thích" bằng một định giá chưa tồn
 * tại lúc chúng được đưa ra.
 *
 * Ba chương trình đầu lặp lại đúng con số trong `lib/points-programs.ts` (bộ
 * định giá của trang calculator) để hai chỗ không nói hai giá khác nhau về
 * cùng một đồng điểm; `audit:reco-data` bắt khi chúng lệch.
 */
type Valuation = {
  programId: string;
  /**
   * Vắng = `"best"`. Viết ra chỉ ở dòng tiền mặt, để bảng dưới đọc được bằng
   * mắt: dòng nào không nói gì là dòng giá trị cao nhất, đúng như trước khi có
   * kiểu đổi.
   */
  redemption?: RedemptionMode;
  centsPerPoint: number;
  /**
   * `verified` cho điểm GIÁ CỐ ĐỊNH: TD Rewards đổi 200 điểm ăn $1 tiền vé là
   * tỷ lệ nhà phát hành công bố, không phải ước lượng của ai. `editorial` cho
   * điểm hàng không, nơi giá trị phụ thuộc vào chuyến bay đổi được.
   *
   * Đánh tất cả thành `editorial` sẽ làm engine hạ độ tin cậy cho những thẻ mà
   * giá trị điểm là thứ chắc chắn nhất về chúng.
   */
  confidence: "verified" | "editorial";
  sourceUrl?: string;
};

const VALUATIONS: Valuation[] = [
  { programId: "amex-mr", centsPerPoint: 1.8, confidence: "editorial" },
  { programId: "avion", centsPerPoint: 1.6, confidence: "editorial" },
  { programId: "aeroplan", centsPerPoint: 1.9, confidence: "editorial" },
  { programId: "avios", centsPerPoint: 1.7, confidence: "editorial" },
  { programId: "flying-blue", centsPerPoint: 1.5, confidence: "editorial" },
  { programId: "asia-miles", centsPerPoint: 1.6, confidence: "editorial" },
  { programId: "aadvantage", centsPerPoint: 1.7, confidence: "editorial" },
  { programId: "bonvoy", centsPerPoint: 0.9, confidence: "editorial" },
  { programId: "scene-plus", centsPerPoint: 1.0, confidence: "verified" },
  { programId: "td-rewards", centsPerPoint: 0.5, confidence: "verified" },
  { programId: "aventura", centsPerPoint: 1.0, confidence: "verified" },
  { programId: "westjet", centsPerPoint: 1.0, confidence: "verified" },
  { programId: "viporter", centsPerPoint: 1.0, confidence: "verified" },
  { programId: "mileageplus", centsPerPoint: 1.4, confidence: "editorial" },
  { programId: "a-la-carte", centsPerPoint: 1.0, confidence: "verified" },
  { programId: "cash-back", centsPerPoint: 1, confidence: "verified" },

  /* ---- Giá khi RÚT RA TIỀN (`redemption: "cash"`) -------------------- *
   *
   * Chỉ chương trình có `cashOut: "redeemable"` mới có dòng ở đây, và
   * `validate.ts` cưỡng chế chiều ngược lại: khai `redeemable` mà không có
   * dòng nào là lỗi. Năm dòng đầu là con số user chốt 20/09/2026.
   *
   * Bốn dòng điểm-giá-cố-định trùng đúng giá `best` của chính chúng; hai dòng
   * đầu thì KHÔNG, và chúng là lý do cột này tồn tại: Membership Rewards®
   * đáng 1.8 cent khi đổi vé và đúng 1 cent khi trả vào sao kê, Avion® là
   * 1.6 và 1. Một cột định giá duy nhất buộc phải nói dối một trong hai câu
   * hỏi.
   *
   * Membership Rewards® và Avion® vào bảng ngày 20/09/2026 (user chốt, 100
   * điểm = $1 cả hai). Trước đó chúng mang `cashOut: "unknown"` — và chính ca
   * đó lộ ra rằng một đồng điểm chưa tra khác hẳn một đồng điểm đã tra và
   * biết không rút được. Nhánh xử lý `unknown` vẫn còn nguyên trong engine
   * cho chương trình sau này, dù hôm nay không ai rơi vào nó.
   *
   * Và tỷ lệ rút tiền sẽ còn lệch nữa. Trang "Pay Off Purchases" của TD ghi 400 điểm = $1 cho
   * giao dịch thường (0.25 cent) và 225 điểm = $1 cho giao dịch du lịch
   * (0.44 cent) — không đường nào ra đúng 0.5 cent; 200 điểm = $1 là tỷ lệ
   * ĐỔI VÉ qua Expedia® For TD. Trang "Payment with Points" của CIBC ghi
   * 4,000 Aventura® = $25 (0.625 cent) khi trả vào sao kê, còn 100 điểm = $1
   * là tỷ lệ của Shopping with Points (trừ thẳng một giao dịch đang chờ).
   * Con số ở đây là đường user chốt 20/09/2026; hai dòng đó để `editorial`
   * chứ không `verified` đúng vì chúng chưa khớp trang chính chủ nào.
   */
  { programId: "amex-mr", redemption: "cash", centsPerPoint: 1.0, confidence: "editorial" },
  { programId: "avion", redemption: "cash", centsPerPoint: 1.0, confidence: "editorial" },
  { programId: "scene-plus", redemption: "cash", centsPerPoint: 1.0, confidence: "verified" },
  { programId: "aventura", redemption: "cash", centsPerPoint: 1.0, confidence: "editorial" },
  { programId: "td-rewards", redemption: "cash", centsPerPoint: 0.5, confidence: "editorial" },
  // Đồng tiền giả: một "điểm" LÀ một cent, nên rút ra tiền không mất gì.
  { programId: "cash-back", redemption: "cash", centsPerPoint: 1, confidence: "verified" },
];

export const PROGRAM_VALUATIONS: ProgramValuation[] = VALUATIONS.map((v) => ({
  // KIỂU ĐỔI vào id: nếu không, dòng tiền mặt và dòng giá tốt nhất của cùng
  // một chương trình dùng chung một id, và `checkUniqueIds` bắt ngay — nhưng
  // chỉ vì phép kiểm đó tồn tại. Id tự phân biệt thì không phụ thuộc vào nó.
  // Khoá bằng `id` của chương trình, KHÔNG bằng `slug`: hai thứ đó khác nhau
  // ở ít nhất một chương trình (`bonvoy` vs `marriott-bonvoy`), và dùng nhầm
  // slug làm khoá ngoại thì dòng định giá trỏ vào hư không — validator bắt
  // được ngay, nhưng chỉ vì phép kiểm khoá ngoại tồn tại.
  id: makeId<ProgramValuationId>("val", v.programId, v.redemption ?? "best", VALUED_ON),
  programId: id<PointsProgramId>(v.programId),
  redemption: v.redemption ?? "best",
  centsPerPoint: v.centsPerPoint,
  effectiveFrom: VALUED_ON,
  effectiveTo: null,
  sourceUrl: v.sourceUrl ?? null,
  sourceKind: v.confidence === "verified" ? "issuer" : "ghe1a",
  verifiedAt: v.redemption === "cash" ? CASH_RECORDED_ON : VALUED_ON,
  recordedAt: v.redemption === "cash" ? CASH_RECORDED_ON : VALUED_ON,
  confidence: v.confidence,
}));
