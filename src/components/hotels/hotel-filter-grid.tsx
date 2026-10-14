"use client";

import { useState } from "react";

import { FilterPanel } from "@/components/ui/filter-panel";
import { FilterChip, RadioGroup } from "@/components/ui/radio-chips";
import {
  EMPTY_SELECTION,
  FILTER_ALL,
  activeFilterCount,
  facetCounts,
  matchesSelection,
  type HotelFacetKey,
  type HotelFilterValues,
  type HotelSelection,
} from "@/lib/hotel-filters";

export interface HotelGridItem {
  slug: string;
  values: HotelFilterValues;
  /** Thẻ đã render ở server — xem chú thích của component. */
  card: React.ReactNode;
}

export interface HotelFacet {
  key: HotelFacetKey;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Lưới khách sạn + bộ lọc chạy ngay trong trình duyệt.
 *
 * THẺ RENDER Ở SERVER, truyền vào đây đã xong (`card`): component này chỉ
 * quyết định thẻ nào hiện. Nó không nhận object `Hotel` nào — luật đã ghi ở
 * AGENTS.md (audit hiệu năng 05/10): prop của Client Component bị nhúng nguyên
 * vào HTML, nên truyền cả đoạn giới thiệu, ảnh, ghi chú của mọi khách sạn chỉ
 * để so ba chuỗi là trả byte cho thứ không ai đọc.
 *
 * Không ghi bộ lọc lên URL: danh sách còn ngắn, và mọi tổ hợp lọc là cùng một
 * trang — không có gì để chia sẻ hay cho Google index. Không đụng URL cũng là
 * không đụng `utm_*` của chiến dịch dẫn người đọc tới đây.
 *
 * Trước hydrate (và khi JS tắt) danh sách hiện đủ, chỉ nút Lọc chưa bấm được.
 */
export function HotelFilterGrid({
  items,
  facets,
  labels,
}: {
  items: HotelGridItem[];
  facets: HotelFacet[];
  labels: {
    filter: string;
    all: string;
    /** Có `{count}`. */
    resultCount: string;
    empty: string;
    emptyCta: string;
  };
}) {
  const [selection, setSelection] = useState<HotelSelection>(EMPTY_SELECTION);

  const values = items.map((item) => item.values);
  const visible = items.filter((item) => matchesSelection(item.values, selection));

  function choose(key: HotelFacetKey, value: string) {
    setSelection((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <FilterPanel
        label={labels.filter}
        activeCount={activeFilterCount(selection)}
        summary={
          <p className="font-medium" aria-live="polite">
            {labels.resultCount.replace("{count}", String(visible.length))}
          </p>
        }
        className="mb-5"
      >
        <div className="space-y-4">
          {facets.map((facet) => {
            const counts = facetCounts(values, selection, facet.key);
            // Lựa chọn không còn khách sạn nào trong phạm vi các nhóm khác thì
            // ẩn — trừ chính lựa chọn đang bật, không thì nhóm mất chip active
            // và cả nhóm rơi khỏi luồng Tab (điều kiện của `RadioGroup`).
            const options = facet.options.filter(
              (option) => (counts.get(option.value) ?? 0) > 0 || selection[facet.key] === option.value,
            );
            // Một lựa chọn duy nhất thì lọc theo nó không đổi được gì — trừ khi
            // nhóm đang lọc: ẩn đi lúc đó là giấu một bộ lọc vẫn đang chạy, và
            // người đọc không còn chip "Tất cả" nào để bỏ nó.
            if (options.length < 2 && selection[facet.key] === FILTER_ALL) return null;
            const inScope = values.filter((value) => matchesSelection(value, selection, facet.key)).length;

            return (
              <RadioGroup key={facet.key} label={facet.label} className="flex flex-wrap items-center gap-2">
                {/* `aria-hidden`: chính chữ này đã là `aria-label` của nhóm. */}
                <span aria-hidden="true" className="mr-1 text-sm font-medium text-muted-foreground">
                  {facet.label}
                </span>
                <FilterChip
                  active={selection[facet.key] === FILTER_ALL}
                  count={inScope}
                  onClick={() => choose(facet.key, FILTER_ALL)}
                >
                  {labels.all}
                </FilterChip>
                {options.map((option) => (
                  <FilterChip
                    key={option.value}
                    active={selection[facet.key] === option.value}
                    count={counts.get(option.value) ?? 0}
                    onClick={() => choose(facet.key, option.value)}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </RadioGroup>
            );
          })}
        </div>
      </FilterPanel>

      {visible.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.slug}>{item.card}</li>
          ))}
        </ul>
      ) : (
        // Nút xoá bộ lọc chứ không phải link: lọc tại chỗ, cùng lý do với
        // `/bank-accounts`.
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
          <button
            type="button"
            onClick={() => setSelection(EMPTY_SELECTION)}
            className="mt-3 min-h-11 cursor-pointer text-sm font-semibold text-primary hover:underline"
          >
            {labels.emptyCta}
          </button>
        </div>
      )}
    </>
  );
}
