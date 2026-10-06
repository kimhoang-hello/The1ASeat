import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown } from "@phosphor-icons/react/ssr";
import { PageHeader } from "@/components/layout/page-header";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { Flag } from "@/components/ui/flag";
import { UsTransferTable } from "@/components/transfer-partners/us-transfer-table";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";
import { getCreditCardOffers } from "@/lib/content";
import { cardsInProgram, creditCardsPath, getCardPointsPrograms } from "@/lib/card-points-programs";
import { PROGRAMS } from "@/lib/award-charts";
import { TRANSFER_PARTNERS, type TransferLeg } from "@/lib/transfer-partners";
import { US_TRANSFER_ISSUERS, US_TRANSFER_PARTNERS } from "@/lib/us-transfer-partners";
import { getUsCreditCards, usCardPath } from "@/lib/us-credit-cards";
import { US_CARDS_PUBLISHED } from "@/lib/feature-flags";
import { todayInSiteZone } from "@/lib/format-date";

const tp = t("transferPartners");
const next = t("nextSteps");
const seo = t("seo");

/**
 * Chương trình nào trong bảng này cũng có bảng giá trong Award Flight Finder.
 * Suy từ `PROGRAMS` chứ không chép tay: thêm một chương trình vào công cụ là
 * hàng tương ứng ở đây tự có link, và bỏ đi thì link tự mất — không có danh
 * sách thứ hai phải nhớ cập nhật song song.
 *
 * Bảng có 10 hàng còn công cụ chỉ báo giá 6 chương trình, nên bốn hàng khách
 * sạn/hàng không còn lại KHÔNG có link. Đó là chủ ý: dẫn Hilton Honors® sang
 * một công cụ không biết gì về Hilton thì tệ hơn là không dẫn.
 *
 * Bảng Mỹ dùng chung tập này: năm hàng của nó mang ĐÚNG tên của hàng Canada
 * tương ứng ("Air Canada® Aeroplan®"…), nên khớp mà không cần bảng nối thứ hai.
 * Bảng giá là của chương trình, không phải của nơi điểm đến từ đó.
 */
const QUOTABLE_PROGRAMS = new Set(
  PROGRAMS.map((program) => program.transferPartnerKey).filter(
    (key): key is string => key !== null,
  ),
);

export const metadata: Metadata = pageMetadata({
  title: seo("transferPartnersTitle"),
  description: seo("transferPartnersDescription"),
  path: "/transfer-partners",
});
export const revalidate = 60;

/**
 * The partner column pins to the left edge while the ratio columns scroll.
 * The table is 560px wide inside a ~341px scroller on a phone, so without this
 * the reader scrolls right to reach the RBC column and arrives at a ratio with
 * no idea which airline it belongs to — on the page whose whole job is
 * comparing the two issuers row by row.
 */
const STICKY_COL = "sticky left-0 z-10";

// Ô tỷ lệ của hai issuer đều TRUNG TÍNH. Trước 03/10/2026 cột Amex® mang màu
// xanh "có lợi" còn cột RBC® mang màu hổ phách "cần chú ý" — tức một cái tên
// trông như một lời đánh giá. Tiêu đề cột (logo + tên) đã nói ô nào của ai.
const BADGE_STYLES = {
  amex: "bg-secondary text-foreground",
  rbc: "bg-secondary text-foreground",
} as const;

/**
 * Hai cột của bảng, khai đúng một lần — và mảng này là NGUỒN DUY NHẤT quyết
 * định thứ tự cột: hàng logo, hàng tên cột, ô tỷ lệ trong từng hàng, và khối
 * "thẻ tích hệ này" ở cuối trang đều `map` qua nó.
 *
 * Đó là điều kiện để đảo thứ tự ở đây là đảo cả bảng. Bản đầu chỉ gom hàng
 * logo, còn hàng tên cột và `row.amex`/`row.rbc` vẫn gõ tay theo đúng thứ tự
 * cũ — nên đảo mảng sẽ cho logo Amex® đứng trên cột tỷ lệ của RBC®, sai lặng
 * lẽ trên đúng cái bảng mà cả nội dung là "hệ nào chuyển sang chương trình
 * nào". `legKey` vừa là tên trường trong `TransferPartnerRow` vừa là khoá màu
 * trong `BADGE_STYLES`, nên hai thứ đó cũng không lệch nhau được — `as const`
 * giữ nó ở kiểu chuỗi hẹp, và `row[column.legKey]` với `tint={column.legKey}`
 * là hai cửa kiểm của `tsc`: gõ sai một chữ là build đỏ, không phải cột trống.
 */
const ISSUER_COLUMNS = [
  {
    programId: "amex-mr",
    legKey: "amex",
    logo: "/images/logos/amex.svg",
    alt: "American Express®",
    logoClass: "mx-auto h-6 w-auto",
    ariaKey: "amexCardsAria",
    nameKey: "columnAmex",
  },
  {
    programId: "avion",
    legKey: "rbc",
    logo: "/images/logos/rbc.svg",
    alt: "RBC®",
    logoClass: "mx-auto h-8 w-auto",
    ariaKey: "rbcCardsAria",
    nameKey: "columnRbc",
  },
] as const;

function LegCell({ leg, tint }: { leg: TransferLeg; tint: keyof typeof BADGE_STYLES }) {
  if (!leg) {
    // The dash was 2.08:1 at /50 and, being only a dash, said nothing at all
    // to a screen reader — on the one table whose whole point is which issuer
    // reaches which programme, where "no" is half the answer. Full
    // `muted-foreground` is 5.53:1 and still the quietest thing in the row,
    // and the sr-only line spells the dash out.
    return (
      <td className="px-4 py-4 text-center text-muted-foreground">
        <span aria-hidden>{tp("noData")}</span>
        <span className="sr-only">{tp("noDataLabel")}</span>
      </td>
    );
  }
  return (
    <td className="px-2 py-3">
      <div
        className={`mx-auto flex max-w-[180px] flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-center ${BADGE_STYLES[tint]}`}
      >
        <span className="text-sm font-bold">{leg.ratio}</span>
        <span className="text-xs opacity-80">{leg.note}</span>
      </div>
    </td>
  );
}

/** Logo hệ điểm ở đầu cột, thành link khi và chỉ khi hệ đó có thẻ để lọc ra. */
function IssuerHeader({
  src,
  alt,
  className,
  programId,
  ariaLabel,
  linkable,
}: {
  src: string;
  alt: string;
  className: string;
  programId: string;
  ariaLabel: string;
  linkable: boolean;
}) {
  /* eslint-disable-next-line @next/next/no-img-element */
  const logo = <img src={src} alt={alt} className={className} />;

  if (!linkable) return logo;

  return (
    <Link
      href={creditCardsPath({ points: programId })}
      aria-label={ariaLabel}
      className="block rounded-md py-1 transition-opacity hover:opacity-70"
    >
      {logo}
    </Link>
  );
}

/**
 * Hai ô chọn đầu trang — link neo xuống bảng Canada hoặc bảng Mỹ, không phải
 * tab. Cả hai bảng nằm sẵn trong HTML: không cần JS, Google đọc được hết, nút
 * Back đưa người đọc về đây. Cùng lý do với bộ chọn của Refundable Hotel Trick.
 */
function RegionJump({
  href,
  country,
  title,
  description,
}: {
  href: string;
  country: "ca" | "us";
  title: string;
  description: string;
}) {
  return (
    <li>
      <a
        href={href}
        className="flex h-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary sm:p-5"
      >
        <span>
          <span className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Flag country={country} />
            {title}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
        </span>
        <ArrowDown size={18} weight="bold" className="shrink-0 text-primary" aria-hidden />
      </a>
    </li>
  );
}

function RegionHeading({
  id,
  country,
  children,
}: {
  id: string;
  country: "ca" | "us";
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-center gap-3 font-display text-2xl font-bold text-foreground">
      <Flag country={country} />
      {children}
    </h2>
  );
}

export default async function TransferPartnersPage() {
  // Hệ điểm nào thật sự có thẻ trên site — đọc từ chính danh sách mà bộ lọc sẽ
  // chạy trên đó, nên một link ở đây không bao giờ hứa một bộ lọc rỗng.
  const offers = await getCreditCardOffers();
  const linkablePrograms = new Set(getCardPointsPrograms(offers).map((p) => p.id));

  // Cột nào không có thẻ nào thì biến mất hẳn thay vì hiện một tiêu đề trống —
  // cùng luật với `CardNextSteps`: đường nào không có thật thì không hiện.
  const cardColumns = ISSUER_COLUMNS.map((column) => ({
    column,
    cards: cardsInProgram(offers, column.programId),
  })).filter(({ cards }) => cards.length > 0);

  // Ngày Toronto một lần cho cả trang: ô có tỷ lệ đã công bố sẽ đổi (Bilt →
  // Hyatt từ 01/01/2027) tự lật đúng ngày, trang ISR làm mới mỗi phút.
  const today = todayInSiteZone();

  // Thẻ Mỹ tích từng hệ điểm của bảng Mỹ — cùng luật với `cardColumns`: cột nào
  // site chưa có thẻ (Wells Fargo®) thì không có khối, thay vì một tiêu đề rỗng.
  // Tắt `US_CARDS_PUBLISHED` thì không có khối nào: các trang thẻ Mỹ lúc đó là
  // nháp `noindex`, và cờ phải giấu MỌI cửa vào chúng (AGENTS.md). Bảng thì vẫn
  // hiện — nó nói về ngân hàng, không trỏ tới trang thẻ nào.
  const usCards = US_CARDS_PUBLISHED ? getUsCreditCards() : [];
  const usCardColumns = US_TRANSFER_ISSUERS.map((issuer) => ({
    issuer,
    cards: issuer.currency
      ? usCards.filter((card) => card.us.rewardsCurrency === issuer.currency)
      : [],
  })).filter(({ cards }) => cards.length > 0);

  return (
    <>
      <PageHeader title={tp("title")} subtitle={tp("subtitle")} />
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label={tp("regionNavLabel")} className="mx-auto max-w-4xl">
          <ul className="grid gap-3 sm:grid-cols-2">
            <RegionJump
              href="#canada"
              country="ca"
              title={tp("canadaTitle")}
              description={tp("canadaJump", { count: TRANSFER_PARTNERS.length })}
            />
            <RegionJump
              href="#my"
              country="us"
              title={tp("usTitle")}
              description={tp("usJump", { count: US_TRANSFER_PARTNERS.length })}
            />
          </ul>
        </nav>

        <section
          id="canada"
          aria-labelledby="canada-title"
          className="mx-auto mt-12 max-w-4xl scroll-mt-chrome"
        >
          <RegionHeading id="canada-title" country="ca">
            {tp("canadaTitle")}
          </RegionHeading>
          <p className="mt-2 max-w-2xl text-muted-foreground">{tp("canadaIntro")}</p>
          <p className="mb-2 mt-6 text-xs font-medium text-muted-foreground sm:hidden">
            {tp("scrollHint")}
          </p>
          {/* `relative`: không có nó các `sr-only` trong bảng thoát khỏi khung
              cuộn và kéo ngang được cả trang — xem `route-award-table.tsx`. */}
          <div className="relative overflow-x-auto rounded-2xl border border-border sm:mt-6">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className={`${STICKY_COL} bg-card px-4 py-3`} />
                  {/* Logo hệ điểm dẫn tới danh sách thẻ tích hệ đó — nhưng
                      CHỈ khi hệ đó thật sự có thẻ trên site. `/credit-cards` cố
                      ý cho `?points=` lạ rơi về danh sách KHÔNG lọc, nên một
                      link tới hệ không có thẻ nào sẽ trả về nguyên 26 thẻ mà
                      người đọc tưởng là kết quả lọc. `amex-mr` từng đúng vào ca
                      đó cho tới 06/09/2026, khi American Express Cobalt® Card
                      thành thẻ Membership Rewards® đầu tiên trên site — cửa
                      kiểm vẫn giữ, vì nó canh tồn kho chứ không canh một ngày
                      cụ thể. */}
                  {ISSUER_COLUMNS.map((column) => (
                    <th key={column.programId} className="px-2 py-3">
                      <IssuerHeader
                        src={column.logo}
                        alt={column.alt}
                        className={column.logoClass}
                        programId={column.programId}
                        ariaLabel={tp(column.ariaKey)}
                        linkable={linkablePrograms.has(column.programId)}
                      />
                    </th>
                  ))}
                </tr>
                <tr className="bg-primary text-primary-foreground">
                  <th
                    className={`${STICKY_COL} bg-primary px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide`}
                  >
                    {tp("columnProgram")}
                  </th>
                  {ISSUER_COLUMNS.map((column) => (
                    <th
                      key={column.programId}
                      className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide"
                    >
                      {tp(column.nameKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRANSFER_PARTNERS.map((row, i) => (
                  <tr
                    key={row.program}
                    className={i % 2 === 0 ? "bg-card" : "bg-background"}
                  >
                    {/* The row stripe has to be repeated on the cell itself: a
                        sticky cell is lifted out of the row's paint order, so
                        without its own opaque background the ratio columns
                        scroll visibly underneath it. */}
                    {/* `th scope="row"`, không phải `td`: người dùng screen
                        reader nhảy thẳng giữa hai ô tỷ lệ Amex®/RBC®, và nếu tên
                        chương trình không được khai là header của hàng thì họ
                        nghe được "1,000 : 1,000" mà không biết nó thuộc chương
                        trình nào — trên đúng cái bảng mà cả nội dung là "hệ nào
                        chuyển sang chương trình nào". */}
                    <th
                      scope="row"
                      className={`${STICKY_COL} px-4 py-4 text-left font-medium text-foreground ${
                        i % 2 === 0 ? "bg-card" : "bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.logo}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-md border border-border object-contain bg-white p-1"
                        />
                        {QUOTABLE_PROGRAMS.has(row.program) ? (
                          <Link
                            href="/award-flight-finder"
                            className="text-primary underline decoration-border underline-offset-4 hover:decoration-primary"
                          >
                            {row.program}
                          </Link>
                        ) : (
                          <span>{row.program}</span>
                        )}
                      </div>
                    </th>
                    {ISSUER_COLUMNS.map((column) => (
                      <LegCell
                        key={column.programId}
                        leg={row[column.legKey]}
                        tint={column.legKey}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{tp("aeroplanNote")}</p>

          {/* Bảng trên nói điểm chuyển đi đâu; khối này nói lấy điểm đó từ thẻ
              nào — câu hỏi ngay tiếp theo, và trước 06/09/2026 trang này không
              trả lời được bằng đường nào ngoài logo đầu cột.

              Link THẲNG tới từng trang thẻ, không phải `?points=`. Link lọc
              canonical về `/credit-cards` nên với crawler nó không phải một
              đường mới, và các trang thẻ nó kể tên không nhận được gì —
              `npm run audit:links` đo đúng chuyện đó (xem chú thích của
              `siblingCardsInProgram`). Thẻ Membership Rewards® đầu tiên trên
              site vấp ngay: nó là thẻ duy nhất của hệ mình nên không có thẻ anh
              em nào trỏ sang, và trang danh sách là đường vào duy nhất.

              `sm:grid-cols-2` chỉ bật khi thật sự có hai cột: cố định nó thì
              một cột đơn độc bị dồn vào nửa trái và bỏ trống nửa phải — ca đó
              có thật, hệ nào chưa có thẻ nào thì bị lọc khỏi `cardColumns`. */}
          {cardColumns.length > 0 && (
            <div
              className={`mt-10 grid gap-8 ${cardColumns.length > 1 ? "sm:grid-cols-2" : ""}`}
            >
              {cardColumns.map(({ column, cards }) => (
                <NextSteps
                  key={column.programId}
                  title={tp("cardsTitle", { program: tp(column.nameKey) })}
                  headingLevel="h3"
                  compact
                >
                  {cards.map((card) => (
                    <StepLink
                      key={card.slug}
                      href={`/credit-cards/${card.slug}`}
                      label={card.name}
                      description={`${card.cardType} · ${card.annualFee}`}
                    />
                  ))}
                </NextSteps>
              ))}
            </div>
          )}
        </section>

        <section id="my" aria-labelledby="us-title" className="mt-16 scroll-mt-chrome">
          {/* Chữ của mục đứng cùng cột với mục Canada, chỉ riêng bảng nới ra
              `max-w-6xl` như một hình rộng trong bài: sáu cột tỷ lệ không vừa
              56rem, còn kéo cả mục ra thì tiêu đề "Mỹ" lệch mép trái so với
              "Canada" ngay phía trên. */}
          <div className="mx-auto max-w-4xl">
            <RegionHeading id="us-title" country="us">
              {tp("usTitle")}
            </RegionHeading>
            <p className="mt-2 max-w-2xl text-muted-foreground">{tp("usIntro")}</p>
            <p className="mb-2 mt-6 text-xs font-medium text-muted-foreground lg:hidden">
              {tp("scrollHint")}
            </p>
          </div>
          <div className="mx-auto max-w-6xl lg:mt-6">
            <UsTransferTable today={today} quotable={QUOTABLE_PROGRAMS} />
          </div>
          <div className="mx-auto max-w-4xl">
            <ul className="mt-4 max-w-prose space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>{tp("usTimeNote")}</li>
              <li>{tp("usChaseNote")}</li>
              <li>{tp("usCitiNote")}</li>
            </ul>

            {/* Như khối thẻ của bảng Canada: link THẲNG tới từng trang thẻ Mỹ,
                đường vào thứ hai cho các trang đó ngoài trang tổng. */}
            {usCardColumns.length > 0 && (
              <div
                className={`mt-10 grid gap-8 ${usCardColumns.length > 1 ? "sm:grid-cols-2" : ""}`}
              >
                {usCardColumns.map(({ issuer, cards }) => (
                  <NextSteps
                    key={issuer.id}
                    title={tp("usCardsTitle", { program: issuer.name })}
                    headingLevel="h3"
                    compact
                  >
                    {cards.map((card) => (
                      <StepLink
                        key={card.slug}
                        href={usCardPath(card.slug)}
                        label={card.name}
                        description={`${card.cardType} · ${card.annualFee}`}
                      />
                    ))}
                  </NextSteps>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="mx-auto mt-16 max-w-4xl">
          <NextSteps title={next("title")}>
            <StepLink
              href="/transfer-bonuses"
              label={next("bonusesLabel")}
              description={next("bonusesDescription")}
            />
            <StepLink
              href="/award-flight-finder"
              label={next("awardLabel")}
              description={next("awardDescription")}
            />
            <StepLink
              href="/calculator"
              label={next("calculatorLabel")}
              description={next("calculatorDescription")}
            />
          </NextSteps>
        </div>
      </div>
    </>
  );
}
