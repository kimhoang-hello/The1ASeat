# Hướng dẫn sửa nội dung Ghế 1A

Website hiện **lấy nội dung trực tiếp từ Contentful** (đã setup xong) —
bạn tự đăng bài / sửa thẻ tín dụng / ưu đãi chuyển điểm qua giao diện web
Contentful, không cần đụng code hay nhờ Claude Code mỗi lần.

## 1. Đăng nhập Contentful

Vào **https://app.contentful.com** → đăng nhập → chọn Space **"Ghe1A"**.

Menu bên trái có mục **Content** — đây là nơi quản lý toàn bộ bài viết, thẻ
tín dụng, ưu đãi chuyển điểm, và hồ sơ tác giả.

## 2. Viết bài blog mới

1. Vào **Content** → bấm **"+ Add entry"** → chọn **"Blog Post"**
2. Điền các trường (mỗi trường có sẵn `...Vi` và `...En` do Contentful tạo sẵn
   — **bỏ qua các trường `...En`, không cần điền** vì website chỉ có bản
   tiếng Việt, chỉ trường `...Vi` được hiển thị):

   | Trường | Ý nghĩa |
   |---|---|
   | Slug | Đường dẫn bài viết, vd `cach-choi-diem-hieu-qua` (không dấu, không khoảng trắng) |
   | Type | `post` (bài viết) hoặc `video` |
   | Category Vi/En | Nhãn chủ đề, hiện phía trên tiêu đề |
   | Title Vi/En | Tiêu đề |
   | Excerpt Vi/En | Tóm tắt ngắn, hiện ở trang danh sách |
   | Body Vi/En | Nội dung đầy đủ — có trình soạn thảo như Google Docs (in đậm, in nghiêng, tiêu đề phụ...) |
   | Cover Image | Chọn 1 trong: `airplane`, `globe`, `building`, `armchair`, `credit-card`, `avatar` (icon minh hoạ tạm, chưa hỗ trợ ảnh thật) |
   | Video URL | Chỉ cần nếu Type = video |
   | Published At | Ngày đăng |
   | Minutes Read | Số phút đọc, vd `6` |
   | Author | Tên tác giả, vd `Hoàng` |

3. Bấm **Publish** (góc trên bên phải) — bài sẽ lên web ngay, **không cần
   deploy lại, không cần Claude Code**.

## 3. Sửa/thêm thẻ tín dụng & ưu đãi chuyển điểm

Tương tự — vào **Content → Add entry** → chọn **"Credit Card Offer"** hoặc
**"Transfer Bonus"**, điền các trường, **Publish**.

Với **Credit Card Offer**, hai trường hay dùng nhất:

| Trường | Ý nghĩa |
|---|---|
| Card Image | Bấm **"Add media"** để **upload ảnh thật của thẻ** (chụp/tải file ảnh). Nếu để trống, web tự hiện icon thẻ tín dụng minh hoạ thay thế. |
| Expires At | Ngày hết hạn ưu đãi (nếu ưu đãi có giới hạn thời gian) — hiện tự động cạnh badge trên web. Không có ưu đãi giới hạn thời gian thì bỏ trống. |

## 4. Sửa hồ sơ tác giả (ảnh, tiểu sử)

Vào **Content**, tìm entry loại **"Author"** (tên "Hoàng") → sửa `Bio Vi`
(bỏ qua `Bio En`) hoặc đổi ảnh ở trường `Photo` → **Publish**.

## 5. Sửa chữ giao diện (nút, tiêu đề mục cố định...)

Phần này **không nằm trong Contentful** (vì là chữ "khung" của giao diện,
không phải nội dung bài viết) — vẫn nằm trong code, ở file
**`messages/vi.json`**. Muốn đổi, ví dụ chữ trên nút đăng ký bản tin, tìm:

```json
"hero": {
  "subscribe": "Đăng ký miễn phí"   ← sửa chữ trong ngoặc kép này
}
```

Phần này cần nhờ Claude Code sửa + commit + push (không tự sửa qua web được).

## 6. Khách sạn (`/hotels`)

Mục Khách sạn **không nằm trong Contentful** — mỗi khách sạn là một khối trong file
**`src/lib/hotels.ts`**. Cách nhanh nhất: nhờ Claude Code ("thêm khách sạn X, review
ở bài Y, link Expedia là Z"). Những gì bạn cần chuẩn bị:

| Việc | Làm thế nào |
|---|---|
| Thêm khách sạn | Cần ít nhất một nguồn thật của bạn: bài review hoặc video YouTube. Chưa có thì khách sạn để `published: false` (nháp, không hiện trên web). |
| Link đặt phòng Expedia® | Vào Expedia® Travel Creator → tạo link cho đúng khách sạn → gửi link `expedia.com/affiliate/…`. **Dán nguyên link, không sửa gì thêm.** |
| Tạm tắt một link | Đổi `enabled: true` thành `false` — nút biến mất, link vẫn còn để bật lại. |
| Đổi ảnh bìa | Ảnh hiện là ảnh chính thức của khách sạn. Muốn dùng ảnh bạn chụp: gửi ảnh, Claude Code thay `coverImage`. |
| Chọn vào khối "Ghế 1A chọn" | Đặt `featured: 1`, `2`, `3`… (số nhỏ đứng trước). Bỏ `featured` là ra khỏi khối. |
| Thứ tự trong danh sách | Thứ tự các khối trong file. |
| Ẩn một khách sạn | `published: false` — trang trả 404, ra khỏi danh sách và sitemap. |

Bật/tắt cả mục: `HOTELS_PUBLISHED` trong `src/lib/feature-flags.ts`. Khi tắt, trang vẫn
mở được bằng link trực tiếp để bạn xem, kèm dải "Bản nháp", và Google không index.

Câu công bố affiliate trên trang khách sạn nằm ở `messages/vi.json` → `hotels.disclosure`.

## 7. Lưu ý

- **Xoá entry** trong Contentful: phải bấm **Unpublish** trước, rồi mới **Delete**
  được (Contentful chặn xoá trực tiếp entry đang published).
- Nếu server chạy local (`npm run dev`) không thấy nội dung mới ngay, refresh
  lại trang — nội dung được lấy trực tiếp từ Contentful mỗi lần tải trang.
- Nếu vì lý do nào đó Contentful bị lỗi/mất kết nối, site tự động dùng lại nội
  dung mẫu trong `content/sample/*.json` để không bị sập trang.
