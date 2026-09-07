import { id, type PointsProgram, type PointsProgramId } from "../types";

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
    defaultCurrencyValue: 1.8,
    calculatorProgramId: "amex-mr",
    cardFilterProgramId: "amex-mr",
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("avion"),
    slug: "avion",
    name: "RBC Avion®",
    programType: "flexible_bank",
    transferable: true,
    defaultCurrencyValue: 1.6,
    calculatorProgramId: "rbc-avion",
    cardFilterProgramId: "avion",
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("aeroplan"),
    slug: "aeroplan",
    name: "Air Canada® Aeroplan®",
    programType: "airline",
    transferable: false,
    defaultCurrencyValue: 1.9,
    calculatorProgramId: "aeroplan",
    cardFilterProgramId: "aeroplan",
    awardChartProgramId: "aeroplan",
  },
  {
    // Avios là ĐỒNG TIỀN mà British Airways, Qatar, Iberia và Aer Lingus dùng
    // chung — không phải tên chương trình của riêng hãng nào. Cùng cách gọi
    // với `award-charts.ts`.
    id: id<PointsProgramId>("avios"),
    slug: "avios",
    name: "Avios",
    programType: "airline",
    transferable: false,
    defaultCurrencyValue: 1.7,
    calculatorProgramId: null,
    cardFilterProgramId: null,
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("flying-blue"),
    slug: "flying-blue",
    name: "Air France KLM® Flying Blue®",
    programType: "airline",
    transferable: false,
    defaultCurrencyValue: 1.5,
    calculatorProgramId: null,
    cardFilterProgramId: null,
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("asia-miles"),
    slug: "asia-miles",
    name: "Cathay Pacific® Asia Miles®",
    programType: "airline",
    transferable: false,
    defaultCurrencyValue: 1.6,
    calculatorProgramId: null,
    cardFilterProgramId: null,
    awardChartProgramId: "asia-miles",
  },
  {
    id: id<PointsProgramId>("aadvantage"),
    slug: "aadvantage",
    name: "American Airlines® AAdvantage®",
    programType: "airline",
    transferable: false,
    defaultCurrencyValue: 1.7,
    calculatorProgramId: null,
    cardFilterProgramId: null,
    awardChartProgramId: "aadvantage",
  },
  {
    id: id<PointsProgramId>("bonvoy"),
    slug: "marriott-bonvoy",
    name: "Marriott Bonvoy®",
    programType: "hotel",
    transferable: true,
    defaultCurrencyValue: 0.9,
    calculatorProgramId: null,
    cardFilterProgramId: "bonvoy",
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("scene-plus"),
    slug: "scene-plus",
    name: "Scene+™",
    programType: "fixed_value",
    transferable: false,
    defaultCurrencyValue: 1.0,
    calculatorProgramId: null,
    cardFilterProgramId: "scene-plus",
    awardChartProgramId: null,
  },
  {
    // 200 điểm = $1 tiền vé qua Expedia® For TD, và KHÔNG chuyển sang hãng
    // nào — chính là điều làm nó khác Aeroplan về bản chất, không chỉ về giá.
    id: id<PointsProgramId>("td-rewards"),
    slug: "td-rewards",
    name: "TD Rewards",
    programType: "fixed_value",
    transferable: false,
    defaultCurrencyValue: 0.5,
    calculatorProgramId: null,
    cardFilterProgramId: "td-rewards",
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("aventura"),
    slug: "aventura",
    name: "CIBC Aventura®",
    programType: "fixed_value",
    transferable: false,
    defaultCurrencyValue: 1.0,
    calculatorProgramId: null,
    cardFilterProgramId: "aventura",
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("westjet"),
    slug: "westjet",
    name: "WestJet® Rewards",
    programType: "fixed_value",
    transferable: false,
    defaultCurrencyValue: 1.0,
    calculatorProgramId: null,
    cardFilterProgramId: "westjet",
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("viporter"),
    slug: "viporter",
    name: "VIPorter®",
    programType: "fixed_value",
    transferable: false,
    defaultCurrencyValue: 1.0,
    calculatorProgramId: null,
    cardFilterProgramId: "viporter",
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("mileageplus"),
    slug: "mileageplus",
    name: "United® MileagePlus®",
    programType: "airline",
    transferable: false,
    defaultCurrencyValue: 1.4,
    calculatorProgramId: null,
    cardFilterProgramId: "mileageplus",
    awardChartProgramId: null,
  },
  {
    id: id<PointsProgramId>("a-la-carte"),
    slug: "a-la-carte",
    name: "À la carte™",
    programType: "fixed_value",
    transferable: false,
    defaultCurrencyValue: 1.0,
    calculatorProgramId: null,
    cardFilterProgramId: "a-la-carte",
    awardChartProgramId: null,
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
    defaultCurrencyValue: 1,
    calculatorProgramId: null,
    cardFilterProgramId: "cash-back",
    awardChartProgramId: null,
  },
];
