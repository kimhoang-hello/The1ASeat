import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { t as translate } from "@/lib/t";
import { getTransferBonuses } from "@/lib/content";
import { formatDate, hasExpired } from "@/lib/format-date";
import { EDITORIAL_REL, relForUrl } from "@/lib/affiliate-links";

const t = translate("bonuses");

export async function TransferBonusesSection() {
  const allBonuses = await getTransferBonuses();

  // Lọc TRƯỚC khi cắt ba cái đầu, cùng lý do với `/transfer-bonuses`: danh
  // sách sắp theo `expiresAt` tăng dần nên cái chết trước đứng đầu, tức là
  // không lọc thì đúng ba ô trên trang chủ là ba offer sắp chết hoặc đã chết.
  // Job `expire-offers` chạy 08:00 UTC mỗi ngày, nên một bonus hết hạn lúc nửa
  // đêm Toronto còn nằm đây vài tiếng — và nằm mãi nếu job hỏng. `revalidate`
  // 60 giây không cứu được: lượt render mới vẫn dựng lại đúng cái HTML đó.
  const bonuses = allBonuses.filter((bonus) => !hasExpired(bonus.expiresAt)).slice(0, 3);

  return (
    <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary sm:text-sm">{t("eyebrow")}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl xl:text-4xl">
              {t("title")}
            </h2>
          </div>
          <Link
            href="/transfer-bonuses"
            className="cursor-pointer text-base font-semibold text-primary hover:underline"
          >
            {t("viewAll")} &rarr;
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border">
          {/* Hết bonus thì khung viền rỗng không chữ nào trông như trang hỏng —
              cùng lý do đã thêm dòng này cho `/transfer-bonuses`. */}
          {bonuses.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
          )}
          {bonuses.map((bonus, i) => (
            <a
              key={bonus.slug}
              href={bonus.url}
              target="_blank"
              rel={relForUrl(bonus.url) ?? EDITORIAL_REL}
              className={`flex cursor-pointer flex-col gap-2 px-5 py-5 transition-colors hover:bg-secondary sm:flex-row sm:items-center sm:justify-between ${
                i !== 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-base">
                  <span className="font-semibold text-foreground">{bonus.fromProgram}</span>
                  <ArrowRight size={16} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">{bonus.toProgram}</span>
                </div>
                {bonus.note && <p className="text-sm text-muted-foreground">{bonus.note}</p>}
              </div>
              <div className="flex items-center gap-4 text-base">
                <span className="font-medium text-amber-700">
                  {t("expires")} {formatDate(bonus.expiresAt)}
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                  +{bonus.bonusPercent}%
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
