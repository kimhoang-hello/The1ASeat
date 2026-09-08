import { CardSpotlight } from "@/components/credit-cards/card-spotlight";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import type { BlogPost, CreditCardOffer } from "@/lib/content";
import { cardMentionsInPost } from "@/lib/post-card-mentions";
import { t as translate } from "@/lib/t";

const posts_t = translate("posts");

/**
 * Thân bài, với khối thẻ chèn ngay dưới đoạn đầu tiên nhắc tới thẻ đó.
 *
 * VÌ SAO CHÈN VÀO GIỮA CHỨ KHÔNG DỒN XUỐNG CUỐI. Cuối bài đã có `PostNextSteps`
 * — nó liệt kê thẻ được nhắc dưới dạng link chữ, và nó ở lại. Nhưng người đọc
 * gặp cái tên "American Express Cobalt® Card" ở đoạn thứ ba thì câu hỏi
 * "welcome bonus bao nhiêu, phí bao nhiêu" nảy ra Ở ĐÓ, không phải sau khi đọc
 * hết bài. Trước khối này, câu trả lời nằm cách hai cú bấm.
 *
 * MỌI CON SỐ ĐỌC SỐNG TỪ CONTENTFUL. Đây là điểm khác quan trọng nhất so với
 * cách viết tay số vào thân bài: bài đăng tháng trước nói "welcome bonus
 * 60,000 điểm" sẽ nằm nguyên như vậy mãi mãi, còn khối này luôn hiện con số
 * của hôm nay. Bài cũ vì thế cũng được lợi mà không phải sửa một chữ nào —
 * nhận diện chạy lúc render, không phải lúc soạn bài.
 *
 * CHIA `prose` LÀM NHIỀU KHỐI. Plugin typography đặt lề trực tiếp lên từng thẻ
 * (`.prose :where(p)`), không đặt lên `> * + *`, nên cắt thân bài thành nhiều
 * `div.prose` liền nhau không đổi khoảng cách giữa các đoạn. Đổi lại,
 * `:first-child { margin-top: 0 }` áp cho mỗi khối, nên khoảng cách quanh khối
 * thẻ do `mt-8`/`mt-10` ở đây quyết định chứ không do plugin.
 */
export function PostBody({
  post,
  offers,
  className = "",
}: {
  post: BlogPost;
  offers: CreditCardOffer[];
  className?: string;
}) {
  const mentions = cardMentionsInPost(post, offers);

  // Không bài nào nhắc thẻ thì giữ NGUYÊN một khối `prose` như trước — không
  // có lý do gì để 35/40 bài đổi hình dạng DOM vì một tính năng chúng không
  // dùng tới.
  if (mentions.length === 0) {
    return (
      <div
        data-affiliate-scope="post-body"
        className={`${PROSE} ${className}`}
        dangerouslySetInnerHTML={{ __html: post.body }}
      />
    );
  }

  // MẢNG thẻ cho mỗi chỗ chèn, không phải một thẻ.
  //
  // `new Map(mentions.map(m => [m.afterBlock, m.card]))` là bản đầu, và nó
  // nuốt thẻ trong im lặng: một đoạn giới thiệu nhắc hai thẻ liền nhau thì hai
  // mention mang cùng `afterBlock`, key trùng, thẻ sau đè thẻ trước. Đo được
  // trên nội dung thật ngày 07/09/2026 — 2 trong 10 khối biến mất đúng kiểu
  // đó, ở hai bài khác nhau.
  const insertAfter = new Map<number, CreditCardOffer[]>();
  for (const mention of mentions) {
    insertAfter.set(mention.afterBlock, [
      ...(insertAfter.get(mention.afterBlock) ?? []),
      mention.card,
    ]);
  }

  // Gom các khối liền nhau lại thành từng mảng, cắt ở đúng chỗ có khối thẻ:
  // ít `div` hơn, và mỗi `div` vẫn là HTML hợp lệ vì ranh giới luôn nằm giữa
  // hai khối cấp cao nhất của rich text.
  const runs: { html: string; cards: CreditCardOffer[] }[] = [];
  let buffer: string[] = [];
  post.bodyBlocks.forEach((block, index) => {
    buffer.push(block);
    const cards = insertAfter.get(index);
    if (cards) {
      runs.push({ html: buffer.join(""), cards });
      buffer = [];
    }
  });
  if (buffer.length > 0) runs.push({ html: buffer.join(""), cards: [] });

  return (
    /* `data-affiliate-scope` bọc CẢ cụm, không bọc từng khối:
       `AffiliateClickTracker` gắn một listener lên phần tử mang thuộc tính
       này, và chia thành nhiều vùng thì link ở vùng thứ hai trở đi không được
       đếm. Nút Apply trong khối thẻ tự bắn event riêng của nó (`ApplyButton`),
       nên không bị đếm hai lần. */
    <div data-affiliate-scope="post-body" className={className}>
      {runs.map((run, index) => (
        <div key={index}>
          <div
            className={`${PROSE} ${index === 0 ? "" : "mt-10"}`}
            dangerouslySetInnerHTML={{ __html: run.html }}
          />
          {run.cards.length > 0 && (
            <div className="mt-8 space-y-4">
              <p className="text-xs font-semibold tracking-wide text-primary">
                {posts_t("cardInPost")}
              </p>
              {run.cards.map((card) => (
                <CardSpotlight key={card.slug} card={card} placement="post_body" />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Công bố affiliate NGAY TRONG BÀI, không để mỗi footer lo.
          Mọi bề mặt khác của site có nút Apply — danh sách thẻ, trang chi tiết
          thẻ, bốn trang "Các thẻ tốt nhất" — đều in `OfferDisclosure` cạnh nút.
          Bài viết trước đây không cần vì link affiliate trong bài là chữ do
          tác giả viết; khối thẻ đổi điều đó, nó là một CTA to đúng bằng cái
          trên trang thẻ. Chỉ hiện khi bài thật sự có khối thẻ — 34/40 bài
          không có nút Apply nào và không cần thêm một hộp chữ nữa. */}
      <OfferDisclosure className="mt-10" />
    </div>
  );
}

/** Đúng chuỗi class thân bài đang dùng — giữ một chỗ để hai nhánh trên không
 *  lệch nhau.
 *
 *  `xl:prose-lg` nâng chữ lên 18px từ `xl`. Đây là cách trang bài "rộng ra"
 *  trên màn hình lớn mà không kéo dài dòng: cột vẫn 42rem, chữ to hơn nên số
 *  ký tự trên một dòng gần như đứng yên (75 → 74) trong khi khối chữ chiếm
 *  nhiều chỗ hơn và dễ đọc hơn ở khoảng cách ngồi xa.
 *
 *  `prose-headings:scroll-mt-28` vì header dính trên đỉnh: không có nó, link
 *  mục lục nhảy tới đúng heading rồi để header che mất chính cái heading đó. */
const PROSE =
  "prose prose-neutral max-w-none prose-headings:font-display prose-headings:scroll-mt-28 prose-a:text-primary [&_:is(h1,h2,h3,h4)_a]:[font-weight:inherit] xl:prose-lg";
