import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { cardsMentionedInPost, pointsProgramForPost } from "@/lib/post-next-steps";
import { foundationPosts } from "@/lib/start-here";
import { START_HERE_PUBLISHED } from "@/lib/feature-flags";
import { t as translate } from "@/lib/t";
import type { BlogPost, CreditCardOffer } from "@/lib/content";

const t = translate("postNextSteps");
const next = translate("nextSteps");

/**
 * Đường từ một bài viết sang mục thẻ.
 *
 * Ba mức, mức trên có thì không cần mức dưới:
 *
 * 1. Bài nhắc đích danh thẻ nào → dẫn thẳng tới thẻ đó.
 * 2. Không thì, tiêu đề gọi tên một hệ điểm có thẻ → dẫn tới bộ lọc hệ đó.
 * 3. Không nữa thì một đường chung tới `/credit-cards`.
 *
 * Mức 3 trông như đã phá luật "thà không có link còn hơn link sai chỗ" của
 * `card-next-steps.ts`, nhưng khác nhau ở chỗ link CHUNG không giống link SAI.
 * Luật bên kia sinh ra để chặn việc dẫn thẻ WestJet® sang một công cụ không
 * biết gì về WestJet® — một câu trả lời sai cho câu hỏi người đọc đang có. Còn
 * mọi bài trên site này đều là miles & points, nên "xem thẻ đang theo dõi"
 * không bao giờ lạc đề; nó chỉ kém cụ thể hơn hai mức trên.
 *
 * NGOÀI RA, bài nào nằm trong lộ trình `/bat-dau` thì có thêm một đường về
 * chính lộ trình đó.
 *
 * CHỈ những bài đó, không phải mọi bài: câu "bài này nằm trong lộ trình cho
 * người mới" là một câu THẬT và CỤ THỂ về đúng bài người ta đang đọc, còn dán
 * nó lên cả ba mươi bài thì thành một banner chung chung, đúng thứ luật trên
 * sinh ra để chặn. Đây cũng là đúng nhóm cần nó: lưu lượng organic đổ vào bài
 * chuyên mục Kiến thức, và trước đây họ đọc xong không có đường nào tới lộ
 * trình — `/bat-dau` chỉ có cửa từ trang chủ và mấy trang tĩnh.
 *
 * LUÔN ĐỨNG SAU đường tới thẻ, ở cả hai nhánh. Click "Apply ngay" là một trong
 * hai thước đo thành công, nên cửa mới không được đứng chắn trước nó. Ở nhánh
 * "thẻ nhắc trong bài" nó còn tách hẳn thành khối riêng bên dưới, vì một lộ
 * trình đọc không phải là một cái thẻ và không thuộc về danh sách đó.
 */
export function PostNextSteps({
  post,
  posts,
  offers,
  className = "",
}: {
  post: BlogPost;
  /** Toàn bộ bài, để dựng lại lộ trình ĐANG RENDER — xem `routePosts` bên dưới. */
  posts: BlogPost[];
  offers: CreditCardOffer[];
  className?: string;
}) {
  const mentioned = cardsMentionedInPost(post, offers);
  const program = mentioned.length === 0 ? pointsProgramForPost(post, offers) : null;

  // Lộ trình ĐANG RENDER, không phải danh sách slug đã khai. Hai con số đó lệch
  // nhau đúng lúc một bài bị đổi slug hoặc unpublish: `/bat-dau` lặng lẽ bỏ bài
  // đó và hiện 5, còn link ở đây vẫn hứa 6. Một câu về số lượng mà cũ đi được
  // là đúng thứ cả trang Bắt đầu sinh ra để tránh.
  //
  // Đọc `post.slug` từ chính danh sách này luôn, nên bài đã rơi khỏi lộ trình
  // cũng không còn tự giới thiệu là nằm trong đó.
  const routePosts = foundationPosts(posts);

  // Gate như mọi cửa vào `/bat-dau` khác — xem AGENTS.md. Cờ tắt là đường này
  // biến mất cùng trang, không để lại link dẫn vào bản nháp.
  const inRoute =
    START_HERE_PUBLISHED && routePosts.some((routePost) => routePost.slug === post.slug);

  const routeLink = inRoute ? (
    <StepLink
      href="/bat-dau"
      label={t("routeLabel")}
      description={t("routeDescription", { count: routePosts.length })}
    />
  ) : null;

  if (mentioned.length > 0) {
    return (
      <>
      <section className={className}>
        <h2 className="font-display text-xl font-bold text-foreground">{t("mentionedTitle")}</h2>
        <ul className="mt-3 space-y-2">
          {mentioned.map((offer) => (
            <li key={offer.slug}>
              <Link
                href={`/credit-cards/${offer.slug}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary"
              >
                <span>
                  <span className="block font-semibold text-foreground">{offer.name}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {offer.issuer} · {offer.annualFee}
                  </span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-primary" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {routeLink && (
        <NextSteps title={next("title")} className={className}>
          {routeLink}
        </NextSteps>
      )}
      </>
    );
  }

  return (
    <NextSteps title={next("title")} className={className}>
      {program ? (
        <StepLink
          href={program.href}
          label={t("programLabel", { program: program.name })}
          description={t("programDescription")}
        />
      ) : (
        <StepLink
          href="/credit-cards"
          label={next("cardsLabel")}
          description={next("cardsDescription")}
        />
      )}
      {routeLink}
    </NextSteps>
  );
}
