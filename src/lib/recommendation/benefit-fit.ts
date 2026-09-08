/**
 * §16 Rule 6 — chỉ chấm phần quyền lợi TĂNG THÊM, không chấm lại thứ người
 * dùng đã có.
 *
 * "Miễn hành lý ký gửi" trên thẻ thứ hai của cùng một hãng gần như đáng 0.
 * Nhưng — và đây là chỗ luật này hay bị làm sai — **hai quyền lợi chỉ trùng
 * nhau khi cùng `benefitId` VÀ cùng `provider`**. Miễn hành lý của Air Canada®
 * và của United® là hai thứ khác nhau; chỉ so `duplicatesAcrossCards` sẽ triệt
 * tiêu giá trị thẻ United® chỉ vì người dùng đang giữ một thẻ Aeroplan®.
 *
 * KHÔNG BỊA GIÁ TIỀN. Bộ dữ liệu chỉ định giá được những quyền lợi mang
 * `unit: "cad"`; bảo hiểm còn nằm trong `textValue` nên mới chỉ so được có/
 * không (§9 bàn giao). Nên điểm quyền lợi ở đây có HAI vế đo được thật —
 * tổng tiền của các quyền lợi tính bằng đô, và SỐ quyền lợi mới — thay vì một
 * bảng giá tự nghĩ ra rồi đem nhân. Bảng giá đó sẽ trông chính xác hơn hẳn
 * những gì nó biết.
 */

import { activeAt } from "./temporal.ts";
import type { DatasetIndex } from "./indexes.ts";
import type { BenefitId, Product, ProductBenefit } from "./types.ts";
import type { ReasonCode } from "./reason-codes.ts";

/** Khoá nhận dạng một quyền lợi CỤ THỂ: quyền lợi nào, của hãng nào. */
function benefitKey(row: ProductBenefit): string {
  return `${row.benefitId}|${row.provider ?? ""}`;
}

export interface BenefitFit {
  /** Tổng giá trị (cent) của những quyền lợi tính bằng đô mà thẻ này THÊM vào. */
  incrementalCashCents: number;
  /** Số quyền lợi thẻ này thêm vào mà người dùng chưa có. */
  incrementalCount: number;
  /** Số quyền lợi bị trùng hoàn toàn (cùng quyền lợi, cùng hãng). */
  duplicatedCount: number;
  totalCount: number;
  reasonCodes: ReasonCode[];
}

/**
 * Tập quyền lợi người dùng ĐANG có, từ các thẻ đang giữ.
 *
 * Tính MỘT LẦN cho cả lượt chạy chứ không tính lại trong vòng lặp ứng viên:
 * nó không đổi theo ứng viên, và dựng lại 34 lần là 34 lần quét
 * `benefitsByProduct`.
 */
export function heldBenefitKeys(
  heldProducts: readonly Product[],
  ix: DatasetIndex,
  asOf: string,
): Set<string> {
  const keys = new Set<string>();
  for (const product of heldProducts) {
    for (const row of activeAt(ix.benefitsByProduct.get(product.id) ?? [], asOf)) {
      keys.add(benefitKey(row));
    }
  }
  return keys;
}

export function benefitFitFor(
  productId: string,
  held: ReadonlySet<string>,
  ix: DatasetIndex,
  asOf: string,
): BenefitFit {
  const rows = activeAt(ix.benefitsByProduct.get(productId) ?? [], asOf);
  const reasonCodes: ReasonCode[] = [];
  let incrementalCashCents = 0;
  let incrementalCount = 0;
  let duplicatedCount = 0;
  let sawNewProvider = false;

  for (const row of rows) {
    const benefit = ix.benefitById.get(row.benefitId as BenefitId);
    if (benefit === undefined) continue;

    const exactMatch = held.has(benefitKey(row));
    // `duplicatesAcrossCards: false` nghĩa là thẻ thứ hai VẪN cho thêm giá trị
    // — travel credit $100 của thẻ này cộng vào travel credit của thẻ kia. Cờ
    // đó nằm trong dữ liệu đúng vì engine không tự đoán được.
    const duplicated = exactMatch && benefit.duplicatesAcrossCards;

    if (duplicated) {
      duplicatedCount += 1;
      continue;
    }
    // Cùng quyền lợi, KHÁC hãng: vẫn là giá trị mới.
    if (!exactMatch && benefit.duplicatesAcrossCards && row.provider !== null) {
      const sameBenefitOtherProvider = [...held].some(
        (key) => key.startsWith(`${row.benefitId}|`) && key !== benefitKey(row),
      );
      if (sameBenefitOtherProvider) sawNewProvider = true;
    }

    incrementalCount += 1;
    if (benefit.unit === "cad" && row.numericValue !== null) {
      incrementalCashCents += row.numericValue * 100;
    }
  }

  if (duplicatedCount > 0) reasonCodes.push("EXISTING_BENEFIT_DUPLICATION");
  if (sawNewProvider) reasonCodes.push("BENEFIT_ADDS_NEW_PROVIDER");

  return {
    incrementalCashCents,
    incrementalCount,
    duplicatedCount,
    totalCount: rows.length,
    reasonCodes,
  };
}
