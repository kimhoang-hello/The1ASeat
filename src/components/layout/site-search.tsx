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
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open || cachedItems) return;

    let cancelled = false;
    fetch("/api/search")
      .then((res) => {
        // `fetch` chỉ reject khi mạng hỏng — 500 hay 502 vẫn resolve bình
        // thường. Không chặn ở đây thì `res.json()` trả một body lỗi,
        // `data.items` là `undefined`, và `cachedItems` được gán `undefined`:
        // ô tìm kiếm đứng mãi ở "đang tải" thay vì báo lỗi, mà nhánh `.catch`
        // thì không bao giờ chạy nên `failed` cũng không bao giờ bật.
        if (!res.ok) throw new Error(`search index: ${res.status}`);
        return res.json();
      })
      .then((data: { items: SearchItem[] }) => {
        if (!Array.isArray(data?.items)) throw new Error("search index: thiếu items");
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

  /**
   * Câu đọc lên cho screen reader, TRỄ so với danh sách hiển thị.
   *
   * Vùng `aria-live` đổi theo từng ký tự thì mỗi phím gõ là một lượt đọc, và
   * người dùng nghe "1 kết quả, 4 kết quả, 12 kết quả…" chồng lên nhau thay vì
   * nghe câu trả lời. Chỉ TRÌ HOÃN phần thông báo — danh sách bên dưới vẫn lọc
   * tức thì ở mỗi lần gõ, vì đó là thứ người nhìn cần.
   */
  const [announced, setAnnounced] = useState("");
  const summary = !items
    ? tSearch("loading")
    : !query.trim()
      ? ""
      : tSearch("resultCount", { count: String(results.length) });

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setAnnounced(summary), 400);
    return () => window.clearTimeout(timer);
  }, [summary, open]);

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

  /**
   * Mũi tên đi trong danh sách bằng FOCUS THẬT, không phải combobox ARIA.
   *
   * Hai cách làm, và cách này cố ý không phải cách kia:
   *
   * - Combobox APG (`role="combobox"` + `role="listbox"`/`option` +
   *   `aria-activedescendant`) giữ focus ở ô nhập và chỉ DI CHUYỂN MỘT THUỘC
   *   TÍNH. Đổi sang nó thì phải gán `role="option"` cho từng `<a>`, tức là
   *   xoá vai trò "link" mà screen reader đang đọc đúng, và bỏ luôn đường Tab
   *   đi qua từng kết quả — đánh đổi hai thứ ĐANG chạy tốt lấy một thứ chưa
   *   có.
   * - Cách ở đây: mũi tên gọi thẳng `.focus()` lên chính thẻ `<a>`. Không cần
   *   thêm một `role` nào, không cần `aria-activedescendant`, và screen reader
   *   đọc lên đúng link đang focus vì focus là thật. Tab, Shift+Tab, Enter và
   *   Escape giữ nguyên hành vi cũ.
   *
   * KHÔNG chuyển tiếp phím chữ về ô nhập khi đang focus ở link: người Việt gõ
   * bằng IME (Telex/VNI), mà tự nối `event.key` vào query sẽ phá bộ gõ dấu.
   * Không có bẫy focus ở đây — Tab, Shift+Tab và Escape đều thoát được.
   */
  function moveFocus(event: React.KeyboardEvent, delta: 1 | -1) {
    const links = listRef.current
      ? [...listRef.current.querySelectorAll<HTMLAnchorElement>("a")]
      : [];
    if (links.length === 0) return;
    event.preventDefault();

    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    // Đang ở ô nhập: xuống là kết quả đầu, lên là kết quả cuối.
    if (current === -1) {
      (delta === 1 ? links[0] : links[links.length - 1]).focus();
      return;
    }

    const next = current + delta;
    // Đi quá hai đầu thì về ô nhập, không cuộn vòng: cuộn vòng làm người dùng
    // bàn phím mất dấu mình đang ở đâu trong danh sách dài.
    if (next < 0 || next >= links.length) {
      inputRef.current?.focus();
      return;
    }
    links[next].focus();
  }

  function onArrowKeys(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") moveFocus(event, 1);
    else if (event.key === "ArrowUp") moveFocus(event, -1);
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
                ref={inputRef}
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onArrowKeys}
                placeholder={tSearch("placeholder")}
                aria-label={tSearch("open")}
                className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
            </form>

            {/* Gõ xong thì danh sách bên dưới đổi, nhưng với người dùng screen
                reader thì không có gì được đọc lên — họ gõ vào khoảng không.
                Một dòng `role="status"` nói số kết quả là đủ; nó `sr-only` vì
                người nhìn thấy đã có ngay danh sách. Cùng luật với kết quả gửi
                form ở `NewsletterForm` và `ContactForm`. */}
            <p className="sr-only" role="status" aria-live="polite">
              {announced}
            </p>

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
                <ul
                  ref={listRef}
                  // Đặt trên `<ul>`, không trên từng link: sự kiện bàn phím nổi
                  // bọt lên đây, nên một handler đủ cho cả danh sách và không
                  // phải gắn lại mỗi lần kết quả đổi.
                  onKeyDown={onArrowKeys}
                  className="max-h-[60vh] overflow-y-auto"
                >
                  {results.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        // `focus:bg-secondary` chứ không chỉ `focus-visible:`:
                        // mũi tên di chuyển focus thật, và người dùng PHẢI thấy
                        // mình đang ở đâu kể cả khi trình duyệt cho rằng lượt
                        // focus này không "visible". Viền mặc định của trình
                        // duyệt vẫn giữ nguyên, đây chỉ là lớp nền thêm vào.
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-secondary focus:bg-secondary"
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
