# Hướng dẫn sửa nội dung Ghế 1A

Website hiện lấy nội dung từ các file JSON trong `content/sample/` (chưa nối
Contentful — xem mục cuối). Sửa các file này rồi nhờ Claude Code commit + push
là nội dung sẽ lên GitHub; muốn lên website thật thì Hostinger cần rebuild lại
(xem [DEPLOY.md](DEPLOY.md)).

## 1. Sửa chữ trên giao diện (nút, tiêu đề mục, nhãn...)

File: **`messages/vi.json`**

Đây là các câu chữ "khung" của trang — không phải nội dung bài viết. Tìm theo
mục (`hero`, `offers`, `posts`, `bonuses`, `calculator`, `author`,
`newsletterCta`, `footer`, `nav`...), mỗi dòng là một câu.

Ví dụ muốn đổi chữ trên nút đăng ký bản tin:

```json
"hero": {
  "subscribe": "Đăng ký miễn phí"   ← sửa chữ trong ngoặc kép này
}
```

Chỉ sửa phần chữ trong dấu `"..."`, giữ nguyên phần `"key":` phía trước.

## 2. Viết bài blog mới

File: **`content/sample/posts.json`**

Đây là một danh sách (mảng) các bài viết. Mỗi bài là một khối `{ ... }`. Để
thêm bài mới, **copy một khối bài có sẵn, dán vào đầu danh sách (ngay sau dấu
`[`), rồi sửa nội dung**, nhớ thêm dấu phẩy `,` sau dấu `}` đóng khối vừa dán
(vì phía sau nó còn bài khác).

Mẫu một bài viết (loại "post" — bài viết thường):

```json
{
  "slug": "ten-duong-dan-bai-viet-khong-dau",
  "type": "post",
  "category": { "vi": "Thẻ tín dụng", "en": "Credit Cards" },
  "title": {
    "vi": "Tiêu đề bài viết bằng tiếng Việt",
    "en": "Title in English"
  },
  "excerpt": {
    "vi": "Tóm tắt ngắn 1-2 câu, hiện ở trang danh sách blog.",
    "en": "Short 1-2 sentence summary shown on the blog listing."
  },
  "body": {
    "vi": "<p>Đoạn văn đầu tiên.</p><p>Đoạn văn thứ hai.</p>",
    "en": "<p>First paragraph.</p><p>Second paragraph.</p>"
  },
  "coverImage": "airplane",
  "publishedAt": "2026-08-10",
  "minutesRead": 6,
  "author": "Hoàng"
}
```

Giải thích từng trường:

| Trường | Ý nghĩa | Lưu ý |
|---|---|---|
| `slug` | Đường dẫn bài viết (vd `/blog/ten-duong-dan...`) | Chỉ chữ thường, số, dấu gạch ngang `-`, không dấu, không trùng bài khác |
| `type` | `"post"` (bài viết) hoặc `"video"` (video) | Bài video sẽ hiện icon ▶ và badge "Video" |
| `category` | Nhãn chủ đề, hiện phía trên tiêu đề | Cả `vi` và `en` |
| `title` | Tiêu đề bài | — |
| `excerpt` | Tóm tắt ngắn | Hiện ở trang danh sách, nên ngắn gọn |
| `body` | Nội dung đầy đủ | Mỗi đoạn văn bọc trong `<p>...</p>`, muốn xuống đoạn mới thì thêm `<p>` mới |
| `coverImage` | Ảnh minh hoạ (hiện tại là icon placeholder) | Chọn 1 trong: `airplane`, `globe`, `building`, `armchair`, `credit-card`, `avatar` |
| `publishedAt` | Ngày đăng | Định dạng `NĂM-THÁNG-NGÀY`, vd `2026-08-10` |
| `minutesRead` | Số phút đọc ước tính | Chỉ cần số nguyên, vd `6` |
| `author` | Tên tác giả hiện dưới tiêu đề | — |

Bài video (`"type": "video"`) có thêm trường `"videoUrl"` (dán link YouTube/
TikTok thật vào đó khi có).

### Việc cần Claude Code làm giúp

Sau khi bạn có nội dung muốn đăng (kể cả viết tay trong tin nhắn, không cần
đúng định dạng JSON), chỉ cần nhắn cho Claude Code, ví dụ:

> "Đăng bài mới: tiêu đề '...', nội dung: ...'"

Claude Code sẽ tự thêm đúng định dạng vào `posts.json`, kiểm tra lỗi, và
commit/push giúp bạn — bạn không bắt buộc phải tự sửa JSON.

## 3. Thẻ tín dụng & ưu đãi chuyển điểm

Tương tự bài viết, hai mục này nằm ở:

- `content/sample/credit-cards.json` — danh sách thẻ tín dụng
- `content/sample/transfer-bonuses.json` — ưu đãi chuyển điểm

Cấu trúc tương tự (mỗi mục một khối `{ ... }`), cứ mô tả với Claude Code là
được thêm/sửa đúng định dạng.

## 4. Đưa thay đổi lên website thật

Sau khi file được sửa và **commit + push lên GitHub** (Claude Code làm bước
này), Hostinger cần chạy lại build để nội dung mới lên website — cách làm chi
tiết ở [DEPLOY.md](DEPLOY.md). Nếu đã bật GitHub Actions tự động deploy (mục 3
trong DEPLOY.md) thì bước này tự chạy sau khi push, không cần làm gì thêm.

## 5. Về lâu dài: chuyển sang Contentful (khuyên dùng)

Sửa JSON vẫn cần Claude Code hỗ trợ mỗi lần. Nếu muốn **tự đăng bài trực tiếp
qua giao diện web** (giống viết Google Docs, không đụng code/JSON/git), hãy
tạo tài khoản Contentful và làm theo [CONTENTFUL.md](CONTENTFUL.md) — website
đã được lập trình sẵn để tự động chuyển sang lấy nội dung từ Contentful ngay
khi bạn điền API key vào `.env.local`.
