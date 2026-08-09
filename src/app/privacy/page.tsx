import type { Metadata } from "next";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";

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
    <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-extrabold text-foreground">{footer("privacy")}</h1>
      <div className="prose prose-neutral mt-8 max-w-none">
        <p>
          Ghế 1A thu thập địa chỉ email khi bạn đăng ký bản tin, và có thể sử dụng cookie để phân
          tích lưu lượng truy cập trang.
        </p>
        <p>
          Khi bạn gửi tin nhắn qua form Liên hệ, chúng tôi thu thập họ tên, địa chỉ email, chủ đề
          và nội dung bạn cung cấp để phản hồi đúng yêu cầu của bạn. Thông tin này chỉ được dùng
          cho mục đích trao đổi trực tiếp với bạn, không dùng cho việc khác.
        </p>
        <p>
          Khi bạn để lại bình luận dưới bài viết hoặc video, tên hiển thị và nội dung bình luận
          được xử lý qua Cusdis, một dịch vụ bình luận bên thứ ba. Bình luận cần được duyệt trước
          khi hiển thị công khai trên trang.
        </p>
        <p>Chúng tôi không bán dữ liệu cá nhân của bạn cho bên thứ ba.</p>
      </div>
    </article>
  );
}
