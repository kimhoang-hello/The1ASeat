import Link from "next/link";
import type { CreditCardOffer } from "@/lib/content";
import { getCardPointsPrograms, programIdFor } from "@/lib/card-points-programs";
import { isElevatedLive } from "@/lib/credit-card-state";
import { isReferralUrl } from "@/lib/affiliate-links";
import { formatDate, hasExpired } from "@/lib/format-date";
import { CardImage, applyOverlay } from "@/components/credit-cards/card-image";
import { ApplyButton } from "@/components/ui/apply-button";
import { CardFactValue } from "@/components/credit-cards/card-facts";
import { cardFactsFor, type CardFactKey } from "@/lib/card-facts";
import { todayInSiteZone } from "@/lib/format-date";
import { t as translate } from "@/lib/t";

const t = translate("compare");
const offers_t = translate("offers");
const facts_t = translate("cardFacts");

/** Dòng Thông tin nhanh trong bảng, cùng thứ tự với khối trên trang thẻ. Thẻ
 *  cashback và thẻ điểm có thể nằm cùng bảng nên dòng đầu mang nhãn chung. */
const FACT_ROWS: { key: CardFactKey; label: string; long: boolean }[] = [
  { key: "earn", label: facts_t("earnCompare"), long: true },
  { key: "eligibility", label: facts_t("eligibility"), long: false },
  { key: "lounge", label: facts_t("lounge"), long: false },
  { key: "insurance", label: facts_t("insurance"), long: true },
];

/**
 * Tên thẻ lặp lại ĐẦU Ô ở những hàng dài (03/10/2026, audit UX/UI): tên chỉ có
 * ở hàng đầu, mà hàng đầu trôi khỏi màn hình sau vài hàng — đọc tới danh sách
 * quyền lợi thì không còn biết cột nào là thẻ nào. Không làm hàng đầu dính
 * được: bảng nằm trong khung cuộn ngang, `sticky top` bám vào khung đó chứ
 * không bám vào màn hình. `aria-hidden` vì trình đọc màn hình đã đọc tên cột
 * từ `th scope="col"`.
 */
function CardName({ name }: { name: string }) {
  return (
    <span aria-hidden className="mb-1.5 block text-xs font-semibold text-muted-foreground">
      {name}
    </span>
  );
}

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
  const today = todayInSiteZone();
  const factsBySlug = new Map(cards.map((card) => [card.slug, cardFactsFor(card.slug, today)]));
  const programName = (offer: CreditCardOffer) => {
    const id = programIdFor(offer);
    return id ? programs.find((program) => program.id === id)?.name : undefined;
  };

  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground lg:hidden">{t("swipeHint")}</p>

      {/* `relative`: không có nó các `sr-only` trong bảng thoát khỏi khung
          cuộn và kéo ngang được cả trang — xem `route-award-table.tsx`. */}
      <div className="relative overflow-x-auto rounded-2xl border border-border bg-card">
        {/* `table-fixed` để các cột thẻ rộng đúng bằng nhau. Để bảng tự co theo
            nội dung thì thẻ nào có dòng quyền lợi dài hơn sẽ giành cột rộng
            hơn — trang so sánh mà cột này to gấp rưỡi cột kia thì mắt đọc ra
            là thẻ này "hơn", trước cả khi kịp đọc con số. Bề rộng tối thiểu
            phải chuyển lên cấp bảng, vì thuật toán fixed lấy bề rộng cột từ
            hàng đầu và không đọc `min-width` của từng ô nữa. */}
        <table
          className={`w-full table-fixed border-collapse text-sm ${
            cards.length > 2 ? "min-w-[790px]" : "min-w-[570px]"
          }`}
        >
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
                <th key={card.slug} scope="col" className="px-4 py-4 text-left align-top">
                  {/* Ô ảnh cỡ cố định, cùng kích thước với ô ảnh ở danh sách
                      thẻ. `w-full` thì ô ảnh dài ra theo cột và một tấm hình
                      thẻ 160px nằm giữa một vệt nền 320px — bản thân ảnh vẫn
                      bằng nhau, nhưng cái nền quanh nó thì không. */}
                  <CardImage
                    image={card.cardImage}
                    name={card.name}
                    placeholderIcon={card.image}
                    className="h-32 w-40 rounded-xl"
                    sizes="160px"
                    {...applyOverlay(card.applyUrl, "card_compare", card.slug)}
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
                    <span className="font-display text-lg font-bold leading-tight text-primary">
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
                    <span className="font-semibold text-success">{card.rebate}</span>
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
                      <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                        {offers_t("elevatedBonus")}
                      </span>
                      {/* Hạn chỉ in ra khi còn hiệu lực — `isElevatedLive` đã
                          bảo đảm điều đó, nhưng kiểm lại ở đây để hàng này
                          không phụ thuộc vào việc nhớ luật của hàm kia. */}
                      {card.expiresAt && !hasExpired(card.expiresAt) && (
                        <span className="mt-1 block text-xs text-warning">
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

            {FACT_ROWS.map(({ key, label, long }) => (
              <Row key={key} label={label}>
                {cards.map((card) => {
                  const fact = factsBySlug.get(card.slug)?.facts.find((row) => row.key === key);
                  return (
                    <td key={card.slug} className="px-4 py-4 text-foreground/90">
                      {long && <CardName name={card.name} />}
                      {/* Thẻ engine chưa biết: "Chưa kiểm", cùng chữ với dòng rỗng. */}
                      <CardFactValue fact={fact ?? { key, lines: [] }} />
                    </td>
                  );
                })}
              </Row>
            ))}

            <Row label={t("rowBenefits")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4">
                  <CardName name={card.name} />
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
                  <CardName name={card.name} />
                  {card.editorsTake || <Empty />}
                </td>
              ))}
            </Row>

            <Row label={t("rowApply")}>
              {cards.map((card) => (
                <td key={card.slug} className="px-4 py-4">
                  {card.applyUrl && (
                    <ApplyButton
                      href={card.applyUrl}
                      affiliate={isReferralUrl(card.applyUrl)}
                      className="w-full text-center"
                      placement="card_compare"
                      product={card.slug}
                    />
                  )}
                  <Link
                    href={`/credit-cards/${card.slug}`}
                    // `py-2.5` cho vùng chạm ~40px thay vì đúng một dòng chữ
                    // 20px. Trong bảng cuộn ngang trên điện thoại, đây là
                    // đường DUY NHẤT sang trang chi tiết mà không đi thẳng ra
                    // link affiliate — hụt tay ở đây là bấm nhầm vào nút Apply
                    // ngay bên trên.
                    className="mt-1 block py-2.5 text-center text-sm font-semibold text-primary hover:underline"
                  >
                    {t("viewCard")}
                  </Link>
                </td>
              ))}
            </Row>
          </tbody>
        </table>
      </div>
      {/* Cùng lời dặn dưới khối Thông tin nhanh ở trang thẻ: bốn hàng dữ kiện ở
          trên dùng chung dữ liệu và chung giới hạn. */}
      <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted-foreground">{facts_t("note")}</p>
    </div>
  );
}
