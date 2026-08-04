// Real transfer ratios/eligibility for Amex Canada Membership Rewards and RBC
// Avion, sourced from each issuer's own transfer-partner pages (Amex) and
// cross-referenced Canadian points-blog guides (RBC, which doesn't publish
// transfer times publicly — eligibility tier is shown instead). Update when
// an issuer changes a ratio or adds/drops a partner.
export type TransferLeg = {
  ratio: string;
  note: string;
} | null;

export type TransferPartnerRow = {
  program: string;
  amex: TransferLeg;
  rbc: TransferLeg;
};

export const TRANSFER_PARTNERS: TransferPartnerRow[] = [
  {
    program: "Aeroplan® (Air Canada®)",
    amex: { ratio: "1,000 : 1,000", note: "~30 phút" },
    rbc: null,
  },
  {
    program: "American Airlines® AAdvantage®",
    amex: null,
    rbc: { ratio: "1,000 : 700", note: "Chỉ Avion Elite" },
  },
  {
    program: "British Airways® Avios",
    amex: { ratio: "1,000 : 1,000", note: "~30 phút" },
    rbc: { ratio: "1,000 : 1,000", note: "Chỉ Avion Elite" },
  },
  {
    program: "Cathay Pacific® Asia Miles®",
    amex: { ratio: "1,000 : 750", note: "5 ngày làm việc" },
    rbc: { ratio: "1,000 : 1,000", note: "Chỉ Avion Elite" },
  },
  {
    program: "Delta® SkyMiles®",
    amex: { ratio: "1,000 : 750", note: "~30 phút" },
    rbc: null,
  },
  {
    program: "Etihad® Guest",
    amex: { ratio: "1,000 : 750", note: "10 ngày làm việc" },
    rbc: null,
  },
  {
    program: "Hilton Honors®",
    amex: { ratio: "1,000 : 1,000", note: "5 ngày làm việc" },
    rbc: null,
  },
  {
    program: "Hudson's Bay® Rewards",
    amex: null,
    rbc: { ratio: "1,000 : 2,000", note: "Mọi hạng Avion" },
  },
  {
    program: "Marriott Bonvoy®",
    amex: { ratio: "5 : 6", note: "Tối đa 48 giờ" },
    rbc: null,
  },
  {
    program: "WestJet® Rewards",
    amex: null,
    rbc: { ratio: "1,000 : 1,000", note: "Mọi hạng Avion" },
  },
];
