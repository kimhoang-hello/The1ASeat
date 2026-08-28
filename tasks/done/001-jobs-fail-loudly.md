# Hai job còn lại vẫn báo xanh khi việc của chúng hỏng

## Objective

`api/sync-videos` và `api/expire-offers` trả HTTP 200 kể cả khi không làm được
việc. Workflow gọi chúng bằng `curl -sfS`, chỉ nhìn HTTP status, nên job xanh
trong khi site sai. Commit 7703651 đã bịt đúng lỗ này cho `api/check-rebates`
và `api/revalidate`; hai route này bị bỏ sót.

## Bằng chứng

- **`sync-videos` — feed hỏng đọc thành "không có video mới".**
  `fetchLatestVideos()` không kiểm `res.ok`. Khi
  `youtube.com/feeds/videos.xml` trả lỗi, hàm `.text()` trang HTML lỗi của
  Google, `split("<entry>")` không thấy entry nào, trả `[]`, route trả 200
  `{checked: 0}`. Đo được ngày 28/08: endpoint đó trả 404 từ mạng của máy này
  — kể cả với channel của chính Google (`UC_x5XG1OV2P6uZZ5FSM9Ttw`), nên nhiều
  khả năng là chặn theo IP chứ không phải YouTube gỡ feed. Không kết luận được
  Hostinger có bị chặn không, và đó chính là vấn đề: nếu bị, job vẫn xanh 8
  giây một lượt và không ai biết video mới đã ngừng lên site.
- **`sync-videos` — lỗi ghi Contentful cũng nuốt luôn.** Vòng lặp gom lỗi vào
  `errors[]` rồi trả 200. Giống hệt lỗi `check-rebates` đã sửa.
- **`sync-videos` — `fetchExistingVideoUrls()` không kiểm `res.ok`.** Nếu lượt
  gọi CMA hỏng, `data.items ?? []` cho set rỗng và `data.total ?? 0` cho 0 nên
  vòng lặp thoát ngay: MỌI video thành "chưa có" và route đi tạo lại tất cả.
  `entryId` cố định (`post-<slug>`) và PUT không kèm version nên Contentful trả
  409 thay vì tạo trùng — nhưng lúc đó cả 15 video đều nằm trong `errors[]` và
  route vẫn trả 200.
- **`expire-offers` — trả 200 kèm `errors[]`.** Route này tự gỡ offer khỏi site
  (AGENTS.md xếp hạng 2 về hậu quả). Một offer hết hạn không gỡ được vẫn nằm
  trên site trong khi job báo xanh.

## Requirements

- `fetchLatestVideos()` ném lỗi khi feed trả non-2xx, kèm status để đọc log.
- `fetchExistingVideoUrls()` ném lỗi khi CMA trả non-2xx, thay vì trả set rỗng.
- `sync-videos` trả 500 khi `errors[]` không rỗng, theo đúng dạng
  `check-rebates` đang dùng.
- `expire-offers` trả 500 khi `errors[]` không rỗng.
- Body JSON giữ nguyên các trường đang có — chỉ đổi HTTP status.
- Không đụng `api/revalidate` (đã đúng) và không đổi logic nghiệp vụ nào khác.

## Acceptance Criteria

- [x] `npm run lint` PASS
- [x] `npx tsc --noEmit` PASS
- [x] `npm run build` PASS
- [x] `npm run audit:trademarks`, `audit:rebates`, `audit:awards` PASS
- [x] Feed non-2xx làm route hỏng to, không còn đọc thành `{checked: 0}`
- [x] `errors[]` không rỗng ⇒ HTTP 500 ở cả hai route
- [x] Đường chạy bình thường (không lỗi) vẫn trả 200 với body như cũ
- [x] Codex review PASS
- [x] Deploy xong site vẫn 200 ở các trang chính

## Priority

High — cả hai route ghi vào Contentful hoặc gỡ nội dung khỏi site, và cơ chế
báo động duy nhất là HTTP status mà workflow đọc.

## Dependencies

None

## Notes

Không tự chạy thử route trên production: gọi thẳng `/api/sync-videos` là ghi
thật vào Contentful. Kiểm bằng đọc code + build, phần còn lại để lượt cron kế
tiếp xác nhận.

## Status

COMPLETE

## Completed

2026-08-28

## Implementation

`sync-videos`: `fetchLatestVideos()` ném khi feed trả non-2xx thay vì đọc trang
lỗi thành 0 video; `fetchExistingVideoUrls` đổi thành `fetchVideoUrlsByState`,
tách entry đã publish khỏi entry còn là draft, và draft được BÁO LỖI chứ không
bỏ qua — nếu bỏ qua thì `--retry` của workflow chỉ cần một lượt nữa là biến lỗi
thật thành xanh. Job cố ý không tự publish draft.

`expire-offers`: thêm mốc đối chiếu là bản đã publish (`liveExpiredSlugs`, đọc
qua CDA như `check-rebates` đã phải làm) và báo những thẻ site vẫn phục vụ hạn
cũ trong khi draft đã sạch `expiresAt`. Chỉ báo, không tự sửa: hình dạng đó
cũng đúng với một tác giả đang sửa dở, mà `updateEntry` publish cả entry.

Cả hai route trả 500 khi `errors[]` không rỗng và `console.error` trước khi trả
(workflow dùng `curl -f` nên body bị nuốt).

## Verification

- Lint: PASS
- Typecheck (`npx tsc --noEmit`): PASS
- Build: PASS
- `audit:trademarks` / `audit:rebates` / `audit:awards`: PASS
- Tests: N/A — repo chưa có test runner
- Codex Review: PASS ở vòng 4, sau 3 vòng REJECT

## Codex — cả phần đã sửa lẫn phần đáng ghi lại

Không phản hồi nào bị bác bỏ; cả 6 đều đúng.

1. **Vòng 1 (3 lỗi).** Trả 500 không đủ vì workflow có `--retry 3
   --retry-all-errors`: lượt sau trả 200 là job xanh. Áp cho cả hai route, cộng
   yêu cầu log trước khi trả 500.
2. **Vòng 2 (2 lỗi).** Nhánh "draft sạch hạn + published còn hạn cũ → tự sửa"
   mà mình vừa viết sẽ publish bản nháp tác giả đang viết dở. Gỡ hẳn nhánh tự
   sửa, đổi thành chỉ báo. Và response lúc nguồn hỏng làm mất `checked` /
   `created` / `errors`.
3. **Vòng 3 (1 lỗi).** Đánh dấu `consideredSlugs` ngay lúc lấy khỏi truy vấn là
   sai: truy vấn so mốc thời gian còn `hasExpired` so theo ngày Toronto, nên
   một draft gia hạn tới `00:00` hôm nay lọt vào truy vấn rồi bị bỏ qua — và
   phần đối chiếu im lặng trong khi site vẫn treo offer hết hạn.

## Delivery

- Commit: `a6e3611` — Stop the last two jobs from going green on a failure they caused
- Push: PASS
- Deployment: PASS (Hostinger auto-deploy từ `main`)
- Post-deployment verification: PASS có giới hạn — `/`, `/credit-cards`,
  `/blog`, `/bank-accounts`, `/transfer-bonuses`, `/calculator`,
  `/transfer-partners`, `/contact` và một trang thẻ đều 200, không trang nào
  hồi quy. KHÔNG xác nhận được build mới đã lên: thay đổi nằm hoàn toàn ở
  server (API route), không để lại dấu vết nào trên HTML, và không được POST
  vào `/api/*` trên production để thử — làm vậy là ghi thật vào Contentful.
  Lượt cron kế tiếp mới là chỗ xác nhận thật.

## Files Changed

- `src/app/api/sync-videos/route.ts`
- `src/app/api/expire-offers/route.ts`
- `AGENTS.md`
