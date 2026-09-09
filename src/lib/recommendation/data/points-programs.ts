import {
  id,
  makeId,
  type PointsProgram,
  type PointsProgramId,
  type ProgramValuation,
  type ProgramValuationId,
} from "../types.ts";

const VALUED_ON = "2026-09-07";

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
    name: "Avios®",
    programType: "airline",
    transferable: false,
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
];

export const PROGRAM_VALUATIONS: ProgramValuation[] = VALUATIONS.map((v) => ({
  // Khoá bằng `id` của chương trình, KHÔNG bằng `slug`: hai thứ đó khác nhau
  // ở ít nhất một chương trình (`bonvoy` vs `marriott-bonvoy`), và dùng nhầm
  // slug làm khoá ngoại thì dòng định giá trỏ vào hư không — validator bắt
  // được ngay, nhưng chỉ vì phép kiểm khoá ngoại tồn tại.
  id: makeId<ProgramValuationId>("val", v.programId, VALUED_ON),
  programId: id<PointsProgramId>(v.programId),
  centsPerPoint: v.centsPerPoint,
  effectiveFrom: VALUED_ON,
  effectiveTo: null,
  sourceUrl: v.sourceUrl ?? null,
  sourceKind: v.confidence === "verified" ? "issuer" : "ghe1a",
  verifiedAt: VALUED_ON,
  recordedAt: VALUED_ON,
  confidence: v.confidence,
}));
