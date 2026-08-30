import Link from "next/link";
import type { CreditCardOffer } from "@/lib/content";
import { getCardPointsPrograms, programIdFor } from "@/lib/card-points-programs";
import { isElevatedLive } from "@/lib/credit-card-state";
import { isReferralUrl } from "@/lib/affiliate-links";
import { formatDate, hasExpired } from "@/lib/format-date";
import { CardImage } from "@/components/credit-cards/card-image";
import { ApplyButton } from "@/components/ui/apply-button";
import { t as translate } from "@/lib/t";

const t = translate("compare");
const offers_t = translate("offers");

/** Ô trống. Dấu gạch một mình không nói gì với screen reader, nên đi kèm một
 *  dòng chỉ đọc lên — cùng cách bảng Transfer Partners đã làm. */
function Empty() {
  return (
    <>
      <span aria-hidden>{offers_t("noValue")}</span>
      <span className="sr-only">{offers_t("noValueLabel")}</span>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-t border-border align-top">
      {/* `th scope="row"`: người dùng screen reader nhảy ngang giữa các cột thẻ
          và cần biết con số đang nghe thuộc hạng mục nào. */}
      <th
        scope="row"
        className="sticky left-0 z-10 bg-card px-4 py-4 text-left text-sm font-semibold text-foreground/80"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

/**
 * Hai hoặc ba thẻ, cùng một hàng cho mỗi hạng mục.
 *
 * Cuộn ngang chứ không xuống dòng: cột hẹp hơn ~220px thì tên thẻ vỡ thành bốn
 * dòng và con số bonus tụt xuống dưới màn hình, tức là mất đúng cái mà người ta
 * mở trang này để nhìn. Cột hạng mục dính bên trái để lúc vuốt vẫn biết đang
 * đọc hàng nào — cùng khuôn với bảng Transfer Partners, kể cả việc phải tự lặp
 * lại màu nền trên ô dính (ô sticky bị nhấc khỏi thứ tự vẽ của hàng, không có
 * nền riêng thì các cột khác trôi lộ ra dưới nó).
 */
export function CompareTable({ cards }: { cards: CreditCardOffer[] }) {
  const programs = getCardPointsPrograms(cards);
  const programName = (offer: CreditCardOffer) => {
    const id = programIdFor(offer);
    return id ? programs.find((program) => program.id === id)?.name : undefined;
  };

  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground lg:hidden">{t("swipeHint")}</p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {cards.map((card) => card.name).join(" · ")}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-[130px] min-w-[130px] bg-card px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t("rowAttribute")}
              </th>
              {cards.map((card) => (
                <th
                  key={card.slug}
                  scope="col"
                  className="min-w-[220px] px-4 py-4 text-left align-top"
                >
                  <CardImage
                    image={card.cardImage}
                    name={card.name}
                    placeholderIcon={card.image}
                    className="h-24 w-full rounded-lg"
                    applyUrl={card.applyUrl}
                  />
                  <Link
                    href={`/credit-cards/${card.slug}`}
                    className="mt-3 block font-display text-base font-bold leading-snug text-primary hover:underline"
                  >
                    {card.name}
                  </Link>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {card.issuer}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <Row label={t("rowWelcomeBonus")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4">
                  {card.welcomeBonus ? (
                    <span className="font-display text-lg font-extrabold leading-tight text-primary">
                      {card.welcomeBonus}
                    </span>
                  ) : (
                    <Empty />
                  )}
                </td>
              ))}
            </Row>

            <Row label={t("rowAnnualFee")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4 text-foreground/90">
                  {card.annualFee || <Empty />}
                </td>
              ))}
            </Row>

            <Row label={t("rowRebate")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4">
                  {card.rebate ? (
                    <span className="font-semibold text-emerald-700">{card.rebate}</span>
                  ) : (
                    <Empty />
                  )}
                </td>
              ))}
            </Row>

            <Row label={t("rowPointsProgram")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4 text-foreground/90">
                  {programName(card) ?? <Empty />}
                </td>
              ))}
            </Row>

            <Row label={t("rowCardType")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4 text-foreground/90">
                  {card.cardType || <Empty />}
                </td>
              ))}
            </Row>

            <Row label={t("rowElevated")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4 text-foreground/90">
                  {isElevatedLive(card) ? (
                    <>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        {offers_t("elevatedBonus")}
                      </span>
                      {/* Hạn chỉ in ra khi còn hiệu lực — `isElevatedLive` đã
                          bảo đảm điều đó, nhưng kiểm lại ở đây để hàng này
                          không phụ thuộc vào việc nhớ luật của hàm kia. */}
                      {card.expiresAt && !hasExpired(card.expiresAt) && (
                        <span className="mt-1 block text-xs text-amber-700">
                          {offers_t("expiresOn")} {formatDate(card.expiresAt)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">{offers_t("no")}</span>
                  )}
                </td>
              ))}
            </Row>

            <Row label={t("rowBenefits")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4">
                  {card.keyBenefits.length > 0 ? (
                    <ul className="list-disc space-y-1.5 pl-4 text-foreground/90">
                      {card.keyBenefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                  ) : (
                    <Empty />
                  )}
                </td>
              ))}
            </Row>

            <Row label={t("rowEditorsTake")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4 text-foreground/90">
                  {card.editorsTake || <Empty />}
                </td>
              ))}
            </Row>

            <Row label={t("rowApply")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4">
                  <ApplyButton
                    href={card.applyUrl}
                    affiliate={isReferralUrl(card.applyUrl)}
                    className="w-full text-center"
                  />
                  <Link
                    href={`/credit-cards/${card.slug}`}
                    className="mt-2 block text-center text-sm font-semibold text-primary hover:underline"
                  >
                    {t("viewCard")}
                  </Link>
                </td>
              ))}
            </Row>
          </tbody>
        </table>
      </div>
    </div>
  );
}
