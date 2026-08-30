"use client";

import { useRouter } from "next/navigation";
import { COMPARE_PARAM, COMPARE_PATH, MAX_COMPARE } from "@/lib/card-compare";
import { t as translate } from "@/lib/t";

const t = translate("compare");

export interface PickableCard {
  slug: string;
  name: string;
}

/**
 * Ba ô chọn thẻ. Bảng so sánh được dựng ở server, nên chọn xong là điều hướng
 * chứ không lọc tại chỗ: URL luôn nói đúng thứ đang hiện, gửi cho người khác
 * là họ mở ra đúng bảng đó, và trình duyệt không phải tải dữ liệu của cả 23
 * thẻ chỉ để hiện hai.
 *
 * Đọc `window.location.search` trong chính lúc bấm thay vì dùng
 * `useSearchParams()`: hook đó bắt component phải nằm trong `<Suspense>` lúc
 * prerender, mà ở đây không cần — giá trị đang chọn đã được server truyền
 * xuống qua `selected`. Việc duy nhất cần tới URL hiện tại là GIỮ LẠI các tham
 * số khác, và `utm_*` của chiến dịch dẫn người đọc tới đây là lý do có đoạn
 * này: dựng URL mới từ đầu sẽ xoá chúng mỗi lần ai đó đổi một ô chọn.
 */
export function ComparePicker({
  cards,
  selected,
}: {
  cards: PickableCard[];
  selected: string[];
}) {
  const router = useRouter();

  // Số ô: đủ cho những thẻ đang chọn, cộng một ô trống để thêm thẻ nữa — nhưng
  // không quá trần. Ba ô trống ngay từ đầu trông như ba việc phải làm.
  const slotCount = Math.min(Math.max(selected.length + 1, 2), MAX_COMPARE);

  function choose(index: number, slug: string) {
    const next = [...selected];
    if (slug === "") next.splice(index, 1);
    else next[index] = slug;

    const params = new URLSearchParams(window.location.search);
    const value = next.filter(Boolean).join(",");
    if (value) params.set(COMPARE_PARAM, value);
    else params.delete(COMPARE_PARAM);

    const query = params.toString();
    router.replace(query ? `${COMPARE_PATH}?${query}` : COMPARE_PATH, { scroll: false });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-display text-base font-bold text-foreground">{t("pickerTitle")}</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: slotCount }, (_, index) => {
          const value = selected[index] ?? "";
          return (
            <label key={index} className="block">
              <span className="text-sm font-medium text-foreground/80">
                {t("pickerCard", { index: index + 1 })}
              </span>
              <select
                value={value}
                onChange={(event) => choose(index, event.target.value)}
                className="mt-1.5 w-full cursor-pointer rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{t("pickerEmpty")}</option>
                {cards
                  // Thẻ đang nằm ở ô khác bị ẩn khỏi ô này: so một thẻ với chính
                  // nó là hai cột giống hệt nhau, không nói lên điều gì.
                  .filter((card) => card.slug === value || !selected.includes(card.slug))
                  .map((card) => (
                    <option key={card.slug} value={card.slug}>
                      {card.name}
                    </option>
                  ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}
