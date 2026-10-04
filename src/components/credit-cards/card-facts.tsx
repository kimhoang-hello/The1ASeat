import { cardFactsFor, hasUnchecked, type CardFact, type CardFacts as CardFactsData } from "@/lib/card-facts";
import { todayInSiteZone } from "@/lib/format-date";
import { t as translate } from "@/lib/t";

const t = translate("cardFacts");

/** Nhãn của một dòng. Thẻ cashback: dòng tích điểm là "Hoàn tiền". */
export function cardFactLabel(fact: CardFact, data: Pick<CardFactsData, "cashBack">): string {
  if (fact.key === "earn") return t(data.cashBack ? "earnCashBack" : "earn");
  return t(fact.key);
}

/** Các ý của một dòng; rỗng thì "Chưa kiểm" — dùng chung cho trang thẻ và
 *  bảng so sánh để hai nơi nói cùng một câu về cùng một dữ kiện. */
export function CardFactValue({ fact }: { fact: CardFact }) {
  if (fact.lines.length === 0) return <span className="text-muted-foreground">{t("notChecked")}</span>;
  if (fact.lines.length === 1) return <>{fact.lines[0].text}</>;
  return (
    <ul className="space-y-1">
      {fact.lines.map((line) => (
        <li key={line.text}>{line.text}</li>
      ))}
    </ul>
  );
}

/**
 * Khối "Thông tin nhanh" trên trang thẻ (03/10/2026, audit UX/UI đợt 3): tích
 * điểm, điều kiện mở thẻ, phòng chờ, bảo hiểm — đứng TRƯỚC nhận định, để người
 * so hai thẻ không phải lục trong đoạn văn. Dữ liệu và luật "chưa kiểm" ở
 * `lib/card-facts.ts`; mọi con số ở đây có `audit:reco-data` đối chiếu với
 * nội dung Contentful của chính thẻ này.
 *
 * Thẻ engine chưa biết thì không hiện gì — không hiện một bảng toàn "Chưa kiểm".
 */
export function CardFacts({ slug, className = "" }: { slug: string; className?: string }) {
  const data = cardFactsFor(slug, todayInSiteZone());
  if (!data) return null;

  return (
    <section aria-labelledby="thong-tin-nhanh" className={className}>
      <h2 id="thong-tin-nhanh" className="font-display text-xl font-bold text-foreground">
        {t("title")}
      </h2>
      <dl className="mt-3 divide-y divide-border border-y border-border">
        {data.facts.map((fact) => (
          <div key={fact.key} className="grid gap-1 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-sm font-semibold text-foreground">{cardFactLabel(fact, data)}</dt>
            <dd className="text-sm leading-relaxed text-foreground/90">
              <CardFactValue fact={fact} />
            </dd>
          </div>
        ))}
      </dl>
      {/* Dữ liệu không lưu phạm vi địa lý của tỷ lệ ("5x ăn uống TẠI CANADA" của
          thẻ Amex®) — câu này nói ra giới hạn đó thay vì để "2x ăn uống" đọc
          như tính cả khi đi nước ngoài (Codex bắt, 03/10/2026). Câu giải thích
          "Chưa kiểm" chỉ in khi khối có chỗ chưa kiểm (04/10/2026). */}
      <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted-foreground">
        {t("note")}
        {hasUnchecked(data) && ` ${t("noteUnchecked")}`}
      </p>
    </section>
  );
}
