import { t as translate } from "@/lib/t";
import { NewsletterForm } from "./newsletter-form";
import { START_HERE_PUBLISHED } from "@/lib/feature-flags";

const t = translate("hero");

/**
 * Đáy hero rút ngắn CHỈ khi dải "Bắt đầu" hiện ngay bên dưới.
 *
 * Khoảng trắng hai khối liền nhau cộng dồn chứ không nuốt nhau: 80px đáy hero
 * cộng 56px đỉnh dải ra 136px, trong khi dưới dải chỉ có 120px, nên dải trông
 * như bị đẩy xuống. Rút đáy hero xuống 56px là chữa đúng chỗ đó.
 *
 * Nhưng lúc cờ còn tắt thì dải không render, và cùng con số 56px ấy lại là
 * khoảng cách hero→offers — một chỗ chẳng ai yêu cầu đổi. Buộc nó vào cờ để
 * trang chủ đang chạy giữ nguyên nhịp cũ, và tự đúng ngay lúc bật cờ.
 */
const HERO_PAD_BOTTOM = START_HERE_PUBLISHED ? "pb-14 2xl:pb-16" : "pb-20 2xl:pb-28";

export function Hero() {
  return (
    <section
      className={`border-b border-border bg-background px-4 pt-20 sm:px-6 lg:px-8 2xl:pt-28 ${HERO_PAD_BOTTOM}`}
    >
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
          <NewsletterForm id="hero-newsletter" size="hero" source="hero" />
          <span className="text-xs text-muted-foreground xl:text-sm">{t("disclaimer")}</span>
        </div>
      </div>
    </section>
  );
}
