"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CATCH_THE_POINTS_GAME_SRC } from "@/lib/catch-the-points-path";
import { t } from "@/lib/t";

const game = t("game");

/**
 * Chiều cao dùng tạm trước khi game tự chỉnh — cỡ màn hình bắt đầu trên điện
 * thoại, để trang không giật một nhịp cao rồi thấp.
 *
 * Chỉ là điểm xuất phát: từ lúc `embed.js` chạy, chính game ghi chiều cao vào
 * `style` của phần tử này (xem chú thích ở đó), nên trang này KHÔNG đặt chiều
 * cao nữa — hai bên cùng ghi một thuộc tính là có lúc giẫm chân nhau.
 */
const INITIAL_HEIGHT = "h-[45rem]";

/** Những gì `public/games/catch-the-points/src/embed.js` gửi sang. */
type GameMessage =
  | { source: "ghe1a-game"; type: "state"; playing: boolean; height: number }
  | { source: "ghe1a-game"; type: "analytics"; detail: Record<string, unknown> }
  | { source: "ghe1a-game"; type: "scroll-to-top" };

function isGameMessage(data: unknown): data is GameMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { source?: unknown }).source === "ghe1a-game"
  );
}

/**
 * Đẩy sự kiện của game sang GA4 nếu trang có gtag.
 *
 * Không bao giờ ném ra ngoài: đo đạc hỏng thì lượt chơi vẫn phải chạy, đúng
 * như `analytics.js` của game yêu cầu.
 */
function forwardToAnalytics(detail: Record<string, unknown>) {
  try {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    const { event, ...params } = detail as { event?: unknown };
    if (typeof gtag !== "function" || typeof event !== "string") return;
    gtag("event", event, params);
  } catch {
    /* Không có gtag, hoặc bị trình chặn quảng cáo chặn — kệ. */
  }
}

/**
 * Game nhúng trong iframe CÙNG DOMAIN, không phải port sang React.
 *
 * Game là một trang tĩnh hoàn chỉnh: CSS đặt thẳng lên `body`/`html`, và một
 * vòng `requestAnimationFrame` chỉ khởi tạo đúng một lần. Biến DOM của nó
 * thành component nghĩa là scope lại 1900 dòng CSS và tự viết phần dọn dẹp
 * animation frame, pointer capture, audio, event listener cho mỗi lần
 * mount/unmount — nhiều việc, nhiều chỗ hỏng, không được gì thêm. Iframe cùng
 * domain cô lập sẵn cả CSS lẫn vòng đời.
 *
 * Chiều cao khung do CHÍNH GAME đặt, không phải component này: xem chú thích
 * dài trong `embed.js`. Ở đây chỉ còn hai việc iframe không tự làm được —
 * chuyển tiếp analytics sang GA4 của website, và cuộn trang khi game xin.
 */
export function CatchThePointsFrame() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Query `?challenge=` của trang được chuyển tiếp vào iframe: chế độ thách
  // đấu của game đọc nó từ query string của chính nó.
  const challenge = useSearchParams().get("challenge");
  const src =
    challenge && /^\d{1,16}$/.test(challenge)
      ? `${CATCH_THE_POINTS_GAME_SRC}?challenge=${challenge}`
      : CATCH_THE_POINTS_GAME_SRC;

  useEffect(() => {
    const frame = frameRef.current;

    function onMessage(event: MessageEvent) {
      // Cùng origin và đúng iframe này — không nhận lệnh từ frame nào khác.
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame?.contentWindow) return;
      if (!isGameMessage(event.data)) return;

      if (event.data.type === "analytics") {
        forwardToAnalytics(event.data.detail);
      } else if (event.data.type === "scroll-to-top") {
        // Game gọi lúc bắt đầu lượt và lúc hiện kết quả. Trong iframe nó không
        // tự cuộn được, mà thứ cần cuộn là trang này.
        frame?.scrollIntoView({ block: "start" });
      } else if (event.data.type === "state" && frame && !frame.style.height) {
        // Đường dự phòng: nếu vì lý do nào đó game không ghi được vào
        // `frameElement` (khác origin), chiều cao vẫn về được bằng tin nhắn.
        if (!event.data.playing && event.data.height > 0) {
          frame.style.height = `${event.data.height}px`;
        }
      }
    }

    window.addEventListener("message", onMessage);
    // Iframe tĩnh này load xong trước bundle React, nên nhịp đồng bộ đầu tiên
    // của game có thể đã chạy trước khi listener trên gắn vào. Hỏi lại một
    // tiếng cho chắc.
    function ping() {
      frame?.contentWindow?.postMessage(
        { source: "ghe1a-page", type: "ping" },
        window.location.origin,
      );
    }
    frame?.addEventListener("load", ping);
    ping();

    return () => {
      window.removeEventListener("message", onMessage);
      frame?.removeEventListener("load", ping);
    };
  }, []);

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={game("frameTitle")}
      // `scroll-mt-4` chừa một chút mép trên khi game xin cuộn về đầu. Trang
      // này không có thanh header dính để phải tránh.
      // Chiều cao khởi tạo là CLASS chứ không phải `style`: game ghi chiều
      // cao thật vào `style.height` của chính phần tử này, và inline style
      // luôn thắng class — nếu để React giữ `style.height` thì mỗi lần render
      // lại là nó đạp lên con số game vừa đặt.
      className={`w-full scroll-mt-4 border-0 ${INITIAL_HEIGHT}`}
      // Lớp chặn cuối cùng để iframe không thành vùng cuộn thứ hai — xem
      // `[data-embedded]` trong style.css của game.
      scrolling="no"
      // Game không có backend, không gọi mạng, chỉ đọc ghi localStorage của
      // chính nó — không cần cấp quyền gì.
      allow=""
    />
  );
}
