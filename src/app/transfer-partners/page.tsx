import type { Metadata } from "next";
import { ArrowDown } from "@phosphor-icons/react/ssr";
import { PageHeader } from "@/components/layout/page-header";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { Flag } from "@/components/ui/flag";
import { UsTransferTable } from "@/components/transfer-partners/us-transfer-table";
import {
  CANADA_ISSUER_COLUMNS,
  CanadaTransferTable,
} from "@/components/transfer-partners/canada-transfer-table";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";
import { getCreditCardOffers } from "@/lib/content";
import { cardsInProgram, getCardPointsPrograms } from "@/lib/card-points-programs";
import { PROGRAMS } from "@/lib/award-charts";
import { TRANSFER_PARTNERS } from "@/lib/transfer-partners";
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
  // Bảng là dữ liệu tĩnh; danh sách thẻ chỉ nuôi các cột "thẻ tích hệ điểm
  // này". Contentful nấc đúng lúc trang dựng lại thì rơi về `[]` + log — cột
  // thẻ biến mất, bảng vẫn hiện (như `/refundable-hotel-trick`).
  const offers = await getCreditCardOffers().catch((error) => {
    console.error("[transfer-partners] không tải được danh sách thẻ, bỏ cột thẻ", error);
    return [];
  });
  const linkablePrograms = new Set(getCardPointsPrograms(offers).map((p) => p.id));

  // Cột nào không có thẻ nào thì biến mất hẳn thay vì hiện một tiêu đề trống —
  // cùng luật với `CardNextSteps`: đường nào không có thật thì không hiện.
  const cardColumns = CANADA_ISSUER_COLUMNS.map((column) => ({
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
          <div className="sm:mt-6">
            <CanadaTransferTable linkablePrograms={linkablePrograms} quotable={QUOTABLE_PROGRAMS} />
          </div>
          <ul className="mt-4 max-w-prose space-y-2 text-xs leading-relaxed text-muted-foreground">
            <li>{tp("canadaTimeNote")}</li>
            <li>{tp("aeroplanNote")}</li>
          </ul>

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
