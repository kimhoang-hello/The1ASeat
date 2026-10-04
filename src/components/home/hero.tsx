import { t as translate } from "@/lib/t";
import { NewsletterForm } from "./newsletter-form";
import Link from "next/link";
import { START_HERE_PUBLISHED, VIETNAM_ROUTES_PUBLISHED } from "@/lib/feature-flags";
import { VIETNAM_ROUTES, VIETNAM_ROUTES_BASE } from "@/lib/award-routes";

const t = translate("hero");

/** "Toronto, Vancouver, Montréal, Calgary" — theo thứ tự xuất hiện trong dữ liệu. */
const ROUTE_ORIGINS = [...new Set(VIETNAM_ROUTES.map((route) => route.originName))].join(", ");

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
      className={`bg-background px-4 pt-20 sm:px-6 lg:px-8 2xl:pt-28 ${HERO_PAD_BOTTOM}`}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center 2xl:max-w-4xl">
        <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl 2xl:text-6xl">
          {t("title1")}{" "}
          <span className="text-primary">{t("title2")}</span>
        </h1>
        {/* Phụ đề là câu của TÁC GIẢ — giữ nguyên theo yêu cầu (03/10/2026).
            Bản audit đã thay bằng một câu định vị viết mẫu; đừng viết lại câu
            này nếu tác giả không đưa câu mới. */}
        <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg 2xl:max-w-2xl 2xl:text-xl">
          {t("subtitle")}
        </p>

        <div
          className="mt-9 flex w-full scroll-mt-chrome flex-col items-center gap-3 2xl:mt-12"
          id="newsletter"
        >
          <span className="text-xs font-semibold tracking-wide text-muted-foreground xl:text-sm">
            {t("formLabel")}
          </span>
          <NewsletterForm id="hero-newsletter" size="hero" source="hero" />
          <span className="text-xs text-muted-foreground xl:text-sm">{t("disclaimer")}</span>
        </div>

        {/* Một dòng chữ chứng minh cơ chế (thẻ → điểm → chặng bay về Việt Nam)
            ngay màn hình đầu, sau audit UX/UI 03/10/2026. CỐ Ý không mang con
            số: một con số ở đây phải đi kèm chương trình, nguồn chuyển điểm và
            phụ phí (PRODUCT.md, nguyên tắc 2) — "70,000 miles AAdvantage®" cần
            100,000 điểm RBC® Avion® Elite — và hero không đủ chỗ cho cả chuỗi
            đó. Số chặng và tên thành phố đọc từ dữ liệu lúc render. Link chữ,
            không phải nút: việc chính của hero vẫn là bản tin (AGENTS.md). */}
        {VIETNAM_ROUTES_PUBLISHED && (
          <p className="mt-8 text-balance text-sm text-muted-foreground sm:text-base">
            {t("routesQuestion")}{" "}
            <Link
              href={VIETNAM_ROUTES_BASE}
              className="inline-block py-2 font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("routesLink", { count: VIETNAM_ROUTES.length, origins: ROUTE_ORIGINS })} &rarr;
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
