import type { Metadata } from "next";
import { EDITORIAL_REL } from "@/lib/affiliate-links";
import Link from "next/link";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";
import { LEGAL_UPDATED, LegalPage } from "@/components/layout/legal-page";

const footer = t("footer");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("privacyTitle"),
  description: seo("privacyDescription"),
  path: "/privacy",
});

// No data fetching here, so Next would ship `s-maxage=31536000` and let
// Hostinger's CDN hold this HTML for a year — and a deploy does not purge that
// CDN. That is how these pages kept serving their pre-SEO <head> after the SEO
// deploy. An explicit window caps the CDN TTL so a deploy lands on its own.
export const revalidate = 3600;

export default function PrivacyPage() {
  return (
    <LegalPage title={footer("privacy")} updated={LEGAL_UPDATED}>
      <p>
        Ghế 1A là blog cá nhân. Chúng tôi thu thập rất ít dữ liệu, chỉ đủ để gửi bản tin, trả lời
        tin nhắn của bạn và biết bài nào được đọc nhiều. Trang này nói rõ thu thập những gì, ai xử
        lý, và bạn có quyền gì.
      </p>

      <h2>Thông tin chúng tôi thu thập</h2>
      <p>
        <strong>Khi bạn đăng ký bản tin:</strong> địa chỉ email của bạn. Đây là thông tin duy nhất
        form đăng ký yêu cầu.
      </p>
      <p>
        <strong>Khi bạn gửi form Liên hệ:</strong> họ tên, địa chỉ email, chủ đề và nội dung bạn
        viết — dùng để phản hồi đúng yêu cầu của bạn, không dùng cho việc khác và không tự động đưa
        bạn vào danh sách nhận bản tin.
      </p>
      <p>
        <strong>Khi bạn bình luận:</strong> tên hiển thị và nội dung bình luận. Ô email trong khung
        bình luận đã được ẩn đi, chúng tôi không thu thập email của người bình luận.
      </p>
      <p>
        <strong>Dữ liệu kỹ thuật:</strong> như mọi website, máy chủ ghi lại địa chỉ IP, loại trình
        duyệt và thời điểm truy cập. Chúng tôi cũng tạm giữ địa chỉ IP trong bộ nhớ máy chủ vài
        giờ để giới hạn số lần gửi form — đây là biện pháp chống spam, không dùng để nhận dạng bạn
        và không được lưu lâu dài.
      </p>
      <p>
        Chúng tôi <strong>không</strong> thu thập số thẻ tín dụng, số tài khoản ngân hàng, điểm tín
        dụng, thu nhập hay bất kỳ thông tin tài chính nào của bạn. Không có chỗ nào trên trang yêu
        cầu những thông tin đó.
      </p>

      <h2>Dịch vụ bên thứ ba chúng tôi dùng</h2>
      <p>
        Chúng tôi không tự vận hành hệ thống email hay phân tích riêng, mà dùng các dịch vụ sau.
        Phần lớn đặt máy chủ tại Hoa Kỳ, nên dữ liệu của bạn có thể được lưu và xử lý ngoài Canada,
        chịu điều chỉnh của pháp luật nơi đó.
      </p>
      <ul>
        <li>
          <strong>Kit (ConvertKit)</strong> — lưu danh sách email bản tin.
        </li>
        <li>
          <strong>Resend</strong> — gửi email chào mừng cho bạn và chuyển nội dung form Liên hệ về
          hộp thư của chúng tôi.
        </li>
        <li>
          <strong>Cusdis</strong> — xử lý phần bình luận dưới bài viết và video. Bình luận cần được
          duyệt trước khi hiển thị công khai.
        </li>
        <li>
          <strong>Google Analytics 4</strong> — thống kê lượt xem và nguồn truy cập ở dạng tổng
          hợp. Có đặt cookie.
        </li>
        <li>
          <strong>YouTube</strong> — các bài dạng video nhúng player của YouTube. Khi player tải,
          Google có thể đặt cookie trên trình duyệt của bạn theo chính sách riêng của họ.
        </li>
        <li>
          <strong>Hostinger</strong> — hạ tầng lưu trữ website và log máy chủ.
        </li>
      </ul>

      <h2>Cookie và cách từ chối</h2>
      <p>
        Trang dùng cookie cho hai việc: thống kê truy cập (Google Analytics) và player YouTube
        nhúng trong bài. Chúng tôi không dùng cookie để hiển thị quảng cáo cá nhân hoá.
      </p>
      <p>
        Bạn có thể chặn hoặc xoá cookie trong cài đặt trình duyệt bất cứ lúc nào. Riêng Google
        Analytics, bạn có thể cài{" "}
        <a
          href="https://tools.google.com/dlpage/gaoptout"
          target="_blank"
          rel={EDITORIAL_REL}
        >
          tiện ích từ chối của Google
        </a>{" "}
        để không bị ghi nhận trên mọi website.
      </p>

      <h2>Khi bạn bấm vào liên kết affiliate</h2>
      <p>
        Các nút &ldquo;Apply ngay&rdquo; đưa bạn sang website của ngân hàng hoặc nền tảng rebate.
        Từ thời điểm bạn rời ghe1a.com, <strong>chính sách bảo mật của trang đích áp dụng, không
        phải chính sách này</strong>. Những trang đó thường đặt cookie theo dõi để ghi nhận rằng
        bạn đến từ đâu.
      </p>
      <p>
        Chúng tôi chỉ nhận được báo cáo tổng hợp về số lượt mở thẻ — <strong>không nhận được danh
        tính, hồ sơ đăng ký hay thông tin tài chính của bạn</strong> từ ngân hàng hay nền tảng
        rebate. Nếu bạn đăng ký nhận rebate, đó là thỏa thuận trực tiếp giữa bạn và nền tảng đó;
        hãy đọc chính sách bảo mật của họ.
      </p>

      <h2>Chúng tôi không bán dữ liệu</h2>
      <p>
        Chúng tôi không bán, cho thuê hay trao đổi dữ liệu cá nhân của bạn với bên thứ ba. Dữ liệu
        chỉ được chia sẻ với các nhà cung cấp dịch vụ nêu trên, trong phạm vi cần thiết để trang
        hoạt động, hoặc khi pháp luật yêu cầu.
      </p>

      <h2>Lưu trữ bao lâu</h2>
      <p>
        Email bản tin được giữ cho tới khi bạn huỷ đăng ký. Nội dung form Liên hệ được giữ trong
        hộp thư của chúng tôi để tiện tra cứu lại khi cần. Bình luận được giữ chừng nào bài viết
        còn trên trang. Địa chỉ IP dùng cho chống spam bị xoá trong vòng vài giờ.
      </p>

      <h2>Quyền của bạn</h2>
      <p>
        Theo luật bảo vệ dữ liệu cá nhân của Canada (PIPEDA), bạn có quyền yêu cầu xem, sửa hoặc
        xoá thông tin cá nhân mà chúng tôi giữ về bạn, và rút lại sự đồng ý bất cứ lúc nào.
      </p>
      <p>
        Huỷ đăng ký bản tin nhanh nhất là bấm liên kết ở cuối bất kỳ email nào chúng tôi gửi. Với
        các yêu cầu khác — xoá bình luận, xoá dữ liệu liên hệ — bạn nhắn cho chúng tôi qua{" "}
        <Link href="/contact">trang Liên hệ</Link>, chúng tôi sẽ xử lý trong thời gian hợp lý.
      </p>

      <h2>Trẻ em</h2>
      <p>
        Nội dung trên trang dành cho người đủ tuổi mở thẻ tín dụng. Chúng tôi không chủ đích thu
        thập thông tin của trẻ em. Nếu bạn cho rằng con bạn đã gửi thông tin cho chúng tôi, hãy
        báo để chúng tôi xoá.
      </p>

      <h2>Bảo mật</h2>
      <p>
        Trang chạy hoàn toàn qua HTTPS. Chúng tôi cố gắng bảo vệ dữ liệu ở mức hợp lý, nhưng không
        có hệ thống nào trên internet an toàn tuyệt đối, nên chúng tôi không thể cam kết an toàn
        tuyệt đối.
      </p>

      <h2>Thay đổi chính sách</h2>
      <p>
        Chúng tôi có thể cập nhật chính sách này khi thêm hoặc bỏ một dịch vụ. Ngày cập nhật gần
        nhất luôn hiển thị ở đầu trang.
      </p>

      <h2>Liên hệ</h2>
      <p>
        Câu hỏi về quyền riêng tư, bạn gửi qua <Link href="/contact">trang Liên hệ</Link> hoặc email
        tới <a href="mailto:info@ghe1a.com">info@ghe1a.com</a>. Xem thêm{" "}
        <Link href="/terms">Điều khoản</Link>.
      </p>
    </LegalPage>
  );
}
