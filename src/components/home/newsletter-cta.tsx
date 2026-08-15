import { t as translate } from "@/lib/t";
import { NewsletterForm } from "./newsletter-form";

const t = translate("newsletterCta");

export function NewsletterCta() {
  return (
    <section className="bg-navy-ink px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-page flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wide text-white/60 sm:text-sm">{t("eyebrow")}</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl xl:text-4xl">
            {t("title1")} {t("title2")}
          </h2>
          {/* Wide enough for the pitch to sit on one line at desktop — it was
              missing by three pixels and dropping "Ghế 1A." onto a line of its
              own. text-pretty keeps a stray last word off its own line at the
              widths where it does still wrap. */}
          <p className="mt-3 max-w-lg text-pretty text-base text-white/70 xl:text-lg">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
          <NewsletterForm variant="dark" id="cta-newsletter" />
        </div>
      </div>
    </section>
  );
}
