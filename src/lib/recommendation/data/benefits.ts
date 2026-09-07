import { id, type Benefit, type BenefitId } from "../types.ts";

/**
 * Từ điển quyền lợi.
 *
 * `duplicatesAcrossCards` là trường quan trọng nhất ở đây, và là lý do quyền
 * lợi phải có cấu trúc thay vì là một dòng chữ (spec §16 Rule 6). Nhìn chữ
 * thì "miễn hành lý ký gửi" và "travel credit $100" giống nhau; nhưng thẻ thứ
 * hai có cái đầu gần như đáng 0, còn thẻ thứ hai có cái sau đáng đúng $100.
 * Engine không có cách nào tự biết điều đó, nên nó nằm trong dữ liệu.
 */
export const BENEFITS: Benefit[] = [
  {
    id: id<BenefitId>("free-checked-bag"),
    slug: "free_checked_bag",
    name: "Miễn phí hành lý ký gửi",
    category: "airline",
    // Một kiện miễn phí là một kiện miễn phí. Thẻ thứ hai cùng hãng không cho
    // thêm gì, trừ khi nó phủ nhiều người đi cùng hơn — `numericValue` giữ số
    // người, nên engine so được hai thẻ thay vì coi chúng như nhau.
    duplicatesAcrossCards: true,
    unit: "guests",
  },
  {
    id: id<BenefitId>("maple-leaf-lounge"),
    slug: "maple_leaf_lounge",
    name: "Maple Leaf Lounge®",
    category: "airport",
    duplicatesAcrossCards: true,
    unit: "guests",
  },
  {
    id: id<BenefitId>("airport-lounge-passes"),
    slug: "airport_lounge_passes",
    name: "Lượt vào phòng chờ sân bay",
    category: "airport",
    // Lượt thì cộng dồn: 4 lượt Visa Airport Companion cộng 6 lượt DragonPass
    // là 10 lượt thật.
    duplicatesAcrossCards: false,
    unit: "visits",
  },
  {
    id: id<BenefitId>("priority-boarding"),
    slug: "priority_boarding",
    name: "Ưu tiên check-in và lên máy bay",
    category: "airline",
    duplicatesAcrossCards: true,
    unit: "guests",
  },
  {
    id: id<BenefitId>("preferred-aeroplan-pricing"),
    slug: "preferred_aeroplan_pricing",
    name: "Giá Aeroplan® ưu đãi cho chủ thẻ",
    category: "airline",
    duplicatesAcrossCards: true,
    unit: null,
  },
  {
    id: id<BenefitId>("companion-pass"),
    slug: "companion_pass",
    name: "Companion pass / voucher người đi cùng",
    category: "airline",
    // Hai voucher là hai chuyến bay cho người đi cùng, dùng được cả hai.
    duplicatesAcrossCards: false,
    unit: "cad",
  },
  {
    id: id<BenefitId>("no-fx-fee"),
    slug: "no_fx_fee",
    name: "Không phụ phí giao dịch ngoại tệ",
    category: "fee",
    // Chỉ quẹt được một thẻ cho một giao dịch, nên thẻ thứ hai không tiết kiệm
    // thêm đồng nào.
    duplicatesAcrossCards: true,
    unit: null,
  },
  {
    id: id<BenefitId>("travel-credit"),
    slug: "travel_credit",
    name: "Travel credit hằng năm",
    category: "credit",
    duplicatesAcrossCards: false,
    unit: "cad",
  },
  {
    id: id<BenefitId>("nexus-credit"),
    slug: "nexus_credit",
    name: "Hoàn phí NEXUS™",
    category: "credit",
    // NEXUS gia hạn 4-5 năm một lần. Thẻ thứ hai không có gì để hoàn.
    duplicatesAcrossCards: true,
    unit: "cad",
  },
  {
    id: id<BenefitId>("hotel-status"),
    slug: "hotel_status",
    name: "Hạng thành viên khách sạn",
    category: "status",
    // Chỉ giữ được một hạng; thẻ thứ hai cùng hạng không nâng lên.
    duplicatesAcrossCards: true,
    unit: null,
  },
  {
    id: id<BenefitId>("free-night-award"),
    slug: "free_night_award",
    name: "Free Night Award hằng năm",
    category: "hotel",
    duplicatesAcrossCards: false,
    unit: "count",
  },
  {
    id: id<BenefitId>("elite-night-credits"),
    slug: "elite_night_credits",
    name: "Elite Night Credits",
    category: "status",
    duplicatesAcrossCards: false,
    unit: "nights",
  },
  {
    id: id<BenefitId>("airline-status-credits"),
    slug: "airline_status_credits",
    name: "Tín chỉ lên hạng hội viên hàng không",
    category: "status",
    duplicatesAcrossCards: false,
    unit: "credits",
  },
  {
    id: id<BenefitId>("travel-medical-insurance"),
    slug: "travel_medical_insurance",
    name: "Bảo hiểm y tế du lịch",
    category: "insurance",
    duplicatesAcrossCards: true,
    unit: "cad",
  },
  {
    id: id<BenefitId>("trip-cancellation-insurance"),
    slug: "trip_cancellation_insurance",
    name: "Bảo hiểm huỷ và gián đoạn chuyến đi",
    category: "insurance",
    duplicatesAcrossCards: true,
    unit: "cad",
  },
  {
    id: id<BenefitId>("mobile-device-insurance"),
    slug: "mobile_device_insurance",
    name: "Bảo hiểm thiết bị di động",
    category: "insurance",
    duplicatesAcrossCards: true,
    unit: "cad",
  },
  {
    id: id<BenefitId>("rental-car-insurance"),
    slug: "rental_car_insurance",
    name: "Bảo hiểm thuê xe",
    category: "insurance",
    duplicatesAcrossCards: true,
    unit: "cad",
  },
  {
    id: id<BenefitId>("annual-fee-waiver-conditional"),
    slug: "annual_fee_waiver_conditional",
    name: "Miễn annual fee khi đạt điều kiện",
    category: "fee",
    // Khác `Offer.annualFeeFirstYear`: cái kia là ưu đãi một lần của offer,
    // cái này là điều kiện lặp lại mỗi năm (gói ngân hàng, hạng Wealthsimple).
    duplicatesAcrossCards: false,
    unit: null,
  },
  {
    id: id<BenefitId>("free-supplementary-card"),
    slug: "free_supplementary_card",
    name: "Thẻ phụ miễn phí",
    category: "fee",
    duplicatesAcrossCards: false,
    unit: "count",
  },
];
