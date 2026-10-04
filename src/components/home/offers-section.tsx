import Link from "next/link";
import { t as translate } from "@/lib/t";
import { getCreditCardOffers } from "@/lib/content";
import { CardRow } from "@/components/credit-cards/card-row";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { splitHotTip } from "@/components/credit-cards/editors-take";
import { HotTip } from "@/components/ui/hot-tip";
import { isElevatedLive } from "@/lib/credit-card-state";
import { US_CARDS_PUBLISHED } from "@/lib/feature-flags";
import { US_CARDS_BASE } from "@/lib/us-cards-path";

const t = translate("offers");
const usCards = translate("usCards");

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function OffersSection() {
  const offersAll = await getCreditCardOffers();
  const notable = offersAll.filter(isElevatedLive);
  const rest = offersAll.filter((offer) => !isElevatedLive(offer));
  const offers = [...shuffle(notable), ...shuffle(rest)].slice(0, 4);

  return (
    <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              {t("title")}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/credit-cards" className="cursor-pointer text-sm font-semibold text-primary hover:underline">
              {t("viewAll")} &rarr;
            </Link>
            {/* Mục Thẻ Mỹ không có cửa nào trên trang chủ ngoài menu. Chỉ là một
                link cạnh "xem tất cả", không chen vào bốn thẻ Canada. */}
            {US_CARDS_PUBLISHED && (
              <Link href={US_CARDS_BASE} className="cursor-pointer text-sm font-semibold text-primary hover:underline">
                {usCards("homeLink")} &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Dòng thẻ GỌN, chính là dòng của `/credit-cards` (03/10/2026, sau
            audit UX/UI). Trước đây mỗi ô in nguyên phần "Ghế 1A đánh giá"
            (tới ~150 chữ) và danh sách quyền lợi — bốn ô chiếm 54% chiều dài
            trang chủ trên điện thoại (4,265 / 7,936px), trùng nguyên văn trang
            thẻ. Riêng ở đây có thêm HOT TIP: đó là đường nhận rebate, và trang
            chủ là nơi duy nhất ngoài trang thẻ từng nói ra nó. */}
        <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
          {offers.map((offer) => {
            const { hotTip } = splitHotTip(offer.editorsTake);
            return (
              <CardRow
                key={offer.slug}
                offer={offer}
                href={`/credit-cards/${offer.slug}`}
                placement="home_offers"
                detailsLabel={t("editorsTake")}
                heading="h3"
              >
                {hotTip && (
                  <div className="mt-3">
                    <HotTip compact>{hotTip}</HotTip>
                  </div>
                )}
              </CardRow>
            );
          })}

          <OfferDisclosure className="mt-3 xl:col-span-2" />
        </div>
      </div>
    </section>
  );
}
