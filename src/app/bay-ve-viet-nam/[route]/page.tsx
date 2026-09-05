import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import {
  CheapestTiles,
  RouteAwardTable,
  RouteRoutings,
} from "@/components/award-charts/route-award-table";
import { formatDate } from "@/lib/format-date";
import { getCreditCardOffers } from "@/lib/content";
import { getCardPointsPrograms, creditCardsPath } from "@/lib/card-points-programs";
import { ringAfter } from "@/lib/card-next-steps";
import { TRANSFER_PARTNERS } from "@/lib/transfer-partners";
import { formatPoints } from "@/lib/award-charts";
import {
  VIETNAM_ROUTES,
  VIETNAM_ROUTES_BASE,
  assertNoPointsInProse,
  awardDataVerifiedOn,
  cheapestByCabin,
  programRows,
  routeLabel,
  vietnamRouteBySlug,
  vietnamRoutePath,
  type VietnamRoute,
} from "@/lib/award-routes";
import { VIETNAM_ROUTES_PUBLISHED } from "@/lib/feature-flags";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const r = translate("awardRoutes");
const chart = translate("awardCharts");
const seo = translate("seo");
const common = translate("common");

export function generateStaticParams() {
  // Chạy lúc `next build`, nên một đoạn viết tay lỡ chứa số điểm sẽ làm deploy
  // đỏ ngay thay vì trôi lặng lên production. Cùng chỗ đặt và cùng lý do với
  // `assertNoBankSlugClash()` bên trang tài khoản ngân hàng.
  assertNoPointsInProse();
  return VIETNAM_ROUTES.map((route) => ({ route: route.slug }));
}

// Dữ liệu award chart nằm trong repo nên chỉ đổi khi deploy, nhưng trang còn
// đọc danh sách thẻ từ Contentful để dựng link "thẻ nào tích loại điểm này".
// Thiếu dòng này thì Next giao cho CDN một `s-maxage` một năm — cùng cái bẫy
// đã ghi ở `/calculator` và `/award-flight-finder`.
export const revalidate = 3600;

/** Mô tả tìm kiếm dựng từ số THẬT lúc render, không gõ tay — cùng luật với
 *  `bodyVi`. Giữ dưới 160 ký tự như `META_DESCRIPTION_MAX` bên tài khoản. */
function routeDescription(route: VietnamRoute): string {
  const [economy, , business] = cheapestByCabin(route);
  const label = `${route.originName} → ${route.destinationName}`;

  const parts: string[] = [];
  if (economy.points !== null) parts.push(`phổ thông từ ${formatPoints(economy.points)}`);
  if (business.points !== null) parts.push(`thương gia từ ${formatPoints(business.points)}`);

  // Giữ dưới 160 ký tự, cùng ngưỡng `META_DESCRIPTION_MAX` bên tài khoản ngân
  // hàng: câu giá bỏ đi trước, phần nói trang này có gì thì luôn ở lại.
  const prices = parts.length ? ` ${parts.join(", ")}.` : "";
  return `${label} bằng điểm:${prices} So sáu chương trình, đường bay có thật và cách chuyển điểm từ thẻ Canada.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ route: string }>;
}): Promise<Metadata> {
  const { route: slug } = await params;
  const route = vietnamRouteBySlug(slug);
  if (!route) return {};

  return {
    ...pageMetadata({
      title: r("metaTitle", { origin: route.originName, destination: route.destinationName }),
      description: routeDescription(route),
      path: vietnamRoutePath(route.slug),
    }),
    // Cùng luật với trang Ngân hàng và trang Bắt đầu.
    ...(VIETNAM_ROUTES_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function VietnamRoutePage({
  params,
}: {
  params: Promise<{ route: string }>;
}) {
  const { route: slug } = await params;
  const route = vietnamRouteBySlug(slug);
  if (!route) notFound();

  const rows = programRows(route);
  const cheapest = cheapestByCabin(route);
  const path = vietnamRoutePath(route.slug);

  // Vòng, không phải "ba chặng đầu danh sách" — cùng lý do đã ghi ở
  // `siblingCardsInProgram`: lấy ba cái đầu thì ba chặng xếp cuối không có một
  // link nội bộ nào trỏ vào, và `audit:links` sẽ đỏ đúng vào chúng.
  const siblings = ringAfter(VIETNAM_ROUTES, (other) => other.slug === route.slug, 3);

  // Chỉ dựng link lọc cho hệ điểm THẬT SỰ có thẻ trên site. `/credit-cards`
  // cố ý cho một id lạ rơi về danh sách không lọc, nên một link đoán bừa sẽ
  // trả về nguyên 23 thẻ và người đọc tưởng đó là kết quả lọc — đúng cái bẫy
  // đã ghi trong `TransferLegs`.
  const offers = await getCreditCardOffers();
  const cardPrograms = new Set(getCardPointsPrograms(offers).map((p) => p.id));

  // Chặng này với tới được những chương trình nào — và từ đó, loại điểm thẻ
  // nào thật sự dùng được ở đây. Suy từ dữ liệu chứ không gán tay.
  const reachable = rows.filter((row) => row.quote.options.length > 0);
  const hasAeroplan = reachable.some((row) => row.quote.program.id === "aeroplan");
  const viaRbc = reachable.some((row) => {
    const partner = TRANSFER_PARTNERS.find((p) => p.program === row.quote.program.transferPartnerKey);
    return partner?.rbc != null;
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbVietnamRoutes"), path: VIETNAM_ROUTES_BASE },
        { name: routeLabel(route), path },
      ]),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader
        eyebrow={r("eyebrow")}
        title={r("title", { origin: route.originName, destination: route.destinationName })}
        subtitle={r("subtitle", {
          origin: route.originName,
          originCode: route.origin.code,
          destination: route.destinationName,
          destinationCode: route.destination.code,
        })}
      />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {!VIETNAM_ROUTES_PUBLISHED && (
          <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {r("draftNotice")}
          </p>
        )}

        <Link
          href={VIETNAM_ROUTES_BASE}
          className="text-sm font-semibold text-primary hover:underline"
        >
          &larr; {r("hubLabel")}
        </Link>

        <h2 className="mt-8 font-display text-xl font-bold text-foreground">
          {r("cheapestHeading")}
        </h2>
        <div className="mt-3">
          <CheapestTiles rows={cheapest} />
        </div>

        {/* Đoạn viết tay của riêng chặng này. Đây là thứ phân biệt mười hai
            trang này với mười hai lần đổ cùng một cái bảng — và là lý do số
            trang dừng ở mười hai. */}
        <div className="mt-8 space-y-4 leading-relaxed text-foreground/90">
          {route.bodyVi.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>

        <h2 className="mt-10 font-display text-xl font-bold text-foreground">
          {r("tableHeading")}
        </h2>
        <p id="route-table-desc" className="mt-1 text-sm text-muted-foreground">
          {r("tableCaption")}
        </p>
        <RouteAwardTable
          rows={rows}
          name={r("tableName", {
            origin: route.originName,
            destination: route.destinationName,
          })}
          describedBy="route-table-desc"
        />

        <h2 className="mt-10 font-display text-xl font-bold text-foreground">
          {r("routingsHeading")}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r("routingsIntro")}</p>
        <RouteRoutings rows={rows} />

        <h2 className="mt-10 font-display text-xl font-bold text-foreground">
          {r("cardsHeading")}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r("cardsIntro")}</p>
        <ul className="mt-3 space-y-2">
          {hasAeroplan && cardPrograms.has("aeroplan") && (
            <StepLink
              href={creditCardsPath({ points: "aeroplan" })}
              label={r("cardsAeroplan")}
              description={r("cardsAeroplanDescription")}
            />
          )}
          {viaRbc && cardPrograms.has("avion") && (
            <StepLink
              href={creditCardsPath({ points: "avion" })}
              label={r("cardsAvion")}
              description={r("cardsAvionDescription")}
            />
          )}
          <StepLink
            href="/transfer-partners"
            label={r("cardsTransfer")}
            description={r("cardsTransferDescription")}
          />
        </ul>

        <div className="mt-10 rounded-xl border border-border bg-secondary p-4">
          <p className="text-sm font-semibold text-foreground">{chart("disclaimerHeading")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{chart("disclaimer")}</p>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {r("verifiedNote", { date: formatDate(awardDataVerifiedOn()) })}
        </p>

        <NextSteps title={r("nextStepsTitle")} className="mt-10 border-t border-border pt-8">
          {siblings.map((sibling) => {
            const economy = cheapestByCabin(sibling)[0];
            return (
              <StepLink
                key={sibling.slug}
                href={vietnamRoutePath(sibling.slug)}
                label={routeLabel(sibling)}
                description={
                  economy.points === null
                    ? r("siblingDescriptionNone")
                    : r("siblingDescription", { points: formatPoints(economy.points) })
                }
              />
            );
          })}
          <StepLink
            href="/award-flight-finder"
            label={r("toolLabel")}
            description={r("toolDescription")}
          />
        </NextSteps>

        <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          <Link href="/" className="underline">
            {common("backHome")}
          </Link>
        </p>
      </div>
    </>
  );
}
