"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CATCH_THE_POINTS_PATH } from "@/lib/catch-the-points-path";

/**
 * Dải offer + thanh nav dính trên cùng — trừ vài trang tự xin không dính.
 *
 * Trang game là trang duy nhất hiện nay: lúc chơi, khung game cao gần hết màn
 * hình, mà một thanh dính đè lên đó vừa ăn mất chiều cao sân chơi vừa che
 * đúng phần HUD điểm và đồng hồ đếm ngược.
 *
 * Dưới `lg` khối này TRƯỢT LÊN khi người đọc cuộn xuống và hiện lại ngay khi
 * cuộn lên. Đo 03/10/2026: trên điện thoại nó cao 114–147px suốt lúc đọc, tức
 * một phần tư màn iPhone nhỏ; tác giả chọn cách này thay vì bỏ dính dải offer,
 * vì nó giữ được cả dải offer lẫn menu mà vẫn trả lại màn hình. Từ `lg` (thanh
 * nav desktop) khối đứng yên như cũ.
 *
 * `children` vẫn được layout gốc (Server Component) dựng sẵn rồi truyền vào,
 * nên phần client ở đây chỉ là đường dẫn và vị trí cuộn.
 */
const NOT_STICKY: string[] = [CATCH_THE_POINTS_PATH];

/** Khoảng màn hình khối này được phép trượt đi — đúng chỗ menu mobile thay cho thanh nav desktop. */
const HIDE_BELOW = "(width < 64rem)";

/**
 * Phải cuộn lên ít nhất chừng này (px, cộng dồn) khối mới hiện lại. Không có
 * ngưỡng thì ngón tay khựng nhẹ giữa một lượt cuộn xuống cũng làm khối nhấp
 * nháy lên xuống.
 */
const SHOW_AFTER_UP_PX = 12;

export function StickyChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sticky = !NOT_STICKY.includes(pathname);
  const ref = useRef<HTMLDivElement>(null);

  // Trạng thái ẩn gắn với ĐƯỜNG DẪN lúc ẩn: sang trang khác là khối tự hiện
  // lại, không cần effect nào đặt lại state — kể cả khi bấm Back về một vị trí
  // cuộn sâu.
  const [hiddenOn, setHiddenOn] = useState<string | null>(null);
  const hidden = sticky && hiddenOn === pathname;

  useEffect(() => {
    const chrome = ref.current;
    if (!sticky || !chrome) return;

    const small = window.matchMedia(HIDE_BELOW);
    let lastY = window.scrollY;
    let lastHeight = chrome.offsetHeight;
    let upTravel = 0;
    let frame = 0;

    function show() {
      upTravel = 0;
      setHiddenOn(null);
    }

    function update() {
      frame = 0;
      const y = window.scrollY;
      const height = chrome?.offsetHeight ?? 0;
      const delta = y - lastY;
      const resized = height !== lastHeight;
      lastY = y;
      lastHeight = height;

      // Luôn hiện khi: màn lớn; menu mobile hay ô tìm kiếm đang mở (cả hai nút
      // mang `aria-expanded`); focus BÀN PHÍM đang ở trong khối (Tab vào một
      // link bị trượt mất là mất dấu); hoặc còn ở đầu trang.
      if (
        !small.matches ||
        chrome?.querySelector('[aria-expanded="true"], :focus-visible') ||
        y <= height
      ) {
        show();
        return;
      }

      // Khối vừa đổi chiều cao — dải offer xoay sang thẻ có tên dài/ngắn hơn
      // (±16px, mỗi 30 giây). Khối nằm trong luồng ở đầu trang, nên trình duyệt
      // tự bù vị trí cuộn (scroll anchoring) để chữ người đọc đang xem đứng
      // yên, và lượt bù đó tới đây như một cú cuộn. Không bỏ qua thì cứ dải
      // ngắn đi là khối đang ẩn tự bật xuống giữa lúc đọc (đo 03/10/2026:
      // `scrollY` 700 → 683.5 không ai chạm vào).
      if (resized) return;

      // Safari nảy quá đáy trang rồi bật lại — lượt "cuộn lên" đó không phải ý
      // người đọc, đừng để nó kéo khối xuống che dòng cuối. Chỉ chặn chiều LÊN:
      // một cú cuộn xuống (phím End, vuốt mạnh) chạm đáy ngay trong một khung
      // hình vẫn phải ẩn khối (Codex bắt).
      if (delta < 0 && y + window.innerHeight >= document.documentElement.scrollHeight - 1) return;

      if (delta > 0) {
        upTravel = 0;
        setHiddenOn(pathname);
      } else if (delta < 0) {
        upTravel -= delta;
        if (upTravel >= SHOW_AFTER_UP_PX) setHiddenOn(null);
      }
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    small.addEventListener("change", show);
    // Tab ngược vào khối lúc nó đang trượt mất: hiện ra để thấy mình đang ở đâu.
    chrome.addEventListener("focusin", show);
    return () => {
      window.removeEventListener("scroll", onScroll);
      small.removeEventListener("change", show);
      chrome.removeEventListener("focusin", show);
      cancelAnimationFrame(frame);
    };
  }, [sticky, pathname]);

  // Chiều cao THẬT của khối, ra biến `--chrome-h` cho phần tử nào phải dính sát
  // mép dưới nó — hàng tên cột của bảng Transfer Partners Mỹ. `top-chrome`
  // (9rem) là khoảng chừa cố định, hợp cho cột ảnh thẻ hay mục lục, nhưng đặt
  // một hàng tiêu đề bảng ở đó thì các hàng bên dưới lộ ra qua khe ~30px giữa
  // hai thứ dính. Đo bằng `ResizeObserver` vì dải offer đổi chiều cao mỗi lần
  // xoay thẻ và khi bị đóng. Trước khi JS chạy, người dùng biến tự rơi về 9rem.
  useEffect(() => {
    const chrome = ref.current;
    if (!chrome) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--chrome-h", `${chrome.offsetHeight}px`);
    });
    observer.observe(chrome);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--chrome-h");
    };
  }, []);

  // `z-50` giữ nguyên ở cả hai nhánh: panel tìm kiếm và menu mobile thả xuống
  // từ thanh này, chúng vẫn phải nằm trên nội dung trang.
  //
  // Cột flex cao TỐI ĐA một màn hình: phần nào của khối dính thò khỏi mép
  // dưới màn hình thì không bao giờ cuộn tới được (cuộn chỉ trượt trang phía
  // sau). Đo 03/10/2026 ở 375×812: mở nhóm "Thẻ tín dụng" trong menu mobile là
  // khối cao 929px, nút "Đăng ký bản tin" đứng yên ở 904px. Trần này cộng
  // `min-h-0` của header và panel menu (`site-header.tsx`) làm panel co lại
  // và tự cuộn. Làm bằng CSS chứ không đo bằng JS: dải offer đổi chiều cao
  // (48–82px tuỳ tên thẻ) mỗi lần xoay thẻ, kể cả khi menu đang mở.
  // `max-h-screen` là đường lui cho trình duyệt chưa hiểu `dvh` (iOS < 15.4).
  const cap = "flex max-h-screen flex-col supports-[height:100dvh]:max-h-dvh";
  // `transform` chứ không đổi `top`/chiều cao: không đẩy bố cục trang, và
  // không tính vào CLS.
  const slide = `transition-transform duration-200 ease-out motion-reduce:transition-none ${
    hidden ? "-translate-y-full" : ""
  }`;
  return (
    <div ref={ref} className={`${sticky ? "sticky top-0" : "relative"} z-50 ${cap} ${slide}`}>
      {children}
    </div>
  );
}
