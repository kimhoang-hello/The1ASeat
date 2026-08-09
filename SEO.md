# SEO cho Ghế 1A

Tài liệu này ghi lại: **(1)** những gì đã sửa trong code, **(2)** những việc chỉ
bạn mới làm được, và **(3)** lộ trình nội dung để lên thứ hạng tiếng Việt.

Cập nhật lần cuối: 2026-08-09.

---

## 1. Đã sửa (không cần bạn làm gì)

### Vấn đề nghiêm trọng nhất: site tồn tại ở hai địa chỉ

`www.ghe1a.com` trước đây trả về **toàn bộ site với mã 200**, y hệt
`ghe1a.com`. Với Google đó là hai website khác nhau có nội dung trùng nhau —
lượt truy cập, backlink và độ tin cậy bị chia đôi, và Google phải tự đoán bản
nào là bản chính.

Đã thêm redirect 301 (`308`) từ `www` về tên miền chính trong
[next.config.ts](next.config.ts). Từ giờ mọi đường dẫn `www` đều chuyển thẳng
về `ghe1a.com`.

### Mọi trang giờ đều có thẻ canonical

Trước đây chỉ trang bài viết và trang thẻ tín dụng chi tiết có canonical. Trang
chủ, `/blog`, `/credit-cards`, `/calculator`, `/about`… đều không có, nên
Google không biết đâu là URL chuẩn khi gặp biến thể (có `www`, có `?type=`,
có tham số quảng cáo…).

Giờ **mọi trang** đều khai báo canonical qua helper chung
[src/lib/seo.ts](src/lib/seo.ts).

### Mỗi trang có tiêu đề và mô tả riêng

Trước đây **cả 10 trang tĩnh dùng chung đúng một dòng mô tả 33 ký tự**
("Miles & Points cho người Việt"). Google gần như chắc chắn sẽ bỏ qua và tự
chế mô tả khác.

Giờ mỗi trang có tiêu đề + mô tả riêng, viết theo cách người Việt thật sự gõ
vào ô tìm kiếm. Nội dung nằm trong `messages/vi.json`, mục `seo` — bạn sửa
trực tiếp ở đó được, không cần đụng tới code.

| Trang | Tiêu đề hiển thị trên Google |
|---|---|
| Trang chủ | Ghế 1A — Miles & Points cho người Việt |
| `/credit-cards` | Thẻ tín dụng tích điểm du lịch tại Canada |
| `/blog` | Blog Miles & Points: kiến thức, review chuyến bay & khách sạn |
| `/calculator` | Công cụ tính giá trị điểm thưởng |
| `/transfer-bonuses` | Transfer Bonus đang diễn ra |
| `/transfer-partners` | Transfer Partners: tỷ lệ chuyển điểm Amex® và RBC® |
| `/about` | Giới thiệu về Ghế 1A |

### Trang chuyên mục mới

Site có 28 bài chia làm 4 chuyên mục nhưng **không có trang nào gom chúng lại**.
Google thích những trang "hub" như vậy: chúng gom các bài cùng chủ đề thành một
cụm, và cụm đó mới là thứ xếp hạng được cho các từ khoá rộng.

Đã tạo:

- `/blog/chuyen-muc/khach-san` — 13 bài
- `/blog/chuyen-muc/danh-gia` — 11 bài
- `/blog/chuyen-muc/kien-thuc` — 3 bài
- `/blog/chuyen-muc/deals` — 1 bài

Bạn thêm chuyên mục mới trong Contentful thì trang tương ứng **tự sinh ra**,
kèm mô tả mặc định. Nếu muốn mô tả riêng cho chuyên mục mới, thêm vào
`CATEGORY_DESCRIPTIONS` trong [src/lib/blog-categories.ts](src/lib/blog-categories.ts).

### Liên kết nội bộ

Trước đây đọc xong một bài thì đường duy nhất là "Về trang chủ" — người đọc
thoát, và Google không có đường đi tiếp để khám phá bài khác.

Giờ mỗi bài có: tên chuyên mục bấm được, và khối **"Bài viết liên quan"** với
3 bài (ưu tiên cùng chuyên mục).

### Dữ liệu có cấu trúc (structured data)

Đây là phần Google dùng để hiển thị kết quả "đẹp" — ảnh, ngày, breadcrumb,
video. Đã thêm:

| Loại | Ở đâu | Có lợi gì |
|---|---|---|
| `BreadcrumbList` | Bài viết, chuyên mục, thẻ tín dụng | Hiện đường dẫn phân cấp thay vì URL trần |
| `VideoObject` | **24 bài video** | Đủ điều kiện xuất hiện ở tab Video và có ảnh thumbnail trong kết quả |
| `ItemList` | `/blog`, `/credit-cards`, mọi chuyên mục | Google hiểu đây là trang danh sách |
| `CreditCard` + `Offer` | Từng thẻ | Hiện phí thường niên, ngân hàng phát hành |
| `ProfilePage` + `Person` | `/about` | Gắn tác giả thành một thực thể — quan trọng với chủ đề tài chính |
| `BlogPosting` (nâng cấp) | Mọi bài | Thêm ngày cập nhật, chuyên mục, liên kết tác giả |

### Link affiliate đã gắn `rel="sponsored"`

Google **yêu cầu** link affiliate/referral phải được đánh dấu. Toàn bộ nút
"Xem offer" giờ có `rel="sponsored nofollow"`. Không làm việc này lâu dài có
thể bị coi là mua bán link.

### Sitemap, robots.txt, RSS

- **Sitemap**: trước đây mọi URL đều khai `lastmod` là "vừa nãy" ở mỗi lần
  build — vô nghĩa với Google. Giờ mỗi URL mang đúng ngày nội dung đằng sau nó,
  kèm `priority` và `changefreq`. Đã thêm 4 trang chuyên mục (48 URL).
- **robots.txt**: chặn `/api/` (không có gì để index), khai báo host chính.
- **RSS mới** tại [`/feed.xml`](https://ghe1a.com/feed.xml), có link trong
  `<head>` mọi trang.

### Hai field SEO mới trong Contentful

Xem hướng dẫn chi tiết trong [CONTENTFUL.md](CONTENTFUL.md) mục
"`seoTitleVi` và `seoDescriptionVi` — dùng khi nào?". Tóm tắt: chúng cho phép
đặt **tiêu đề tiếng Việt cho Google** mà không đổi tiêu đề hiển thị trên trang.

---

## 2. Việc chỉ bạn làm được

### 2.1. Kết nối Google Search Console — làm ngay

Không có Search Console thì không ai biết site đang đứng ở đâu, từ khoá nào ra
được, trang nào bị lỗi. Đây là việc quan trọng nhất còn lại.

1. Vào [search.google.com/search-console](https://search.google.com/search-console),
   chọn **Add property → URL prefix**, nhập `https://ghe1a.com`.
2. Chọn cách xác minh **HTML tag**. Google đưa một đoạn như
   `<meta name="google-site-verification" content="ABC123..." />`.
3. Copy **chỉ phần trong `content="..."`** (ví dụ `ABC123...`).
4. Vào hPanel → website ghe1a.com → **Environment variables**, thêm biến:

   ```
   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION = ABC123...
   ```

5. Deploy lại (push bất kỳ thay đổi nào, hoặc bấm redeploy trong hPanel), rồi
   quay lại Search Console bấm **Verify**.
6. Xác minh xong, vào **Sitemaps** và nộp `sitemap.xml`.

Code đã sẵn sàng đọc biến này — bạn chỉ cần điền giá trị.

### 2.2. Bing Webmaster Tools

Bing giờ là nguồn dữ liệu cho ChatGPT và Copilot, đáng làm dù lượng truy cập
nhỏ. Vào [bing.com/webmasters](https://www.bing.com/webmasters), chọn
**Import from Google Search Console** — mất khoảng một phút sau khi xong bước 2.1.

### 2.3. Vấn đề nội dung lớn nhất: 24 bài video quá mỏng

Đây là điều quan trọng nhất mà code không giải quyết thay được.

Hiện trạng của 24 bài video (86% số bài trên site):

- Tiêu đề là **tiếng Anh** nguyên bản từ YouTube.
- Phần nội dung chỉ có **đúng một câu**, trùng y hệt phần tóm tắt.
- Ngoài ra chỉ còn một khung video nhúng.

Với Google đây là "thin content" — trang gần như không có gì để đọc. Chúng
không xếp hạng được cho từ khoá tiếng Anh (cạnh tranh với các kênh Mỹ lớn), mà
cũng không xếp hạng được cho từ khoá tiếng Việt (vì không có chữ tiếng Việt
nào để khớp).

**Cách xử lý, theo thứ tự công sức tăng dần:**

1. **Rẻ nhất — điền `seoTitleVi` (khoảng 3 phút/bài).** Trang vẫn hiện tiêu đề
   tiếng Anh cho người xem, nhưng Google xếp hạng theo tiêu đề tiếng Việt bạn
   đặt. Bắt đầu từ những video hay nhất.

   Ví dụ cho bài `jal-a350-business-class-review`:

   | Field | Nội dung |
   |---|---|
   | `seoTitleVi` | Review Business Class Japan Airlines A350-1000: JFK đi Tokyo |
   | `seoDescriptionVi` | Trải nghiệm thực tế khoang Business Class mới của Japan Airlines trên A350-1000 chặng New York JFK – Tokyo Haneda: ghế, suất ăn và cách đổi điểm lấy vé. |

2. **Đáng làm nhất — viết 300–500 chữ tiếng Việt vào `bodyVi`.** Không cần
   viết lại kịch bản video. Chỉ cần: bay/ở hạng gì, tốn bao nhiêu điểm, đổi từ
   chương trình nào, ba điểm thích và một điểm không thích, có đáng không. Đây
   chính là thứ người Việt tìm và không tìm được ở đâu khác.

3. **Tốt nhất về dài hạn** — với 5–10 video mạnh nhất, viết hẳn bài review đầy
   đủ, video chỉ là phần minh hoạ. Một bài như vậy có giá trị SEO hơn cả 20
   trang mỏng cộng lại.

Gợi ý ưu tiên: làm bước 1 cho cả 24 bài trước (khoảng 1–2 tiếng), rồi làm bước
2 cho các bài về Nhật, Đài Loan, Hong Kong, Hàn Quốc — đây là những điểm đến
người Việt hay tìm nhất.

---

## 3. Lộ trình từ khoá và nội dung

Site hiện mạnh về **review** (trải nghiệm thực tế) nhưng yếu về **kiến thức**
(chỉ 3 bài). Trong khi đó, kiến thức mới là thứ người mới tìm kiếm, và cũng
chính là thứ dẫn người đọc tới trang thẻ tín dụng — nơi tạo ra doanh thu.

### Nhóm từ khoá đang bỏ trống

**A. Người mới bắt đầu** (mục tiêu: `/blog/chuyen-muc/kien-thuc`)

- miles and points là gì
- cách tích điểm thẻ tín dụng
- điểm thưởng thẻ tín dụng dùng để làm gì
- đổi điểm lấy vé máy bay như thế nào
- welcome offer là gì

**B. Người Việt ở Canada** (mục tiêu: `/credit-cards` — nhóm ra tiền nhất)

- thẻ tín dụng Canada cho người mới sang
- thẻ tín dụng tích điểm du lịch Canada
- Aeroplan là gì / cách dùng điểm Aeroplan
- Amex Membership Rewards Canada đổi được gì
- người mới định cư Canada mở thẻ tín dụng nào

**C. Ý định đổi điểm cụ thể** (mục tiêu: từng bài viết)

- đổi điểm bay Nhật Bản
- vé hạng thương gia đi Việt Nam bằng điểm
- bao nhiêu điểm đổi được vé đi Nhật
- khách sạn Tokyo đổi bằng điểm Marriott / Hyatt

**D. So sánh** (loại bài rất dễ lên top và giữ hạng lâu)

- Aeroplan hay Avion tốt hơn
- Amex hay RBC cho người Việt ở Canada
- cashback hay points *(đã có — bài này đang đúng hướng)*

### 10 bài nên viết tiếp, theo thứ tự

1. Miles & Points là gì? Hướng dẫn cho người Việt mới bắt đầu *(bài trụ cột,
   link tới mọi bài khác)*
2. Người Việt mới sang Canada nên mở thẻ tín dụng nào đầu tiên?
3. Aeroplan là gì và cách dùng điểm Aeroplan hiệu quả nhất
4. Bao nhiêu điểm để bay hạng thương gia từ Canada về Việt Nam?
5. Amex Membership Rewards vs RBC Avion: chọn hệ nào?
6. 5 sai lầm khiến bạn mất điểm oan
7. Cách đổi điểm Marriott lấy đêm khách sạn ở Nhật
8. Điểm thưởng có hết hạn không? Quy tắc từng chương trình
9. Hướng dẫn đọc một welcome offer: điều kiện chi tiêu, thời hạn, bẫy thường gặp
10. Lịch trình một chuyến đi Nhật hoàn toàn bằng điểm

Mỗi bài nên: dài 1,200–2,000 chữ, có ít nhất 3 link tới bài khác trên site,
và ít nhất 1 link tới trang thẻ tín dụng liên quan.

### Nhịp độ

Một bài kiến thức chất lượng mỗi 1–2 tuần, đều đặn, tốt hơn nhiều so với đăng
dồn 10 bài rồi nghỉ ba tháng.

---

## 4. Kỳ vọng thời gian

SEO không có kết quả tức thì. Mốc thực tế:

- **Tuần 1–2**: Google phát hiện redirect `www`, các trang chuyên mục mới và
  sitemap mới. Search Console bắt đầu có dữ liệu.
- **Tháng 1–2**: các trang video bắt đầu xuất hiện ở kết quả video (nhờ
  `VideoObject`). Trang chuyên mục bắt đầu có hiển thị.
- **Tháng 3–6**: nếu nhóm bài kiến thức được viết đều, các từ khoá nhóm A và B
  bắt đầu vào top 20–30.
- **Tháng 6–12**: nhóm từ khoá thẻ tín dụng — cạnh tranh cao nhất, nhưng cũng
  ít đối thủ tiếng Việt nhất.

Lợi thế lớn nhất của Ghế 1A: **gần như không có đối thủ viết về Miles & Points
bằng tiếng Việt cho thị trường Canada.** Rào cản không phải là cạnh tranh, mà
là có đủ nội dung tiếng Việt để Google có cái mà xếp hạng.
