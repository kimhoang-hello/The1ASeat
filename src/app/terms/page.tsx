import type { Metadata } from "next";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";

const footer = t("footer");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("termsTitle"),
  description: seo("termsDescription"),
  path: "/terms",
});

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-extrabold text-foreground">{footer("terms")}</h1>
      <div className="prose prose-neutral mt-8 max-w-none">
        <p>
          Bằng việc sử dụng trang này, bạn đồng ý rằng nội dung chỉ mang tính tham khảo, không phải
          lời khuyên tài chính.
        </p>
      </div>
    </article>
  );
}
