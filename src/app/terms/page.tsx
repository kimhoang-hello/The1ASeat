import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";
import { LEGAL_UPDATED, LegalPage } from "@/components/layout/legal-page";

const footer = t("footer");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("termsTitle"),
  description: seo("termsDescription"),
  path: "/terms",
});

// No data fetching here, so Next would ship `s-maxage=31536000` and let
// Hostinger's CDN hold this HTML for a year — and a deploy does not purge that
// CDN. That is how these pages kept serving their pre-SEO <head> after the SEO
// deploy. An explicit window caps the CDN TTL so a deploy lands on its own.
export const revalidate = 3600;

export default function TermsPage() {
  return (
    <LegalPage title={footer("terms")} updated={LEGAL_UPDATED}>
      <p>
        Khi bạn truy cập và sử dụng ghe1a.com, bạn đồng ý với các điều khoản dưới đây. Nếu bạn
        không đồng ý, vui lòng ngừng sử dụng trang.
      </p>

      <h2>Nội dung chỉ mang tính tham khảo</h2>
      <p>
        Ghế 1A là blog cá nhân chia sẻ kinh nghiệm về Miles &amp; Points. Chúng tôi{" "}
        <strong>không phải tổ chức tài chính, không phải cố vấn tài chính được cấp phép</strong>, và
        không cung cấp lời khuyên tài chính, thuế hay pháp lý cho trường hợp cụ thể của bạn.
      </p>
      <p>
        Mọi nội dung trên trang là quan điểm cá nhân dựa trên trải nghiệm và tìm hiểu của chúng tôi
        tại thời điểm viết. Quyết định mở thẻ tín dụng, chuyển điểm hay đặt vé là quyết định tài
        chính của riêng bạn. Hãy cân nhắc tình hình của chính mình, và tham khảo chuyên gia được cấp
        phép nếu cần.
      </p>

      <h2>Thông tin thẻ và ưu đãi có thể thay đổi bất cứ lúc nào</h2>
      <p>
        Welcome bonus, phí thường niên, tỷ lệ tích điểm, điều kiện chi tiêu, tỷ lệ transfer và ngày
        hết hạn của các ưu đãi <strong>do ngân hàng phát hành quyết định và có thể thay đổi, rút
        lại hoặc gia hạn bất cứ lúc nào mà không báo trước</strong>. Chúng tôi cố gắng cập nhật
        thường xuyên, nhưng không cam kết mọi con số trên trang luôn khớp với ưu đãi đang chạy.
      </p>
      <p>
        <strong>
          Điều khoản chính thức của ngân hàng phát hành mới là điều khoản có hiệu lực.
        </strong>{" "}
        Luôn đọc kỹ trang đăng ký của ngân hàng trước khi mở thẻ, và kiểm tra giá cùng chỗ trống
        thật trên trang của chương trình trước khi chuyển điểm — điểm đã chuyển sang hãng bay gần
        như không lấy lại được.
      </p>

      <h2>Quan hệ affiliate và hoa hồng</h2>
      <p>
        Ghế 1A có thể nhận hoa hồng hoặc referral từ các đối tác thẻ tín dụng và ngân hàng khi bạn
        mở thẻ hoặc mở tài khoản qua liên kết trên trang. Điều này không làm bạn tốn thêm chi phí.
      </p>
      <p>
        Các ý kiến, đánh giá và phân tích hoàn toàn là quan điểm độc lập của chúng tôi, không được
        cung cấp, xét duyệt hay chấp thuận bởi bất kỳ tổ chức phát hành nào. Việc một thẻ hay một
        tài khoản xuất hiện trên trang, hay xuất hiện ở vị trí nào, không đảm bảo đó là lựa chọn tốt
        nhất cho bạn.
      </p>

      <h2>Liên kết và dịch vụ bên thứ ba</h2>
      <p>
        Trang có liên kết tới website của ngân hàng, chương trình điểm thưởng và các nền tảng
        rebate. Chúng tôi không kiểm soát và không chịu trách nhiệm về nội dung, ưu đãi, điều kiện
        hay cách xử lý dữ liệu của những trang đó. Khi bạn rời ghe1a.com, điều khoản và chính sách
        bảo mật của trang đích sẽ áp dụng.
      </p>
      <p>
        Riêng với các nền tảng rebate: khoản rebate là thỏa thuận giữa <em>bạn</em> và nền tảng đó,
        không phải với Ghế 1A. Điều kiện nhận, thời gian chi trả, việc bị từ chối hay thu hồi rebate
        đều do nền tảng đó quyết định theo điều khoản riêng của họ.
      </p>

      <h2>Sở hữu trí tuệ</h2>
      <p>
        Bài viết, hình ảnh, video và thiết kế trên Ghế 1A thuộc quyền sở hữu của chúng tôi, trừ
        phần thuộc về bên thứ ba. Bạn được chia sẻ liên kết tự do. Vui lòng không sao chép lại
        nguyên văn nội dung sang trang khác mà không xin phép và ghi nguồn.
      </p>
      <p>
        Tên ngân hàng, chương trình điểm thưởng và hãng hàng không được nhắc tới là thương hiệu của
        chủ sở hữu tương ứng, dùng ở đây với mục đích mô tả. Ghế 1A không có liên kết sở hữu với
        các tổ chức đó.
      </p>

      <h2>Sử dụng được phép</h2>
      <p>
        Vui lòng không dùng trang để phát tán spam, thu thập dữ liệu tự động ở quy mô lớn, dò tìm
        lỗ hổng, hay gửi nội dung vi phạm pháp luật qua form liên hệ và phần bình luận. Chúng tôi
        có thể chặn truy cập hoặc gỡ bình luận vi phạm mà không cần báo trước.
      </p>

      <h2>Giới hạn trách nhiệm</h2>
      <p>
        Nội dung được cung cấp &ldquo;nguyên trạng&rdquo;, không kèm bảo đảm nào về tính chính xác,
        đầy đủ hay phù hợp với mục đích của bạn. Trong phạm vi pháp luật cho phép, Ghế 1A không chịu
        trách nhiệm cho bất kỳ thiệt hại nào phát sinh từ việc bạn sử dụng trang hoặc dựa vào nội
        dung trên trang — bao gồm nhưng không giới hạn ở tổn thất về điểm thưởng, phí thường niên,
        lãi suất, hay ưu đãi không nhận được.
      </p>

      <h2>Thay đổi điều khoản</h2>
      <p>
        Chúng tôi có thể cập nhật điều khoản này theo thời gian. Ngày cập nhật gần nhất luôn hiển
        thị ở đầu trang. Việc bạn tiếp tục sử dụng trang sau khi có thay đổi được xem là bạn chấp
        nhận bản cập nhật.
      </p>

      <h2>Luật áp dụng</h2>
      <p>
        Điều khoản này được điều chỉnh bởi pháp luật tỉnh bang Ontario và pháp luật liên bang
        Canada đang áp dụng tại đó.
      </p>

      <h2>Liên hệ</h2>
      <p>
        Có câu hỏi về điều khoản này, bạn gửi tin nhắn qua <Link href="/contact">trang Liên hệ</Link>{" "}
        hoặc email tới <a href="mailto:info@ghe1a.com">info@ghe1a.com</a>. Xem thêm{" "}
        <Link href="/privacy">Chính sách bảo mật</Link>.
      </p>
    </LegalPage>
  );
}
