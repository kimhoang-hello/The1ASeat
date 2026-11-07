import type { Metadata } from "next";
import Link from "next/link";
import { getTransferBonuses } from "@/lib/content";
import { EDITORIAL_REL } from "@/lib/affiliate-links";
import { formatDate, todayInSiteZone } from "@/lib/format-date";
import { liveBonusViews, type BonusView } from "@/lib/transfer-bonus-view";
import { US_BONUS_CHECKED_ON, US_BONUS_SOURCE, getUsTransferBonuses } from "@/lib/us-transfer-bonuses-data";
import { PageHeader } from "@/components/layout/page-header";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { RegionHeading, RegionJump } from "@/components/ui/region-nav";
import { BonusList } from "@/components/transfer-bonuses/bonus-list";
import { t } from "@/lib/t";
import { pageMetadata } from "@/lib/seo";

const tb = t("bonuses");
const next = t("nextSteps");
const seo = t("seo");

export const metadata: Metadata = pageMetadata({
  title: seo("transferBonusesTitle"),
  description: seo("transferBonusesDescription"),
  path: "/transfer-bonuses",
});

// Bonus Canada đến từ Contentful; không có dòng này trang tĩnh hoàn toàn và chỉ
// thấy bonus mới ở lần deploy kế tiếp. Bonus Mỹ nằm trong repo nhưng cũng cần
// nó: bonus hết hạn rời trang đúng ngày mà không phải đợi deploy.
export const revalidate = 60;

function jumpDescription(bonuses: BonusView[]): string {
  if (bonuses.length === 0) return tb("jumpEmpty");
  return tb("jumpCount", { count: bonuses.length, date: formatDate(bonuses[0].expiresAt) });
}

/** Danh sách của một nước, hoặc trạng thái rỗng dẫn sang bảng tỷ lệ thường ngày của đúng nước đó. */
function RegionBonuses({
  bonuses,
  emptyText,
  emptyHref,
}: {
  bonuses: BonusView[];
  emptyText: string;
  emptyHref: string;
}) {
  if (bonuses.length > 0) return <BonusList bonuses={bonuses} />;
  // Không còn hàng nào thì khung viền rỗng trông như trang hỏng; bảng tỷ lệ
  // transfer thường ngày là câu trả lời gần nhất cho người vừa tới đây.
  return (
    <div className="rounded-2xl border border-border px-5 py-8 text-center">
      <p className="text-sm text-muted-foreground">{emptyText}</p>
      <Link href={emptyHref} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
        {tb("emptyCta")} &rarr;
      </Link>
    </div>
  );
}

export default async function TransferBonusesPage() {
  // KHÔNG dùng bản `…Within`: bonus Canada là nội dung chính của trang. Lỗi thì
  // để lượt dựng lại thất bại và Next giữ bản cũ, thay vì cache 60 giây một mục
  // Canada báo "chưa có bonus nào" trong khi có.
  const caPublished = await getTransferBonuses();
  const today = todayInSiteZone();

  // Lọc bonus hết hạn ngay ở trang: job `expire-offers` chỉ gỡ bonus Canada mỗi
  // ngày một lần, còn bonus Mỹ chỉ được đọc lại mỗi tuần. Danh sách sắp theo
  // `expiresAt` tăng dần nên không lọc thì cái đã chết đứng ĐẦU mỗi mục.
  const ca = liveBonusViews(caPublished, today);
  const us = liveBonusViews(getUsTransferBonuses(), today);

  return (
    <>
      <PageHeader title={tb("title")} subtitle={tb("subtitle")} />

      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label={tb("regionNavLabel")} className="mx-auto max-w-page">
          <ul className="grid gap-3 sm:grid-cols-2">
            <RegionJump href="#canada" country="ca" title={tb("regionCa")} description={jumpDescription(ca)} />
            <RegionJump href="#my" country="us" title={tb("regionUs")} description={jumpDescription(us)} />
          </ul>
        </nav>

        <section id="canada" aria-labelledby="canada-title" className="mx-auto mt-12 max-w-page scroll-mt-chrome">
          <RegionHeading id="canada-title" country="ca">
            {tb("regionCa")}
          </RegionHeading>
          <p className="mb-6 mt-2 max-w-2xl text-muted-foreground">{tb("canadaIntro")}</p>
          <RegionBonuses bonuses={ca} emptyText={tb("canadaEmpty")} emptyHref="/transfer-partners#canada" />
        </section>

        <section id="my" aria-labelledby="us-title" className="mx-auto mt-16 max-w-page scroll-mt-chrome">
          <RegionHeading id="us-title" country="us">
            {tb("regionUs")}
          </RegionHeading>
          <p className="mt-2 max-w-2xl text-muted-foreground">{tb("usIntro")}</p>
          {/* Bonus Mỹ không có trang điều khoản riêng để dẫn tới như bonus
              Canada — nói rõ một lần ở đây số liệu lấy từ đâu và cũ tới đâu. */}
          <p className="mb-6 mt-2 max-w-2xl text-sm text-muted-foreground">
            {tb("usSourceLabel")}{" "}
            <a
              href={US_BONUS_SOURCE}
              target="_blank"
              rel={EDITORIAL_REL}
              className="font-medium text-primary underline underline-offset-4"
            >
              Daily Drop
            </a>
            , {tb("usSourceNote", { date: formatDate(US_BONUS_CHECKED_ON) })}
          </p>
          <RegionBonuses bonuses={us} emptyText={tb("usEmpty")} emptyHref="/transfer-partners#my" />
        </section>

        {/* Hàng Canada dẫn ra ngoài site, hàng Mỹ không dẫn đâu cả — ba đường
            dưới đây là ba câu hỏi đứng ngay sau một transfer bonus: chuyển từ
            đâu sang đâu, có đáng chuyển không, và lấy điểm để chuyển ở đâu. */}
        <div className="mx-auto mt-16 max-w-page">
          <NextSteps title={next("title")}>
            <StepLink
              href="/transfer-partners"
              label={next("transferLabel")}
              description={next("transferDescription")}
            />
            <StepLink
              href="/calculator"
              label={next("calculatorLabel")}
              description={next("calculatorDescription")}
            />
            <StepLink href="/credit-cards" label={next("cardsLabel")} description={next("cardsDescription")} />
          </NextSteps>
        </div>
      </div>
    </>
  );
}
