import Link from "next/link";
import { t as translate } from "@/lib/t";
import { NewsletterForm } from "./newsletter-form";
import { START_HERE_PUBLISHED } from "@/lib/feature-flags";

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

        {/* NÚT PHỤ, không phải dòng chữ — và không phải cụm bốn ô của
            `/bat-dau`.
            Bản đầu là một link `text-sm`: đo trên mobile ra vùng chạm 37px
            (dưới chuẩn 44px, mà PRODUCT.md ghi rõ có độc giả lớn tuổi), chữ
            14px nhỏ nhất trong hero, nằm ở 628px tức mép màn hình khi có thanh
            trình duyệt. Đặt cửa vào của nhóm cần giúp nhất vào phần tử yếu
            nhất màn hình là tự mâu thuẫn.
            Nhưng cũng không bê bốn ô lên đây: hero có đúng một nhiệm vụ chính
            là đăng ký bản tin, một trong hai thước đo thành công. Nút viền
            cùng bề rộng và cùng chiều cao với nút đặc bên trên giải được cả
            hai — nhìn thấy ngay, mà nền đặc vẫn là thứ mắt chạm trước. */}
        {START_HERE_PUBLISHED && (
          <div className="mt-9 flex w-full max-w-md flex-col items-center gap-2 sm:max-w-xl xl:max-w-2xl 2xl:mt-12">
            <span className="text-sm text-muted-foreground xl:text-base">
              {t("startHerePrompt")}
            </span>
            <Link
              href="/bat-dau"
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-primary px-6 py-3.5 text-base font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground xl:px-8 xl:py-4 xl:text-lg"
            >
              {t("startHereLink")} &rarr;
            </Link>
          </div>
        )}

        <div
          className="mt-7 flex w-full scroll-mt-24 flex-col items-center gap-3"
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
