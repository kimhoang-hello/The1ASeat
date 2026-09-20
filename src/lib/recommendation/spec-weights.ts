/**
 * Trọng số §10 ĐÚNG như spec viết — một bảng cho cả test lẫn debugger.
 *
 * Bảng từng chỉ nằm trong `engine.test.ts`: engine lệch spec thì test đỏ,
 * nhưng một admin đang đọc bảng điểm của một lượt chạy (không có lượt mốc để
 * so) phải thuộc lòng §10 mới biết `w=0.45` là sai. Debugger đối chiếu từng
 * dòng với bảng này (vòng rà "khuyến nghị này sai").
 *
 * `earn_points` KHÔNG có trong spec — spec chỉ nêu tên hàm; trọng số là lựa
 * chọn của engine (xem đầu `scoring/earning.ts`). `cash` thì spec không nêu cả
 * tên hàm: nó ra đời cùng cột định giá `cash` (`RedemptionMode`). Cả hai nằm
 * đây để debugger nói được "đây là bảng của engine, không phải của spec".
 */

export const SPEC_WEIGHTS = {
  trip: {
    trip_currency_utility: 0.35, points_gap_reduction: 0.2, offer_quality: 0.15,
    spend_fit: 0.1, flexibility_value: 0.1, travel_benefits: 0.05,
  },
  next_card: {
    offer_quality: 0.25, spend_fit: 0.2, long_term_earn_fit: 0.15,
    currency_fit: 0.15, benefits_fit: 0.1, diversification: 0.1,
  },
  diversify: {
    new_currency_exposure: 0.35, transfer_flexibility: 0.25,
    long_term_earn_fit: 0.15, offer_quality: 0.1, spend_fit: 0.1,
  },
  earn_points: {
    long_term_earn_fit: 0.4, currency_fit: 0.2, offer_quality: 0.15,
    spend_fit: 0.1, fee_drag: 0.1,
  },
  cash: {
    long_term_earn_fit: 0.35, offer_quality: 0.25, currency_fit: 0.15,
    fee_drag: 0.1, spend_fit: 0.1,
  },
} as const satisfies Record<string, Record<string, number>>;

/** Bảng nào là của spec, bảng nào là lựa chọn của engine. */
export const WEIGHT_SOURCE: Record<keyof typeof SPEC_WEIGHTS, string> = {
  trip: "§10.2",
  next_card: "§10.1",
  diversify: "§10.3",
  earn_points: "engine (spec không cho trọng số)",
  cash: "engine (ý định thêm sau spec)",
};
