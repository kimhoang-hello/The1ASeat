import Link from "next/link";
import { creditCardsPath, type CardPointsProgram } from "@/lib/card-points-programs";
import { t } from "@/lib/t";

const offers_t = t("offers");

/**
 * Filters the card list by reward currency — the same chip row the blog uses
 * for its categories. Unlike those, these are filters rather than archive
 * pages, so the row carries its own "Tất cả" chip to clear the filter.
 */
export function PointsProgramLinks({
  programs,
  activeId,
  activeType,
  totalCount,
  className = "",
}: {
  programs: CardPointsProgram[];
  activeId?: string;
  activeType: string;
  totalCount: number;
  className?: string;
}) {
  if (programs.length < 2) return null;

  const chip = (isActive: boolean) =>
    `inline-block cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${
      isActive
        ? "border-primary bg-primary/10 font-semibold text-primary"
        : "border-border text-foreground/70 hover:border-primary hover:text-primary"
    }`;

  return (
    <nav aria-label={offers_t("pointsLabel")} className={className}>
      <ul className="flex flex-wrap items-center gap-2">
        <li className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {offers_t("pointsLabel")}
        </li>

        <li>
          <Link
            href={creditCardsPath({ type: activeType })}
            aria-current={activeId ? undefined : "true"}
            className={chip(!activeId)}
          >
            {offers_t("pointsAll")}
            <span className="ml-1 text-xs text-muted-foreground">{totalCount}</span>
          </Link>
        </li>

        {programs.map((program) => (
          <li key={program.id}>
            <Link
              href={creditCardsPath({ type: activeType, points: program.id })}
              aria-current={program.id === activeId ? "true" : undefined}
              className={chip(program.id === activeId)}
            >
              {program.name}
              <span className="ml-1 text-xs text-muted-foreground">{program.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
