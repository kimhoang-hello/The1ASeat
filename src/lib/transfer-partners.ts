// Real transfer ratios/eligibility for Amex Canada Membership Rewards and RBC
// Avion, sourced from each issuer's own transfer-partner pages: Amex's own
// live tool at global.americanexpress.com/rewards/transfer (Canada country
// context, verified 2026-08-04 — this superseded an earlier, less complete
// scrape of a different Amex CA page that had Etihad Guest but was missing
// Air France KLM Flying Blue and ALL Accor); RBC doesn't publish transfer
// times publicly anywhere, so eligibility tier is shown instead, cross
// referenced from thepointcalculator.com and princeoftravel.com. Update when
// an issuer changes a ratio or adds/drops a partner.
export type TransferLeg = {
  ratio: string;
  note: string;
} | null;

export type TransferPartnerRow = {
  program: string;
  logo: string;
  amex: TransferLeg;
  rbc: TransferLeg;
};

export const TRANSFER_PARTNERS: TransferPartnerRow[] = [
  {
    program: "Accor® ALL®",
    logo: "/images/logos/partners/all-accor.png",
    amex: { ratio: "1,000 : 500", note: "Tối đa 48 giờ" },
    rbc: null,
  },
  {
    program: "Air Canada® Aeroplan®",
    logo: "/images/logos/partners/aeroplan.jpg",
    amex: { ratio: "1,000 : 1,000", note: "~30 phút" },
    rbc: null,
  },
  {
    program: "Air France KLM® Flying Blue®",
    logo: "/images/logos/partners/flying-blue.jpg",
    amex: { ratio: "1,000 : 1,000", note: "Tối đa 3 ngày" },
    rbc: null,
  },
  {
    program: "American Airlines® AAdvantage®",
    logo: "/images/logos/partners/american-airlines.png",
    amex: null,
    rbc: { ratio: "1,000 : 700", note: "Chỉ Avion Elite" },
  },
  {
    // Avios is the currency British Airways shares with Qatar, Iberia and Aer
    // Lingus; the programme it belongs to is The British Airways Club, renamed
    // from Executive Club in 2025.
    program: "British Airways® Club",
    logo: "/images/logos/partners/british-airways.png",
    amex: { ratio: "1,000 : 1,000", note: "~30 phút" },
    rbc: { ratio: "1,000 : 1,000", note: "Chỉ Avion Elite" },
  },
  {
    program: "Cathay Pacific® Asia Miles®",
    logo: "/images/logos/partners/cathay-pacific.png",
    amex: { ratio: "1,000 : 750", note: "5 ngày làm việc" },
    rbc: { ratio: "1,000 : 1,000", note: "Chỉ Avion Elite" },
  },
  {
    program: "Delta® SkyMiles®",
    logo: "/images/logos/partners/delta.jpg",
    amex: { ratio: "1,000 : 750", note: "~30 phút" },
    rbc: null,
  },
  {
    program: "Hilton Honors®",
    logo: "/images/logos/partners/hilton.jpg",
    amex: { ratio: "1,000 : 1,000", note: "5 ngày làm việc" },
    rbc: null,
  },
  {
    program: "Marriott Bonvoy®",
    logo: "/images/logos/partners/marriott.jpg",
    amex: { ratio: "1,000 : 1,200", note: "Tối đa 48 giờ" },
    rbc: null,
  },
  {
    program: "WestJet® Rewards",
    logo: "/images/logos/partners/westjet.png",
    amex: null,
    rbc: { ratio: "1,000 : 1,000", note: "Mọi hạng Avion" },
  },
];
