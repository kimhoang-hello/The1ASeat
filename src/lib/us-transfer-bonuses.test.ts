import { test } from "node:test";
import assert from "node:assert/strict";
import type { DailyDropBonus } from "./daily-drop-bonuses.ts";
import { matchUsPartnerRow, resolveUsBonuses, usBonusGaps } from "./us-transfer-bonuses.ts";
import { boostRatio, bonusesByCell, cellKey, describeBonus } from "./transfer-bonus-view.ts";
import type { TransferBonus } from "./content/types.ts";

// Đúng 11 dòng Daily Drop ngày 06/11/2026 — đủ mọi ca: khớp tự động, alias,
// chương trình chưa có trong bảng (Copa) và hệ điểm ngoài sáu ngân hàng (Rove).
const DAILY_DROP: DailyDropBonus[] = [
  { from: "American Express Membership Rewards", to: "Marriott Bonvoy", bonusPercent: 35, expiresOn: "2026-12-10" },
  { from: "Chase Ultimate Rewards", to: "IHG One Rewards", bonusPercent: 80, expiresOn: "2026-12-03" },
  { from: "Chase Ultimate Rewards", to: "Wyndham Rewards", bonusPercent: 30, expiresOn: "2026-12-03" },
  { from: "Capital One miles", to: "Copa Airlines", bonusPercent: 30, expiresOn: "2026-12-01" },
  { from: "Chase Ultimate Rewards", to: "Aer Lingus/British Airways/Iberia Avios", bonusPercent: 30, expiresOn: "2026-12-01" },
  { from: "Citi ThankYou points", to: "Turkish Miles & Smiles", bonusPercent: 40, expiresOn: "2026-11-30" },
  { from: "American Express Membership Rewards", to: "Virgin Atlantic Flying Club", bonusPercent: 30, expiresOn: "2026-11-30" },
  { from: "Capital One miles", to: "Flying Blue", bonusPercent: 20, expiresOn: "2026-11-30" },
  { from: "Capital One miles", to: "Virgin Atlantic Flying Club", bonusPercent: 30, expiresOn: "2026-11-20" },
  { from: "Citi ThankYou points", to: "Cathay Pacific", bonusPercent: 10, expiresOn: "2026-11-14" },
  { from: "Rove Miles", to: "JetBlue TrueBlue", bonusPercent: 20, expiresOn: "2026-11-14" },
];

test("chỉ giữ sáu hệ điểm của bảng Mỹ, tên lấy đúng chữ có ® của bảng", () => {
  const bonuses = resolveUsBonuses(DAILY_DROP);
  assert.equal(bonuses.length, 10, "Rove Miles bị bỏ");
  assert.ok(bonuses.every((b) => b.region === "us" && !b.url));

  const pair = (b: TransferBonus) => `${b.fromProgram} → ${b.toProgram}`;
  const pairs = bonuses.map(pair);
  assert.ok(pairs.includes("Amex Membership Rewards® → Marriott Bonvoy®"));
  assert.ok(pairs.includes("Chase Ultimate Rewards® → IHG® One Rewards"));
  assert.ok(pairs.includes("Citi ThankYou® → Turkish Airlines® Miles&Smiles"));
  assert.ok(pairs.includes("Capital One® Miles → Air France KLM® Flying Blue®"));
  assert.ok(pairs.includes("Citi ThankYou® → Cathay Pacific® Asia Miles®"));
  assert.ok(pairs.includes("Chase Ultimate Rewards® → Avios® (British Airways®, Iberia®, Aer Lingus®)"));
  assert.ok(pairs.includes("Capital One® Miles → Copa Airlines ConnectMiles"));

  // Sắp-hết-trước, như bonus Canada.
  const dates = bonuses.map((b) => b.expiresAt);
  assert.deepEqual(dates, [...dates].sort());
});

test("khớp tên mơ hồ thì không khớp — thà chữ thô còn hơn mượn nhầm tỷ lệ", () => {
  assert.equal(matchUsPartnerRow("Flying Blue")?.program, "Air France KLM® Flying Blue®");
  assert.equal(matchUsPartnerRow("Club"), undefined, "British Airways® Club và Iberia® Club");
  assert.equal(matchUsPartnerRow("Lufthansa Miles & More"), undefined);
});

test("báo đúng ba loại chỗ hở cho job", () => {
  const gaps = usBonusGaps([
    ...DAILY_DROP,
    { from: "Chase Ultimate Rewards", to: "Lufthansa Miles & More", bonusPercent: 25, expiresOn: "2026-12-31" },
  ]).map((gap) => `${gap.kind}: ${gap.item.from} → ${gap.item.to}`);
  assert.deepEqual(gaps.sort(), [
    "issuer: Rove Miles → JetBlue TrueBlue",
    "leg: Capital One miles → Copa Airlines",
    "partner: Chase Ultimate Rewards → Lufthansa Miles & More",
  ]);
});

test("tỷ lệ sau bonus nhân trên tỷ lệ thường của đúng ô", () => {
  assert.deepEqual(boostRatio("1,000 : 1,000", 35), { from: "1,000", base: "1,000", boosted: "1,350" });
  assert.deepEqual(boostRatio("1,000 : 1,200", 30), { from: "1,000", base: "1,200", boosted: "1,560" });
  assert.deepEqual(boostRatio("1,500 : 1,000", 25), { from: "1,500", base: "1,000", boosted: "1,250" });
  assert.equal(boostRatio("Instant", 30), undefined);

  const views = resolveUsBonuses(DAILY_DROP).map((b) => describeBonus(b, "2026-11-06"));
  const ihg = views.find((v) => v.toProgram === "IHG® One Rewards")!;
  assert.equal(ihg.ratio?.boosted, "1,800");
  assert.equal(ihg.logo, "/images/logos/programs/ihg.png");
  assert.deepEqual(ihg.cells, [{ issuer: "chase", program: "IHG® One Rewards" }]);

  // Copa chưa có hàng trong bảng: không logo, không tỷ lệ, không ô — vẫn là một bonus.
  const copa = views.find((v) => v.toProgram.startsWith("Copa"))!;
  assert.equal(copa.logo, undefined);
  assert.equal(copa.ratio, undefined);
  assert.deepEqual(copa.cells, []);

  const cells = bonusesByCell(views);
  assert.equal(cells.get(cellKey("amex", "Marriott Bonvoy®"))?.bonusPercent, 35);
  assert.equal(cells.get(cellKey("chase", "Marriott Bonvoy®")), undefined, "bonus Amex® không lan sang ô Chase®");
  // Một đợt Avios® gắn nhãn cả ba ô Chase® (Codex 06/11/2026: trước chỉ ô British Airways®).
  for (const program of ["British Airways® Club", "Iberia® Club", "Aer Lingus® AerClub"]) {
    assert.equal(cells.get(cellKey("chase", program))?.bonusPercent, 30, program);
  }
});

test("bonus Canada (Contentful) tự khớp bảng Canada theo tên", () => {
  const rbc: TransferBonus = {
    slug: "rbc-avion-to-british-airways-avios",
    region: "ca",
    fromProgram: "RBC® Avion®",
    toProgram: "British Airways® Club",
    bonusPercent: 30,
    expiresAt: "2026-11-30T00:00-05:00",
    url: "https://www.avionrewards.com/promos/british-airways-bonus.html",
  };
  const view = describeBonus(rbc, "2026-11-06");
  assert.deepEqual(view.cells, [{ issuer: "rbc", program: "British Airways® Club" }]);
  assert.equal(view.ratio?.boosted, "1,300");

  const amexMarriott = describeBonus(
    { ...rbc, fromProgram: "American Express® Membership Rewards®", toProgram: "Marriott Bonvoy®" },
    "2026-11-06",
  );
  assert.deepEqual(amexMarriott.cells, [{ issuer: "amex", program: "Marriott Bonvoy®" }]);
  assert.equal(amexMarriott.ratio?.boosted, "1,560", "Amex® Canada → Bonvoy® là 1,000 : 1,200");
});
