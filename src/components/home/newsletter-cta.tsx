import { t as translate } from "@/lib/t";
import { NewsletterForm } from "./newsletter-form";

const t = translate("newsletterCta");

export function NewsletterCta() {
  return (
    <section className="bg-navy-ink px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wide text-white/60">{t("eyebrow")}</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
            {t("title1")} {t("title2")}
          </h2>
          <p className="mt-3 max-w-md text-sm text-white/70">{t("subtitle")}</p>
        </div>

        <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
          <NewsletterForm variant="dark" id="cta-newsletter" />
        </div>
      </div>
    </section>
  );
}
