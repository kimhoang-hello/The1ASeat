import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "@/components/contact/contact-form";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";

const contact = t("contactPage");
const next = t("nextSteps");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("contactTitle"),
  description: seo("contactDescription"),
  path: "/contact",
});

// No data fetching here, so Next would ship `s-maxage=31536000` and let
// Hostinger's CDN hold this HTML for a year — and a deploy does not purge that
// CDN. That is how these pages kept serving their pre-SEO <head> after the SEO
// deploy. An explicit window caps the CDN TTL so a deploy lands on its own.
export const revalidate = 3600;

export default function ContactPage() {
  return (
    <>
      <PageHeader eyebrow={contact("eyebrow")} title={contact("title")} subtitle={contact("subtitle")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <ContactForm />
          </div>

          {/* Phần lớn người mở trang này đang có một câu hỏi, không phải đang
              muốn gửi thư — và trước khối này gửi xong là hết đường đi. Ba
              đường dưới đây trả lời trước những câu hay được hỏi nhất. */}
          <NextSteps title={contact("nextStepsTitle")} className="mt-10">
            <StepLink
              href="/bat-dau"
              label={next("startHereLabel")}
              description={next("startHereDescription")}
            />
            <StepLink
              href="/blog"
              label={next("blogLabel")}
              description={next("blogDescription")}
            />
            <StepLink
              href="/about"
              label={next("aboutLabel")}
              description={next("aboutDescription")}
            />
          </NextSteps>
        </div>
      </section>
    </>
  );
}
