# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Người Việt sống ở Canada quan tâm tới Miles & Points. Hai nhóm chính:

- **Người mới định cư** — chưa có credit history, chưa hiểu hệ thống thẻ Canada, mọi tài liệu tốt đều bằng tiếng Anh và viết cho thị trường Mỹ.
- **Người đã chơi điểm tầm trung** — đã có vài thẻ, đang săn elevated offer và transfer bonus, cần biết đổi điểm chặng nào thì đáng.

Tình huống đọc: chủ yếu trên điện thoại, thường vào đúng lúc đang cân nhắc mở một
thẻ cụ thể hoặc đang tính chuyến về Việt Nam. Trong nhóm độc giả có người lớn tuổi
(thế hệ phụ huynh) — xác nhận 2026-08-16.

Job: "cho tôi biết nên mở thẻ nào tiếp theo, đổi được chặng nào, tốn bao nhiêu
điểm, và có đáng transfer không — bằng tiếng Việt, với thẻ tôi thật sự mở được ở
Canada."

## Product Purpose

Blog và kênh YouTube tiếng Việt hướng dẫn tích điểm thẻ tín dụng Canada và đổi
điểm lấy vé hạng thương gia, hạng nhất, đêm khách sạn. Tồn tại vì kiến thức Miles
& Points chất lượng gần như chỉ có bằng tiếng Anh và viết cho thẻ Mỹ.

Thành công đo bằng: lượt bấm "Apply ngay" trên trang thẻ tín dụng (nguồn doanh thu
affiliate), và lượt đăng ký newsletter (giữ chân, báo elevated offer + transfer bonus).

## Positioning

Giao điểm **tiếng Việt × thị trường Canada** — chưa có đối thủ nào phục vụ. Blog
tiếng Anh ở Canada đúng thị trường nhưng sai ngôn ngữ và không nói tới nhu cầu đặc
thù (bay về Việt Nam, người mới định cư). Blog tiếng Việt thì viết cho thẻ Mỹ hoặc
thẻ Việt Nam.

Cơ chế không sao chép được: mỗi nội dung nối trọn chuỗi **thẻ → chương trình
transfer → chặng bay có thật → số điểm thật → surcharge → có đáng không**, thay vì
dừng ở "thẻ này có 70,000 điểm".

## Operating Context

- Nội dung (bài viết, thẻ tín dụng, transfer bonus, hồ sơ tác giả) quản lý qua
  Contentful space "Ghe1A"; tác giả tự đăng, không cần deploy.
- 4 công cụ tra cứu dùng trực tiếp trên trang: Points Calculator, Transfer Partners,
  Transfer Bonus tracker, Award Flight Finder.
- Award chart và welcome offer thay đổi liên tục; dữ liệu có ghi ngày kiểm tra.
  Offer hết hạn được chuyển mục, không xoá.
- Tự động hoá qua GitHub Actions: kiểm tra rebate, hết hạn offer, đồng bộ video.

## Capabilities and Constraints

- Next.js 16 (App Router, Turbopack), Tailwind CSS 4, Contentful; deploy lên
  Hostinger VPS bằng PM2 + Nginx + GitHub Actions.
- **Chỉ có tiếng Việt** (`lang="vi-VN"`). Contentful có sẵn field `...En` nhưng
  không dùng và không hiển thị.
- Quy mô hiện tại: 23 thẻ tín dụng Canada, ~28 bài viết/video chia 4 chuyên mục,
  6 chương trình hàng không trong Award Flight Finder.
- Quy ước nội dung bắt buộc: thêm ®/™ cho tên ngân hàng và chương trình thật;
  số dùng dấu phẩy ngăn nghìn kiểu Anh (`110,000`); `$` mặc định là CAD (chỉ dùng
  `US$` khi thật sự là USD); giữ nguyên tiếng Anh các thuật ngữ như welcome offer,
  transfer bonus, award, register.
- Bảng dữ liệu rộng (Award Flight Finder, Transfer Partners) **phải đọc được trên
  màn hình nhỏ** — đây là ràng buộc sản phẩm, không phải tuỳ chọn thiết kế.
- Nội dung không phải lời khuyên tài chính; không hứa chắc chắn được duyệt thẻ.

## Brand Commitments

**Ràng buộc:** tên "Ghế 1A", tagline "Miles & Points cho người Việt", và phần
disclosure affiliate ở footer (bắt buộc giữ vì uy tín và minh bạch).

**Giọng:** thân mật nhưng chắc chắn — xưng "mình", gọi người đọc là "bạn". Trực
tiếp, luôn kèm con số, nói rõ chỗ không chắc. Không hype, không FOMO giả tạo.

**Không ràng buộc (xác nhận 2026-08-16):** bảng màu kem `#faf6ec` / navy `#0f2a4a`,
cặp font Plus Jakarta Sans + Inter, bo góc `0.75rem` và toàn bộ hệ hình ảnh hiện
tại đều **mở cho redesign**. Chúng là hiện trạng và bằng chứng, không phải cam kết.

## Evidence on Hand

**Chưa có bằng chứng dạng số nào công bố được** (xác nhận 2026-08-16): không số
subscriber newsletter, không số sub YouTube, không testimonial. Thiết kế sau này
**không được** dùng social proof dạng con số, logo đối tác, hay lời chứng thực —
kể cả dạng placeholder.

Bằng chứng thật đang có, dùng được:

- Review chuyến bay và khách sạn do chính tác giả bay/ở, kèm video trên YouTube
  @HoangLeCA (`sameAs` trong schema `Person` ở `/about`).
- Dữ liệu award chart đối chiếu nhiều nguồn, hiển thị công khai ngày kiểm tra.
- 23 thẻ tín dụng Canada đang theo dõi với offer cập nhật.
- Tiểu sử tác giả thật trong Contentful (entry "Author", tên Hoàng).

## Product Principles

1. **Trung thực hơn là đầy đủ.** Chương trình nào giấu award chart thì để trống và
   nói thẳng "không tra trước được" — vì điểm đã transfer không lấy lại được.
2. **Mọi con số phải nối được tới hành động.** Không có số nào đứng một mình:
   luôn kèm transfer từ đâu, bay chặng nào, tốn thêm surcharge bao nhiêu.
3. **Mobile là mặt trận chính**, kể cả với bảng dữ liệu dày nhất.
4. **Đọc được trước, đẹp sau.** Có độc giả lớn tuổi; không hy sinh độ tương phản
   hay cỡ chữ để lấy vẻ tinh tế.
5. **Không lời khuyên tài chính.** Nêu cả rủi ro và ai không nên chơi điểm.

## Accessibility & Inclusion

- Độc giả lớn tuổi: ưu tiên cỡ chữ lớn, tương phản cao, tránh font mảnh và chữ xám
  nhạt trên nền màu.
- Bảng số liệu rộng phải đọc được trên màn hình nhỏ (hiện dùng vuốt ngang kèm chỉ
  dẫn "Vuốt ngang để xem đầy đủ bảng →").
- Đã có sẵn trong code: liên kết skip-to-content, hỗ trợ `prefers-reduced-motion`,
  `lang="vi"`.
