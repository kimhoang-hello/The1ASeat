import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "footer" });
  return { title: t("terms") };
}

export default async function TermsPage({
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
      <h1 className="font-display text-3xl font-extrabold text-foreground">{t("terms")}</h1>
      <p className="mt-6 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
        {isVi
          ? "Đây là nội dung mẫu. Vui lòng thay thế bằng điều khoản sử dụng thực tế (có tham vấn pháp lý) trước khi website chính thức ra mắt."
          : "This is placeholder content. Replace with your actual terms of use (reviewed by legal counsel) before launch."}
      </p>
      <div className="prose prose-neutral mt-8 max-w-none">
        <p>
          {isVi
            ? "Bằng việc sử dụng trang này, bạn đồng ý rằng nội dung chỉ mang tính tham khảo, không phải lời khuyên tài chính."
            : "By using this site, you agree the content is for informational purposes only and not financial advice."}
        </p>
      </div>
    </article>
  );
}
