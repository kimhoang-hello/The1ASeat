// Editorial destinations and thresholds; these never affect gameplay or scoring.
//
// Chín đích đến do chủ website chốt ngày 05/09/2026. Nhãn CTA viết tiếng Việt
// như phần còn lại của game; chỉ giữ nguyên tiếng Anh những thuật ngữ Miles &
// Points mà site vẫn để nguyên (annual fee, Dynamic Pricing…).
export const contentLinks = {
  beginnerGuide: 'https://ghe1a.com/bat-dau',
  rule1: 'https://ghe1a.com/blog/bat-dau-choi-miles-points-dieu-co-ban-nhat',
  dynamicPricing: 'https://ghe1a.com/blog/lam-sao-thang-duoc-aeroplan-dynamic-pricing',
  diversification: 'https://ghe1a.com/blog/tai-sao-nen-co-nhieu-point-currencies',
  annualFees: 'https://ghe1a.com/blog/3-dieu-uoc-gi-biet-truoc-mile-points',
  bestOffers: 'https://ghe1a.com/credit-cards?type=noi-bat',
  transfers: 'https://ghe1a.com/transfer-bonuses',
  awardTravel: 'https://ghe1a.com/award-flight-finder',
  general: 'https://ghe1a.com/blog?type=post',
};
export const recommendationRules = {
  negative: { absolute: 700, ratio: 0.18, minimum: 200 },
  interest: { hits: 2, absolute: 500, ratio: 0.12, minimum: 100 },
  expert: { ranks: ['GHẾ 1A', '👑 HUYỀN THOẠI ĐIỂM THƯỞNG'], combo: 15, score: 30000, damage: 600, ratio: 0.08 },
  positive: { welcomeWeight: 1, goldenWeight: 3, welcomeMinimum: 4, transferMinimum: 3, partnerPointsPerUnit: 1500, awardMinimum: 1800 },
};
const n = value => value.toLocaleString('vi-VN');
export const recommendationContent = {
  carrying_balance: { type:'negative', eyebrow:'QUY TẮC SỐ 1 BỊ PHÁ VỠ', title:'Còn nợ thẻ, hết cuộc chơi', message:()=> 'Điểm thưởng không bù nổi tiền lãi. Lượt sau, nhớ thanh toán đủ nhé.', ctaText:'Bắt đầu với kiến thức nền tảng', destination:'beginnerGuide', trackingId:'balance_beginner_guide' },
  interest: { type:'negative', eyebrow:'ĐIỂM CẦN LƯU Ý', title:'Lãi suất', message:s=> `Bạn mất ${n(s.interestDamage)} điểm vì lãi suất. Săn điểm vui hơn khi không phải trả lãi.`, ctaText:'Nắm quy tắc số 1 của Miles & Points', destination:'rule1', trackingId:'interest_rule_one' },
  dynamic_pricing: { type:'negative', eyebrow:'ĐỐI THỦ LỚN NHẤT', title:'Dynamic Pricing', message:s=> `Aeroplan có kế hoạch riêng: ${n(s.dynamicPricingDamage)} điểm của bạn đã bay theo Dynamic Pricing.`, ctaText:'Tìm cách thắng Dynamic Pricing', destination:'dynamicPricing', trackingId:'dynamic_pricing_guide' },
  devaluation: { type:'negative', eyebrow:'ĐỐI THỦ LỚN NHẤT', title:'Devaluation', message:s=> `Devaluation cuốn đi ${n(s.devaluationDamage)} điểm. Đến lúc diversify points rồi.`, ctaText:'Vì sao nên có nhiều loại điểm?', destination:'diversification', trackingId:'diversification_guide' },
  annual_fees: { type:'negative', eyebrow:'ĐỐI THỦ LỚN NHẤT', title:'Phí thường niên', message:s=> `Phí cộng dồn nhanh thật: ${n(s.annualFeeDamage)} điểm đã ra đi. Quyền lợi có bù được phí không nhỉ?`, ctaText:'Khi nào annual fee đáng trả?', destination:'annualFees', trackingId:'annual_fee_guide' },
  welcome_bonus: { type:'positive', eyebrow:'SỞ TRƯỜNG CỦA BẠN', title:'Săn Welcome Bonus', message:s=> `Bạn hứng được ${n(s.welcomeBonusCaught + s.goldenWelcomeBonusCaught)} Welcome Bonus. Biết rõ điểm nằm ở đâu rồi đấy.`, ctaText:'Xem ưu đãi thẻ nổi bật hiện tại', destination:'bestOffers', trackingId:'welcome_best_offers' },
  transfer_bonus: { type:'positive', eyebrow:'SỞ TRƯỜNG CỦA BẠN', title:'Chuyển điểm đúng lúc', message:s=> `${n(s.transferBonusCaught + s.transferPartnerBoostsCaught)} lần bắt được bonus chuyển điểm và tăng tốc đối tác. Canh thời điểm chuẩn đấy.`, ctaText:'Tìm hiểu thêm về chuyển điểm', destination:'transfers', trackingId:'transfer_partners_guide' },
  award_hunter: { type:'positive', eyebrow:'SỞ TRƯỜNG CỦA BẠN', title:'Thợ săn vé thưởng', message:s=> `Bạn gom ${n(s.awardAvailabilityPointsEarned)} điểm khi vé thưởng mở. Thấy chỗ là chớp ngay!`, ctaText:'Tìm chuyến bay đổi bằng điểm', destination:'awardTravel', trackingId:'award_flight_guide' },
  expert: { type:'positive', eyebrow:'ĐÚNG CHẤT DÂN CHƠI ĐIỂM', title:'Ghế đẹp dành cho bạn', message:s=> `${n(s.finalScore)} điểm, không lần nào trúng lãi suất. Thanh toán đủ mỗi kỳ sao kê. Nể thật!`, ctaText:'Xem ưu đãi thẻ nổi bật hiện tại', destination:'bestOffers', trackingId:'expert_best_offers' },
  general: { type:'neutral', eyebrow:'BƯỚC TIẾP THEO', title:'Hiểu điểm, đi xa hơn', message:()=> 'Đổi được chuyến đi ngon bắt đầu từ việc hiểu điểm của mình làm được gì.', ctaText:'Khám phá Miles & Points', destination:'general', trackingId:'general_points_guide' },
};
