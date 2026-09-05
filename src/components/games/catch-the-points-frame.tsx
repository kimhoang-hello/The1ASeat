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

  // Đo thẳng trong document của iframe. Iframe cùng origin nên trang này với
  // tới được, và đo trực tiếp thì không có gì để lệch: không phụ thuộc việc
  // tin nhắn có tới không, cũng không phụ thuộc `embed.js` có nhận ra kích
  // thước vừa đổi hay không. Chuyện đó đã trả giá một lần — trên Safari
  // iPhone nội dung cao hơn con số game báo sang, khung thiếu vài trăm pixel,
  // và iframe biến thành một vùng cuộn thứ hai ngay giữa trang.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let resize: ResizeObserver | undefined;
    let mutation: MutationObserver | undefined;

    function measure() {
      const doc = frame?.contentDocument;
      if (!doc?.body) return;
      const shell = doc.getElementById("game-shell");
      const isPlaying = shell?.classList.contains("is-playing") === true;
      setPlaying(isPlaying);
      // Box của <body>, không phải `documentElement.scrollHeight`: số kia không
      // bao giờ nhỏ hơn khung nhìn, nên khung đã nới ra cho màn kết quả thì
      // không co lại được khi người chơi bấm "Chơi lại".
      if (isPlaying) return;
      const height = Math.ceil(
        Math.max(doc.body.getBoundingClientRect().height, doc.body.scrollHeight),
      );
      if (height > 0) setHeight(height);
    }

    function attach() {
      const doc = frame?.contentDocument;
      if (!doc?.body) return;
      resize?.disconnect();
      mutation?.disconnect();
      resize = new ResizeObserver(measure);
      // Cả <body> lẫn <html>: game đặt `overflow: hidden` lên cả hai khi được
      // nhúng, và tuỳ trình duyệt, cái đổi kích thước trước có thể là cái kia.
      resize.observe(doc.body);
      resize.observe(doc.documentElement);
      // Vào/ra lượt chơi không đổi kích thước body ngay, nên phải nghe thẳng
      // class `is-playing`.
      const shell = doc.getElementById("game-shell");
      if (shell) {
        mutation = new MutationObserver(measure);
        mutation.observe(shell, { attributeFilter: ["class"] });
      }
      // Font tiếng Việt và ảnh logo về sau, layout mới ra đúng chiều cao.
      doc.fonts?.ready.then(measure).catch(() => {});
      doc.addEventListener("readystatechange", measure);
      measure();
    }

    frame.addEventListener("load", attach);
    // Đo lại vài nhịp trong mấy giây đầu. Trên điện thoại chậm, ảnh và font
    // của game về sau khi trang này đã đo xong, mà game lại bị cấm cuộn bên
    // trong khung — nên một lần đo hụt là mất hẳn phần chân khung, không có
    // thanh cuộn nào cứu. Rẻ và chỉ chạy lúc mới vào trang.
    const warmup = [100, 400, 900, 1800, 3000].map((delay) => setTimeout(attach, delay));
    // Xoay ngang máy hoặc đổi cỡ cửa sổ là layout trong game đổi theo.
    window.addEventListener("resize", measure);
    attach();
    return () => {
      frame.removeEventListener("load", attach);
      window.removeEventListener("resize", measure);
      warmup.forEach(clearTimeout);
      frame.contentDocument?.removeEventListener("readystatechange", measure);
      resize?.disconnect();
      mutation?.disconnect();
    };
  }, []);

  // Kênh tin nhắn lo hai việc mà đo đạc không làm được — chuyển tiếp analytics
  // và nhận yêu cầu cuộn — đồng thời là đường dự phòng cho chiều cao nếu vì lý
  // do nào đó `contentDocument` không với tới được.
  useEffect(() => {
    const frame = frameRef.current;

    function onMessage(event: MessageEvent) {
      // Cùng origin và đúng iframe này — không nhận lệnh từ frame nào khác.
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame?.contentWindow) return;
      if (!isGameMessage(event.data)) return;

      if (event.data.type === "state") {
        if (frame?.contentDocument) return; // Đã có đường đo trực tiếp.
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
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={game("frameTitle")}
      // Chừa một chút mép trên khi game xin cuộn về đầu. Không cần nhiều: trang
      // này không có thanh header dính để tránh.
      className="w-full scroll-mt-4 border-0"
      // Thuộc tính cũ nhưng Safari vẫn nghe, và nó là lớp chặn cuối cùng để
      // iframe không bao giờ thành vùng cuộn thứ hai — xem `[data-embedded]`
      // trong style.css của game.
      scrolling="no"
      style={{ height: playing ? PLAYING_HEIGHT : height }}
      // Game không có backend, không gọi mạng, chỉ đọc ghi localStorage của
      // chính nó — không cần cấp quyền gì.
      allow=""
    />
  );
}
