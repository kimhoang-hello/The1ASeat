"use client";

import { useId, useState } from "react";
import { CaretDown, SlidersHorizontal } from "@phosphor-icons/react";
import messages from "../../../messages/vi.json";
import { translator } from "@/lib/t";

const common = translator(messages.common);

/**
 * Bộ lọc của một danh sách, gom sau MỘT nút "Lọc · Sắp xếp (n)" ở mọi bề ngang.
 *
 * Thêm 03/10/2026 (audit UX/UI): trên màn 375px, tab, chip và ô sắp xếp của
 * `/credit-cards` đẩy thẻ đầu tiên xuống 1,464px — gần hai màn hình chỉ có bộ
 * lọc, trong khi phần lớn người đọc cuộn danh sách chứ không lọc. Nút mang số
 * bộ lọc đang bật, nên người đến bằng link có sẵn `?points=` vẫn biết danh
 * sách đang bị lọc mà không phải mở ra xem.
 *
 * Desktop cũng gom vào nút từ 05/10/2026 (user chốt): trước đó từ `lg` bảng
 * lọc luôn mở và nút ẩn, nhưng hai hàng chip + ô sắp xếp vẫn đẩy thẻ đầu tiên
 * xuống, và hai bề ngang trông như hai bộ lọc khác nhau.
 *
 * `summary` (số kết quả) đứng cạnh nút. Nút chỉ hoạt động sau hydrate; trước
 * đó bảng lọc đóng, danh sách vẫn đọc được bình thường.
 */
export function FilterPanel({
  label,
  activeCount,
  summary,
  children,
  className = "",
}: {
  label: string;
  /** Số bộ lọc khác mặc định (tab, chip, thứ tự sắp xếp). */
  activeCount: number;
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-4 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary"
      >
        <SlidersHorizontal size={16} aria-hidden />
        {label}
        {/* "(2)" trần chỉ có nghĩa với mắt đang nhìn nút; trình đọc màn hình
            nghe "Lọc · Sắp xếp 2" thì không biết 2 là gì. */}
        {activeCount > 0 && (
          <>
            <span aria-hidden className="text-primary">
              ({activeCount})
            </span>
            <span className="sr-only">, {common("filterActive", { count: activeCount })}</span>
          </>
        )}
        <CaretDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div className="text-sm text-muted-foreground">{summary}</div>

      <div id={panelId} className={`w-full ${open ? "" : "hidden"}`}>
        {children}
      </div>
    </div>
  );
}
