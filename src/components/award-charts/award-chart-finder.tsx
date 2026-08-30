"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/format-date";
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
 *  can see whether the points they hold reach this chart at all.
 *
 *  Các chip này CỐ Ý không phải link. Biến chúng thành link sang
 *  `/credit-cards?points=…` thì phải biết hệ điểm đó có thẻ nào không — mà
 *  danh sách thẻ nằm ở Contentful, component này lại là client nên không với
 *  tới. Link thẳng mà không kiểm sẽ hỏng lặng: `?points=amex-mr` hiện KHÔNG
 *  khớp thẻ nào trên site (thẻ Amex ở đây đều tích Aeroplan®/Bonvoy®), và
 *  `/credit-cards` cố ý cho id lạ rơi về danh sách KHÔNG lọc — người đọc bấm
 *  "Amex® MR" rồi nhận nguyên 23 thẻ, tưởng đó là kết quả lọc.
 *  Đường đi tiếp của trang này nằm ở khối cuối `award-flight-finder/page.tsx`. */
function TransferLegs({ program }: { program: Program }) {
  const row = TRANSFER_PARTNERS.find((p) => p.program === program.transferPartnerKey);
  const legs = [
    { issuer: "Amex® MR", leg: row?.amex ?? null, tint: "bg-[#e7f2ea] text-[#1f6f43]" },
    { issuer: "RBC® Avion®", leg: row?.rbc ?? null, tint: "bg-[#fdf1d8] text-[#8a5a10]" },
  ].filter((entry) => entry.leg !== null);

  if (legs.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
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
            // missing figure. Air Canada does publish a floor and a median of
            // what members paid, which is the most that can honestly be said.
            <div className="leading-tight">
              {option.dynamicFrom === undefined ? (
                <p className="text-xs font-medium text-muted-foreground">{t("optionDynamic")}</p>
              ) : (
                <>
                  <p className="text-sm font-bold text-foreground">
                    <span className="font-normal">{t("fromPrefix")} </span>
                    {formatPoints(option.dynamicFrom)}
                  </p>
                  {option.dynamicMedian !== undefined && (
                    <p className="text-[10px] text-muted-foreground">
                      {t("medianLabel", { points: formatPoints(option.dynamicMedian) })}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">{t("optionDynamic")}</p>
                </>
              )}
            </div>
          ) : (
            // Same two problems as the dash in the Transfer Partners table:
            // 2.49:1 at /60, and nothing but "dash" for a screen reader on a
            // figure that is the whole reason the row is there.
            <span className="text-sm text-muted-foreground">
              <span aria-hidden>—</span>
              <span className="sr-only">{t("optionNoPrice")}</span>
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

/** The three ways a card ends up with no number. They differ only in wording,
 *  and each says which of the three it is rather than defaulting to blaming
 *  the chart. */
function NoPrice({ title, detail }: { title: string; detail?: string }) {
  return (
    <>
      <p className="font-display text-lg font-bold text-muted-foreground sm:text-xl">{title}</p>
      {detail && (
        <p className="mt-0.5 max-w-[15rem] text-xs leading-snug text-muted-foreground">{detail}</p>
      )}
    </>
  );
}

function Price({
  quote,
  cheapest,
}: {
  quote: Quote;
  cheapest: number | null;
}) {
  const { program, points, startingAt } = quote;
  const gap = points !== null && cheapest !== null ? points - cheapest : 0;

  return (
    <>
      <p className="font-display text-2xl font-extrabold text-primary sm:text-3xl">
        {startingAt && <span className="mr-1.5 text-base font-semibold">{t("fromPrefix")}</span>}
        {formatPoints(points!)}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("pointsUnit", { currency: program.currency })}
      </p>
      {startingAt && (
        <p className="mt-0.5 max-w-[15rem] text-[11px] leading-snug text-muted-foreground">
          {t("startingAtHint")}
        </p>
      )}
      {gap === 0 ? (
        <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
          {t("cheapest")}
        </span>
      ) : (
        <p className="mt-1 text-[11px] font-medium text-muted-foreground">
          {t("vsCheapest", { diff: formatPoints(gap) })}
        </p>
      )}
    </>
  );
}

function QuoteCard({ quote, cheapest }: { quote: Quote; cheapest: number | null }) {
  const { program, points, options } = quote;
  const isCheapest = points !== null && points === cheapest;

  return (
    // `min-w-0` ở đây mới khép kín chuỗi: hàng bên trong đã có `min-w-0` và
    // tên chương trình đã `truncate`, nhưng thẻ này là grid item nên mặc định
    // `min-width: auto` vẫn kéo min-content của tên lên thành bề rộng cột.
    // "American Airlines® AAdvantage®" vì thế đẩy cột lên 312px trong khi cột
    // chỉ có 288px, làm trang trượt ngang 8px ở màn 320px.
    <li
      className={`min-w-0 rounded-2xl border bg-card p-4 sm:p-5 ${
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
          {points !== null ? (
            <Price quote={quote} cheapest={cheapest} />
          ) : options.length === 0 ? (
            // The programme's partners do not fly this route at all.
            <NoPrice title={t("noRoutingShort")} detail={t("noRouting")} />
          ) : program.pricing.kind === "unquotable" ? (
            <NoPrice title={t(program.pricing.labelKey)} detail={t(program.pricing.hintKey)} />
          ) : options.every((o) => o.needsFeeder) ? (
            // The chart is fine; it stops applying once a domestic hop is in
            // the ticket. Blaming a missing cabin rate sent every non-gateway
            // city the wrong explanation.
            <NoPrice title={t("feederOnlyShort")} detail={t("feederNote")} />
          ) : (
            <NoPrice title={t("notPublished")} />
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
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {t("optionsCaveat")}
          </p>
          <ul className="mt-2 grid gap-1.5">
            {options.map((option) => (
              <OptionRow
                // The airports alone are not unique: Toronto–Beijing appears
                // twice, once on Air China against the fixed chart and once on
                // Air Canada priced dynamically. Sharing a key made React keep
                // a stale row when the destination changed, so a leftover
                // "YYZ → PEK" turned up on searches to other cities.
                key={`${option.routing.join("-")}-${option.carriers
                  .map((c) => c.code)
                  .join("")}${option.dynamicPrice ? "-dyn" : ""}`}
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
  // Sửa tham số trên URL hiện có thay vì dựng lại query từ đầu: dựng lại sẽ xoá
  // `utm_*` của chiến dịch dẫn người đọc tới đây, ngay lần đầu họ đổi điểm đến.
  // Cùng lý do và cùng cách làm như `bank-account-finder`.
  function update(patch: Partial<Selection>) {
    const next = { ...selection, ...patch };
    const params = new URLSearchParams(searchParams);
    params.set("origin", next.origin);
    params.set("destination", next.destination);
    params.set("cabin", next.cabin);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  const originAirport = ORIGINS.find((a) => a.code === origin)!;
  const destinationAirport = DESTINATIONS.find((a) => a.code === destination)!;

  const quotes = useMemo(
    () => quoteRoute(originAirport, destinationAirport, cabin),
    [originAirport, destinationAirport, cabin]
  );

  const cheapest = quotes.find((q) => q.points !== null)?.points ?? null;
  const cabinLabel = t(CABINS.find((c) => c.id === cabin)!.labelKey);
  // Ngày CŨ NHẤT, không phải mới nhất. `.at(-1)` sau `.sort()` lấy ngày tươi
  // nhất trong sáu chương trình, nên trang tuyên bố "Số liệu kiểm tra ngày
  // 23/08" trong khi năm chương trình còn lại lần cuối kiểm là 09/08 — hai
  // tuần trước. Trên một trang award chart thì dữ liệu cũ chính là kiểu hỏng
  // đáng sợ nhất, nên con số trung thực là cái cũ nhất: nó đúng cho mọi dòng
  // bên dưới, còn ngày mới nhất chỉ đúng cho một dòng.
  const verifiedOn = PROGRAMS.map((p) => p.verifiedOn).sort()[0];

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
          <span id="cabin-label" className="text-sm font-medium text-foreground/80">
            {t("cabinLabel")}
          </span>
          {/* One equal column per cabin, at every width. The previous
              flex-wrap + 50% basis put two on the first row and left the third
              alone on a row of its own, stretched to full width and shorter
              than the other two — a segmented control whose three segments were
              three different sizes. A grid stays even whatever CABINS holds,
              and items-stretch keeps the row heights equal when a longer label
              like "Premium Economy" wraps to two lines. */}
          <div
            role="group"
            aria-labelledby="cabin-label"
            className="mt-1.5 grid auto-cols-fr grid-flow-col items-stretch gap-2"
          >
            {CABINS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={cabin === c.id}
                onClick={() => update({ cabin: c.id })}
                className={`cursor-pointer rounded-lg border px-2 py-2 text-sm font-medium transition-colors sm:px-3 ${
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

      <div className="mt-8" aria-live="polite">
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

        <p className="mt-4 text-xs text-muted-foreground">{t("verifiedOn", { date: formatDate(verifiedOn) })}</p>

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
