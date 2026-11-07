import data from "../../data/us-transfer-bonuses.json";
import type { TransferBonus } from "./content/types";
import type { DailyDropBonus } from "./daily-drop-bonuses";
import { resolveUsBonuses } from "./us-transfer-bonuses";

/**
 * Chỗ DUY NHẤT nạp `data/us-transfer-bonuses.json` — tách khỏi
 * `us-transfer-bonuses.ts` để file đó còn chạy được bằng `node --test` (ESM
 * của Node đòi `with { type: "json" }` cho import JSON, như `offer-history.ts`).
 *
 * File do `.github/workflows/sync-us-transfer-bonuses.yml` ghi mỗi tuần.
 */
type UsBonusFile = {
  source: string;
  /** Ngày job đọc Daily Drop lần gần nhất (`YYYY-MM-DD`, giờ Toronto). */
  checkedOn: string;
  bonuses: DailyDropBonus[];
};

const file = data as UsBonusFile;

export const US_BONUS_SOURCE = file.source;
export const US_BONUS_CHECKED_ON = file.checkedOn;

/** Mọi bonus Mỹ trong file, KỂ CẢ đã hết hạn — chỗ dùng tự lọc `hasExpired` như bonus Canada. */
export function getUsTransferBonuses(): TransferBonus[] {
  return resolveUsBonuses(file.bonuses);
}
