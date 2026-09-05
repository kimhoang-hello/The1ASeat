"use client";

import { useRouter } from "next/navigation";
import { CARD_SORT_OPTIONS, type CardSortId } from "@/lib/credit-card-sort";

/**
 * Ô "Sắp xếp theo" của trang thẻ tín dụng — cùng hình dạng với ô bên trang tài
 * khoản ngân hàng, vì người đọc tới hai trang này với cùng một câu hỏi.
 *
 * Khác một chỗ ở bên trong: trang tài khoản ngân hàng lọc ngay trong trình
 * duyệt nên chỉ cần `replaceState`, còn danh sách thẻ được dựng ở server nên
 * đổi thứ tự là phải điều hướng. Cùng cách `ComparePicker` làm, và vì cùng một
 * lý do: URL luôn nói đúng thứ đang hiện, gửi cho người khác là họ mở ra đúng
 * danh sách đó.
 *
 * Đọc `window.location.search` lúc bấm thay vì `useSearchParams()`: hook đó
 * bắt component phải nằm trong `<Suspense>` lúc prerender, mà ở đây không cần
 * — giá trị đang chọn đã được server truyền xuống qua `value`. Việc duy nhất
 * cần tới URL hiện tại là GIỮ LẠI các tham số khác: `?type=`, `?points=`, và
 * `utm_*` của chiến dịch dẫn người đọc tới đây.
 */
export function CardSortSelect({
  value,
  label,
  optionLabels,
  className = "",
}: {
  value: CardSortId;
  label: string;
  /** Chuỗi đã dựng sẵn, KHÔNG phải hàm `t`: đây là Client Component, mà React
   *  Server Components không cho truyền function qua ranh giới đó. */
  optionLabels: Record<CardSortId, string>;
  className?: string;
}) {
  const router = useRouter();

  function choose(next: string) {
    const params = new URLSearchParams(window.location.search);
    if (next === CARD_SORT_OPTIONS[0].id) params.delete("sort");
    else params.set("sort", next);

    const query = params.toString();
    router.replace(query ? `/credit-cards?${query}` : "/credit-cards", { scroll: false });
  }

  return (
    <div className={className}>
      <label className="block">
        <span className="text-sm font-medium text-foreground/80">{label}</span>
        <select
          value={value}
          onChange={(event) => choose(event.target.value)}
          className="mt-1.5 w-full cursor-pointer rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        >
          {CARD_SORT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {optionLabels[option.id]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
