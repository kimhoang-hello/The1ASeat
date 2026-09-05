# Catch the Points — chỗ nào nằm ở đâu

Game gốc là một trang tĩnh độc lập (bản bàn giao V2.1, commit `ff865a2`). Khi
đưa vào website nó bị **tách làm hai chỗ**, và đây là lý do:

| Thư mục | Nội dung | Vì sao ở đó |
| --- | --- | --- |
| `public/games/catch-the-points/` | `index.html`, `src/`, `assets/` | Next chỉ phục vụ file tĩnh từ `public/`. Đây là bản đang chạy thật. |
| `games/catch-the-points/` (thư mục này) | `tests/`, `docs/`, `README.md` | Không phải thứ người đọc cần tải về. Để trong `public/` là công khai luôn cả tài liệu nội bộ. |

Vì tách như vậy, `tests/*.js` import ngược lên
`../../../public/games/catch-the-points/src/…`. Chạy:

    npm run test:game     # 43 test, từ gốc repo

`README.md` cạnh file này là bản gốc của tác giả game — nó vẫn nói theo bố cục
cũ (`npm run dev`, `server.mjs`, `/assets/…`). Đọc nó để hiểu gameplay và cách
chỉnh thông số; đọc bảng trên để biết file thật nằm đâu.

## Những gì đã đổi so với bản bàn giao

1. **Đường dẫn asset.** Bản gốc dùng `/assets/…` và `/src/…` tính từ gốc site —
   đưa vào `public/games/catch-the-points/` là trỏ ra ngoài và đè lên asset của
   website. Nay: `index.html` và `assets/fonts/fonts.css` dùng đường dẫn tương
   đối; JavaScript giải qua `ASSET_BASE` trong `src/config.js`
   (`new URL("../assets/", import.meta.url)`), nên chuyển thư mục đi đâu cũng
   không phải sửa lại lần nữa.
2. **Bộ icon nhúng thẳng vào `index.html`.** `assets/icons.svg` đã bị xoá.
   WebKit không đọc `<use href="file-ngoai.svg#id">`, nên trên Safari iPhone
   toàn bộ icon mũi tên, nút "Chơi lại" và icon máy bay biến mất — lặng lẽ,
   không lỗi console. Sprite nay nằm trong `<body>` và mọi tham chiếu là `#id`.
3. **Chế độ nhúng.** `src/embed.js` (script chặn trong `<head>`) gắn
   `data-embedded` lên `<html>` khi game chạy trong iframe, báo chiều cao thật
   cho trang cha, và chuyển tiếp sự kiện `ghe1a:analytics` ra ngoài. CSS
   `[data-embedded]` ở cuối `src/style.css` giấu logo/tên site/link chân trang
   — trang bọc ngoài đã có sẵn những thứ đó. Mở thẳng
   `/games/catch-the-points/index.html` thì không có gì đổi so với bản duyệt.
4. **`scrollToTop()` trong `src/main.js`** thay cho `window.scrollTo(0, 0)`:
   trong iframe, document của game không cuộn được (trang cha chỉnh chiều cao
   theo nội dung), nên phải nhờ trang cha cuộn.

Không đụng vào gameplay, scoring, `recommendation-config.js` hay bất kỳ quyết
định giao diện nào đã duyệt.
