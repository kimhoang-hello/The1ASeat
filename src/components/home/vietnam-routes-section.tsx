import Link from "next/link";
import { formatPoints } from "@/lib/award-charts";
import {
  VIETNAM_ROUTES,
  VIETNAM_ROUTES_BASE,
  cheapestByCabin,
  routeLabel,
  vietnamRoutePath,
  type CheapestByCabin,
} from "@/lib/award-routes";
import { VIETNAM_ROUTES_PUBLISHED } from "@/lib/feature-flags";
import { t as translate } from "@/lib/t";

const t = translate("homeRoutes");
const chart = translate("awardCharts");

/**
 * Ba chặng về Sài Gòn từ ba cộng đồng người Việt lớn nhất ở Canada. Chọn theo
 * SLUG, không theo vị trí trong `VIETNAM_ROUTES`, để sắp lại danh sách ở đó
 * không đổi thầm thứ trang chủ đang khoe. Slug không còn thì bị bỏ qua.
 */
const FEATURED_SLUGS = ["toronto-sai-gon", "vancouver-sai-gon", "montreal-sai-gon"];

/** Hai hạng người đọc hỏi nhiều nhất; hạng phổ thông đặc biệt ở trang chặng. */
const CABINS_SHOWN = new Set(["economy", "business"]);

/**
 * Khối "Bay về Việt Nam" ở trang chủ (thêm 03/10/2026 sau audit UX/UI).
 *
 * Mười hai trang chặng là nội dung khác biệt nhất của site — chuỗi thẻ → điểm
 * → chặng bay có thật → số điểm thật mà PRODUCT.md gọi là cơ chế không sao chép
 * được — nhưng trước đây trang chủ không có lối nào vào chúng. Mỗi con số đi
 * kèm TÊN LOẠI ĐIỂM của nó (37,500 AAdvantage® và 37,500 Aeroplan® không đổi
 * được cho nhau), đúng như ô số liệu ở chính trang chặng; nguồn chuyển điểm và
 * phụ phí nằm ở trang chặng, mỗi ô là một link sang đó.
 *
 * Mọi số tính lúc render từ `cheapestByCabin()` — cùng hàm trang chặng dùng —
 * nên bảng giá đổi ở `award-charts.ts` là khối này đổi theo, không có số nào
 * gõ tay ở đây.
 */
export function VietnamRoutesSection() {
  if (!VIETNAM_ROUTES_PUBLISHED) return null;

  const routes = FEATURED_SLUGS.flatMap((slug) => {
    const route = VIETNAM_ROUTES.find((r) => r.slug === slug);
    return route ? [{ route, cheapest: cheapestByCabin(route).filter((c) => CABINS_SHOWN.has(c.cabin)) }] : [];
  });
  if (routes.length === 0) return null;

  return (
    <section className="border-t border-border bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        <div className="mb-8 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl xl:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Link
            href={VIETNAM_ROUTES_BASE}
            className="shrink-0 py-2 text-sm font-semibold text-primary hover:underline"
          >
            {t("viewAll", { count: VIETNAM_ROUTES.length })} &rarr;
          </Link>
        </div>

        <ul className="grid gap-4 md:grid-cols-3">
          {routes.map(({ route, cheapest }) => (
            <li key={route.slug}>
              <Link
                href={vietnamRoutePath(route.slug)}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <span className="font-display text-lg font-bold text-foreground group-hover:text-primary">
                  {routeLabel(route)}
                </span>
                <dl className="mt-3 divide-y divide-border">
                  {cheapest.map((row) => (
                    <CabinRow key={row.cabin} row={row} />
                  ))}
                </dl>
                <span className="mt-auto pt-4 text-sm font-semibold text-primary">
                  {t("routeCta")} &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CabinRow({ row }: { row: CheapestByCabin }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-sm text-muted-foreground">{chart(row.labelKey)}</dt>
      <dd className="text-right">
        {row.points === null ? (
          <span className="text-sm text-muted-foreground">{t("noQuote")}</span>
        ) : (
          <>
            <span className="font-display text-lg font-bold tabular-nums text-primary">
              {row.startingAt && <span className="mr-1 text-sm font-semibold">{chart("fromPrefix")}</span>}
              {formatPoints(row.points)}
            </span>
            <span className="block text-xs text-muted-foreground">{row.programCurrency}</span>
          </>
        )}
      </dd>
    </div>
  );
}
