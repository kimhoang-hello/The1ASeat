# Autonomous Development Loop

Nhật ký các phiên phát triển tự động. Ngắn gọn — chi tiết nằm trong từng file
task ở [done/](done/) và [review/](review/).

## 2026-08-29

### Session

Trigger: Scheduled

### Completed

Không có — backlog trống, không bịa task.

### Blocked

Không có.

### Kiểm tra sức khoẻ repo

Chạy đủ bộ gate trên `main` sạch tại commit `db308d1`, tất cả đều xanh:

| Gate | Kết quả |
|---|---|
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run audit:trademarks` | PASS — 0 chỗ thiếu ®/™ |
| `npm run audit:rebates` | PASS — 29/29 tài khoản khớp FinlyWealth |
| `npm run audit:awards` | PASS — 2016 quote / 8×14×3 combo |
| Production (ghe1a.com) | `/`, `/credit-cards`, `/blog`, `/bank-accounts`, `/transfer-bonuses`, `/calculator` đều 200 |

### Ghi nhận

- **`sync-videos` đỏ thêm hai lần nữa vì cùng một kiểu hỏng: `curl: (28)
  Failed to connect to ghe1a.com port 443`.** Lượt 21:56 UTC 28/08 (chạy
  33214687431) và lượt 06:05 UTC 29/08 (chạy 33237637114) — cả hai đều 4/4
  lượt retry connect fail trong ~19 phút, không phải timeout giữa chừng. Cùng
  dạng với lần 01:37 UTC 28/08 đã ghi trong log hôm qua. Ba lần trong vòng
  chưa tới 30 giờ là hạ tầng Hostinger, không phải code — site kiểm lại lúc
  viết log này đã 200 ở mọi route chính. Không tạo task; AGENTS.md đã ghi rõ
  đây là uptime của hosting, không sửa được trong repo.
- Không có phát hiện mới nào cần task. `audit:rebates` vẫn nhắc 10 tài khoản
  dùng link `/banking/` thay vì `/rebates/` trả tiền cao hơn — đã ghi trong
  log 28/08 là lựa chọn của tác giả, không lặp lại ở đây.

### Codex

Không chạy — không có thay đổi code nào trong phiên này.

### Commits

- Cập nhật file log này.

### Trạng thái cuối phiên

IDLE. Backlog trống, repo sạch, mọi gate xanh, production khoẻ. Chờ task mới
trong [backlog/](backlog/) hoặc lần chạy theo lịch kế tiếp.

## 2026-08-29

### Session

Trigger: Manual — "Claude và Codex phối hợp kiểm tra toàn diện website".

### Completed

- Rà toàn repo trên `4d293ab` (Codex `gpt-5.6-sol`, effort high), 8 phát hiện,
  vá cả 8 + 3 lỗi trong chính bản vá do hai vòng phản biện sau bắt được.
  Commit `8b6874b`, đã deploy và xác minh trên site thật.

### Blocked

Không có.

### Kiểm tra sức khoẻ repo

`lint`, `tsc --noEmit`, `build` (8.9s), `audit:trademarks` (0), `audit:awards`
(2016 quote, PASS), `audit:rebates` (29 tài khoản khớp) — sạch cả trước lẫn sau
khi vá. Nội dung published: 23 thẻ / 2 transfer bonus / 36 bài, không thẻ nào
hết hạn còn treo, không bonus nào hết hạn còn published, không thẻ nào thiếu
trường, cả 23 thẻ đều có rule chip trong `card-points-programs`. Site: 106 URL
trong sitemap + 163 link nội bộ đều 200; 62 link ngoài đều sống (Facebook trả
400 với curl nhưng mở được trong browser — đúng như đã ghi trong bộ nhớ);
title/description/canonical không trùng và không thiếu chỗ nào; 106 trang đều
có JSON-LD + og:image; 643 ảnh đều có `alt`; không có lỗi console trên
desktop lẫn mobile.

### Ghi nhận

- **Lần thứ tư `sync-videos` không connect được** (run `33256468875`, 14:02–14:21
  UTC): `curl: (28) Failed to connect to ghe1a.com port 443` bốn lượt liền, mỗi
  lượt ~269s. Lần này có thêm dữ kiện thu hẹp nguyên nhân: mình bấm tay ba
  workflow liền nhau, `check-rebates` và `expire-offers` đi qua bình thường
  ngay trước đó, còn `sync-videos` — lượt thứ ba — bị chặn ở tầng TCP suốt 20
  phút. Site vẫn 200 từ máy ở nhà trong đúng khoảng đó. Nên đây KHÔNG phải
  "Hostinger tắt hẳn 20 phút" như lần trước ghi: nhiều khả năng Hostinger chặn
  hoặc giới hạn theo IP runner sau vài request dồn. Nếu còn lặp, hướng kiểm là
  so IP runner giữa lượt xanh và lượt đỏ, chứ không phải uptime.
- Không có thẻ nào thuộc diện `expire-offers` phải xử lý hôm nay (0 thẻ hết
  hạn), nên lượt chạy tay chỉ xác minh được đường auth mới và hai vòng đối
  chiếu mới — không xác minh được nhánh giữ `expiresAt`.

### Codex

3 vòng. Vòng 1 rà toàn repo: 8 phát hiện (4 High, 3 Medium, 1 Low), không phát
hiện nào bị bác bỏ — kiểm lại từng cái trong source thì đều đúng. Vòng 2
(`review --uncommitted`) tìm ra bản vá của mình mở một đường mất bản tin mới:
claim được trả lại khi Kit lỗi nhưng route vẫn trả 200, nên Contentful không
gọi lại và bài đầu tiên im lặng không có bản tin. Vòng 3 bác tiếp cách sửa của
vòng 2: `!res.ok` gộp cả 5xx, mà 5xx KHÔNG chứng minh được là Kit chưa tạo
broadcast — tách 4xx (trả chỗ, 502) khỏi 5xx (giữ chỗ, 200).

Bài học đáng giữ: **hai vòng sau đắt giá hơn vòng đầu.** Vòng 1 tìm lỗi trong
code có sẵn; vòng 2 và 3 tìm lỗi trong bản vá vừa viết — đúng chỗ mình tự tin
nhất và không ai soi.

### Commits

- `8b6874b` — Close the eight holes a full-repo cross-review found
- `d05350a` — Send the security headers the site never had

### Deploy

**Hostinger BỎ QUA lượt push `d05350a` — auto-deploy không tự chạy.** Commit
trước đó (`8b6874b`) lên sau 3 phút; lượt này chờ 45 phút vẫn là bản cũ. Đã
loại trừ khả năng "CDN nuốt header" trước khi kết luận: trang chủ vẫn trả về
các header do chính app đặt (`x-powered-by`, `x-nextjs-cache`, `etag`), nên
edge không lọc header của app — đơn giản là bản mới chưa chạy. User bấm
**Redeploy** tay trong hPanel thì lên ngay.

Cách kiểm nhanh một thay đổi CHỈ nằm ở tầng server có lên hay chưa: đổi thứ gì
đó quan sát được từ ngoài rồi so. Lần này dùng `GET /api/expire-offers` →
405 (trước là 401) cho commit `8b6874b`, và chính header cho `d05350a`. Chunk
JS/CSS thì KHÔNG dùng được: tên chúng băm theo nội dung client, mà thay đổi
kiểu này không đụng tới bundle nên tên y hệt trước sau.

### Trạng thái cuối phiên

Backlog trống. Ba job đã chạy tay: `check-rebates` và `expire-offers` xanh,
`sync-videos` đỏ vì lỗi mạng phía hosting, không liên quan tới thay đổi.

Kiểm lại sau khi cả hai commit đã lên production: 106 URL sitemap đều 200 và
đều mang đủ 5 header mới; `GET` hai job route trả 405, `?secret=` trả 401;
www→apex vẫn 308; title/description/canonical không trùng không thiếu; 106
trang đủ JSON-LD + og:image; không ảnh nào thiếu `alt`; không lỗi console.
Nhúng YouTube và widget bình luận Cusdis (iframe `srcdoc`) đều chạy — đã kiểm
tận trong DOM của iframe, vì ảnh chụp màn hình lúc pane bị ẩn hay ra khung
trắng và suýt làm mình báo nhầm là hỏng.

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
