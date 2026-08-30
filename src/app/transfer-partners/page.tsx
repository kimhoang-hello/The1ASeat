import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";
import { getCreditCardOffers } from "@/lib/content";
import { creditCardsPath, getCardPointsPrograms } from "@/lib/card-points-programs";
import { PROGRAMS } from "@/lib/award-charts";
import { TRANSFER_PARTNERS, type TransferLeg } from "@/lib/transfer-partners";

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

const BADGE_STYLES = {
  amex: "bg-[#e7f2ea] text-[#1f6f43]",
  rbc: "bg-[#fdf1d8] text-[#8a5a10]",
} as const;

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

export default async function TransferPartnersPage() {
  // Hệ điểm nào thật sự có thẻ trên site — đọc từ chính danh sách mà bộ lọc sẽ
  // chạy trên đó, nên một link ở đây không bao giờ hứa một bộ lọc rỗng.
  const offers = await getCreditCardOffers();
  const linkablePrograms = new Set(getCardPointsPrograms(offers).map((p) => p.id));
  return (
    <>
      <PageHeader eyebrow={tp("eyebrow")} title={tp("title")} subtitle={tp("subtitle")} />
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 text-xs font-medium text-muted-foreground sm:hidden">
            {tp("scrollHint")}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className={`${STICKY_COL} bg-card px-4 py-3`} />
                  {/* Logo hệ điểm dẫn tới danh sách thẻ tích hệ đó — nhưng
                      CHỈ khi hệ đó thật sự có thẻ trên site. `/credit-cards` cố
                      ý cho `?points=` lạ rơi về danh sách KHÔNG lọc, nên một
                      link tới hệ không có thẻ nào sẽ trả về nguyên 23 thẻ mà
                      người đọc tưởng là kết quả lọc. Hiện `amex-mr` đúng vào ca
                      đó: thẻ Amex® trên site đều tích Aeroplan®/Bonvoy®, không
                      thẻ nào tích Membership Rewards®. */}
                  <th className="px-2 py-3">
                    <IssuerHeader
                      src="/images/logos/amex.svg"
                      alt="American Express"
                      className="mx-auto h-6 w-auto"
                      programId="amex-mr"
                      ariaLabel={tp("amexCardsAria")}
                      linkable={linkablePrograms.has("amex-mr")}
                    />
                  </th>
                  <th className="px-2 py-3">
                    <IssuerHeader
                      src="/images/logos/rbc.svg"
                      alt="RBC"
                      className="mx-auto h-8 w-auto"
                      programId="avion"
                      ariaLabel={tp("rbcCardsAria")}
                      linkable={linkablePrograms.has("avion")}
                    />
                  </th>
                </tr>
                <tr className="bg-primary text-primary-foreground">
                  <th
                    className={`${STICKY_COL} bg-primary px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide`}
                  >
                    {tp("columnProgram")}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                    {tp("columnAmex")}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                    {tp("columnRbc")}
                  </th>
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
                    <LegCell leg={row.amex} tint="amex" />
                    <LegCell leg={row.rbc} tint="rbc" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{tp("aeroplanNote")}</p>

          <NextSteps title={next("title")} className="mt-10">
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
      </section>
    </>
  );
}
