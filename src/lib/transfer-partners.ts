// Real transfer ratios/eligibility for Amex Canada Membership Rewards and RBC
// Avion, sourced from each issuer's own transfer-partner pages: Amex's own
// live tool at global.americanexpress.com/rewards/transfer (Canada country
// context, verified 2026-08-04 — this superseded an earlier, less complete
// scrape of a different Amex CA page that had Etihad Guest but was missing
// Air France KLM Flying Blue and ALL Accor). RBC: tỷ lệ, hạng được chuyển và
// thời gian (tối đa 4 tuần) đối chiếu trang Avion Rewards ngày 06/10/2026 —
// bản cũ ghi "RBC không công bố thời gian" là sai, điều khoản có ghi. Update
// when an issuer changes a ratio or adds/drops a partner.
//
// Logo hàng là logo VUÔNG trong `/images/logos/programs/`, dùng chung với bảng
// Mỹ (`us-transfer-partners.ts`) từ 06/10/2026: một chương trình một logo trên
// cả trang. Logo chữ cũ trong `/images/logos/partners/` co về 22px thì không
// đọc được; Award Flight Finder vẫn dùng bản chữ ở khổ rộng của nó.
export type TransferLeg = {
  ratio: string;
  /** Điều kiện của ô (hạng thẻ RBC®). */
  note?: string;
  /** Thời gian chuyển tối đa ngân hàng công bố. */
  time?: string;
} | null;

export type TransferPartnerRow = {
  program: string;
  /** Nhóm trên trang (Hãng bay / Khách sạn), cùng cách chia với bảng Mỹ. */
  kind: "airline" | "hotel";
  logo: string;
  amex: TransferLeg;
  rbc: TransferLeg;
};

// Điều khoản Avion Rewards (avionrewards.com/terms-and-conditions, đọc 06/10/2026):
// "allow up to 4 weeks for your Avion points to be converted". Trang travel của
// Avion Rewards: Elite chuyển được cả bốn hãng, Premium chỉ WestJet.
const RBC_TIME = "Tối đa 4 tuần";

export const TRANSFER_PARTNERS: TransferPartnerRow[] = [
  {
    program: "Accor® ALL®",
    kind: "hotel",
    logo: "/images/logos/programs/accor.png",
    amex: { ratio: "1,000 : 500", time: "Tối đa 48 giờ" },
    rbc: null,
  },
  {
    program: "Air Canada® Aeroplan®",
    kind: "airline",
    logo: "/images/logos/programs/aeroplan.png",
    amex: { ratio: "1,000 : 1,000", time: "Tối đa 30 phút" },
    rbc: null,
  },
  {
    program: "Air France KLM® Flying Blue®",
    kind: "airline",
    logo: "/images/logos/programs/flying-blue.png",
    amex: { ratio: "1,000 : 1,000", time: "Tối đa 3 ngày" },
    rbc: null,
  },
  {
    program: "American Airlines® AAdvantage®",
    kind: "airline",
    logo: "/images/logos/programs/american-airlines.png",
    amex: null,
    rbc: { ratio: "1,000 : 700", note: "Chỉ Avion® Elite", time: RBC_TIME },
  },
  {
    // Avios is the currency British Airways shares with Qatar, Iberia and Aer
    // Lingus; the programme it belongs to is The British Airways Club, renamed
    // from Executive Club in 2025.
    program: "British Airways® Club",
    kind: "airline",
    logo: "/images/logos/programs/british-airways.png",
    amex: { ratio: "1,000 : 1,000", time: "Tối đa 30 phút" },
    rbc: { ratio: "1,000 : 1,000", note: "Chỉ Avion® Elite", time: RBC_TIME },
  },
  {
    program: "Cathay Pacific® Asia Miles®",
    kind: "airline",
    logo: "/images/logos/programs/cathay-pacific.png",
    amex: { ratio: "1,000 : 750", time: "5 ngày làm việc" },
    rbc: { ratio: "1,000 : 1,000", note: "Chỉ Avion® Elite", time: RBC_TIME },
  },
  {
    program: "Delta® SkyMiles®",
    kind: "airline",
    logo: "/images/logos/programs/delta.png",
    amex: { ratio: "1,000 : 750", time: "Tối đa 30 phút" },
    rbc: null,
  },
  {
    program: "Hilton Honors®",
    kind: "hotel",
    logo: "/images/logos/programs/hilton.png",
    amex: { ratio: "1,000 : 1,000", time: "5 ngày làm việc" },
    rbc: null,
  },
  {
    program: "Marriott Bonvoy®",
    kind: "hotel",
    logo: "/images/logos/programs/marriott.png",
    amex: { ratio: "1,000 : 1,200", time: "Tối đa 48 giờ" },
    rbc: null,
  },
  {
    program: "WestJet® Rewards",
    kind: "airline",
    logo: "/images/logos/programs/westjet.png",
    amex: null,
    rbc: { ratio: "1,000 : 1,000", note: "Avion® Premium và Elite", time: RBC_TIME },
  },
];
