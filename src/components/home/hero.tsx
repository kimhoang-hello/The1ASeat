import { t as translate } from "@/lib/t";
import { NewsletterForm } from "./newsletter-form";

const t = translate("hero");

export function Hero() {
  return (
    <section className="border-b border-border bg-background px-4 py-20 sm:px-6 lg:px-8 2xl:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center 2xl:max-w-4xl">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl 2xl:text-6xl">
          {t("title1")}{" "}
          <span className="text-primary">{t("title2")}</span>
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg 2xl:max-w-2xl 2xl:text-xl">
          {t("subtitle")}
        </p>

        <div
          className="mt-9 flex w-full scroll-mt-24 flex-col items-center gap-3 2xl:mt-12"
          id="newsletter"
        >
          <span className="text-xs font-semibold tracking-wide text-muted-foreground xl:text-sm">
            {t("formLabel")}
          </span>
          <NewsletterForm id="hero-newsletter" size="hero" />
          <span className="text-xs text-muted-foreground xl:text-sm">{t("disclaimer")}</span>
        </div>
      </div>
    </section>
  );
}
