"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import messages from "../../../messages/vi.json";
import { translator } from "@/lib/t";

const t = translator(messages.posts);

/**
 * The home page's preview strip. It shows more posts than fit at once and
 * scrolls sideways, so a reader can look past the newest few without leaving
 * for the archive. Native scrolling does the work — swipe, trackpad and
 * keyboard already move it — and the arrows are the affordance that says so on
 * a desktop, where none of those are visible.
 *
 * Thẻ bài được dựng sẵn ở server rồi truyền vào làm `children` (05/10/2026).
 * Trước đó component này nhận nguyên `BlogPost[]`, và một prop của Client
 * Component là được nhúng NGUYÊN VẸN vào HTML để hydrate — kể cả thân bài
 * HTML mà thẻ không hề hiện: trang chủ nặng 437 KB, gần 200 KB trong đó là
 * thân của 12 bài viết. Ở đây chỉ còn phần cuộn.
 */
export function PostCarousel({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    // A pixel of slack: sub-pixel layout means scrollLeft rarely lands exactly
    // on the end, which would leave the forward arrow enabled at the end.
    setAtStart(track.scrollLeft <= 1);
    setAtEnd(track.scrollLeft >= track.scrollWidth - track.clientWidth - 1);
  }, []);

  useEffect(() => {
    syncEdges();
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(syncEdges);
    observer.observe(track);
    return () => observer.disconnect();
  }, [syncEdges]);

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current;
    const card = track?.firstElementChild;
    if (!track || !card) return;
    // One card plus the gap, so a click always lands on a card edge.
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: "smooth",
    });

    // Re-check the edges once the animation settles rather than relying on the
    // scroll handler alone: a smooth scroll that ends exactly on the boundary
    // can deliver its last event before scrollLeft reaches its final value,
    // which would leave an arrow enabled at the end of the track. Running twice
    // is harmless — both paths set the same state.
    if ("onscrollend" in window) track.addEventListener("scrollend", syncEdges, { once: true });
    window.setTimeout(syncEdges, 600);
  }

  const arrowClass =
    "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground/70 transition-colors hover:border-primary hover:text-primary disabled:cursor-default disabled:opacity-35 disabled:hover:border-border disabled:hover:text-foreground/70";

  return (
    <>
      <div className="mb-4 hidden justify-end gap-2 lg:flex">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={atStart}
          aria-label={t("scrollPrev")}
          className={arrowClass}
        >
          <CaretLeft size={18} weight="bold" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={atEnd}
          aria-label={t("scrollNext")}
          className={arrowClass}
        >
          <CaretRight size={18} weight="bold" />
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={syncEdges}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </>
  );
}
