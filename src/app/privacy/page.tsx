import type { Metadata } from "next";
import { t } from "@/lib/t";

const footer = t("footer");

export const metadata: Metadata = { title: footer("privacy") };

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
