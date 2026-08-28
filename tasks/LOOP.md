# Autonomous Development Loop

Nhật ký các phiên phát triển tự động. Ngắn gọn — chi tiết nằm trong từng file
task ở [done/](done/) và [review/](review/).

## 2026-08-28

### Session

Trigger: Manual (phiên đầu tiên — khởi tạo)

### Completed

- 001 — Hai job còn lại vẫn báo xanh khi việc của chúng hỏng

### Blocked

Không có.

### Kiểm tra sức khoẻ repo

Chạy đủ bộ gate trên `main` sạch tại commit `2f52545`, tất cả đều xanh:

| Gate | Kết quả |
|---|---|
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run audit:trademarks` | PASS — 0 chỗ thiếu ®/™ |
| `npm run audit:rebates` | PASS — 29/29 tài khoản khớp FinlyWealth |
| `npm run audit:awards` | PASS — 2016 quote / 8×14×3 combo |
| Production (ghe1a.com) | `/`, `/credit-cards`, `/blog` đều 200 |

### Ghi nhận

- **Job `sync-videos` hỏng lúc 01:37 UTC 28/08 — hạ tầng, không phải code.**
  Run [33133415212](https://github.com/kimhoang-hello/The1ASeat/actions/runs/33133415212)
  đỏ sau 19m34s: cả 4 lượt curl đều `(28) Failed to connect to ghe1a.com port
  443`, tức không bắt tay được TCP chứ không phải route chạy lâu. Khác hẳn hai
  lần hỏng 20/08 và 21/08 (timeout giữa chừng vì route gọi ra ngoài) mà
  `--retry` trong workflow sinh ra để chữa. Lần này site tắt hẳn khoảng 20 phút
  phía Hostinger; lúc kiểm lại đã 200 trở lại. Cron chạy 6 giờ/lần nên lượt
  06:00 UTC lẽ ra bù được — nhưng tới 07:45 UTC lượt đó vẫn chưa chạy. Lịch
  chạy của repo này vốn trôi rất xa mốc `0 */6`: các lượt gần đây rơi vào
  01:37, 03:34, 08:09, 14:27, 19:44 UTC, và có lượt bị bỏ hẳn. Đó là hành vi
  của scheduled workflow trên GitHub, không phải thứ sửa được trong repo. Nếu
  kiểu hỏng "không connect được" lặp lại thì vấn đề là uptime của hosting.
- **Chính lần đỏ đó dẫn tới task 001.** Đọc log để hiểu vì sao job hỏng thì
  phát hiện `sync-videos` đọc feed mà không kiểm `res.ok` — tức một feed hỏng
  sẽ cho job XANH trong 8 giây thay vì đỏ. Đo tại chỗ: endpoint
  `youtube.com/feeds/videos.xml` trả 404 từ mạng của máy này, kể cả với channel
  của Google. Channel ID trong code thì đúng (đối chiếu `externalId` trên trang
  channel) và 8 video mới nhất đều đã có trên site, nên không mất dữ liệu.
- Không tạo task nào cho phần nhắc của `audit:rebates` (10 tài khoản dùng link
  `/banking/` trong khi bản `/rebates/` trả tiền): đó là link tác giả tự chọn.

### Codex

4 vòng cho task 001 (3 REJECT rồi PASS) — vượt trần 3 vòng đúng một lượt, và
lượt thứ 4 chỉ để xác nhận bản sửa một dòng của vòng 3, không phải để cãi
tiếp. Không phản hồi nào của Codex bị bác bỏ; cả 6 đều đúng, chi tiết trong
[done/001-jobs-fail-loudly.md](done/001-jobs-fail-loudly.md).

Bài học đáng giữ: **trả 500 không đồng nghĩa với "lỗi sẽ hiện ra"**. Cả ba
workflow đều gọi bằng `curl --retry 3 --retry-all-errors`, nên một lỗi tự xoá
dấu vết của mình sẽ xanh ở lượt thử thứ hai. Vòng 1 của Codex là chỗ phát hiện
điều đó, và nó làm hỏng chính giả định mà task được viết ra để thực hiện.

### Commits

- "Give the autonomous loop a queue to read from" — tạo `tasks/` và file này.
- `a6e3611` — Stop the last two jobs from going green on a failure they caused

### Trạng thái cuối phiên

Hết hạn mức phiên (90 phút) sau khi giao xong task 001. Backlog trống, không
bắt đầu task mới. Chờ task mới trong [backlog/](backlog/) hoặc lần chạy theo
lịch kế tiếp.
