import {
  id,
  idPart,
  makeId,
  type EarningCap,
  type EarningCapId,
  type EarningRate,
  type EarningRateId,
  type PointsProgramId,
  type ProductId,
  type SpendCategory,
} from "../types.ts";

/**
 * Tỷ lệ tích điểm theo hạng mục.
 *
 * NGUỒN: `keyBenefitsVi` của chính entry Contentful. Chỉ seed những tỷ lệ nội
 * dung site NÓI RA. Thẻ nào site không nêu tỷ lệ `everything_else` thì ở đây
 * cũng không có, dù mình biết con số thật — vì con số đó chưa qua vòng kiểm
 * nào của site, và một dữ kiện chưa kiểm nằm lẫn giữa những dữ kiện đã kiểm
 * thì cả bộ mất giá trị. `audit:reco-data` liệt kê các thẻ thiếu, và Phase 3
 * phải hạ độ tin cậy của khuyến nghị dựa trên thẻ thiếu tỷ lệ nền.
 *
 * KHÔNG mô hình hoá thưởng theo KÊNH ĐẶT (thêm 1 điểm khi đặt qua Amex®
 * Travel Online, 2x qua CIBC® Rewards Centre, 4x qua Scene+™ Travel). V1
 * không có chiều "đặt ở đâu", và nhét chúng vào hạng mục `travel` sẽ hứa với
 * một người đặt vé thẳng trên trang hãng một tỷ lệ họ không bao giờ nhận.
 * Ngoại lệ có chủ ý: CIBC® Aventura® chỉ trả 2x DUY NHẤT qua kênh riêng, nên
 * bỏ hẳn thì thẻ trông như không có nhóm du lịch nào — nó được seed kèm
 * `restrictedTo`.
 */

const VERIFIED_ON = "2026-09-07";

type RateSeed = [
  category: SpendCategory,
  multiplier: number,
  opts?: {
    /** Tên trần DÙNG CHUNG, khai trong `CAPS` bên dưới. Nhiều hạng mục cùng
     *  tên trần = cùng MỘT cái trần, không phải mỗi hạng mục một cái. */
    cap?: string;
    rateAfterCap?: number;
    restrictedTo?: string;
  },
];

/**
 * Trần tích điểm, khai riêng để nhiều hạng mục dùng CHUNG một cái.
 *
 * Đây là chỗ dễ mất tiền nhất trong cả file. TD® Cash Back có trần $450 mỗi
 * năm cho nhóm siêu thị/xăng/sạc/di chuyển và một trần $450 KHÁC cho nhóm hoá
 * đơn định kỳ/streaming. Bản trước chép `capAmount: 45000` vào cả sáu dòng,
 * nên sáu dòng trông như sáu cái trần độc lập — engine đọc nó sẽ cấp $2,700
 * thay vì $900. Cobalt cũng vậy: ba nhóm 5x dùng chung 12,500 điểm/tháng.
 */
const CAPS: Record<string, Record<string, {
  name: string;
  kind: "spend" | "points";
  amount: number;
  period: "monthly" | "quarterly" | "annual";
}>> = {
  "amex-cobalt": {
    dining5x: {
      name: "Nhóm 5x ăn uống và siêu thị",
      kind: "points",
      amount: 12500,
      period: "monthly",
    },
  },
  "td-cash-back-visa-infinite": {
    everyday3: {
      name: "Nhóm 3% siêu thị, xăng, sạc và di chuyển",
      kind: "points",
      amount: 45000,
      period: "annual",
    },
    recurring3: {
      name: "Nhóm 3% hoá đơn định kỳ và streaming",
      kind: "points",
      amount: 45000,
      period: "annual",
    },
  },
  "bmo-viporter-world-elite-mastercard": {
    porter3x: {
      name: "Chi tiêu Porter® hưởng 3x",
      kind: "spend",
      amount: 20000,
      period: "annual",
    },
  },
};

const RATES: Record<string, { program: string; rates: RateSeed[] }> = {
  "amex-green": { program: "amex-mr", rates: [["everything_else", 1]] },

  "amex-gold-rewards": {
    program: "amex-mr",
    rates: [
      ["travel", 2],
      ["gas", 2],
      ["grocery", 2],
      ["drugstore", 2],
      // Site ghi rõ nhà hàng chỉ 1x trên thẻ này — dễ tưởng nhầm vì thẻ Amex®
      // nào cũng mạnh ăn uống. Có dòng riêng để không ai suy ra từ Cobalt.
      ["dining", 1],
      ["everything_else", 1],
    ],
  },

  "amex-cobalt": {
    program: "amex-mr",
    rates: [
      // Trần tính bằng ĐIỂM (12,500/tháng), không phải bằng tiền chi. Site quy
      // ra "$2,500 chi tiêu" cho dễ hiểu, nhưng đơn vị gốc là điểm — ghi sai
      // đơn vị ở đây là sai giá trị thẻ hàng chục nghìn điểm một năm.
      ["dining", 5, { cap: "dining5x", rateAfterCap: 1 }],
      ["food_delivery", 5, { cap: "dining5x", rateAfterCap: 1 }],
      ["grocery", 5, { cap: "dining5x", rateAfterCap: 1 }],
      ["streaming", 3],
      ["gas", 2],
      ["transit", 2],
      ["rideshare", 2],
      ["everything_else", 1],
    ],
  },

  "scotiabank-momentum-visa-infinite-plus": {
    program: "cash-back",
    rates: [
      ["grocery", 4],
      ["recurring", 4],
      ["gas", 2],
      ["transit", 2],
      ["food_delivery", 2],
      ["everything_else", 1],
    ],
  },

  "cibc-aventura-gold-visa": {
    program: "aventura",
    rates: [
      ["travel", 2, { restrictedTo: "Đặt qua CIBC® Rewards Centre (CIBC® by Expedia®)" }],
      ["travel", 1],
      ["gas", 1.5],
      ["ev_charging", 1.5],
      ["grocery", 1.5],
      ["drugstore", 1.5],
      ["everything_else", 1],
    ],
  },

  "scotiabank-gold-amex": {
    program: "scene-plus",
    rates: [
      ["grocery", 6, { restrictedTo: "Sobeys, Safeway, FreshCo và các siêu thị cùng nhóm" }],
      ["dining", 5],
      ["entertainment", 5],
    ],
  },

  "scotiabank-scene-plus-visa-students": {
    program: "scene-plus",
    rates: [
      ["grocery", 2, { restrictedTo: "Sobeys, Safeway, IGA, Foodland, FreshCo, Co-op" }],
      ["grocery", 1],
      ["entertainment", 2, { restrictedTo: "Cineplex và cineplex.com" }],
      ["entertainment", 1],
      ["everything_else", 1],
    ],
  },

  "westjet-rbc-world-elite-mastercard": {
    program: "westjet",
    rates: [
      ["airline_direct", 2],
      ["grocery", 2],
      ["gas", 2],
      ["ev_charging", 2],
      ["transit", 2],
      ["rideshare", 2],
      ["everything_else", 1.5],
    ],
  },

  "amex-aeroplan-reserve": {
    program: "aeroplan",
    rates: [
      ["airline_direct", 3],
      ["dining", 2],
      ["food_delivery", 2],
    ],
  },

  "td-aeroplan-visa-infinite-privilege": {
    program: "aeroplan",
    rates: [
      ["airline_direct", 2],
      ["gas", 1.5],
      ["ev_charging", 1.5],
      ["grocery", 1.5],
      ["travel", 1.5],
      ["transit", 1.5],
      ["dining", 1.5],
      ["everything_else", 1.25],
    ],
  },

  "td-aeroplan-visa-infinite": {
    program: "aeroplan",
    rates: [
      ["airline_direct", 1.5],
      ["gas", 1.5],
      ["ev_charging", 1.5],
      ["grocery", 1.5],
      ["everything_else", 1],
    ],
  },

  // TD® First Class Travel: `keyBenefitsVi` chỉ nói welcome bonus và các
  // credit, không nêu một tỷ lệ tích điểm nào. Để trống có chủ ý — xem chú
  // thích đầu file.
  "td-first-class-travel-visa-infinite": { program: "td-rewards", rates: [] },

  "cibc-aventura-visa-infinite": {
    program: "aventura",
    rates: [
      ["travel", 2, { restrictedTo: "Đặt qua CIBC® Rewards Centre (CIBC® by Expedia®)" }],
      ["travel", 1],
      ["gas", 1.5],
      ["ev_charging", 1.5],
      ["grocery", 1.5],
      ["drugstore", 1.5],
      ["everything_else", 1],
    ],
  },

  "amex-aeroplan-business-reserve": {
    program: "aeroplan",
    rates: [
      ["airline_direct", 3],
      ["hotel", 2, { restrictedTo: "Tại Canada" }],
      ["hotel", 1.25],
      ["car_rental", 2, { restrictedTo: "Tại Canada" }],
      ["car_rental", 1.25],
      ["everything_else", 1.25],
    ],
  },

  "amex-marriott-bonvoy-business": {
    program: "bonvoy",
    rates: [
      ["hotel", 5, { restrictedTo: "Khách sạn thuộc Marriott Bonvoy®" }],
      ["hotel", 2],
      ["gas", 3],
      ["dining", 3],
      ["travel", 3],
      ["everything_else", 2],
    ],
  },

  "national-bank-world-elite-mastercard": {
    program: "a-la-carte",
    rates: [
      // Site viết "đến 5 điểm/$1" — National Bank® chia bậc theo mức chi và
      // theo gói ngân hàng, nên 5 là TRẦN chứ không phải tỷ lệ ai cũng nhận.
      // Đánh dấu `restrictedTo` để engine không lấy nó làm mặc định, và dòng
      // không giới hạn ở dưới mới là dòng nó dùng.
      ["grocery", 5, { restrictedTo: "Mức trần theo bậc chi tiêu — không phải tỷ lệ nền" }],
      ["grocery", 1],
      ["dining", 5, { restrictedTo: "Mức trần theo bậc chi tiêu — không phải tỷ lệ nền" }],
      ["dining", 1],
      ["gas", 2],
      ["ev_charging", 2],
      ["recurring", 2],
      ["travel", 2],
      ["everything_else", 1],
    ],
  },

  "td-cash-back-visa-infinite": {
    program: "cash-back",
    rates: [
      // Trần $450 TIỀN HOÀN mỗi năm. Một "điểm" ở chương trình cash-back là
      // một CENT (xem points-programs.ts), nên trần viết là 45,000.
      // Bốn hạng mục dưới đây dùng CHUNG một trần $450/năm — cùng `cap`.
      ["grocery", 3, { cap: "everyday3", rateAfterCap: 1 }],
      ["gas", 3, { cap: "everyday3", rateAfterCap: 1 }],
      ["ev_charging", 3, { cap: "everyday3", rateAfterCap: 1 }],
      ["transit", 3, { cap: "everyday3", rateAfterCap: 1 }],
      // Nhóm thứ hai có trần $450 RIÊNG, không dùng chung với nhóm trên.
      ["recurring", 3, { cap: "recurring3", rateAfterCap: 1 }],
      ["streaming", 3, { cap: "recurring3", rateAfterCap: 1 }],
      ["everything_else", 1],
    ],
  },

  "wealthsimple-visa-infinite-privilege": { program: "cash-back", rates: [["everything_else", 2]] },
  "wealthsimple-visa-infinite-plus": { program: "cash-back", rates: [["everything_else", 2]] },

  "rbc-avion-visa-infinite-privilege": { program: "avion", rates: [["everything_else", 1.25]] },

  "td-aeroplan-visa-platinum": {
    program: "aeroplan",
    rates: [
      ["gas", 1],
      ["grocery", 1],
      ["airline_direct", 1],
      // "1 điểm cho mỗi $1.50" — viết thành 1/1.5 chứ không làm tròn 0.67, để
      // phép nhân trong engine ra đúng con số TD® thật sự trả.
      ["everything_else", 1 / 1.5],
    ],
  },

  "amex-aeroplan": {
    program: "aeroplan",
    rates: [
      ["airline_direct", 2],
      ["dining", 1.5],
      ["food_delivery", 1.5],
      ["everything_else", 1],
    ],
  },

  "bmo-viporter-world-elite-mastercard": {
    program: "viporter",
    rates: [
      ["airline_direct", 3, { cap: "porter3x", rateAfterCap: 2 }],
      ["travel", 2],
      ["grocery", 2],
      ["dining", 2],
    ],
  },

  "united-mileageplus-neo-world-elite-mastercard": {
    program: "mileageplus",
    rates: [
      ["airline_direct", 1.25],
      ["dining", 1],
      ["grocery", 1],
      ["everything_else", 0.75],
    ],
  },

  "amex-marriott-bonvoy": {
    program: "bonvoy",
    rates: [
      ["hotel", 5, { restrictedTo: "Khách sạn thuộc Marriott Bonvoy®" }],
      ["hotel", 2],
      ["everything_else", 2],
    ],
  },

  "scotiabank-passport-visa-infinite": {
    program: "scene-plus",
    rates: [
      ["grocery", 3, { restrictedTo: "Sobeys, Safeway, IGA, Foodland, Co-op" }],
      ["grocery", 2],
      ["dining", 2],
      ["entertainment", 2],
      ["transit", 2],
      ["everything_else", 1],
    ],
  },

  "rbc-avion-visa-infinite": {
    program: "avion",
    rates: [
      ["travel", 1.25],
      ["everything_else", 1],
    ],
  },

  "rbc-avion-visa-platinum": { program: "avion", rates: [["everything_else", 1]] },

  "cibc-aeroplan-visa": {
    program: "aeroplan",
    rates: [
      ["gas", 1],
      ["ev_charging", 1],
      ["grocery", 1],
      ["airline_direct", 1],
      // "1 điểm cho mỗi $1.50" — giữ dạng phân số, xem TD® Platinum ở trên.
      ["everything_else", 1 / 1.5],
    ],
  },

  "cibc-aeroplan-visa-infinite": {
    program: "aeroplan",
    rates: [
      ["gas", 1.5],
      ["ev_charging", 1.5],
      ["grocery", 1.5],
      ["airline_direct", 1.5],
      ["hotel", 1.5, { restrictedTo: "Khách sạn Hyatt®" }],
      ["hotel", 1],
      ["everything_else", 1],
    ],
  },

  "cibc-aeroplan-visa-infinite-privilege": {
    program: "aeroplan",
    rates: [
      ["airline_direct", 2],
      ["hotel", 2, { restrictedTo: "Khách sạn Hyatt®" }],
      ["hotel", 1.25],
      ["gas", 1.5],
      ["ev_charging", 1.5],
      ["grocery", 1.5],
      ["travel", 1.5],
      ["dining", 1.5],
      ["everything_else", 1.25],
    ],
  },
};

function capIdFor(slug: string, cap: string): EarningCapId {
  return makeId<EarningCapId>("cap", slug, cap, VERIFIED_ON);
}

export const EARNING_CAPS: EarningCap[] = Object.entries(CAPS).flatMap(([slug, caps]) =>
  Object.entries(caps).map(([key, cap]) => ({
    id: capIdFor(slug, key),
    productId: id<ProductId>(`prd_${slug}`),
    name: cap.name,
    kind: cap.kind,
    amount: cap.amount,
    period: cap.period,
    effectiveFrom: VERIFIED_ON,
    effectiveTo: null,
    sourceUrl: `https://ghe1a.com/credit-cards/${slug}`,
    sourceKind: "ghe1a",
    verifiedAt: VERIFIED_ON,
    confidence: "verified",
  })),
);

export const EARNING_RATES: EarningRate[] = Object.entries(RATES).flatMap(
  ([slug, { program, rates }]) =>
    rates.map(([category, multiplier, opts]) => ({
      // KHÔNG đánh số theo vị trí trong mảng: chèn một dòng vào giữa sẽ đổi id
      // của mọi dòng phía sau, im lặng. Id dựng từ NỘI DUNG — hạng mục, nhóm
      // merchant, ngày hiệu lực — nên nó ổn định qua mọi lần sắp xếp lại, và
      // hai phiên bản của cùng một tỷ lệ không đụng nhau.
      id: makeId<EarningRateId>(
        "er",
        `prd_${slug}`,
        category,
        idPart(opts?.restrictedTo ?? null),
        VERIFIED_ON,
      ),
      productId: id<ProductId>(`prd_${slug}`),
      category,
      multiplier,
      pointsProgramId: program as PointsProgramId,
      capId: opts?.cap === undefined ? null : capIdFor(slug, opts.cap),
      rateAfterCap: opts?.rateAfterCap ?? null,
      restrictedTo: opts?.restrictedTo ?? null,
      effectiveFrom: VERIFIED_ON,
      effectiveTo: null,
      sourceUrl: `https://ghe1a.com/credit-cards/${slug}`,
      sourceKind: "ghe1a",
      verifiedAt: VERIFIED_ON,
      confidence: "verified",
    })),
);
