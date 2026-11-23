import { ClockCounterClockwise, TrendUp } from "@phosphor-icons/react/ssr";
import type { CreditCardOffer } from "@/lib/content";
import { rebateHistory } from "@/lib/offer-history";
import {
  dayMs as rebateDayMs,
  DAY_MS as REBATE_DAY_MS,
  type RebateHistory as RebateHistoryData,
  type RebateSegment,
} from "@/lib/rebate-history";
import { formatDate, todayInSiteZone } from "@/lib/format-date";
import { t as translate } from "@/lib/t";

const t = translate("offerHistory");

const money = (amount: number) => `$${amount.toLocaleString("en-US")}`;
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function rangeOf(segment: RebateSegment): string {
  if (segment.current) return `${formatDate(segment.from)} – ${t("rebateNow")}`;
  if (segment.days === 1) return formatDate(segment.from);
  // Qua năm thì đầu khoảng cũng phải có năm: "01/11 – 03/01/2027" đọc thành tháng 11/2027.
  const start = segment.from.slice(0, 4) === segment.to.slice(0, 4) ? shortDate(segment.from) : formatDate(segment.from);
  return `${start} – ${formatDate(segment.to)}`;
}

/** Dòng phụ dưới "Cao nhất"/"Thấp nhất": đang ở mức này, hoặc lần gần nhất. */
function extremeNote(history: RebateHistoryData, amount: number): string {
  if (history.current === amount) return t("rebateAtLevel");
  const hits = history.segments.filter((segment) => segment.amount === amount);
  const last = hits[hits.length - 1];
  return hits.length > 1 ? t("rebateTimes", { count: hits.length, range: rangeOf(last) }) : rangeOf(last);
}

/**
 * Lịch sử rebate FinlyWealth trên trang thẻ (23/11/2026, tác giả chọn phương án A:
 * biểu đồ, đặt sau "Thông tin nhanh", thẻ một mức thì một câu, nhãn chỉ khi đang cao nhất).
 *
 * Thẻ không có rebate thì không hiện. Thẻ mới thấy một mức thì rút về một câu.
 * Từ hai mức trở lên: ba con số + biểu đồ bậc thang + bảng các lần đổi.
 */
export function RebateHistory({ offer, className = "" }: { offer: CreditCardOffer; className?: string }) {
  const today = todayInSiteZone();
  const history = rebateHistory(offer.slug, offer.rebate, today);
  if (!history) return null;

  if (history.distinct < 2) {
    const segment = history.segments[history.segments.length - 1];
    return (
      <p
        className={`flex items-start gap-2 rounded-xl bg-secondary px-4 py-3 text-sm text-foreground/90 ${className}`}
      >
        <ClockCounterClockwise size={18} className="mt-0.5 shrink-0 text-primary" />
        <span>
          {t(history.unchanged ? "rebateSingle" : "rebateSingleSince", {
            amount: money(history.current),
            since: formatDate(segment.from),
            days: segment.days,
          })}
        </span>
      </p>
    );
  }

  const currentSegment = history.segments[history.segments.length - 1];
  const stats = [
    { label: t("rebateCurrent"), value: history.current, note: t("rebateSince", { date: formatDate(currentSegment.from) }) },
    { label: t("rebateHighest"), value: history.max, note: extremeNote(history, history.max) },
    { label: t("rebateLowest"), value: history.min, note: extremeNote(history, history.min) },
  ];

  return (
    <section aria-labelledby="lich-su-rebate" className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 id="lich-su-rebate" className="font-display text-xl font-bold text-foreground">
          {t("rebateTitle")}
        </h2>
        {history.current >= history.max && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
            <TrendUp size={14} weight="bold" />
            {t("rebatePeak")}
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 border-y border-border">
        {stats.map((stat, i) => (
          <div key={stat.label} className={`min-w-0 py-3 pr-3 ${i > 0 ? "border-l border-border pl-3 sm:pl-4" : ""}`}>
            <dt className="text-sm font-semibold text-foreground">{stat.label}</dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums text-foreground sm:text-2xl">{money(stat.value)}</dd>
            <dd className="mt-0.5 text-xs leading-snug text-muted-foreground">{stat.note}</dd>
          </div>
        ))}
      </dl>

      <RebateChart history={history} today={today} className="mt-5" />

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-primary">
          {t("rebateShowAll", { count: history.segments.length })}
        </summary>
        <table className="mt-2 w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-2 font-semibold">{t("rebateColAmount")}</th>
              <th className="py-1.5 pr-2 font-semibold">{t("rebateColPeriod")}</th>
              <th className="whitespace-nowrap py-1.5 text-right font-semibold">{t("rebateColDays")}</th>
            </tr>
          </thead>
          <tbody>
            {[...history.segments].reverse().map((segment) => (
              <tr key={segment.from} className="border-b border-border align-top">
                <td className="py-2 pr-2 font-semibold text-foreground">
                  {segment.amount === null ? (
                    <span className="font-normal text-muted-foreground">{t("rebateNone")}</span>
                  ) : (
                    money(segment.amount)
                  )}
                </td>
                <td className="py-2 pr-2 text-foreground/90">
                  {rangeOf(segment)}
                  {segment.first && <span className="text-xs text-muted-foreground"> ({t("rebateTrackingStart")})</span>}
                  {segment.live && <span className="text-xs text-muted-foreground"> ({t("rebateFromPage")})</span>}
                </td>
                <td className="py-2 text-right text-foreground/90">{segment.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted-foreground">
        {t("rebateFootnote", { since: formatDate(history.trackedSince) })}
      </p>
    </section>
  );
}

/**
 * Biểu đồ bậc thang, dựng hoàn toàn ở server. Đường và vùng là SVG co giãn
 * theo bề rộng (`preserveAspectRatio="none"` + nét không co), còn chữ và chấm
 * là HTML đặt theo %, nên chữ giữ đúng cỡ trên điện thoại.
 */
function RebateChart({ history, today, className = "" }: { history: RebateHistoryData; today: string; className?: string }) {
  const { segments, max } = history;
  const x0 = rebateDayMs(segments[0].from);
  const x1 = rebateDayMs(today) + REBATE_DAY_MS;
  const xPct = (ms: number) => ((ms - x0) / (x1 - x0)) * 100;
  const step = max > 150 ? 100 : 50;
  const top = Math.ceil(max / step) * step;
  const yPct = (amount: number) => (1 - amount / top) * 100;
  const yTicks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  // Đường + vùng cho từng chuỗi đoạn liền nhau có rebate (khoảng trống làm đứt).
  const runs: RebateSegment[][] = [];
  let run: RebateSegment[] = [];
  for (const segment of segments) {
    if (segment.amount === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push(segment);
  }
  if (run.length) runs.push(run);

  const sx = (ms: number) => (xPct(ms) * 10).toFixed(2);
  const paths = runs.map((r) => {
    let line = "";
    let area = "";
    r.forEach((segment, i) => {
      const a = sx(rebateDayMs(segment.from));
      const b = sx(rebateDayMs(segment.to) + REBATE_DAY_MS);
      const y = yPct(segment.amount!).toFixed(2);
      line += `${i === 0 ? "M" : "L"}${a},${y}L${b},${y}`;
      area += `${i === 0 ? `M${a},100L` : "L"}${a},${y}L${b},${y}`;
    });
    area += `L${sx(rebateDayMs(r[r.length - 1].to) + REBATE_DAY_MS)},100Z`;
    return { line, area };
  });

  // Vạch ngày: ngày bắt đầu, đầu mỗi tháng (khi không chen chữ), và hôm nay.
  const xTicks: { pct: number; label: string }[] = [];
  const start = new Date(x0);
  let month = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
  let lastPct = 0;
  while (month < x1) {
    const pct = xPct(month);
    // Vạch đầu cách nhãn ngày bắt đầu (canh trái, ~33px) xa hơn các vạch sau:
    // vùng vẽ ở màn 320px chỉ ~200px, dưới 26% là chồng chữ.
    if (pct - lastPct >= (lastPct === 0 ? 26 : 16) && pct <= 82) {
      xTicks.push({ pct, label: shortDate(new Date(month).toISOString()) });
      lastPct = pct;
    }
    const d = new Date(month);
    month = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }

  const maxSegments = segments.filter((segment) => segment.amount === max);
  const lastMax = maxSegments[maxSegments.length - 1];
  const maxMid = Math.min(
    Math.max((xPct(rebateDayMs(lastMax.from)) + xPct(rebateDayMs(lastMax.to) + REBATE_DAY_MS)) / 2, 8),
    92,
  );
  const first = segments[0];

  return (
    <div
      role="img"
      aria-label={t("rebateChartLabel", {
        since: formatDate(history.trackedSince),
        min: money(history.min),
        max: money(history.max),
        current: money(history.current),
      })}
      className={`relative h-40 pb-6 pl-10 pr-12 pt-5 ${className}`}
    >
      <div className="relative h-full w-full">
        {/* Khoảng không có rebate: gạch chéo, không nối đường. */}
        {segments
          .filter((segment) => segment.amount === null)
          .map((segment) => (
            <div
              key={segment.from}
              className="absolute inset-y-0"
              style={{
                left: `${xPct(rebateDayMs(segment.from))}%`,
                width: `${xPct(rebateDayMs(segment.to) + REBATE_DAY_MS) - xPct(rebateDayMs(segment.from))}%`,
                backgroundImage: "repeating-linear-gradient(135deg, var(--border) 0 2px, transparent 2px 6px)",
              }}
            />
          ))}

        <svg
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          aria-hidden
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {paths.map((p) => (
            <path key={p.area} d={p.area} className="fill-success-soft" />
          ))}
          {yTicks.map((v) => (
            <line
              key={v}
              x1={0}
              x2={1000}
              y1={yPct(v)}
              y2={yPct(v)}
              className="stroke-border"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {paths.map((p) => (
            <path
              key={p.line}
              d={p.line}
              fill="none"
              className="stroke-success"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {segments.map((segment) => {
            const a = xPct(rebateDayMs(segment.from)) * 10;
            const b = xPct(rebateDayMs(segment.to) + REBATE_DAY_MS) * 10;
            return (
              <rect key={segment.from} x={a} y={0} width={Math.max(b - a, 1)} height={100} fill="transparent">
                <title>
                  {`${segment.amount === null ? t("rebateNone") : money(segment.amount)} · ${rangeOf(segment)} · ${t("rebateDays", { days: segment.days })}`}
                </title>
              </rect>
            );
          })}
        </svg>

        {/* Trục dọc */}
        {yTicks.map((v) => (
          <span
            key={v}
            className="absolute right-full mr-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
            style={{ top: `${yPct(v)}%` }}
          >
            {money(v)}
          </span>
        ))}

        {/* Trước ngày bắt đầu theo dõi: nét chấm, vì không biết. */}
        <span
          className="absolute right-full w-1.5 border-t-2 border-dotted border-success/50"
          style={{ top: `calc(${yPct(first.amount!)}% - 1px)` }}
        />

        {/* Mức cao nhất (khi không phải mức hiện tại) */}
        {history.current < max && (
          <span
            className="absolute -translate-x-1/2 -translate-y-full pb-1 text-xs font-bold tabular-nums text-foreground"
            style={{ left: `${maxMid}%`, top: `${yPct(max)}%` }}
          >
            {money(max)}
          </span>
        )}

        {/* Điểm cuối + nhãn mức hiện tại */}
        <span
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success ring-2 ring-background"
          style={{ left: "100%", top: `${yPct(history.current)}%` }}
        />
        <span
          className="absolute left-full ml-2.5 -translate-y-1/2 text-xs font-bold tabular-nums text-foreground"
          style={{ top: `${yPct(history.current)}%` }}
        >
          {money(history.current)}
        </span>

        {/* Trục ngang */}
        <span className="absolute left-0 top-full mt-1.5 text-[11px] tabular-nums text-muted-foreground">
          {shortDate(first.from)}
        </span>
        {xTicks.map((tick) => (
          <span
            key={tick.label}
            // Gần mép phải thì nhường chỗ cho "Hôm nay" trên điện thoại.
            className={`absolute top-full mt-1.5 -translate-x-1/2 text-[11px] tabular-nums text-muted-foreground ${tick.pct > 70 ? "max-sm:hidden" : ""}`}
            style={{ left: `${tick.pct}%` }}
          >
            {tick.label}
          </span>
        ))}
        <span className="absolute right-0 top-full mt-1.5 text-[11px] text-muted-foreground">{t("rebateToday")}</span>
      </div>
    </div>
  );
}
