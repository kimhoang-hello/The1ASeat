# Ghi nhận công khai — Ghế 1A — 30/08/2026

> Phạm vi: quan sát từ website đang phục vụ công khai, thực hiện ngày
> 30/08/2026 (giờ Toronto). Các trích dẫn dưới đây trỏ tới nguồn do chính
> Ghế 1A xuất bản; không đánh giá độ chính xác của các offer/thẻ.

## Định vị và đối tượng

- Trang chủ tự mô tả là hướng dẫn tiếng Việt về tích/đổi điểm thẻ tín dụng
  tại Canada, gồm welcome offer, transfer bonus, review hạng thương gia và
  khách sạn. Đây là một ngách hẹp, dễ hiểu: **người Việt cần ra quyết định
  Miles & Points trong bối cảnh Canada**. [Trang chủ](https://ghe1a.com/)
- Nội dung công khai cho thấy hành trình đầy đủ hơn một blog review: trang
  thẻ tín dụng, tài khoản ngân hàng, bài hướng dẫn/review, và bốn công cụ
  `Award Flight Finder`, `Points Calculator`, `Transfer Partners`, `Transfer
  Bonus`. [Điều hướng/trang chủ](https://ghe1a.com/) · [sitemap](https://ghe1a.com/sitemap.xml)
- Hai đề bài có ý định sử dụng rất cụ thể đã được phục vụ: chọn thẻ (offer,
  phí, quyền lợi, đối tác transfer) và đổi điểm cho tuyến Canada–Việt Nam.
  [Thẻ tín dụng](https://ghe1a.com/credit-cards) · [Award Flight Finder](https://ghe1a.com/award-flight-finder)
- Thương hiệu đặt tác giả thật ở phần giới thiệu, liên kết tiếp tục sang
  YouTube và Facebook; footer công khai disclosure về hoa hồng/referral và
  tính độc lập của đánh giá. Đây là nền tảng tin cậy phù hợp với sản phẩm có
  quyết định tài chính. [Giới thiệu](https://ghe1a.com/about) · [Trang chủ](https://ghe1a.com/)

## Trải nghiệm/chuyển đổi đang thấy

- Trang chủ ưu tiên một offer nổi bật, bốn thẻ đáng chú ý có nút `Apply
  ngay`, bài mới nhất, transfer bonus và hai vị trí đăng ký newsletter. Luồng
  hiện tại vì thế tối ưu cho **độc giả đã sẵn ý định** hơn là người mới chưa
  biết bắt đầu ở đâu. [Trang chủ](https://ghe1a.com/)
- Luồng tìm hiểu có các thành phần tốt nhưng tách rời: người đọc phải tự nối
  công cụ định giá điểm, đối tác transfer, tuyến bay và trang thẻ. [Points
  Calculator](https://ghe1a.com/calculator) · [Transfer Partners](https://ghe1a.com/transfer-partners) · [Award Flight Finder](https://ghe1a.com/award-flight-finder)
- Site đang có quy mô chỉ mục đủ để xây hub/landing page theo nhu cầu: sitemap
  hiện công khai **107 URL**, gồm 25 URL dưới `/credit-cards`, 30 dưới
  `/bank-accounts`, 43 dưới `/blog`, cùng các trang công cụ. (Đếm từ sitemap
  tại thời điểm kiểm tra.) [Sitemap](https://ghe1a.com/sitemap.xml)

## Hàm ý phát triển (dựa trên các quan sát trên)

1. **Tạo “lộ trình theo mục tiêu” làm điểm vào chính.** Ba lựa chọn như “mới
   sang Canada”, “muốn bay Việt Nam bằng business”, “đang có Amex/RBC points”
   có thể dẫn tuần tự tới thẻ phù hợp → cách đạt welcome bonus → transfer →
   tuyến bay. Điều này đóng gói lợi thế liên kết dữ liệu hiện có thành một
   hành trình có kết quả, thay vì thêm một bài blog tổng quát nữa.
2. **Biến các công cụ thành kết quả có thể hành động.** Sau một kết quả Award
   Flight Finder, hiển thị rõ “điểm cần có”, chương trình nhận điểm, các thẻ
   Canada phù hợp và bài hướng dẫn liên quan; sau calculator, gợi ý giữ/đổi
   điểm tùy giá trị. Đây là cầu nối trực tiếp từ tra cứu sang CTA mà vẫn giữ
   tính hữu ích trước.
3. **Thêm hub “offer alert” có lợi ích cá nhân hoá nhẹ.** Newsletter hiện là
   CTA chung. Cho phép chọn các nhóm quan tâm (Amex/RBC/Aeroplan, người mới,
   Canada–Việt Nam) sẽ làm lời hứa đăng ký cụ thể hơn và tạo nền cho email
   theo ý định, không cần giả định số liệu xã hội.
4. **Đóng gói authority thành các trang evergreen theo câu hỏi.** Ví dụ “Bay
   Canada–Việt Nam bằng điểm”, “Thẻ đầu tiên khi chưa có credit history”,
   “Khi nào nên transfer points”. Mỗi hub nên liên kết sâu tới calculator,
   award finder, thẻ và bài nguồn; như vậy tăng discoverability mà không làm
   loãng định vị Canada × tiếng Việt.

## Tín hiệu kỹ thuật/khả năng tìm thấy (quan sát bên ngoài)

- `robots.txt` cho phép crawler, chặn `/api/`, và công bố sitemap. [robots.txt](https://ghe1a.com/robots.txt) · [sitemap.xml](https://ghe1a.com/sitemap.xml)
- Trang chủ có canonical tuyệt đối, meta description, Open Graph/Twitter card
  và JSON-LD cho `Organization`/`WebSite`; `lang` là tiếng Việt. [Trang
  chủ](https://ghe1a.com/)
- Phản hồi trang chủ đang cho thấy Next.js qua HTTP/2, CDN Hostinger, prerender
  và các header `Strict-Transport-Security`, `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`. CSP quan sát
  được chỉ là `upgrade-insecure-requests`; đây là ghi nhận, chưa phải khuyến
  nghị thêm CSP vì cần kiểm thử tương thích script trước. [Trang chủ](https://ghe1a.com/)

## Nguồn và phương pháp

- Tải trực tiếp trang chủ, các trang công cụ/trang danh mục, `robots.txt` và
  `sitemap.xml` qua HTTPS; kiểm tra title, description, heading, điều hướng,
  schema và header phản hồi công khai.
- Không dùng dữ liệu analytics, Contentful, tài khoản quản trị, hay nguồn bên
  thứ ba. Số URL là snapshot, sẽ thay đổi khi site xuất bản nội dung mới.
