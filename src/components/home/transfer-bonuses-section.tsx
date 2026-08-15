import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { t as translate } from "@/lib/t";
import { getTransferBonuses } from "@/lib/content";
import { formatDate } from "@/lib/format-date";

const t = translate("bonuses");

export async function TransferBonusesSection() {
  const allBonuses = await getTransferBonuses();
  const bonuses = allBonuses.slice(0, 3);

  return (
    <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary">{t("eyebrow")}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
              {t("title")}
            </h2>
          </div>
          <Link
            href="/transfer-bonuses"
            className="cursor-pointer text-sm font-semibold text-primary hover:underline"
          >
            {t("viewAll")} &rarr;
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border">
          {bonuses.map((bonus, i) => (
            <a
              key={bonus.slug}
              href={bonus.url}
              target="_blank"
              rel="noopener noreferrer"
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
                  {t("expires")} {formatDate(bonus.expiresAt)}
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
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
