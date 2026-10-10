import type { CreditCardOffer } from "./content";
import { hasExpired } from "./format-date";
import { absoluteUrl, bonusForTitle } from "./seo";
import { SITE_URL } from "./subscriber-email";
import { t } from "./t";
import { type UsCreditCardOffer, usCardPath } from "./us-credit-cards";

/**
 * schema.org/CreditCard for one offer. Shared between the /credit-cards list
 * (nested in the ItemList) and each card's own page, so the two never drift.
 *
 * Deliberately no Review/AggregateRating: there is no rating behind the
 * editor's take, and shipping a rating we do not actually collect would be
 * fabricated markup.
 */
export function creditCardJsonLd(offer: CreditCardOffer | UsCreditCardOffer) {
  // Link ref thẻ Mỹ mở một trang liệt kê cả nhóm thẻ, không định danh riêng thẻ
  // này — `Offer.url` trỏ trang sản phẩm của ngân hàng thay vào đó.
  const offerUrl = ("us" in offer && offer.us.sourceUrl) || offer.applyUrl;
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
    // Ảnh thẻ Mỹ nằm trong `public/` nên là đường dẫn tương đối; schema.org
    // cần URL tuyệt đối. Ảnh thẻ Canada (Contentful) đã tuyệt đối sẵn.
    ...(offer.cardImage && {
      image: offer.cardImage.startsWith("/") ? absoluteUrl(offer.cardImage) : offer.cardImage,
    }),
    provider: { "@type": "Organization", name: offer.issuer },
    feesAndCommissionsSpecification: offer.annualFee,
    areaServed: offer.country === "CA" ? "CA" : "US",
    offers: {
      "@type": "Offer",
      // BỎ HẲN `url` khi thẻ không có applyUrl hợp lệ (xem `safeApplyUrl`).
      // In `url: ""` là nói với crawler rằng offer này mở ở chính trang đang
      // đứng — sai, và sai một cách trông như thật.
      ...(offerUrl && { url: offerUrl }),
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

/** "điểm Aeroplan®" → "aeroplan": so tên chương trình với tên thẻ mà không vấp ký hiệu. */
function bareName(text: string): string {
  return text.replace(/[®™℠*]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * `<title>` của trang một thẻ (Canada lẫn Mỹ): tên thẻ + con số welcome bonus.
 *
 * Search Console 90 ngày tới 06/10/2026: query tìm ra trang thẻ là tên sản
 * phẩm kèm đúng thứ người ta đang cân — "tangerine world elite mastercard
 * welcome bonus", "td first class travel visa infinite promotion", "marriott
 * boundless 100k", "chase marriott 150k". Tiêu đề chỉ có tên thẻ thì không
 * khớp vế sau. Con số lấy từ `welcomeBonus`, đúng chuỗi trang đang hiện làm số
 * lớn, nên tiêu đề đổi cùng lúc với trang — không có bản viết tay nào để lệch.
 *
 * Tên chương trình bị bỏ khi tên thẻ đã chứa nó ("TD® Aeroplan® Visa
 * Infinite* Card: welcome bonus 50,000 điểm", không phải "… điểm Aeroplan®").
 * Nhãn không có chữ số ("Nhân đôi toàn bộ cashback năm đầu") thì giữ tiêu đề
 * là tên thẻ: không có con số thì vế sau chỉ làm dài tiêu đề.
 *
 * `expiresAt` đã qua thì cũng chỉ tên thẻ. `expire-offers` chạy ngày một lần,
 * còn thẻ Mỹ không có job nào gỡ — trong khoảng đó con số trong `welcomeBonus`
 * là offer đã đóng, và tiêu đề là chỗ duy nhất Google in nó ra ngay dòng đầu.
 * Không dùng `isElevatedLive`: thẻ không elevated vẫn có welcome bonus hợp lệ.
 */
export function creditCardMetaTitle(offer: CreditCardOffer): string {
  if (offer.expiresAt && hasExpired(offer.expiresAt)) return offer.name;
  // Kiểm chữ số trên nhãn ĐÃ gọt: " (tối đa 100,000 điểm)" có số trước khi gọt
  // nhưng gọt xong là chuỗi rỗng.
  let bonus = bonusForTitle(offer.welcomeBonus ?? "");
  if (!/\d/.test(bonus)) return offer.name;
  const unit = bonus.match(/^(.*\d\S*\s+(?:điểm|miles))\s+(.+)$/u);
  if (unit && bareName(offer.name).includes(bareName(unit[2]))) bonus = unit[1];
  return seo("cardTitle", { name: offer.name, bonus });
}

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
    if (fee && text.length + 1 + fee.length <= META_DESCRIPTION_MAX) text = `${text} ${fee}`;
    // Câu đuôi đầy đủ dài 71 ký tự: headline 90–100 ký tự không còn chỗ cho nó
    // và từng dừng ở 95–98 ký tự (6 trang, đo 01/10/2026). Bản ngắn lấp chỗ đó.
    const tail = [seo("cardTail"), seo("cardTailShort")].find(
      (extra) => text.length + 1 + extra.length <= META_DESCRIPTION_MAX,
    );
    if (tail) text = `${text} ${tail}`;
  }

  return text;
}
