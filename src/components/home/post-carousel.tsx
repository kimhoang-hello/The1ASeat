"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { BlogPost } from "@/lib/content";
import { PostCard } from "@/components/blog/post-card";
import { t as translate } from "@/lib/t";

const t = translate("posts");

/**
 * The home page's preview strip. It shows more posts than fit at once and
 * scrolls sideways, so a reader can look past the newest few without leaving
 * for the archive. Native scrolling does the work — swipe, trackpad and
 * keyboard already move it — and the arrows are the affordance that says so on
 * a desktop, where none of those are visible.
 */
export function PostCarousel({ posts }: { posts: BlogPost[] }) {
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

      {/* The widths are exact fractions of the track minus the gaps it spans,
          so one, two, three or four cards sit flush across a row. On a phone a
          card stops short of the full width, letting the next one peek in —
          that overhang is what tells a reader there is more to swipe to. */}
      <div
        ref={trackRef}
        onScroll={syncEdges}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post) => (
          <div
            key={post.slug}
            className="flex w-[82%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)] 2xl:w-[calc((100%-4.5rem)/4)]"
          >
            <PostCard post={post} headingLevel="h3" className="w-full" />
          </div>
        ))}
      </div>
    </>
  );
}
