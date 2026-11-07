// Phần hiển thị chung của transfer bonus Canada và Mỹ: logo chương trình nhận
// và tỷ lệ SAU bonus ("1,000 điểm → 1,350"), lấy từ đúng bảng Transfer Partners
// của nước đó. Con số này là câu hỏi đầu tiên của người đọc ("35% là được bao
// nhiêu?"), và bảng đã có sẵn tỷ lệ thường — không phải nhập tay lần hai.
//
// Hàm thuần: test chạy bằng `node --test`.
import type { TransferBonus } from "./content/types.ts";
import { hasExpired } from "./format-date.ts";
import { TRANSFER_PARTNERS, type TransferPartnerRow } from "./transfer-partners.ts";
import { US_TRANSFER_PARTNERS, legOn, type UsTransferIssuerId } from "./us-transfer-partners.ts";
import { normalizeProgramName } from "./us-transfer-bonuses.ts";

export type BonusRatio = {
  /** Số điểm chuyển đi, "1,000". */
  from: string;
  /** Số nhận về lúc không có bonus, "1,200". */
  base: string;
  /** Số nhận về trong đợt bonus, "1,560". */
  boosted: string;
};

export type BonusView = TransferBonus & {
  logo?: string;
  ratio?: BonusRatio;
  /** Các ô của bảng Transfer Partners (cột hệ điểm + tên hàng) mà bonus rơi vào — để bảng gắn nhãn lên đúng ô. */
  cells: { issuer: string; program: string }[];
};

const NUMBER = new Intl.NumberFormat("en-US");

/**
 * "1,000 : 1,200" + 30% → { from: "1,000", base: "1,200", boosted: "1,560" }.
 * Làm tròn tới điểm gần nhất — ngân hàng cộng bonus theo số nguyên. Tỷ lệ không
 * đọc được (ô có chữ thay vì số) thì không có dòng tỷ lệ, không đoán.
 */
export function boostRatio(ratio: string, bonusPercent: number): BonusRatio | undefined {
  const match = /^([\d,]+)\s*:\s*([\d,]+)$/.exec(ratio.trim());
  if (!match) return undefined;
  const from = Number(match[1].replace(/,/g, ""));
  const to = Number(match[2].replace(/,/g, ""));
  if (!from || !to) return undefined;
  return {
    from: NUMBER.format(from),
    base: NUMBER.format(to),
    boosted: NUMBER.format(Math.round((to * (100 + bonusPercent)) / 100)),
  };
}

/** Cột của bảng Canada mà tên hệ điểm nguồn trong Contentful nói tới. */
function canadaIssuer(fromProgram: string): "amex" | "rbc" | undefined {
  const name = normalizeProgramName(fromProgram);
  if (/\b(rbc|avion)\b/.test(name)) return "rbc";
  if (/\b(american express|amex|membership rewards)\b/.test(name)) return "amex";
  return undefined;
}

/**
 * Hàng của bảng Canada cho tên chương trình nhận viết tay trong Contentful.
 * Khớp nguyên tên trước ("British Airways® Club"), rồi mới tới "mọi từ của tên
 * có mặt trong một hàng duy nhất" ("Marriott Bonvoy" → "Marriott Bonvoy®").
 */
function canadaRow(toProgram: string): TransferPartnerRow | undefined {
  const name = normalizeProgramName(toProgram);
  const exact = TRANSFER_PARTNERS.find((row) => normalizeProgramName(row.program) === name);
  if (exact) return exact;
  const wanted = name.split(" ").filter(Boolean);
  const hits = TRANSFER_PARTNERS.filter((row) => {
    const have = new Set(normalizeProgramName(row.program).split(" "));
    return wanted.length > 0 && wanted.every((token) => have.has(token));
  });
  return hits.length === 1 ? hits[0] : undefined;
}

/** `today`: ngày Toronto `YYYY-MM-DD`, để ô có tỷ lệ hẹn giờ (`change`) lật đúng ngày như bảng. */
export function describeBonus(bonus: TransferBonus, today: string): BonusView {
  if (bonus.region === "us") {
    const partner = bonus.partner;
    if (!partner) return { ...bonus, cells: [] };
    const issuer = partner.issuer as UsTransferIssuerId;
    const rows = partner.programs
      .map((program) => US_TRANSFER_PARTNERS.find((r) => r.program === program))
      .filter((row) => row !== undefined);
    const withLeg = rows
      .map((row) => ({ row, leg: legOn(row, issuer, today) }))
      .filter((hit) => hit.leg !== null);
    // Logo + tỷ lệ theo hàng đầu tiên (Avios®: British Airways®) — một dòng
    // tỷ lệ cho cả nhóm vì ngân hàng chuyển cùng một tỷ lệ sang mọi hàng.
    const first = withLeg[0];
    return {
      ...bonus,
      logo: rows[0]?.logo,
      ratio: first?.leg ? boostRatio(first.leg.ratio, bonus.bonusPercent) : undefined,
      cells: withLeg.map((hit) => ({ issuer: partner.issuer, program: hit.row.program })),
    };
  }

  const row = canadaRow(bonus.toProgram);
  if (!row) return { ...bonus, cells: [] };
  const issuer = canadaIssuer(bonus.fromProgram);
  const leg = issuer ? row[issuer] : null;
  if (!issuer || !leg) return { ...bonus, logo: row.logo, cells: [] };
  return {
    ...bonus,
    logo: row.logo,
    ratio: boostRatio(leg.ratio, bonus.bonusPercent),
    cells: [{ issuer, program: row.program }],
  };
}

export function cellKey(issuer: string, program: string): string {
  return `${issuer}|${program}`;
}

/**
 * Bonus theo ô của bảng Transfer Partners. Hai bonus cùng một ô (hiếm: hai đợt
 * nối nhau) thì giữ cái hết hạn trước — đúng thứ tự của danh sách nguồn.
 */
export function bonusesByCell(views: BonusView[]): Map<string, BonusView> {
  const map = new Map<string, BonusView>();
  for (const view of views) {
    for (const cell of view.cells) {
      const key = cellKey(cell.issuer, cell.program);
      if (!map.has(key)) map.set(key, view);
    }
  }
  return map;
}

/** Bonus còn hạn, đã gắn logo + tỷ lệ, giữ thứ tự sắp-hết-trước của nguồn. */
export function liveBonusViews(bonuses: TransferBonus[], today: string): BonusView[] {
  return bonuses.filter((bonus) => !hasExpired(bonus.expiresAt)).map((bonus) => describeBonus(bonus, today));
}
