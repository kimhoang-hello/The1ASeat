import {
  id,
  type AwardStrategy,
  type AwardStrategyId,
  type PointsProgramId,
  type TripRegion,
} from "../types";

/**
 * KHOẢNG điểm cho một CÁCH đi, không phải giá của một chuyến bay (spec §6).
 *
 * "YYZ → Sài Gòn business = 102,500 Aeroplan" là một con số nghe chắc chắn mà
 * không đúng: Aeroplan tính theo TỔNG quãng đường các chặng thật sự bay, nên
 * cùng đôi thành phố ấy đổi giá theo đường nối — YVR→SGN qua Seoul rơi vào
 * band thấp hơn cùng chuyến qua Tokyo. Ba số low/typical/high nói đúng thứ
 * biết được, và quyết định `NO_NEW_CARD` thắng hay thua ở Phase 3 dựa trên
 * việc so số dư với KHOẢNG này.
 *
 * MỘT CHIỀU, MỘT NGƯỜI. Nhân đôi cho khứ hồi và nhân theo số khách là việc
 * của engine — nhân sẵn ở dữ liệu thì không cách nào chia lại cho một chuyến
 * một chiều.
 *
 * NGUỒN: `lib/award-charts.ts`, tức chính bảng giá Award Flight Finder đang
 * dùng — đã tra tại nguồn và có ngày kiểm. Không tra lại lần hai: hai chỗ tra
 * độc lập là hai chỗ sẽ lệch, và ở đây lệch nghĩa là engine bảo "đủ điểm rồi"
 * trong khi trang tra cứu ngay bên cạnh nói ngược lại.
 *
 * PHẠM VI CÓ HẠN, VÀ ĐÓ LÀ TRUNG THỰC. Spec §33 nêu 5 vùng; bảng giá trong
 * repo chỉ phủ **Canada → Đông Nam Á / Việt Nam**. Bốn vùng còn lại KHÔNG
 * được seed bằng số ước chừng — thà engine nói "chưa có dữ liệu cho chặng
 * này" còn hơn nói một con số không ai tra được. `audit:reco-data` liệt kê
 * các vùng còn trống.
 */

const AWARD_CHART_SOURCE = "src/lib/award-charts.ts";

type StrategySeed = {
  key: string;
  origin: TripRegion;
  destination: TripRegion;
  program: string;
  name: string;
  /** [economy, premium_economy, business] — mỗi phần tử là [low, typical, high]
   *  hoặc `null` khi chương trình không bán hạng đó trên chặng này. */
  economy: [number, number, number] | null;
  premium: [number, number, number] | null;
  business: [number, number, number] | null;
  surcharge: "low" | "medium" | "high";
  availability: "easy" | "medium" | "hard";
  complexity: "simple" | "moderate" | "complex";
  confidence: "verified" | "estimated";
  verifiedAt: string;
  sourceUrl: string;
  note: string;
};

const SEEDS: StrategySeed[] = [
  {
    key: "aeroplan-ca-sea",
    origin: "CANADA_US",
    destination: "SEA_VIETNAM",
    program: "aeroplan",
    name: "Aeroplan® / Star Alliance™ qua đối tác",
    // Cột "All other partners" của Air Canada®: cố định và có bảo đảm. Mọi
    // hành trình Canada → Đông Nam Á rơi vào band 7,501–11,000 hoặc 11,001+,
    // nên khoảng chạy từ cận dưới của band đầu tới cận trên của band sau.
    economy: [65000, 65000, 70000],
    // Premium Economy KHÔNG có trong cột đối tác cố định — nó chỉ tồn tại ở
    // cột "Air Canada and/or Select Partners", vốn là giá động và chỉ công bố
    // mức sàn. Vì thế `confidence` của cả nhóm này là `estimated`, và
    // `pointsLow` ở đây là SÀN chứ không phải giá.
    premium: [85000, 90000, 95000],
    business: [102500, 102500, 115000],
    surcharge: "low",
    availability: "medium",
    complexity: "moderate",
    confidence: "verified",
    verifiedAt: "2026-08-23",
    sourceUrl: "https://www.aircanada.com/ca/en/aco/home/aeroplan/redeem/air-canada.html",
    note:
      "Số của cột đối tác cố định. Hành trình bay toàn bằng Air Canada® được " +
      "định giá động, không theo bảng này. Có chặng đối tác thì thu thêm phí đặt vé.",
  },
  {
    key: "aadvantage-ca-sea",
    origin: "CANADA_US",
    destination: "SEA_VIETNAM",
    program: "aadvantage",
    name: "AAdvantage® qua đối tác oneworld",
    // Bảng theo VÙNG, không theo khoảng cách: Việt Nam nằm ở Asia Region 2, và
    // một mức giá duy nhất cho cả vùng. Nên low = typical = high — đây là chỗ
    // ba con số bằng nhau nói đúng bản chất chứ không phải thiếu dữ liệu.
    economy: [37500, 37500, 37500],
    premium: [50000, 50000, 50000],
    business: [70000, 70000, 70000],
    surcharge: "low",
    availability: "hard",
    complexity: "complex",
    confidence: "verified",
    verifiedAt: "2026-08-09",
    sourceUrl:
      "https://www.aa.com/web/i18n/aadvantage-program/use-miles/partner-airline-flights.html",
    note:
      "Chỉ áp cho chặng do đối tác khai thác; máy bay của chính American " +
      "Airlines® được định giá động và không dùng bảng này.",
  },
  {
    key: "asia-miles-ca-sea",
    origin: "CANADA_US",
    destination: "SEA_VIETNAM",
    program: "asia-miles",
    name: "Asia Miles® trên máy bay Cathay Pacific®",
    // Mọi hành trình Canada → Đông Nam Á rơi vào band 7,501+ duy nhất, nên ba
    // con số bằng nhau.
    economy: [38000, 38000, 38000],
    premium: [78000, 78000, 78000],
    business: [119000, 119000, 119000],
    surcharge: "medium",
    availability: "medium",
    complexity: "moderate",
    // Cathay đã RÚT bảng giá khỏi trang chính thức. Số này dựng lại từ ba
    // nguồn thứ cấp đồng thuận — thật và kiểm chứng được, nhưng không phải là
    // thứ hãng đứng sau, nên `estimated`.
    confidence: "estimated",
    verifiedAt: "2026-08-09",
    sourceUrl:
      "https://flights.cathaypacific.com/en_CA/redeem-flights/flight-award-chart.html",
    note:
      "Cathay không còn công bố bảng giá; số dựng lại từ ba nguồn độc lập " +
      "đồng thuận. Đây là mức cho máy bay Cathay khai thác — bảng đối tác cao hơn vài nghìn.",
  },
];

/** Chương trình có bảng giá nhưng KHÔNG quote được, kèm lý do. Có mặt ở đây
 *  để engine phân biệt "chưa ai làm" với "đã tra và kết luận là không nói
 *  được" — hai thứ dẫn tới hai câu trả lời khác nhau cho người đọc. */
export const UNQUOTABLE_AWARD_PROGRAMS: { programId: string; reason: string }[] = [
  {
    programId: "avios",
    reason:
      "British Airways® và Qatar® chia bảng giá theo từng hãng khai thác, có " +
      "mức peak/off-peak, và devalue đối tác lần gần nhất 15/12/2025. Không " +
      "nguồn công khai nào dựng lại đủ tin cậy.",
  },
  {
    programId: "flying-blue",
    reason: "Flying Blue® định giá hoàn toàn động, không có bảng giá nào cả.",
  },
  {
    programId: "mileageplus",
    reason:
      "United® không công bố bảng giá vé thưởng; số miles đổi một chặng thay " +
      "đổi theo từng chuyến, kể cả trên đối tác Star Alliance™.",
  },
];

export const AWARD_STRATEGIES: AwardStrategy[] = SEEDS.flatMap((seed) =>
  (
    [
      ["economy", seed.economy],
      ["premium_economy", seed.premium],
      ["business", seed.business],
    ] as const
  )
    .filter(([, range]) => range !== null)
    .map(([cabin, range]) => {
      const [low, typical, high] = range!;
      return {
        id: id<AwardStrategyId>(`${seed.key}-${cabin}`),
        originRegion: seed.origin,
        destinationRegion: seed.destination,
        cabin,
        programId: seed.program as PointsProgramId,
        strategyName: seed.name,
        pointsLow: low,
        pointsTypical: typical,
        pointsHigh: high,
        cashSurchargeLevel: seed.surcharge,
        availabilityDifficulty: seed.availability,
        bookingComplexity: seed.complexity,
        note: seed.note,
        effectiveFrom: seed.verifiedAt,
        effectiveTo: null,
        sourceUrl: seed.sourceUrl,
        verifiedAt: seed.verifiedAt,
        confidence: seed.confidence,
      };
    }),
);

/** Nguồn gốc của cả bộ, để `audit:reco-data` nhắc khi `award-charts.ts` đổi mà
 *  file này chưa đổi theo. */
export const AWARD_STRATEGY_UPSTREAM = AWARD_CHART_SOURCE;
