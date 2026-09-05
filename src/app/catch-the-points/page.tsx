import type { Metadata } from "next";
import { Suspense } from "react";

import { CatchThePointsFrame } from "@/components/games/catch-the-points-frame";
import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { CATCH_THE_POINTS_PATH } from "@/lib/catch-the-points-path";
import { CATCH_THE_POINTS_PUBLISHED, START_HERE_PUBLISHED } from "@/lib/feature-flags";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { t } from "@/lib/t";

const game = t("game");
const next = t("nextSteps");
const seo = t("seo");

export const metadata: Metadata = {
  ...pageMetadata({
    title: seo("catchThePointsTitle"),
    description: seo("catchThePointsDescription"),
    path: CATCH_THE_POINTS_PATH,
  }),
  // Cùng luật với trang Ngân hàng, trang Bắt đầu và các trang chặng: chưa công
  // bố thì không cho Google index.
  ...(CATCH_THE_POINTS_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
};

// Cùng lý do với `/calculator`: trang không đọc dữ liệu ngoài nên Next sẽ giao
// cho CDN một `s-maxage` một năm, mà deploy không xoá cache đó.
export const revalidate = 3600;

export default function CatchThePointsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: seo("breadcrumbCatchThePoints"), path: CATCH_THE_POINTS_PATH },
        ])}
      />
      <PageHeader eyebrow={game("eyebrow")} title={game("title")} subtitle={game("subtitle")} />

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-page">
          {!CATCH_THE_POINTS_PUBLISHED && (
            <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              {game("draftNotice")}
            </p>
          )}

          {/* `useSearchParams` bên trong khung game cần một ranh giới Suspense
              lúc prerender. Fallback giữ đúng khoảng chỗ để trang không nhảy
              một nhịp khi game hiện ra. */}
          <Suspense fallback={<div className="h-[45rem] w-full" aria-hidden />}>
            <CatchThePointsFrame />
          </Suspense>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">
                {game("howToTitle")}
              </h2>
              <ul className="mt-3 space-y-2 text-base text-foreground/90">
                <li>{game("howToDesktop")}</li>
                <li>{game("howToMobile")}</li>
                <li>{game("howToRule")}</li>
              </ul>
            </section>
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">
                {game("noteTitle")}
              </h2>
              <ul className="mt-3 space-y-2 text-base text-muted-foreground">
                <li>{game("noteScore")}</li>
                <li>{game("noteFiction")}</li>
              </ul>
            </section>
          </div>

          {/* Game là cửa vào vui nhất và cụt nhất của site: chơi xong không có
              đường nào đi tiếp trừ đúng một CTA trong màn kết quả, mà CTA đó
              nằm trong iframe nên crawler không thấy. Khối này là các đường
              nội bộ thật, nằm trong HTML server trả về. */}
          <NextSteps title={next("title")} className="mt-10">
            {START_HERE_PUBLISHED && (
              <StepLink
                href="/bat-dau"
                label={next("startHereLabel")}
                description={next("startHereDescription")}
              />
            )}
            <StepLink
              href="/credit-cards"
              label={next("cardsLabel")}
              description={next("cardsDescription")}
            />
            <StepLink
              href="/award-flight-finder"
              label={next("awardLabel")}
              description={next("awardDescription")}
            />
            <StepLink
              href="/transfer-partners"
              label={next("transferLabel")}
              description={next("transferDescription")}
            />
          </NextSteps>
        </div>
      </section>
    </>
  );
}
