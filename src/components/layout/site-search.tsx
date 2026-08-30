"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { searchItems, type SearchItem } from "@/lib/search";
import { t } from "@/lib/t";

const tSearch = t("search");

const KIND_LABEL: Record<SearchItem["kind"], string> = {
  card: tSearch("kindCard"),
  account: tSearch("kindAccount"),
  post: tSearch("kindPost"),
  page: tSearch("kindPage"),
};

/**
 * The index is fetched once per page load, the first time the box is opened,
 * and kept here rather than in state so a reader who opens the box, closes it
 * and opens it again does not pay for it twice. It is a few dozen titles —
 * small enough that filtering happens in the browser and every keystroke is
 * answered instantly, with no request per query.
 */
let cachedItems: SearchItem[] | null = null;

export function SiteSearch({ onOpen }: { onOpen?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Lấy từ module cache lúc RENDER, không phải chỉ lúc khởi tạo state. Bản cũ
  // đọc `cachedItems` đúng một lần ở `useState`, nên có một đường kẹt vĩnh
  // viễn: mở ô tìm kiếm rồi đóng TRƯỚC khi `/api/search` trả về thì `cancelled`
  // chặn `setItems`, trong khi `cachedItems` vẫn được gán. Lần mở sau, effect
  // thoát sớm vì đã có cache mà state thì vẫn `null` — panel đứng ở "đang tải"
  // cho tới khi tải lại trang. Mạng chậm là đủ để dựng lại.
  const [fetched, setFetched] = useState<SearchItem[] | null>(null);
  const items = fetched ?? cachedItems;
  const [failed, setFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || cachedItems) return;

    let cancelled = false;
    fetch("/api/search")
      .then((res) => res.json())
      .then((data: { items: SearchItem[] }) => {
        cachedItems = data.items;
        if (!cancelled) {
          setFetched(data.items);
          // Một lượt hỏng trước đó không được phép dán nhãn lỗi lên lượt vừa
          // thành công: `failed` là trạng thái của LẦN TẢI, không phải của
          // component.
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    // Escape hands focus back to the button it came from — otherwise the panel
    // closes under the cursor and the keyboard reader is left at the top of
    // the document.
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("click", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const results = items ? searchItems(items, query) : [];

  function toggle() {
    setOpen((wasOpen) => {
      if (!wasOpen) onOpen?.();
      return !wasOpen;
    });
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  // Enter takes the top result, the way a browser's address bar does — the
  // results are links, so Tab still walks the rest of the list.
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const first = results[0];
    if (!first) return;
    close();
    router.push(first.href);
  }

  return (
    <div ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? tSearch("close") : tSearch("open")}
        aria-expanded={open}
        onClick={toggle}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-secondary hover:text-primary"
      >
        {open ? <X size={20} /> : <MagnifyingGlass size={20} />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-background px-4 pb-5 pt-4 shadow-lg sm:px-6 lg:px-10">
          <div className="mx-auto max-w-2xl">
            <form onSubmit={submit} className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2.5">
              <MagnifyingGlass size={18} className="shrink-0 text-muted-foreground" />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tSearch("placeholder")}
                aria-label={tSearch("open")}
                className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
            </form>

            <div className="mt-3">
              {failed && !items ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">{tSearch("error")}</p>
              ) : !query.trim() ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  {items ? tSearch("hint") : tSearch("loading")}
                </p>
              ) : results.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  {tSearch("empty", { query: query.trim() })}
                </p>
              ) : (
                <ul className="max-h-[60vh] overflow-y-auto">
                  {results.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-secondary"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {item.title}
                          </span>
                          {item.meta && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.meta}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/60">
                          {KIND_LABEL[item.kind]}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
