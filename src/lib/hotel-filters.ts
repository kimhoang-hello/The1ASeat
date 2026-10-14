/**
 * Logic bộ lọc của trang `/hotels`, tách khỏi `hotels.ts`.
 *
 * Client Component lọc danh sách import file này; nếu nó import thẳng
 * `hotels.ts` thì toàn bộ đoạn giới thiệu, điểm cộng, ghi chú của mọi khách
 * sạn chui vào bundle trình duyệt chỉ để so ba chuỗi (cùng bẫy đã ghi trong
 * `site-header.tsx` với `bank-compare`). Ở đây không có dữ liệu, chỉ có hàm.
 */

export const FILTER_ALL = "all";

export type HotelFacetKey = "destination" | "chain" | "category";

export const HOTEL_FACET_KEYS: HotelFacetKey[] = ["destination", "chain", "category"];

/** Giá trị lọc của một khách sạn — mỗi nhóm đúng một giá trị. */
export type HotelFilterValues = Record<HotelFacetKey, string>;

/** Lựa chọn của người đọc — mỗi nhóm một giá trị, hoặc `FILTER_ALL`. */
export type HotelSelection = Record<HotelFacetKey, string>;

export const EMPTY_SELECTION: HotelSelection = {
  destination: FILTER_ALL,
  chain: FILTER_ALL,
  category: FILTER_ALL,
};

/** Khớp mọi nhóm đang chọn; `ignore` bỏ qua một nhóm (để đếm cho chính nhóm đó). */
export function matchesSelection(
  values: HotelFilterValues,
  selection: HotelSelection,
  ignore?: HotelFacetKey,
): boolean {
  return HOTEL_FACET_KEYS.every(
    (key) => key === ignore || selection[key] === FILTER_ALL || values[key] === selection[key],
  );
}

/**
 * Số khách sạn của từng lựa chọn trong nhóm `key`, đếm trong phạm vi các nhóm
 * KHÁC đang chọn — cùng luật với hàng ngân hàng ở `/bank-accounts`: không chip
 * nào hứa một con số mà bấm vào lại ra danh sách rỗng.
 */
export function facetCounts(
  items: HotelFilterValues[],
  selection: HotelSelection,
  key: HotelFacetKey,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!matchesSelection(item, selection, key)) continue;
    counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
  }
  return counts;
}

/** Số nhóm đang lọc — con số trên nút "Lọc". */
export function activeFilterCount(selection: HotelSelection): number {
  return HOTEL_FACET_KEYS.filter((key) => selection[key] !== FILTER_ALL).length;
}
