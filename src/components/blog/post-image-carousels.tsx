"use client";

import { useEffect } from "react";

/**
 * Gắn nút mũi tên + bộ đếm cho các carousel ảnh trong thân bài.
 *
 * Carousel được dựng ở server thành HTML trong chuỗi thân bài
 * (`renderImageCarousel` trong `lib/content/contentful.ts`), nên không có
 * component React nào để treo `onClick` — cùng lý do và cùng cách làm với
 * `AffiliateClickTracker`: component rỗng, tìm DOM bằng selector. Thân bài vẫn
 * nằm trọn trong Server Component.
 *
 * Cuộn là cuộn gốc của trình duyệt; ở đây chỉ làm ba việc mà CSS không làm
 * được: bấm mũi tên thì sang đúng một ảnh, ẩn mũi tên ở hai đầu (giống
 * `PostCarousel` ở trang chủ), và cập nhật "2 / 5" — bộ đếm cũng là chỗ báo
 * cho trình đọc màn hình đang ở ảnh nào.
 */
export function PostImageCarousels() {
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    document.querySelectorAll<HTMLElement>("[data-image-carousel]").forEach((root) => {
      const track = root.querySelector<HTMLElement>("[data-carousel-track]");
      const prev = root.querySelector<HTMLButtonElement>("[data-carousel-prev]");
      const next = root.querySelector<HTMLButtonElement>("[data-carousel-next]");
      const count = root.querySelector<HTMLElement>("[data-carousel-count]");
      if (!track || !prev || !next) return;
      const total = track.children.length;

      const step = () => {
        const slide = track.firstElementChild;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        return slide ? slide.getBoundingClientRect().width + gap : track.clientWidth;
      };

      const sync = () => {
        // Một pixel lỏng: layout lẻ pixel hiếm khi để scrollLeft chạm đúng mép.
        prev.disabled = track.scrollLeft <= 1;
        next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
        if (count) {
          const index = Math.min(total, Math.round(track.scrollLeft / step()) + 1);
          const label = `${index} / ${total}`;
          // Bộ đếm là vùng `aria-live`: chỉ ghi khi số đổi, ghi lại cùng một
          // chuỗi trên mỗi sự kiện cuộn làm trình đọc màn hình đọc đi đọc lại.
          if (count.textContent !== label) count.textContent = label;
        }
      };

      const go = (direction: 1 | -1) => () => {
        track.scrollBy({ left: direction * step(), behavior: "smooth" });
      };
      const onPrev = go(-1);
      const onNext = go(1);

      track.addEventListener("scroll", sync, { passive: true });
      prev.addEventListener("click", onPrev);
      next.addEventListener("click", onNext);
      const observer = new ResizeObserver(sync);
      observer.observe(track);
      sync();

      cleanups.push(() => {
        track.removeEventListener("scroll", sync);
        prev.removeEventListener("click", onPrev);
        next.removeEventListener("click", onNext);
        observer.disconnect();
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
