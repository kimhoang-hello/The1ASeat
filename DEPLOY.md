# Deploy lên Hostinger

Site đang chạy trên **Hostinger "Websites" (Node.js hosting)** — sản phẩm hosting
tự quản lý của Hostinger, có sẵn tích hợp GitHub riêng, khác với thuê 1 VPS trần rồi
tự cài Node/PM2/Nginx. Không cần SSH tay hay GitHub Actions cho việc deploy.

## 1. Deploy tự động

Website đã được **kết nối với GitHub repo này** trong Hostinger hPanel (mục
**Connected with GitHub**, xem trong Dashboard của website) với **Auto-deployment**
bật sẵn — mỗi lần push lên `main`, Hostinger tự `git pull`, `npm ci`, `npm run
build`, rồi khởi động lại app. Không cần làm gì thêm, chỉ cần `git push`.

Muốn deploy lại thủ công (vd sau khi đổi biến môi trường): vào Dashboard của
website trên hPanel → bấm **Redeploy**.

## 2. Biến môi trường

Đặt ở **hPanel → Websites → ghe1a.com → Environment variables** (không phải file
`.env.local` — file đó chỉ dùng khi chạy local). Cần các biến giống
[.env.example](.env.example):

- `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN` — BẮT BUỘC. Thiếu một trong
  hai là bản build hỏng (cố ý: site không có dữ liệu mẫu để rơi về), và
  Hostinger giữ nguyên bản đang chạy.
- `KIT_API_KEY`, `KIT_FORM_ID` — cho form đăng ký bản tin. Thiếu thì form trả về
  lỗi `not_configured`.
- `RESEND_API_KEY` — gửi email liên hệ từ `/contact` về info@ghe1a.com và email
  chào mừng cho subscriber mới. Thiếu thì form liên hệ báo lỗi cho người gửi.
- `REVALIDATE_SECRET`, `HOSTINGER_API_TOKEN`, `HOSTINGER_USERNAME`,
  `HOSTINGER_DOMAIN` — tuỳ chọn, xem [CONTENTFUL.md](CONTENTFUL.md#auto-refresh-site-khi-bấm-publish)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — tuỳ chọn, Measurement ID của Google
  Analytics 4 (dạng `G-XXXXXXXXXX`, lấy ở analytics.google.com → Admin → Data
  Streams). Không có thì site không gắn script analytics nào.
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` — tuỳ chọn, chỉ là thẻ xác minh Search
  Console.

Phần lớn job chạy theo lịch (GitHub Actions) gọi ngược vào site, nên server
cũng cần đúng các biến này. Kiểm 09/09/2026, phía GitHub giữ ĐÚNG những cái
sau — không phải mọi biến ở trên:

| Ở đâu trên GitHub | Biến | Job dùng |
|---|---|---|
| Repo secret | `EXPIRE_OFFERS_SECRET` | `expire-offers` |
| Repo secret | `SYNC_VIDEOS_SECRET` | `sync-videos` |
| Environment `contentful-write` (chỉ branch `main`) | `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`, `CONTENTFUL_MANAGEMENT_TOKEN`, `FINLY_API_KEY` | `check-rebates`, `check-bank-rebates`, `offer-history` (chỉ hai biến đọc) |

`KIT_V4_API_KEY` chỉ nằm trên server — không workflow nào đọc nó. Site không
còn dùng `ANTHROPIC_API_KEY` từ 05/11/2026; xoá được khỏi hPanel.

Vì sao `check-rebates` khác mọi job khác: từ 09/09/2026 nó chạy THẲNG TRONG
RUNNER chứ không gọi site (edge Hostinger chặn IP runner — xem
`scripts/check-rebates.mts`), nên nó cần token Contentful ở phía GitHub. Đặt
trong environment thay vì secret cấp repo để lượt `workflow_dispatch` từ branch
lạ không đọc được. Xem chú thích từng biến trong [.env.example](.env.example).

Site không đọc `NEXT_PUBLIC_SITE_URL`: base URL là hằng `SITE_URL` trong
`src/lib/subscriber-email.ts`, cố ý để trong repo chứ không để trong hosting
panel — xem chú thích ở đó.

Đổi biến môi trường xong nhớ bấm **Redeploy** để áp dụng.

## 3. Cache — vì sao nội dung mới đôi khi chưa lên ngay

Có 2 lớp cache tách biệt nhau:

- **Next.js ISR** (trong code, `export const revalidate = 60` ở các trang đọc
  Contentful) — tự làm mới dữ liệu tối đa 1 phút/lần, không cần deploy lại.
- **CDN của Hostinger** (`hcdn`) — cache HTML tới 1 năm phía trước server. Sau khi
  Contentful publish, nếu 1 phút trôi qua mà site vẫn chưa cập nhật, vào Dashboard
  website → **Essentials → Cache → Clear cache**.

Redeploy **không** tự xoá cache CDN — 2 việc độc lập nhau.

## 4. Domain & SSL

Quản lý ở **Manage domain** trong Dashboard website — Hostinger tự cấp SSL (mục
**SSL** hiện ✓ trong Dashboard).

## 5. Kiểm tra khi có lỗi

- **Runtime logs** (sidebar website) — log lỗi runtime của app đang chạy.
- **Deployments** (sidebar website) — xem lịch sử build, log build lỗi nếu có.
  **CI xanh KHÔNG có nghĩa là đã lên site**: CI không chạy `npm run build` trên
  máy của Hostinger. Push xong phải xem ở đây, hoặc mở site thật.

### Vì sao build dùng webpack (`next build --webpack`)

Từ 27/09/2026 tới 29/09/2026, 10 lượt deploy liền hỏng trên Hostinger trong
khi build trên máy và CI vẫn xanh — site đứng ở bản cũ hai ngày mà không ai
biết. Hai lỗi, cả hai chỉ có trong môi trường build của Hostinger:

1. `next/font/google`: Turbopack báo "next/font/google queries have exactly one
   entry" khi tải Plus Jakarta Sans. Đã sửa tận gốc bằng cách tự host font
   (`src/app/fonts/`), build không còn gọi Google Fonts.
2. Sau đó Turbopack chết ở bước PostCSS: "node process exited before we could
   connect to it". Turbopack chạy PostCSS trong một tiến trình node con rồi nối
   vào nó; máy build Hostinger không cho kết nối đó. Webpack chạy PostCSS ngay
   trong tiến trình chính nên không vướng.

`next dev` vẫn dùng Turbopack — chỉ bản build production đổi. Muốn quay lại
Turbopack thì bỏ cờ `--webpack` trong `package.json`, push, rồi PHẢI xem tab
Deployments cho tới khi lượt đó "Completed".
- Content model và các job ghi vào Contentful: xem [CONTENTFUL.md](CONTENTFUL.md).
