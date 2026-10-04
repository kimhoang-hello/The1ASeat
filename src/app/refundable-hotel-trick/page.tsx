import type { Metadata } from "next";
import { ArrowDown, ArrowUp, Check, Warning, X } from "@phosphor-icons/react/ssr";
import { PostToc } from "@/components/blog/post-toc";
import { PageHeader } from "@/components/layout/page-header";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { JsonLd } from "@/components/seo/json-ld";
import { FlowChip, FlowChips, chipToneClass } from "@/components/refundable-hotel-trick/flow-chips";
import { RhtCalculator } from "@/components/refundable-hotel-trick/rht-calculator";
import { getCreditCardOffers, getPosts, type CreditCardOffer } from "@/lib/content";
import { cashOutCents, formatDollars, formatPoints, rateLabel } from "@/lib/cash-out";
import { formatDate } from "@/lib/format-date";
import {
  RHT_FLOW,
  RHT_LAST_UPDATED,
  RHT_PATH,
  RHT_PENDING_POSTED,
  RHT_PENDING_POSTED_ANCHOR,
  RHT_PICKER_ANCHOR,
  RHT_POINTS_PROGRAMS,
  RHT_PROGRAMS,
  rhtCards,
  rhtProgram,
  valueLabel,
  type RhtProgram,
  type RhtStep,
} from "@/lib/refundable-hotel-trick";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const t = translate("rht");
const seo = translate("seo");
const next = translate("nextSteps");

export const metadata: Metadata = pageMetadata({
  title: seo("rhtTitle"),
  description: seo("rhtDescription"),
  path: RHT_PATH,
});

// Khối thẻ ở cuối mỗi workflow đọc Contentful — cùng nhịp ISR với các trang
// công cụ khác, để thẻ mới hay thẻ bị gỡ hiện ra mà không cần deploy.
export const revalidate = 60;

/**
 * Bài nền tảng có nhắc RHT cho Scene+™, Aventura® và TD Rewards®. Tìm theo slug
 * lúc render: bài đổi slug hay bị gỡ thì link tự biến mất thay vì thành 404.
 */
const POINTS_101_SLUG = "canadian-credit-card-points-101-nen-tich-diem-nao";

/** Khoảng cách chung giữa các khối lớn của trang. */
const BLOCK = "border-t border-border pt-12";

/** Id các khối không phải workflow — đích của mục lục. */
const SECTION = {
  before: "truoc-khi-bat-dau",
  calculator: "calculator",
  table: "so-sanh-nhanh",
  disclaimer: "luu-y",
} as const;

/** Mục lục dính bên phải từ `xl`, theo đúng thứ tự các khối trên trang. */
function tocItems() {
  return [
    { id: SECTION.before, text: t("beforeTitle") },
    ...RHT_PROGRAMS.flatMap((program) => [
      { id: program.anchor, text: program.heading },
      ...(program.id === "scene" ? [{ id: RHT_PENDING_POSTED_ANCHOR, text: t("tocCompare") }] : []),
    ]),
    { id: SECTION.calculator, text: t("tocCalculator") },
    { id: SECTION.table, text: t("tableTitle") },
    { id: SECTION.disclaimer, text: t("disclaimerTitle") },
  ];
}

/* ---------------------------------------------------------------- Hero --- */

/**
 * Năm bước chung của RHT, dạng stepper năm cột thay vì chuỗi chip: năm chip có
 * mũi tên không vừa một hàng 375px và gãy dòng giữa chừng, còn năm cột thì vừa
 * cả ở 320px.
 */
function FlowStepper() {
  return (
    <div>
      <ol aria-label={t("flowLabel")} className="grid grid-cols-5">
        {RHT_FLOW.map((chip, index) => (
          <li key={chip.label} className="relative flex flex-col items-center text-center">
            {index > 0 && (
              <span aria-hidden className="absolute right-1/2 top-4 h-px w-full bg-border" />
            )}
            <span className="relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-primary">
              {index + 1}
            </span>
            <span className="mt-2 text-xs font-bold text-foreground sm:text-sm">{chip.label}</span>
          </li>
        ))}
      </ol>
      {/* Sơ đồ chung không có Product Switch, mà với TD® đó là bước bắt buộc
          trước khi cancel — người đọc lấy sơ đồ này làm checklist là cancel
          sớm (Codex bắt, 04/10/2026). */}
      <p className="mt-4 text-sm text-muted-foreground">{t("flowNote")}</p>
    </div>
  );
}

/** Dòng giá trị dưới tên chương trình: tỷ lệ, hoặc "Annual Travel Credit". */
function programValue(program: RhtProgram): string {
  return program.centsPerPoint === null
    ? (program.pickerValue ?? "")
    : rateLabel(program.centsPerPoint);
}

/**
 * Bốn thẻ chọn chương trình — link neo xuống đúng workflow, không phải tab.
 * Cả bốn hướng dẫn nằm sẵn trong HTML: không cần JS để đọc, Google đọc được
 * hết, và nút Back của trình duyệt đưa người đọc về lại đây.
 *
 * Mỗi thẻ mang luôn quy tắc cốt lõi ("PENDING → REDEEM"), để một cái liếc qua
 * khu này đã thấy đủ bốn luật quan trọng nhất của trang.
 */
function ProgramPicker() {
  return (
    <section id={RHT_PICKER_ANCHOR} className="scroll-mt-chrome">
      <h2 className="font-display text-2xl font-bold text-foreground">{t("pickerTitle")}</h2>
      <ul className="mt-5 grid grid-cols-1 gap-3 min-[22.5rem]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {RHT_PROGRAMS.map((program) => (
          <li key={program.id}>
            <a
              href={`#${program.anchor}`}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary sm:p-5"
            >
              <span className="font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
                {program.name}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">{programValue(program)}</span>
              {/* Mỗi cụm một khối không gãy: "TRAVEL CREDIT" vỡ đôi qua hai
                  dòng ở thẻ hẹp thì đọc thành hai bước. Mũi tên đứng riêng nên
                  dòng chỉ gãy quanh nó. Cụm dài nhất ("PRODUCT SWITCH", ~115px)
                  vừa thẻ hai cột từ 360px; dưới đó lưới về một cột. */}
              <span className="mt-3 text-xs font-bold leading-relaxed text-foreground">
                {program.rule.map((step, index) => (
                  <span key={step}>
                    {index > 0 && " → "}
                    <span className="whitespace-nowrap">{step}</span>
                  </span>
                ))}
              </span>
              <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primary">
                {t("pickerCta")}
                <ArrowDown size={14} weight="bold" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------- Before you start */

function BeforeYouStart() {
  const checks = [t("beforeCheckDeadline"), t("beforeCheckCancellation"), t("beforeCheckRefund")];
  return (
    <section
      id={SECTION.before}
      aria-labelledby={`${SECTION.before}-title`}
      className="scroll-mt-chrome rounded-2xl border border-warning/30 bg-warning-soft p-5 sm:p-6"
    >
      <h2
        id={`${SECTION.before}-title`}
        className="flex items-center gap-2 font-display text-xl font-bold text-foreground"
      >
        <Warning size={24} weight="fill" className="shrink-0 text-warning" aria-hidden />
        {t("beforeTitle")}
      </h2>
      <p className="mt-3 text-base text-foreground">{t("beforeMustBe")}</p>
      <div className="mt-2">
        <FlowChip chip={{ label: "FULLY REFUNDABLE", tone: "good" }} withIcon />
      </div>
      <p className="mt-4 text-base text-foreground">{t("beforeCheck")}</p>
      <ul className="mt-2 space-y-1.5">
        {checks.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 text-base font-semibold text-foreground"
          >
            <Check size={18} weight="bold" className="shrink-0 text-success" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-base text-foreground">
        <X size={18} weight="bold" className="shrink-0 text-destructive" aria-hidden />
        {t("beforeNoNonRefundable")}
      </p>
      <p className="mt-4 border-t border-warning/30 pt-4 text-base font-bold text-warning">
        {t("beforeStop")}
      </p>
    </section>
  );
}

/* ------------------------------------------------------ Program workflow */

/** "Rate: 1 point = 0.5¢", kèm kênh khi tỷ lệ chỉ đúng qua một kênh (TD®). */
function rateLine(program: RhtProgram): string | null {
  if (program.centsPerPoint === null) return null;
  const rate = rateLabel(program.centsPerPoint);
  return program.rateChannel
    ? t("rateChannel", { channel: program.rateChannel, rate })
    : t("rate", { rate });
}

/** Quy tắc cốt lõi của chương trình — khối nổi nhất của mỗi workflow. */
function KeyRule({ program }: { program: RhtProgram }) {
  const { keyRule } = program;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <FlowChips
        chips={program.rule.map((label) => ({ label, tone: "good" as const }))}
        label={keyRule.title}
      />
      <div className="mt-3 space-y-1.5">
        {keyRule.body.map((line) => (
          <p key={line} className="text-base font-semibold leading-relaxed text-foreground">
            {line}
          </p>
        ))}
      </div>
      {keyRule.verdicts && (
        <ul className="mt-4 space-y-2">
          {keyRule.verdicts.map((row) => (
            <li key={row.state} className="flex flex-wrap items-center gap-1.5">
              <FlowChip chip={{ label: row.state }} />
              <VerdictArrow />
              <FlowChip chip={{ label: row.verdict, tone: row.tone }} withIcon />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Mũi tên nhỏ giữa trạng thái và việc phải làm. */
function VerdictArrow() {
  return (
    <span aria-hidden className="px-0.5 text-sm font-bold text-muted-foreground">
      →
    </span>
  );
}

function StepBody({ step, program }: { step: RhtStep; program: RhtProgram }) {
  const rate = step.showRate ? rateLine(program) : null;
  return (
    <div className="mt-1.5 space-y-3">
      {step.body.map((line) => (
        <p key={line} className="text-base leading-relaxed text-foreground/90">
          {line}
        </p>
      ))}
      {step.flow && (
        <FlowChips
          chips={step.flow.chips}
          direction={step.flow.direction}
          size={step.flow.direction === "column" ? "sm" : "md"}
        />
      )}
      {step.bodyAfter?.map((line) => (
        <p key={line} className="text-base leading-relaxed text-foreground/90">
          {line}
        </p>
      ))}
      {rate && <p className="text-sm font-semibold text-foreground">{rate}</p>}
      {step.note && <p className="text-sm text-muted-foreground">{step.note}</p>}
      {step.warnings?.map((line) => (
        <p
          key={line}
          className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm font-semibold leading-relaxed text-warning"
        >
          <Warning size={18} weight="fill" className="mt-px shrink-0" aria-hidden />
          <span>{line}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Timeline dọc: số thứ tự trong vòng tròn, một đường kẻ nối các bước. Dọc ở mọi
 * bề ngang — tám bước nằm ngang thì trên desktop chữ mỗi bước còn vài từ một
 * dòng, trên điện thoại thì không nằm ngang được.
 */
function StepTimeline({ program }: { program: RhtProgram }) {
  return (
    <ol
      aria-label={t("stepsLabel", { program: program.heading })}
      className="rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      {program.steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-4 pb-7 last:pb-0">
          {index < program.steps.length - 1 && (
            <span
              aria-hidden
              className="absolute bottom-0 left-4 top-9 w-px -translate-x-1/2 bg-border"
            />
          )}
          <span
            aria-hidden
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary"
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="font-display text-lg font-bold leading-snug text-foreground">
              <span className="sr-only">{t("stepLabel", { n: index + 1 })}: </span>
              {step.title}
            </h3>
            <StepBody step={step} program={program} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "50,000 points = $500" — tính từ tỷ lệ, không viết tay. */
function Examples({ program }: { program: RhtProgram }) {
  if (program.centsPerPoint === null || program.examplePoints.length === 0) return null;
  const centsPerPoint = program.centsPerPoint;
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-foreground/80">{t("examples")}</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {program.examplePoints.map((points) => (
          <li
            key={points}
            className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-foreground"
          >
            {formatPoints(points)} points = {formatDollars(cashOutCents(points, centsPerPoint))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Thẻ dùng được workflow này, đọc từ danh sách thẻ đang phục vụ. Không có thẻ
 * nào thì khối biến mất — cùng luật với mọi khối "đi tiếp" trên site.
 */
function ProgramCards({ program, cards }: { program: RhtProgram; cards: CreditCardOffer[] }) {
  if (cards.length === 0) return null;
  return (
    <NextSteps title={program.cardsTitle} headingLevel="h3" compact>
      {cards.map((card) => (
        <StepLink
          key={card.slug}
          href={`/credit-cards/${card.slug}`}
          label={card.name}
          description={card.cardType}
        />
      ))}
    </NextSteps>
  );
}

function ProgramSection({ program, cards }: { program: RhtProgram; cards: CreditCardOffer[] }) {
  const rate = rateLine(program);
  return (
    <section
      id={program.anchor}
      aria-labelledby={`${program.anchor}-title`}
      className={`scroll-mt-chrome ${BLOCK}`}
    >
      <h2
        id={`${program.anchor}-title`}
        className="font-display text-2xl font-bold text-foreground sm:text-3xl"
      >
        {program.heading}
      </h2>
      <p className="mt-2 text-base text-muted-foreground">
        {t("purpose", { purpose: program.purpose })}
      </p>
      {rate && <p className="mt-1 text-base font-semibold text-foreground">{rate}</p>}
      <Examples program={program} />

      <div className="mt-6 space-y-5">
        <KeyRule program={program} />
        <StepTimeline program={program} />

        <div>
          <p className="text-sm font-semibold text-foreground/80">{t("summary")}</p>
          <FlowChips chips={program.summary} size="sm" className="mt-2" label={t("summary")} />
        </div>

        <ProgramCards program={program} cards={cards} />
      </div>

      <a
        href={`#${RHT_PICKER_ANCHOR}`}
        className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowUp size={14} weight="bold" aria-hidden />
        {t("backToPicker")}
      </a>
    </section>
  );
}

/* ------------------------------------------------------ CIBC® vs Scene+™ */

/**
 * Chỗ người đọc dễ làm sai nhất, nên có khối riêng: hai chuỗi đặt cạnh nhau,
 * căn đỉnh, để mắt thấy ngay REDEEM của CIBC® nằm ở hàng mà Scene+™ còn đang
 * đợi POSTED. Hai cột kể cả trên điện thoại — xếp chồng thì mất đúng phép so
 * sánh ngang đó, và chữ trong mỗi chip đủ ngắn để vừa cột 320px.
 */
function PendingVsPosted() {
  return (
    <section
      id={RHT_PENDING_POSTED_ANCHOR}
      aria-labelledby={`${RHT_PENDING_POSTED_ANCHOR}-title`}
      className={`scroll-mt-chrome ${BLOCK}`}
    >
      <span className="inline-flex rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
        {t("compareBadge")}
      </span>
      <h2
        id={`${RHT_PENDING_POSTED_ANCHOR}-title`}
        className="mt-3 font-display text-2xl font-bold text-foreground sm:text-3xl"
      >
        {t("compareTitle")}
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5">
        {RHT_PENDING_POSTED.map(({ program: id, sequence }) => {
          const program = rhtProgram(id);
          return (
            <div key={id} className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <h3 className="font-display text-base font-bold leading-snug text-foreground sm:text-xl">
                {program.name}
              </h3>
              {/* Khối chip trải hết bề ngang cột và cao bằng nhau ở hai cột, để
                  hàng thứ ba thẳng hàng: REDEEM bên này, POSTED bên kia. */}
              <ol aria-label={program.name} className="mt-4 flex flex-col">
                {sequence.map((chip, index) => (
                  <li key={chip.label} className="flex flex-col items-stretch">
                    {index > 0 && (
                      <ArrowDown
                        size={18}
                        weight="bold"
                        className="mx-auto my-1 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <span
                      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-center text-sm font-bold sm:text-base ${chipToneClass(chip.tone)}`}
                    >
                      {chip.label}
                      {chip.tone === "go" && <Check size={16} weight="bold" aria-hidden />}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-success/30 bg-success-soft p-5 sm:p-6">
        <p className="text-sm font-semibold text-success">{t("compareTakeaway")}</p>
        <ul className="mt-2 space-y-1.5">
          <li className="font-display text-lg font-bold text-foreground sm:text-xl">
            {t("compareCibc")}
          </li>
          <li className="font-display text-lg font-bold text-foreground sm:text-xl">
            {t("compareScene")}
          </li>
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- Calculator ---- */

function CalculatorSection() {
  return (
    <section
      id={SECTION.calculator}
      aria-labelledby={`${SECTION.calculator}-title`}
      className={`scroll-mt-chrome ${BLOCK}`}
    >
      <h2
        id={`${SECTION.calculator}-title`}
        className="font-display text-2xl font-bold text-foreground sm:text-3xl"
      >
        {t("calcTitle")}
      </h2>
      <div className="mt-6">
        <RhtCalculator
          programs={RHT_POINTS_PROGRAMS.map((program) => ({
            id: program.id,
            label: program.calculatorLabel,
            pointsName: program.pointsName,
            centsPerPoint: program.centsPerPoint,
          }))}
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------- Quick comparison --- */

/**
 * Bảng bốn cột từ `sm`; dưới `sm` là bốn thẻ — bảng bốn cột ở 375px phải cuộn
 * ngang, và dòng ghi chú của TD® không có chỗ đứng. Hai bản dựng từ CÙNG một
 * mảng, và bản bị ẩn là `display: none` nên screen reader chỉ đọc một bản.
 */
function QuickComparison() {
  const columns = [t("colValue"), t("colWhen"), t("colBooking")];
  return (
    <section
      id={SECTION.table}
      aria-labelledby={`${SECTION.table}-title`}
      className={`scroll-mt-chrome ${BLOCK}`}
    >
      <h2
        id={`${SECTION.table}-title`}
        className="font-display text-2xl font-bold text-foreground sm:text-3xl"
      >
        {t("tableTitle")}
      </h2>

      <ul className="mt-6 space-y-3 sm:hidden">
        {RHT_PROGRAMS.map((program) => (
          <li key={program.id} className="rounded-2xl border border-border bg-card p-4">
            <a
              href={`#${program.anchor}`}
              className="font-display text-base font-bold text-primary hover:underline"
            >
              {program.shortName}
            </a>
            <dl className="mt-2 divide-y divide-border">
              {[valueLabel(program), program.compare.when, program.compare.booking].map(
                (value, i) => (
                  <div key={columns[i]} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 text-sm">
                    <dt className="text-muted-foreground">{columns[i]}</dt>
                    <dd className="font-semibold text-foreground">{value}</dd>
                  </div>
                ),
              )}
            </dl>
            {program.compare.note && (
              <p className="mt-2 text-sm font-semibold text-warning">{program.compare.note}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="relative mt-6 hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t("colProgram")}
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {RHT_PROGRAMS.map((program) => (
              <tr key={program.id} className="align-top">
                <th scope="row" className="px-4 py-3.5 font-display text-base font-bold">
                  <a href={`#${program.anchor}`} className="text-primary hover:underline">
                    {program.shortName}
                  </a>
                </th>
                <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-foreground">
                  {valueLabel(program)}
                </td>
                <td className="px-4 py-3.5 font-semibold text-foreground">
                  {program.compare.when}
                </td>
                <td className="px-4 py-3.5 text-foreground">
                  {program.compare.booking}
                  {program.compare.note && (
                    <span className="mt-1 block text-xs font-semibold text-warning">
                      {program.compare.note}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Disclaimer --- */

function Disclaimer() {
  return (
    <section
      id={SECTION.disclaimer}
      aria-labelledby={`${SECTION.disclaimer}-title`}
      className={`scroll-mt-chrome ${BLOCK}`}
    >
      <h2
        id={`${SECTION.disclaimer}-title`}
        className="font-display text-xl font-bold text-foreground"
      >
        {t("disclaimerTitle")}
      </h2>
      <div className="mt-3 max-w-prose space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>{t("disclaimer1")}</p>
        <p>{t("disclaimer2")}</p>
        <p>{t("disclaimer3")}</p>
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground/80">
        {t("lastUpdated", { date: formatDate(RHT_LAST_UPDATED) })}
      </p>
    </section>
  );
}

/* --------------------------------------------------------------- Page --- */

export default async function RefundableHotelTrickPage() {
  // Cả hai chỉ nuôi khối link phụ — bốn workflow và calculator là dữ liệu tĩnh.
  // Contentful nấc đúng lúc trang dựng lại (webhook xoá cache bằng `expire: 0`)
  // thì rơi về `[]` + log, như trang bài viết: khối thẻ và link bài nền tảng
  // biến mất, còn hướng dẫn vẫn hiện. Bắt ở đây, KHÔNG trong hàm cache — không
  // thì mảng rỗng bị cache như dữ liệu thật (AGENTS.md, audit 03/10 đợt 0).
  const [offers, posts] = await Promise.all([
    getCreditCardOffers().catch((error) => {
      console.error("[refundable-hotel-trick] không tải được danh sách thẻ, bỏ khối thẻ", error);
      return [];
    }),
    getPosts().catch((error) => {
      console.error(
        "[refundable-hotel-trick] không tải được bài viết, bỏ link bài nền tảng",
        error,
      );
      return [];
    }),
  ]);
  const points101 = posts.find((post) => post.slug === POINTS_101_SLUG);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [breadcrumbJsonLd([{ name: t("title"), path: RHT_PATH }])],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Thân trang sát trái cùng mép với `PageHeader` (DESIGN-SYSTEM 5.1.2),
          cột chữ chặn ở 48rem cho dễ đọc. Bề ngang dôi ra từ `xl` dành cho mục
          lục dính — cùng cách trang bài viết dùng phần rộng thêm, và cùng
          component. Dưới `xl` thẻ chọn chương trình ở đầu trang làm việc của
          mục lục. */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-page xl:grid xl:grid-cols-[minmax(0,48rem)_16rem] xl:gap-16">
          <div className="min-w-0 max-w-3xl space-y-12">
            <FlowStepper />
            <ProgramPicker />
            <BeforeYouStart />

            {RHT_PROGRAMS.map((program) => (
              <div key={program.id} className="space-y-12">
                <ProgramSection program={program} cards={rhtCards(program, offers)} />
                {/* Ngay sau Scene+™, khi người đọc vừa đọc xong cả hai luật. */}
                {program.id === "scene" && <PendingVsPosted />}
              </div>
            ))}

            <CalculatorSection />
            <QuickComparison />

            <NextSteps title={next("title")} className={BLOCK}>
              {points101 && (
                <StepLink
                  href={`/blog/${points101.slug}`}
                  label={points101.title}
                  description={points101.excerpt}
                />
              )}
              <StepLink
                href="/calculator"
                label={next("calculatorLabel")}
                description={next("calculatorDescription")}
              />
              <StepLink
                href="/credit-cards"
                label={next("cardsLabel")}
                description={next("cardsDescription")}
              />
            </NextSteps>

            <Disclaimer />
          </div>

          {/* `aside` không dính, `nav` bên trong mới dính — xem chú thích ở trang
            bài viết (`blog/[slug]/page.tsx`). */}
          <aside className="hidden xl:block">
            <PostToc
              items={tocItems()}
              className="sticky top-chrome max-h-[calc(100vh-10rem)] scroll-py-2 overflow-y-auto overscroll-contain pb-2"
            />
          </aside>
        </div>
      </section>
    </>
  );
}
