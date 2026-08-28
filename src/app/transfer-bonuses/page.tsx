import type { Metadata } from "next";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { getTransferBonuses } from "@/lib/content";
import { EDITORIAL_REL, relForUrl } from "@/lib/affiliate-links";
import { formatDate, hasExpired } from "@/lib/format-date";
import { PageHeader } from "@/components/layout/page-header";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";

const bonuses_t = t("bonuses");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("transferBonusesTitle"),
  description: seo("transferBonusesDescription"),
  path: "/transfer-bonuses",
});

// Content comes from Contentful; without this the page is fully static and
// only picks up new Contentful publishes on the next code deploy.
export const revalidate = 60;

export default async function TransferBonusesPage() {
  const published = await getTransferBonuses();

  // Lưới an toàn cho job `expire-offers`: nó gỡ bonus hết hạn mỗi ngày một
  // lần, nên giữa hai lần chạy — hoặc khi nó hỏng — bonus đã chết vẫn nằm
  // trong Contentful. Danh sách sắp theo `expiresAt` tăng dần, nên cái chết
  // trước lại đứng ĐẦU trang: không lọc thì thứ người đọc thấy trước tiên là
  // một offer bấm vào không dùng được nữa.
  const bonuses = published.filter((bonus) => !hasExpired(bonus.expiresAt));

  return (
    <>
      <PageHeader eyebrow={bonuses_t("eyebrow")} title={bonuses_t("title")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-page overflow-hidden rounded-2xl border border-border">
          {/* Hết bonus thì trước đây trang vẽ một khung viền rỗng không chữ
              nào — người đọc không biết là chưa có bonus hay trang hỏng. */}
          {bonuses.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {bonuses_t("empty")}
            </p>
          )}

          {bonuses.map((bonus, i) => (
            <a
              key={bonus.slug}
              href={bonus.url}
              target="_blank"
              rel={relForUrl(bonus.url) ?? EDITORIAL_REL}
              className={`flex cursor-pointer flex-col gap-2 px-5 py-4 transition-colors hover:bg-secondary sm:flex-row sm:items-center sm:justify-between ${
                i !== 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-foreground">{bonus.fromProgram}</span>
                  <ArrowRight size={14} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">{bonus.toProgram}</span>
                </div>
                {bonus.note && <p className="text-xs text-muted-foreground">{bonus.note}</p>}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium text-amber-700">
                  {bonuses_t("expires")} {formatDate(bonus.expiresAt)}
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  +{bonus.bonusPercent}%
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
