import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { formatDate } from "@/lib/format-date";
import { formatPoints } from "@/lib/award-charts";
import {
  VIETNAM_ROUTES,
  VIETNAM_ROUTES_BASE,
  awardDataVerifiedOn,
  cheapestByCabin,
  routeLabel,
  vietnamRoutePath,
} from "@/lib/award-routes";
import { VIETNAM_ROUTES_PUBLISHED } from "@/lib/feature-flags";
import { absoluteUrl, pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const r = translate("awardRoutes");
const chart = translate("awardCharts");
const seo = translate("seo");
const next = translate("nextSteps");

export const metadata: Metadata = {
  ...pageMetadata({
    title: seo("vietnamRoutesTitle"),
    description: seo("vietnamRoutesDescription"),
    path: VIETNAM_ROUTES_BASE,
  }),
  // Cùng luật với trang Ngân hàng và trang Bắt đầu: chưa công bố thì không cho
  // Google index.
  ...(VIETNAM_ROUTES_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
};

// Cùng lý do với `/award-flight-finder`: trang không đọc dữ liệu ngoài nên
// Next sẽ giao cho CDN một `s-maxage` một năm, mà deploy không xoá cache đó.
export const revalidate = 3600;

/** Một con số kèm loại điểm của nó, cho ô bảng tổng.
 *
 *  Con số đứng một mình không nói nó là điểm của ai, mà ba cột xếp cạnh nhau
 *  như thể đổi được cho nhau. Logo cho mắt quét nhanh, tên loại điểm cho người
 *  đọc chưa quen logo — site có độc giả lớn tuổi, nên chỉ logo là chưa đủ.
 *
 *  Logo `alt=""` vì tên đã nằm ngay cạnh dưới dạng chữ; để `alt` mang tên nữa
 *  là screen reader đọc đúng một thứ hai lần. */
function ProgramFigure({
  points,
  startingAt,
  logo,
  currency,
  secondary = false,
}: {
  points: number;
  startingAt: boolean;
  logo: string | null;
  currency: string | null;
  /** Lựa chọn rẻ thứ hai: cùng bố cục, nhỏ và nhạt hơn. */
  secondary?: boolean;
}) {
  return (
    <>
      <span
        className={`block font-display ${
          secondary ? "text-[13px] font-semibold text-foreground/70" : "font-bold"
        }`}
      >
        {startingAt && (
          <span className="font-normal text-muted-foreground">{chart("fromPrefix")} </span>
        )}
        {formatPoints(points)}
      </span>
      {currency && (
        <span className="mt-1 flex items-center justify-end gap-1.5">
          {logo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logo}
              alt=""
              className={`${
                secondary ? "h-3.5 w-3.5" : "h-4 w-4"
              } shrink-0 rounded border border-border bg-white object-contain p-px`}
            />
          )}
          <span
            className={`${
              secondary ? "text-[11px]" : "text-xs"
            } font-medium leading-tight text-muted-foreground`}
          >
            {currency}
          </span>
        </span>
      )}
    </>
  );
}

export default function VietnamRoutesHubPage() {
  const rows = VIETNAM_ROUTES.map((route) => ({ route, cheapest: cheapestByCabin(route) }));
  const cabins = rows[0].cheapest;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([{ name: seo("breadcrumbVietnamRoutes"), path: VIETNAM_ROUTES_BASE }]),
      {
        "@type": "ItemList",
        name: seo("vietnamRoutesTitle"),
        itemListElement: rows.map(({ route }, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: routeLabel(route),
          url: absoluteUrl(vietnamRoutePath(route.slug)),
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader title={r("hubTitle")} subtitle={r("hubSubtitle")} />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {!VIETNAM_ROUTES_PUBLISHED && (
          <p className="mb-6 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
            {r("draftNotice")}
          </p>
        )}

        <div className="space-y-4 leading-relaxed text-foreground/90">
          <p>{r("hubIntro1")}</p>
          <p>{r("hubIntro2")}</p>
        </div>

        <h2 className="mt-10 font-display text-xl font-bold text-foreground">
          {r("hubTableHeading")}
        </h2>
        <p id="hub-table-desc" className="mt-1 text-sm text-muted-foreground">
          {r("hubTableCaption")}
        </p>

        {/* Cùng cách chia vai như bảng ở trang chặng: `<caption>` đặt tên cho
            bảng, `aria-describedby` trỏ tới đoạn mô tả nhìn thấy được đứng
            ngoài khung cuộn. Xem chú thích đầy đủ ở `route-award-table.tsx` —
            kể cả vì sao khung phải `relative`. */}
        <div className="relative mt-4 overflow-x-auto rounded-xl border border-border">
          <table
            aria-describedby="hub-table-desc"
            className="w-full min-w-[32rem] border-collapse text-left"
          >
            <caption className="sr-only">{r("hubTableName")}</caption>
            <thead>
              <tr className="bg-secondary">
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {r("hubRouteColumn")}
                </th>
                {cabins.map((cabin) => (
                  <th
                    key={cabin.cabin}
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {chart(cabin.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ route, cheapest }, index) => (
                <tr
                  key={route.slug}
                  // Đường kẻ đậm hơn mỗi khi đổi thành phố đi: bốn nhóm ba
                  // chặng đọc ra thành bốn nhóm, không phải mười hai dòng rời.
                  className={
                    index > 0 && VIETNAM_ROUTES[index - 1].origin.code !== route.origin.code
                      ? "border-t-2 border-border"
                      : "border-t border-border"
                  }
                >
                  <th scope="row" className="px-4 py-3 font-normal">
                    <Link
                      href={vietnamRoutePath(route.slug)}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      {routeLabel(route)}
                    </Link>
                  </th>
                  {cheapest.map((cell) => (
                    <td
                      key={cell.cabin}
                      className="px-4 py-3 text-right text-sm tabular-nums text-foreground"
                    >
                      {cell.points === null ? (
                        <span className="text-muted-foreground">
                          <span aria-hidden>—</span>
                          <span className="sr-only">{chart("notPublished")}</span>
                        </span>
                      ) : (
                        <>
                          <ProgramFigure
                            points={cell.points}
                            startingAt={cell.startingAt}
                            logo={cell.programLogo}
                            currency={cell.programCurrency}
                          />
                          {/* Lựa chọn thứ hai nằm DƯỚI, nhạt hơn và ngăn bằng
                              nét đứt: mắt quét cột vẫn gặp con số rẻ nhất trước,
                              còn người đang giữ loại điểm khác thì thấy ngay
                              mình có đường hay không. Ô không có lựa chọn thứ
                              hai thì để trống phần này — xem `runnerUp`. */}
                          {cell.runnerUp && (
                            <span className="mt-2 block border-t border-dashed border-border pt-2">
                              <span className="sr-only">{r("hubRunnerUpLabel")} </span>
                              <ProgramFigure
                                points={cell.runnerUp.points}
                                startingAt={cell.runnerUp.startingAt}
                                logo={cell.runnerUp.programLogo}
                                currency={cell.runnerUp.programCurrency}
                                secondary
                              />
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-secondary p-4">
          <p className="text-sm font-semibold text-foreground">{chart("disclaimerHeading")}</p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">{chart("disclaimer")}</p>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {r("verifiedNote", { date: formatDate(awardDataVerifiedOn()) })}
        </p>

        <NextSteps title={next("title")} className="mt-10 border-t border-border pt-8">
          <StepLink
            href="/award-flight-finder"
            label={r("toolLabel")}
            description={r("toolDescription")}
          />
          <StepLink
            href="/credit-cards"
            label={next("cardsLabel")}
            description={next("cardsDescription")}
          />
          <StepLink
            href="/transfer-partners"
            label={r("cardsTransfer")}
            description={r("cardsTransferDescription")}
          />
        </NextSteps>
      </div>
    </>
  );
}
