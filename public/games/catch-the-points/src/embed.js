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
 *  2. Báo cho trang cha biết game đang ở trạng thái nào và cao bao nhiêu.
 *  3. Chuyển tiếp sự kiện `ghe1a:analytics` ra ngoài để trang cha nối vào GA4.
 *
 * VÌ SAO PHẢI BÁO TRẠNG THÁI, KHÔNG CHỈ BÁO CHIỀU CAO: lúc đang chơi, chiều
 * cao sân chơi tính bằng `dvh` (xem `.game-shell.is-playing .stage` trong
 * style.css). Trong iframe, `dvh` chính là chiều cao của iframe — nên nếu
 * trang cha đặt chiều cao iframe theo nội dung, nội dung lại tính theo chiều
 * cao iframe, hai bên đuổi nhau và trên điện thoại sân chơi tụt thẳng xuống
 * `min-height`. Trang cha vì thế chỉ dùng chiều cao đo được khi KHÔNG chơi;
 * lúc đang chơi nó tự đặt chiều cao theo màn hình, đúng như bản chạy độc lập.
 *
 * Mọi thứ bọc trong try/catch: cầu nối hỏng thì lượt chơi vẫn phải chạy tiếp.
 */
(function () {
  if (window.parent === window) return;

  document.documentElement.setAttribute("data-embedded", "");

  var origin = window.location.origin;
  function post(message) {
    try {
      window.parent.postMessage(message, origin);
    } catch {
      /* Trang cha khác origin thì bỏ qua, game vẫn chơi được. */
    }
  }

  function watch() {
    var shell = document.getElementById("game-shell");
    var lastHeight = 0;
    var lastPlaying = null;

    function report(force) {
      // `scrollHeight` của <html>, không phải của <body>: margin của phần tử
      // cuối cùng nằm ngoài body và sẽ bị bỏ sót.
      var height = Math.ceil(document.documentElement.scrollHeight);
      var playing = !!shell && shell.classList.contains("is-playing");
      // Gắn class lên <html> để CSS biết đang chơi: lúc đó khung game do trang
      // cha đặt chiều cao, nên bên trong phải giãn cho vừa khung thay vì tự
      // tính bằng `dvh` — xem cuối style.css.
      document.documentElement.classList.toggle("game-playing", playing);
      if (!force && height === lastHeight && playing === lastPlaying) return;
      lastHeight = height;
      lastPlaying = playing;
      post({ source: "ghe1a-game", type: "state", playing: playing, height: height });
    }

    // Trang cha hỏi lại sau khi iframe load xong. Cần thật, không phải cho
    // chắc: iframe này nhẹ hơn cả bundle React của trang cha, nên bản báo đầu
    // tiên có thể bay đi TRƯỚC khi trang cha kịp gắn listener — và vì `report`
    // bỏ qua giá trị trùng, sẽ không có lần báo thứ hai. `force` phá dedupe đó.
    window.addEventListener("message", function (event) {
      if (event.origin !== origin) return;
      var data = event.data;
      if (data && data.source === "ghe1a-page" && data.type === "ping") report(true);
    });

    report(true);
    new ResizeObserver(function () {
      report(false);
    }).observe(document.body);
    // Vào/ra lượt chơi không đổi kích thước body ngay lập tức, nên phải nghe
    // thẳng class `is-playing`.
    if (shell)
      new MutationObserver(function () {
        report(false);
      }).observe(shell, { attributeFilter: ["class"] });
    // Font tiếng Việt về sau, layout mới ra đúng chiều cao.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
        report(false);
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
