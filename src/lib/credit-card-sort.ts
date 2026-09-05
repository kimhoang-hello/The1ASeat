import type { CreditCardOffer } from "./content/types";
import { hasExpired } from "./format-date";

/**
 * Thứ tự hiển thị của trang /credit-cards — bản của trang thẻ tín dụng cho
 * `SORT_OPTIONS` bên lib/bank-accounts.ts. Hai trang trả lời cùng một câu hỏi
 * nên chúng dùng cùng một hình dạng điều khiển ("Sắp xếp theo" + một ô chọn),
 * chỉ khác danh sách tiêu chí vì hai loại sản phẩm bán những con số khác nhau.
 *
 * KHÔNG có "Welcome bonus cao nhất", dù đó là tiêu chí đầu tiên bên tài khoản
 * ngân hàng. Bonus của tài khoản ngân hàng đều là đô la nên so được với nhau;
 * bonus của thẻ thì không — tồn kho hiện tại có "110,000 điểm Bonvoy®",
 * "25,000 miles MileagePlus®", "Cashback 15% (tối đa $300)" và "Đến $600 giá
 * trị". Xếp 110,000 điểm Bonvoy® trên 100,000 điểm Aeroplan® là nói rằng cái
 * trước lớn hơn cái sau, trong khi 110,000 Bonvoy® đổi được ít đêm khách sạn
 * hơn nhiều so với giá trị 100,000 Aeroplan®. Muốn có tiêu chí này thì phải
 * quy đổi qua bảng định giá (lib/points-programs.ts) — một quyết định nội
 * dung, không phải một phép sắp xếp.
 */
export const CARD_SORT_OPTIONS = [
  { id: "featured", labelKey: "sortFeatured" },
  { id: "rebate", labelKey: "sortRebate" },
  { id: "fee", labelKey: "sortFee" },
  { id: "expiring", labelKey: "sortExpiring" },
  { id: "az", labelKey: "sortAz" },
] as const;

export type CardSortId = (typeof CARD_SORT_OPTIONS)[number]["id"];

/** Cái mà một người mở /credit-cards không kèm tham số nào sẽ thấy. */
export const DEFAULT_CARD_SORT: CardSortId = "featured";

/** `?sort=rác` rơi về thứ tự mặc định thay vì làm vỡ trang. */
export function cardSortId(value: string | undefined): CardSortId {
  return CARD_SORT_OPTIONS.some((option) => option.id === value)
    ? (value as CardSortId)
    : DEFAULT_CARD_SORT;
}

/**
 * Con số đô la ĐỨNG ĐẦU chuỗi. `annualFee` trong Contentful là một câu văn có
 * nhiều số tiền: "$139/năm — miễn năm đầu (thẻ phụ: $50/năm, tối đa 3 thẻ)".
 * Số đầu tiên là phí của chính cái thẻ này, những số sau là phí thẻ phụ — bắt
 * đầu chuỗi bằng `^` chứ không quét cả câu, nếu không thẻ $139 sẽ được xếp như
 * thẻ $50.
 *
 * Không dùng `splitAnnualFee` của OfferStats: hàm đó cố ý nhận dạng hẹp để
 * quyết định có tách phần ghi chú xuống dòng nhỏ hay không, nên với dạng có
 * "— miễn năm đầu" nó trả nguyên câu. Đúng cho việc hiển thị, nhưng ở đây thì
 * năm thẻ sẽ mất số và rơi xuống cuối danh sách.
 */
function moneyAtStart(text: string): number | undefined {
  const trimmed = text.trim();
  if (/^miễn phí/i.test(trimmed)) return 0;

  const match = /^\$\s?([\d,]+(?:\.\d+)?)/.exec(trimmed);
  if (!match) return undefined;

  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : undefined;
}

/** Ngày hết hạn CÒN Ý NGHĨA. Ngày đã qua bị coi như không có — thẻ hết hạn
 *  hôm qua không phải là thẻ "sắp hết hạn" gấp nhất. */
function liveExpiry(offer: CreditCardOffer): string | undefined {
  if (!offer.expiresAt || hasExpired(offer.expiresAt)) return undefined;
  return offer.expiresAt;
}

/**
 * Thẻ không có số ở tiêu chí đang chọn (không rebate khi sắp theo rebate,
 * không ngày hết hạn khi sắp theo hạn) bị đẩy xuống cuối thay vì coi như bằng
 * 0 — cùng lý do đã ghi ở `sortAccounts`: "không có" và "bằng 0" là hai chuyện
 * khác nhau, và một thẻ không hết hạn không phải là thẻ hết hạn sớm nhất.
 *
 * `featured` trả về đúng thứ tự nhận vào — thứ tự đã được `getCreditCardOffers`
 * quyết định (elevated offer trước, rồi Amex, rồi phần còn lại).
 */
export function sortOffers(offers: CreditCardOffer[], sort: CardSortId): CreditCardOffer[] {
  // Copy cả ở nhánh này: `sortAccounts` bên tài khoản ngân hàng không bao giờ
  // trả về chính mảng nhận vào, và một hàm cùng tên gọi mà lúc trả bản sao lúc
  // trả bản gốc là cái bẫy chỉ lộ ra khi có người sắp xếp tại chỗ ở đâu đó.
  if (sort === "featured") return [...offers];

  const byName = (a: CreditCardOffer, b: CreditCardOffer) => a.name.localeCompare(b.name, "vi");

  return [...offers].sort((a, b) => {
    switch (sort) {
      case "rebate": {
        const value = (offer: CreditCardOffer) =>
          (offer.rebate ? moneyAtStart(offer.rebate) : undefined) ?? -1;
        const diff = value(b) - value(a);
        return diff !== 0 ? diff : byName(a, b);
      }
      case "fee": {
        // Thẻ không đọc được phí xuống cuối, nên `Infinity` chứ không phải -1.
        const value = (offer: CreditCardOffer) => moneyAtStart(offer.annualFee) ?? Infinity;
        const diff = value(a) - value(b);
        return diff !== 0 ? diff : byName(a, b);
      }
      case "expiring": {
        const a1 = liveExpiry(a);
        const b1 = liveExpiry(b);
        if (a1 === undefined && b1 === undefined) return byName(a, b);
        if (a1 === undefined) return 1;
        if (b1 === undefined) return -1;
        // So chuỗi ISO: "2026-09-22T00:00-04:00" < "2026-11-01T00:00-04:00".
        // Đủ dùng vì mười chữ cái đầu đã là YYYY-MM-DD, và cùng lý do như
        // `hasExpired` — cắt chuỗi thay vì đi qua `new Date()`, để múi giờ của
        // máy chủ không đẩy ngày đi một hôm.
        const diff = a1.slice(0, 10).localeCompare(b1.slice(0, 10));
        return diff !== 0 ? diff : byName(a, b);
      }
      case "az":
        return byName(a, b);
    }
  });
}
