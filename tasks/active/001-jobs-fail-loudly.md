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

- [ ] `npm run lint` PASS
- [ ] `npx tsc --noEmit` PASS
- [ ] `npm run build` PASS
- [ ] `npm run audit:trademarks`, `audit:rebates`, `audit:awards` PASS
- [ ] Feed non-2xx làm route hỏng to, không còn đọc thành `{checked: 0}`
- [ ] `errors[]` không rỗng ⇒ HTTP 500 ở cả hai route
- [ ] Đường chạy bình thường (không lỗi) vẫn trả 200 với body như cũ
- [ ] Codex review PASS
- [ ] Deploy xong site vẫn 200 ở các trang chính

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

IN PROGRESS
