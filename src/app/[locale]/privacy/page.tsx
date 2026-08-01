import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "footer" });
  return { title: t("privacy") };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: routeLocale } = await params;
  setRequestLocale(routeLocale);
  const [t, locale] = await Promise.all([getTranslations("footer"), getLocale()]);

  const isVi = locale === "vi";

  return (
    <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-extrabold text-foreground">{t("privacy")}</h1>
      <p className="mt-6 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
        {isVi
          ? "Đây là nội dung mẫu. Vui lòng thay thế bằng chính sách bảo mật thực tế (có tham vấn pháp lý) trước khi website chính thức ra mắt."
          : "This is placeholder content. Replace with your actual privacy policy (reviewed by legal counsel) before launch."}
      </p>
      <div className="prose prose-neutral mt-8 max-w-none">
        <p>
          {isVi
            ? "Ghế 1A thu thập địa chỉ email khi bạn đăng ký bản tin, và có thể sử dụng cookie để phân tích lưu lượng truy cập trang."
            : "Ghế 1A collects your email address when you subscribe to the newsletter, and may use cookies to analyze site traffic."}
        </p>
        <p>
          {isVi
            ? "Chúng tôi không bán dữ liệu cá nhân của bạn cho bên thứ ba."
            : "We do not sell your personal data to third parties."}
        </p>
      </div>
    </article>
  );
}
