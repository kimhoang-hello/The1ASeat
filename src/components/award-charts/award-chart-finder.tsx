"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Info, WarningCircle } from "@phosphor-icons/react";
import { t as translate } from "@/lib/t";
import { TRANSFER_PARTNERS } from "@/lib/transfer-partners";
import {
  CABINS,
  DESTINATIONS,
  ORIGINS,
  PROGRAMS,
  formatPoints,
  quoteRoute,
  type Cabin,
  type Program,
  type Quote,
  type RoutingOption,
} from "@/lib/award-charts";

const t = translate("awardCharts");

const CONFIDENCE_LABELS: Record<Program["confidence"], string> = {
  published: "confidencePublished",
  unpublished: "confidenceUnpublished",
  unquotable: "confidenceUnquotable",
};

const CONFIDENCE_STYLES: Record<Program["confidence"], string> = {
  published: "bg-[#e7f2ea] text-[#1f6f43]",
  unpublished: "bg-[#fdf1d8] text-[#8a5a10]",
  unquotable: "bg-secondary text-muted-foreground",
};

const SURCHARGE_LABELS = {
  low: "surchargeLow",
  medium: "surchargeMedium",
  high: "surchargeHigh",
} as const;

const SURCHARGE_STYLES = {
  low: "text-[#1f6f43]",
  medium: "text-[#8a5a10]",
  high: "text-[#a3352b]",
} as const;

function isCabin(value: string | null): value is Cabin {
  return CABINS.some((c) => c.id === value);
}

type Selection = { origin: string; destination: string; cabin: Cabin };

function readParams(params: URLSearchParams): Selection {
  const origin = params.get("origin");
  const destination = params.get("destination");
  const cabin = params.get("cabin");
  return {
    origin: ORIGINS.some((a) => a.code === origin) ? origin! : "YYZ",
    destination: DESTINATIONS.some((a) => a.code === destination) ? destination! : "SGN",
    cabin: isCabin(cabin) ? cabin : "business",
  };
}

/** The transfer legs from transfer-partners.ts for one program, so a reader
 *  can see whether the points they hold reach this chart at all. */
function TransferLegs({ program }: { program: Program }) {
  const row = TRANSFER_PARTNERS.find((p) => p.program === program.transferPartnerKey);
  const legs = [
    { issuer: "Amex MR", leg: row?.amex ?? null, tint: "bg-[#e7f2ea] text-[#1f6f43]" },
    { issuer: "RBC Avion", leg: row?.rbc ?? null, tint: "bg-[#fdf1d8] text-[#8a5a10]" },
  ].filter((entry) => entry.leg !== null);

  if (legs.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground/80">
        {t(program.transferNoteKey ?? "transferNone")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {legs.map(({ issuer, leg, tint }) => (
        <span
          key={issuer}
          className={`rounded-md px-2 py-1 text-[11px] font-medium leading-tight ${tint}`}
        >
          {issuer} · {leg!.ratio}
        </span>
      ))}
    </div>
  );
}

/** One bookable way of flying the route: who flies it, where it stops, how far
 *  it is and what that costs. */
function OptionRow({ option, currency }: { option: RoutingOption; currency: string }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        option.isBest ? "border-primary/40 bg-primary/5" : "border-transparent bg-secondary/60"
      }`}
    >
      <div className="flex shrink-0 flex-col gap-0.5">
        {option.carriers.map((carrier) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={carrier.code}
            src={carrier.logo}
            alt={carrier.name}
            title={carrier.name}
            className="h-6 w-14 rounded border border-border bg-white object-contain p-0.5"
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm text-foreground">{option.routing.join(" → ")}</p>
        <p className="text-[11px] text-muted-foreground">
          {option.carriers.map((c) => c.name).join(" + ")} ·{" "}
          {t("routingMiles", { miles: formatPoints(option.miles) })}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {option.points === null ? (
          option.dynamicPrice ? (
            // No chart ever covered this flying, so a dash would read as a
            // missing figure rather than the answer.
            <span className="text-xs font-medium text-muted-foreground">{t("optionDynamic")}</span>
          ) : (
            <span
              className="text-sm text-muted-foreground/60"
              title={option.needsFeeder ? t("feederNote") : undefined}
            >
              —
            </span>
          )
        ) : (
          <>
            <p className="text-sm font-bold text-foreground">
              {option.startingAt && <span className="font-normal">{t("fromPrefix")} </span>}
              {formatPoints(option.points)}
            </p>
            <p className="text-[10px] text-muted-foreground">{currency}</p>
          </>
        )}
      </div>
    </li>
  );
}

function QuoteCard({ quote, cheapest }: { quote: Quote; cheapest: number | null }) {
  const { program, points, options } = quote;
  const isCheapest = points !== null && points === cheapest;
  const gap = points !== null && cheapest !== null ? points - cheapest : 0;
  const unquotable = program.pricing.kind === "unquotable";

  return (
    <li
      className={`rounded-2xl border bg-card p-4 sm:p-5 ${
        isCheapest ? "border-primary ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={program.logo}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md border border-border bg-white object-contain p-1"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{program.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  CONFIDENCE_STYLES[program.confidence]
                }`}
              >
                {t(CONFIDENCE_LABELS[program.confidence])}
              </span>
              <span className={`text-[11px] font-medium ${SURCHARGE_STYLES[program.surcharge]}`}>
                {t(SURCHARGE_LABELS[program.surcharge])}
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          {options.length === 0 ? (
            // No number can be right when the programme's partners do not fly
            // the route at all — say that, rather than blaming the chart.
            <>
              <p className="font-display text-lg font-bold text-muted-foreground sm:text-xl">
                {t("noRoutingShort")}
              </p>
              <p className="mt-0.5 max-w-[15rem] text-xs leading-snug text-muted-foreground">
                {t("noRouting")}
              </p>
            </>
          ) : points === null ? (
            unquotable && program.pricing.kind === "unquotable" ? (
              <>
                <p className="font-display text-lg font-bold text-muted-foreground sm:text-xl">
                  {t(program.pricing.labelKey)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(program.pricing.hintKey)}
                </p>
              </>
            ) : (
              // Not a number, so it must not borrow the number's type scale —
              // at 375px the display size wrapped straight over the card edge.
              <p className="max-w-[16rem] text-sm font-medium text-muted-foreground">
                {t("notPublished")}
              </p>
            )
          ) : (
            <>
              <p className="font-display text-2xl font-extrabold text-primary sm:text-3xl">
                {quote.startingAt && (
                  <span className="mr-1.5 text-base font-semibold">{t("fromPrefix")}</span>
                )}
                {formatPoints(points)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("pointsUnit", { currency: program.currency })}
              </p>
              {quote.startingAt && (
                <p className="mt-0.5 max-w-[15rem] text-[11px] leading-snug text-muted-foreground">
                  {t("startingAtHint")}
                </p>
              )}
              {isCheapest ? (
                <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  {t("cheapest")}
                </span>
              ) : (
                gap > 0 && (
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                    {t("vsCheapest", { diff: formatPoints(gap) })}
                  </p>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* Notes that apply to this city pair only. Amber is reserved for a rate
          that contradicts the programme's own chart; a rate that merely
          explains itself gets a neutral box, so the colour keeps its meaning. */}
      {quote.routeNoteKey && (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-xs font-medium leading-relaxed ${
            quote.routeNoteTone === "highlight"
              ? "border-[#8a5a10]/30 bg-[#fdf1d8] text-[#8a5a10]"
              : "border-border bg-secondary text-foreground/80"
          }`}
        >
          {t(quote.routeNoteKey)}
        </p>
      )}

      {options.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("optionsHeading", { count: options.length })}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/80">
            {t("optionsCaveat")}
          </p>
          <ul className="mt-2 grid gap-1.5">
            {options.map((option) => (
              <OptionRow
                key={option.routing.join("-")}
                option={option}
                currency={program.currency}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("transferHeading")}
        </p>
        <div className="mt-1.5">
          <TransferLegs program={program} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t(program.noteKey)}</p>
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full cursor-pointer rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
      >
        {children}
      </select>
    </label>
  );
}

function Finder() {
  const searchParams = useSearchParams();

  // The URL is the single source of truth rather than a mirror of local
  // state. This page is prerendered, so on a hard load the first client render
  // of this subtree can happen before the search params resolve — seeding
  // useState from them would freeze the defaults and silently break every
  // shared deep link. Deriving on each render sidesteps that entirely.
  const selection = readParams(searchParams);
  const { origin, destination, cabin } = selection;

  // replaceState is the documented way to shallow-route in the App Router; it
  // feeds back into useSearchParams, which is what re-renders this component.
  function update(patch: Partial<Selection>) {
    const next = { ...selection, ...patch };
    window.history.replaceState(null, "", `?${new URLSearchParams(next).toString()}`);
  }

  const originAirport = ORIGINS.find((a) => a.code === origin)!;
  const destinationAirport = DESTINATIONS.find((a) => a.code === destination)!;

  const quotes = useMemo(
    () => quoteRoute(originAirport, destinationAirport, cabin),
    [originAirport, destinationAirport, cabin]
  );

  const cheapest = quotes.find((q) => q.points !== null)?.points ?? null;
  const cabinLabel = t(CABINS.find((c) => c.id === cabin)!.labelKey);
  const verifiedOn = PROGRAMS.map((p) => p.verifiedOn).sort().at(-1)!;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("originLabel")}
            value={origin}
            onChange={(value) => update({ origin: value })}
          >
            {ORIGINS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code})
              </option>
            ))}
          </Field>

          <Field
            label={t("destinationLabel")}
            value={destination}
            onChange={(value) => update({ destination: value })}
          >
            {DESTINATIONS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code}) · {a.country}
              </option>
            ))}
          </Field>
        </div>

        <div className="mt-4">
          <span className="text-sm font-medium text-foreground/80">{t("cabinLabel")}</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CABINS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => update({ cabin: c.id })}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  cabin === c.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-white text-foreground/80 hover:bg-secondary"
                }`}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="flex flex-wrap items-baseline gap-x-2 font-display text-xl font-bold text-foreground">
          <span>{originAirport.city}</span>
          <ArrowRight size={18} weight="bold" className="text-primary" aria-hidden />
          <span>{destinationAirport.city}</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("resultsSub", { cabin: cabinLabel })}
        </p>

        <ul className="mt-4 grid gap-3">
          {quotes.map((quote) => (
            <QuoteCard key={quote.program.id} quote={quote} cheapest={cheapest} />
          ))}
        </ul>

        <p className="mt-4 text-xs text-muted-foreground">{t("verifiedOn", { date: verifiedOn })}</p>

        <div className="mt-6 flex gap-3 rounded-xl border border-border bg-secondary p-4">
          <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-[#a3352b]" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">{t("disclaimerHeading")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("disclaimer")}</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Info size={20} weight="fill" className="text-primary" aria-hidden />
            {t("howHeading")}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {["1", "2", "3", "4"].map((n) => (
              <div key={n} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">{t(`howStep${n}Title`)}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t(`howStep${n}Body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AwardChartFinder() {
  // useSearchParams opts the subtree into client-side rendering, so the
  // boundary keeps the rest of the page prerenderable — same pattern the
  // site header already uses for its Blog dropdown.
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-3xl animate-pulse rounded-2xl bg-secondary" />}>
      <Finder />
    </Suspense>
  );
}
