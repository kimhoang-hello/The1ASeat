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

// No data fetching here, so Next would ship `s-maxage=31536000` and let
// Hostinger's CDN hold this HTML for a year — and a deploy does not purge that
// CDN. That is how these pages kept serving their pre-SEO <head> after the SEO
// deploy. An explicit window caps the CDN TTL so a deploy lands on its own.
export const revalidate = 3600;

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
