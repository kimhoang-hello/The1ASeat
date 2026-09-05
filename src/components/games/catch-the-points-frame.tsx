"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CATCH_THE_POINTS_GAME_SRC } from "@/lib/catch-the-points-path";
import { t } from "@/lib/t";

const game = t("game");

/** Chiều cao dùng tạm trước khi game báo số thật — cỡ màn hình bắt đầu trên
 *  điện thoại, để trang không giật một nhịp cao rồi thấp. */
const INITIAL_HEIGHT = 720;

/**
 * Chiều cao khung lúc ĐANG CHƠI, đặt theo màn hình chứ không theo nội dung.
 *
 * `svh` chứ không phải `dvh`: trên điện thoại thanh địa chỉ thò ra thụt vào
 * liên tục, mà mỗi lần `dvh` đổi là sân chơi nhảy một cái ngay giữa lượt.
 * Trang này cố ý KHÔNG có thanh header dính (xem `StickyChrome`), nên game
 * lấy được gần trọn màn hình; 2rem chừa lại để khung không dán sát mép.
 */
const PLAYING_HEIGHT = "clamp(30rem, calc(100svh - 2rem), 54rem)";

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
 * domain cô lập sẵn cả CSS lẫn vòng đời, và hai bên vẫn nói chuyện được bằng
 * `postMessage`.
 *
 * Chiều cao: xem chú thích dài trong `embed.js`. Tóm tắt — lúc đang chơi thì
 * khung cao theo màn hình, lúc khác cao đúng bằng nội dung game báo sang, vì
 * màn kết quả dài hơn màn chơi rất nhiều.
 */
export function CatchThePointsFrame() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const [playing, setPlaying] = useState(false);

  // Query `?challenge=` của trang được chuyển tiếp vào iframe: chế độ thách
  // đấu của game đọc nó từ query string của chính nó.
  const challenge = useSearchParams().get("challenge");
  const src =
    challenge && /^\d{1,16}$/.test(challenge)
      ? `${CATCH_THE_POINTS_GAME_SRC}?challenge=${challenge}`
      : CATCH_THE_POINTS_GAME_SRC;

  useEffect(() => {
    const frame = frameRef.current;
    let answered = false;

    /**
     * Xin game báo lại trạng thái.
     *
     * Bắt tay bằng ping là CẦN, không phải cho chắc: iframe tĩnh này load
     * xong trước cả bundle React của trang, nên bản báo đầu tiên của game có
     * thể bay đi trước khi listener bên dưới kịp gắn — và `embed.js` bỏ qua
     * giá trị trùng nên sẽ không tự báo lần hai. Khung khi đó đứng nguyên ở
     * chiều cao tạm và màn kết quả bị cắt cụt.
     */
    function ping() {
      frame?.contentWindow?.postMessage(
        { source: "ghe1a-page", type: "ping" },
        window.location.origin,
      );
    }

    function onMessage(event: MessageEvent) {
      // Cùng origin và đúng iframe này — không nhận lệnh từ frame nào khác.
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame?.contentWindow) return;
      if (!isGameMessage(event.data)) return;

      if (event.data.type === "state") {
        answered = true;
        setPlaying(event.data.playing);
        if (!event.data.playing && event.data.height > 0) setHeight(event.data.height);
      } else if (event.data.type === "analytics") {
        forwardToAnalytics(event.data.detail);
      } else if (event.data.type === "scroll-to-top") {
        // Game gọi lúc bắt đầu lượt và lúc hiện kết quả. Trong iframe nó không
        // tự cuộn được, mà thứ cần cuộn là trang này.
        frame?.scrollIntoView({ block: "start" });
      }
    }

    window.addEventListener("message", onMessage);
    frame?.addEventListener("load", ping);
    ping();
    // Hỏi lại vài nhịp cho tới khi có tiếng trả lời, rồi thôi: `load` có thể
    // đã bắn xong trước khi listener trên gắn vào, mà iframe cũng có thể chưa
    // dựng xong document lúc ping đầu tiên.
    const retry = setInterval(() => {
      if (answered) clearInterval(retry);
      else ping();
    }, 300);
    const giveUp = setTimeout(() => clearInterval(retry), 5000);

    return () => {
      window.removeEventListener("message", onMessage);
      frame?.removeEventListener("load", ping);
      clearInterval(retry);
      clearTimeout(giveUp);
    };
  }, []);

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={game("frameTitle")}
      // Chừa một chút mép trên khi game xin cuộn về đầu. Không cần nhiều: trang
      // này không có thanh header dính để tránh.
      className="w-full scroll-mt-4 border-0"
      style={{ height: playing ? PLAYING_HEIGHT : height }}
      // Game không có backend, không gọi mạng, chỉ đọc ghi localStorage của
      // chính nó — không cần cấp quyền gì.
      allow=""
    />
  );
}
