import type { Metadata } from "next";
import { t } from "@/lib/t";

const footer = t("footer");

export const metadata: Metadata = { title: footer("privacy") };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-extrabold text-foreground">{footer("privacy")}</h1>
      <p className="mt-6 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
        Đây là nội dung mẫu. Vui lòng thay thế bằng chính sách bảo mật thực tế (có tham vấn pháp lý)
        trước khi website chính thức ra mắt.
      </p>
      <div className="prose prose-neutral mt-8 max-w-none">
        <p>
          Ghế 1A thu thập địa chỉ email khi bạn đăng ký bản tin, và có thể sử dụng cookie để phân
          tích lưu lượng truy cập trang.
        </p>
        <p>Chúng tôi không bán dữ liệu cá nhân của bạn cho bên thứ ba.</p>
      </div>
    </article>
  );
}
