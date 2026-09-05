/**
 * Cầu nối giữa game và trang Ghế 1A bọc quanh nó.
 *
 * Game vẫn là một trang tĩnh chạy độc lập được — mở thẳng
 * `/games/catch-the-points/index.html` là chơi bình thường, không có gì đổi so
 * với bản đã duyệt. File này chỉ làm gì đó khi game nằm trong iframe:
 *
 *  1. Gắn `data-embedded` lên <html> để CSS giấu logo, tên site và link chân
 *     trang mà trang bọc ngoài đã có sẵn. Chạy bằng script CHẶN trong <head>,
 *     không phải module: module bị hoãn tới sau khi parse xong, nên người đọc
 *     kịp thấy một nhịp có hai logo Ghế 1A chồng nhau.
 *  2. TỰ ĐẶT CHIỀU CAO CỦA CHÍNH KHUNG IFRAME. Xem bên dưới.
 *  3. Chuyển tiếp sự kiện `ghe1a:analytics` ra ngoài để trang cha nối vào GA4.
 *
 * VÌ SAO GAME TỰ ĐẶT CHIỀU CAO KHUNG, thay vì báo số sang cho trang cha đặt:
 * iframe cùng origin nên `window.frameElement` với tới được, và ghi thẳng vào
 * đó thì việc đo và việc áp dụng nằm trong CÙNG một document, cùng một lượt
 * layout. Đường cũ đi qua `postMessage` rồi qua state của React: đo ở document
 * này, áp ở document kia, cách nhau ít nhất một nhịp — và trên Safari iPhone
 * khoảng lệch đó đủ để phần chân khung (dải "HỨNG ĐIỂM THƯỞNG" và dòng QUY
 * TẮC SỐ 1) bị cắt mất, vì game bị cấm cuộn bên trong khung.
 *
 * Lúc ĐANG CHƠI thì chiều cao tính theo màn hình chứ không theo nội dung: sân
 * chơi dùng `dvh`, mà trong iframe `dvh` chính là chiều cao iframe — đo nội
 * dung rồi đặt lại làm hai bên đuổi nhau. Chuỗi `clamp()` dưới đây được ghi
 * vào style của phần tử iframe nên `svh` trong đó là màn hình THẬT của trang
 * cha, không phải khung này.
 *
 * Mọi thứ bọc trong try/catch: cầu nối hỏng thì lượt chơi vẫn phải chạy tiếp.
 */
(function () {
  if (window.parent === window) return;

  document.documentElement.setAttribute("data-embedded", "");

  var origin = window.location.origin;
  /* `svh` chứ không phải `dvh`: trên điện thoại thanh địa chỉ thò ra thụt vào
     liên tục, mà mỗi lần `dvh` đổi là sân chơi nhảy một cái giữa lượt. Trang
     game cố ý không có thanh header dính, nên game lấy được gần trọn màn hình;
     2rem chừa lại để khung không dán sát mép. */
  var PLAYING_HEIGHT = "clamp(30rem, calc(100svh - 2rem), 54rem)";

  function frameElement() {
    try {
      return window.frameElement;
    } catch {
      return null; // Khác origin — rơi về đường `postMessage` bên dưới.
    }
  }

  function post(message) {
    try {
      window.parent.postMessage(message, origin);
    } catch {
      /* Trang cha khác origin thì bỏ qua, game vẫn chơi được. */
    }
  }

  function watch() {
    var shell = document.getElementById("game-shell");
    var frame = frameElement();

    function sync() {
      var playing = !!shell && shell.classList.contains("is-playing");
      // Class trên <html> để CSS biết đang chơi mà cho flexbox chia chỗ thay vì
      // tính bằng `dvh` — xem cuối style.css.
      document.documentElement.classList.toggle("game-playing", playing);

      // Box của <body>, KHÔNG phải `documentElement.scrollHeight`: số kia không
      // bao giờ nhỏ hơn khung nhìn, nên sau khi khung đã nới ra cho màn kết quả
      // thì bấm "Chơi lại" là nó kẹt luôn ở mức cao.
      var height = Math.ceil(
        Math.max(document.body.getBoundingClientRect().height, document.body.scrollHeight),
      );

      if (frame) {
        try {
          frame.style.height = playing ? PLAYING_HEIGHT : height + "px";
        } catch {
          /* Không ghi được thì vẫn còn tin nhắn bên dưới. */
        }
      }
      post({ source: "ghe1a-game", type: "state", playing: playing, height: height });
    }

    sync();
    new ResizeObserver(sync).observe(document.body);
    // Vào/ra lượt chơi không đổi kích thước body ngay lập tức, nên phải nghe
    // thẳng class `is-playing`.
    if (shell) new MutationObserver(sync).observe(shell, { attributeFilter: ["class"] });
    // Font tiếng Việt và ảnh logo về sau, layout mới ra đúng chiều cao.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);
    // Xoay ngang máy: `clamp()` ở trên tính lại, và nội dung cũng xếp lại.
    window.addEventListener("resize", sync);
    // Vài nhịp trong mấy giây đầu, cho máy chậm tải ảnh xong mới ra đúng số.
    [100, 400, 900, 1800, 3000].forEach(function (delay) {
      setTimeout(sync, delay);
    });

    window.addEventListener("message", function (event) {
      if (event.origin !== origin) return;
      var data = event.data;
      if (data && data.source === "ghe1a-page" && data.type === "ping") sync();
    });

    window.addEventListener("ghe1a:analytics", function (event) {
      post({ source: "ghe1a-game", type: "analytics", detail: event.detail });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watch, { once: true });
  } else {
    watch();
  }
})();
