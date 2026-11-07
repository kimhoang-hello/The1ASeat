// Transfer bonus của điểm thẻ MỸ: biến danh sách thô của Daily Drop
// (`data/us-transfer-bonuses.json`, job hằng tuần ghi) thành `TransferBonus`
// mang tên hệ điểm và tên chương trình ĐÚNG như bảng `/transfer-partners#my`.
//
// VÌ SAO KHÔNG Ở CONTENTFUL như bonus Canada: entry `transferBonus` không có
// trường nào nói bonus thuộc nước nào, và "American Express Membership
// Rewards" là tên của CẢ HAI hệ điểm. Thêm trường vào content model bị chặn ở
// tầng quyền (xem AGENTS.md), còn cả mục Mỹ — thẻ, bảng transfer partners —
// vốn đã sống trong repo. Contentful giữ nguyên vai cũ: mọi `transferBonus`
// ở đó là bonus Canada.
//
// LUẬT BIÊN TẬP, áp ở đây chứ không ở job (job chỉ chép nguồn cho đúng):
// - Chỉ giữ bonus của sáu hệ điểm có cột trong bảng Mỹ. Daily Drop đôi khi có
//   bonus của chương trình không phải thẻ ngân hàng (Rove Miles, 06/11/2026) —
//   bảng của chính họ cũng không có cột đó.
// - Chương trình nhận khớp được hàng của bảng thì mượn tên có ®, logo và tỷ lệ
//   thường của hàng đó. Không khớp thì vẫn hiện, bằng đúng chữ Daily Drop, và
//   `unmatchedUsBonuses` báo cho job + test để thêm vào `PARTNER_ALIASES`.
//
// Hàm thuần, không đọc JSON: test chạy bằng `node --test`. Chỗ nạp file là
// `us-transfer-bonuses-data.ts`.
import type { TransferBonus } from "./content/types.ts";
import type { DailyDropBonus } from "./daily-drop-bonuses.ts";
import {
  US_TRANSFER_ISSUERS,
  US_TRANSFER_PARTNERS,
  type UsTransferIssuerId,
  type UsTransferPartnerRow,
} from "./us-transfer-partners.ts";

/** Tên hệ điểm nguồn của Daily Drop (đã chuẩn hoá) → cột của bảng Mỹ. */
const ISSUER_ALIASES: Record<string, UsTransferIssuerId> = {
  "american express membership rewards": "amex",
  "amex membership rewards": "amex",
  "chase ultimate rewards": "chase",
  "capital one miles": "capital-one",
  "capital one": "capital-one",
  "citi thankyou points": "citi",
  "citi thankyou": "citi",
  "citi thank you": "citi",
  "bilt rewards": "bilt",
  "bilt": "bilt",
  "wells fargo rewards": "wells-fargo",
  "wells fargo": "wells-fargo",
};

/**
 * Tên chương trình nhận mà phép khớp tự động không tự giải được.
 * `rows` = các hàng trong bảng Mỹ mà đợt bonus áp cho (hàng đầu cho logo + tỷ
 * lệ, mọi hàng đều được gắn nhãn trong bảng); `name` = chữ hiện ra.
 */
const PARTNER_ALIASES: Record<string, { rows?: string[]; name: string }> = {
  // Một đợt cho cả ba chương trình Avios® — Chase® chuyển 1:1 sang cả ba.
  "aer lingus british airways iberia avios": {
    rows: ["British Airways® Club", "Iberia® Club", "Aer Lingus® AerClub"],
    name: "Avios® (British Airways®, Iberia®, Aer Lingus®)",
  },
  "copa airlines": { name: "Copa Airlines ConnectMiles" },
  "copa airlines connectmiles": { name: "Copa Airlines ConnectMiles" },
};

/** Chữ thường, bỏ ®/™ và dấu, mọi thứ không phải chữ/số thành một khoảng trắng. */
export function normalizeProgramName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[®™]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return normalizeProgramName(name).split(" ").filter(Boolean);
}

/**
 * Hàng của bảng Mỹ mà tên Daily Drop nói tới: mọi từ của tên Daily Drop phải có
 * mặt trong tên hàng (cộng dòng phụ). "Flying Blue" → "Air France KLM® Flying
 * Blue®", "Cathay Pacific" → "Cathay Pacific® Asia Miles®". Khớp HAI hàng trở
 * lên là mơ hồ → coi như không khớp, thà hiện tên thô còn hơn mượn nhầm tỷ lệ.
 */
export function matchUsPartnerRow(name: string): UsTransferPartnerRow | undefined {
  const wanted = tokens(name);
  if (wanted.length === 0) return undefined;
  const hits = US_TRANSFER_PARTNERS.filter((row) => {
    const have = new Set(tokens(`${row.program} ${row.detail ?? ""}`));
    return wanted.every((token) => have.has(token));
  });
  return hits.length === 1 ? hits[0] : undefined;
}

export function usIssuerFor(from: string): UsTransferIssuerId | undefined {
  return ISSUER_ALIASES[normalizeProgramName(from)];
}

type ResolvedPartner = { name: string; rows: UsTransferPartnerRow[] };

function resolvePartner(to: string): ResolvedPartner {
  const alias = PARTNER_ALIASES[normalizeProgramName(to)];
  if (alias) {
    const rows = (alias.rows ?? []).map((program) => {
      const row = US_TRANSFER_PARTNERS.find((r) => r.program === program);
      // Tên hàng gõ sai trong alias thì test đỏ ngay, không lặng lẽ mất nhãn.
      if (!row) throw new Error(`PARTNER_ALIASES trỏ tới hàng không có: ${program}`);
      return row;
    });
    return { name: alias.name, rows };
  }
  const row = matchUsPartnerRow(to);
  return row ? { name: row.program, rows: [row] } : { name: to.trim(), rows: [] };
}

/** Slug ổn định cho `key` của React và cho test: "chase-ihg-one-rewards-2026-12-03". */
function slugFor(issuer: UsTransferIssuerId, to: string, expiresOn: string): string {
  return `${issuer}-${normalizeProgramName(to).replace(/ /g, "-")}-${expiresOn}`;
}

export function resolveUsBonuses(raw: DailyDropBonus[]): TransferBonus[] {
  const bonuses: TransferBonus[] = [];
  for (const item of raw) {
    const issuerId = usIssuerFor(item.from);
    if (!issuerId) continue;
    const issuer = US_TRANSFER_ISSUERS.find((i) => i.id === issuerId)!;
    const partner = resolvePartner(item.to);
    bonuses.push({
      slug: slugFor(issuerId, item.to, item.expiresOn),
      region: "us",
      fromProgram: issuer.name,
      toProgram: partner.name,
      bonusPercent: item.bonusPercent,
      expiresAt: item.expiresOn,
      partner: { issuer: issuerId, programs: partner.rows.map((row) => row.program) },
    });
  }
  // Cùng thứ tự với bonus Canada (Contentful sắp theo `expiresAt`): cái sắp hết đứng đầu.
  return bonuses.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.slug.localeCompare(b.slug));
}

export type UsBonusGap = {
  /**
   * - `issuer`: hệ điểm nguồn ngoài sáu cột — bonus bị bỏ. Đúng luật khi đó là
   *   chương trình không phải thẻ ngân hàng; cần sửa khi một ngân hàng đổi tên.
   * - `partner`: chương trình nhận không khớp hàng nào của bảng Mỹ và chưa có
   *   trong `PARTNER_ALIASES` — bonus vẫn hiện, bằng chữ thô của Daily Drop.
   * - `leg`: khớp được chương trình nhưng bảng `/transfer-partners#my` không có
   *   ô của ngân hàng này ở đó — có thể ngân hàng vừa thêm đối tác và bảng cần
   *   đối chiếu lại. Bonus vẫn hiện, chỉ thiếu dòng tỷ lệ.
   */
  kind: "issuer" | "partner" | "leg";
  item: DailyDropBonus;
};

/** Những dòng của Daily Drop mà site chưa hiểu hết — job in ra để người sửa. */
export function usBonusGaps(raw: DailyDropBonus[]): UsBonusGap[] {
  const out: UsBonusGap[] = [];
  for (const item of raw) {
    const issuer = usIssuerFor(item.from);
    if (!issuer) {
      out.push({ kind: "issuer", item });
      continue;
    }
    const alias = PARTNER_ALIASES[normalizeProgramName(item.to)];
    if (!alias && !matchUsPartnerRow(item.to)) {
      out.push({ kind: "partner", item });
      continue;
    }
    const { rows } = resolvePartner(item.to);
    if (!rows.some((row) => row.legs[issuer])) out.push({ kind: "leg", item });
  }
  return out;
}
