import type { CreditCardOffer } from "./content";
import { absoluteUrl } from "./seo";
import { SITE_URL } from "./subscriber-email";
import { t } from "./t";
import { usCardPath } from "./us-credit-cards";

/**
 * schema.org/CreditCard for one offer. Shared between the /credit-cards list
 * (nested in the ItemList) and each card's own page, so the two never drift.
 *
 * Deliberately no Review/AggregateRating: there is no rating behind the
 * editor's take, and shipping a rating we do not actually collect would be
 * fabricated markup.
 */
export function creditCardJsonLd(offer: CreditCardOffer) {
  // Thẻ Mỹ sống ở mục riêng — `@id` phải trỏ đúng trang của nó, không phải
  // một `/credit-cards/<slug>` không tồn tại.
  const url = absoluteUrl(
    offer.country === "US" ? usCardPath(offer.slug) : `/credit-cards/${offer.slug}`,
  );

  return {
    "@type": "CreditCard",
    "@id": `${url}#product`,
    name: offer.name,
    description: offer.headline,
    url,
    category: offer.cardType,
    ...(offer.cardImage && { image: offer.cardImage }),
    provider: { "@type": "Organization", name: offer.issuer },
    feesAndCommissionsSpecification: offer.annualFee,
    areaServed: offer.country === "CA" ? "CA" : "US",
    offers: {
      "@type": "Offer",
      // BỎ HẲN `url` khi thẻ không có applyUrl hợp lệ (xem `safeApplyUrl`).
      // In `url: ""` là nói với crawler rằng offer này mở ở chính trang đang
      // đứng — sai, và sai một cách trông như thật.
      ...(offer.applyUrl && { url: offer.applyUrl }),
      category: offer.cardType,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: offer.issuer },
      // KHÔNG có `availabilityEnds`. `Offer` ở đây là việc mở thẻ (`url` là
      // apply URL, `seller` là ngân hàng), còn `offer.expiresAt` chỉ là hạn của
      // welcome bonus. Gán vào nhau là báo với crawler rằng thẻ ngừng nhận
      // application từ ngày đó, trong khi trang vẫn liệt kê và vẫn cho apply —
      // và với các entry lưu mốc `00:00`, schema còn kết thúc ngay đầu cái ngày
      // mà giao diện tính là còn hiệu lực. Hạn welcome offer đã hiện trên trang;
      // schema.org không có chỗ đúng cho nó trong `CreditCard`.
    },
    ...(offer.keyBenefits.length > 0 && {
      // Benefits render as a bulleted list on the page; expose the same list as
      // product properties rather than cramming them into `description`.
      additionalProperty: offer.keyBenefits.map((benefit) => ({
        "@type": "PropertyValue",
        name: "Quyền lợi",
        value: benefit,
      })),
    }),
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

const seo = t("seo");

/** Chỗ Google cắt mô tả — cùng mốc với `bankAccountDescription`. */
const META_DESCRIPTION_MAX = 160;
/** Dưới mốc này thì snippet bỏ trống gần nửa chỗ hiển thị. */
const META_DESCRIPTION_MIN = 110;

/** Chỗ cắt được trong một headline: trước mỗi vế phụ, không bao giờ giữa chừng một con số. */
const CLAUSE_BREAKS = [" — ", ", ", " cộng ", " kèm ", " và "];

/** "$139/năm — miễn năm đầu (thẻ phụ…)" → "$139/năm". Phần sau là điều kiện
 *  thẻ phụ/miễn phí, trang thẻ đã nói đủ; trong snippet nó chỉ làm loãng. */
function shortAnnualFee(annualFee: string): string {
  return annualFee.split(/ \(| — |;/)[0].trim();
}

/**
 * Vị trí cuối cùng của `sep` trước `limit` mà cắt ở đó không chẻ đôi một tên
 * riêng. Dấu phẩy nằm TRONG tên thì chữ sau nó viết hoa ("The Ritz-Carlton,
 * Toronto"); dấu phẩy ngăn hai vế của headline thì chữ sau viết thường
 * ("…, hoàn đến 6 điểm/$1"). Số "$1,500" không dính vì không có dấu cách.
 */
function lastClauseBreak(text: string, sep: string, limit: number): number {
  let at = text.lastIndexOf(sep, limit);
  while (at > 0 && sep === ", " && /\p{Lu}/u.test(text.charAt(at + sep.length))) {
    at = text.lastIndexOf(sep, at - 1);
  }
  return at;
}

function endSentence(text: string): string {
  const trimmed = text.replace(/[\s,;:—-]+$/, "");
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * `<meta name="description">` của trang một thẻ.
 *
 * Nguồn vẫn là `headline` — câu biên tập mở bằng "Welcome bonus…" — nhưng
 * headline được viết cho thẻ trên trang, không cho snippet: đo 22/09/2026, câu
 * ngắn nhất 58 ký tự (bỏ trống nửa snippet), dài nhất 179 (Google cắt mất vế
 * cuối). Quá dài thì cắt ở ranh giới vế gần mốc nhất; quá ngắn thì nối annual
 * fee rồi câu đuôi, mỗi phần chỉ khi còn vừa.
 *
 * Chỉ dùng cho thẻ meta. `description` của JSON-LD vẫn là headline nguyên văn.
 */
export function creditCardMetaDescription(offer: CreditCardOffer): string {
  let text = offer.headline.trim();

  if (text.length > META_DESCRIPTION_MAX) {
    const cut = Math.max(
      ...CLAUSE_BREAKS.map((sep) => lastClauseBreak(text, sep, META_DESCRIPTION_MAX - 1)),
    );
    text =
      cut > META_DESCRIPTION_MIN
        ? endSentence(text.slice(0, cut))
        : `${text.slice(0, text.lastIndexOf(" ", META_DESCRIPTION_MAX - 1))}…`;
  }

  if (text.length < META_DESCRIPTION_MIN) {
    text = endSentence(text);
    // Headline tự nói annual fee rồi ("…với annual fee chỉ $120") thì nối thêm
    // "Annual fee $120/năm." là đọc cùng một con số hai lần liền nhau.
    const fee =
      offer.annualFee && !/annual fee/i.test(text)
        ? seo("cardAnnualFee", { fee: shortAnnualFee(offer.annualFee) })
        : "";
    for (const extra of [fee, seo("cardTail")]) {
      if (extra && text.length + 1 + extra.length <= META_DESCRIPTION_MAX) text = `${text} ${extra}`;
    }
  }

  return text;
}
