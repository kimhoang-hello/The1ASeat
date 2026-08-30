import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { cardsMentionedInPost, pointsProgramForPost } from "@/lib/post-next-steps";
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
 */
export function PostNextSteps({
  post,
  offers,
  className = "",
}: {
  post: BlogPost;
  offers: CreditCardOffer[];
  className?: string;
}) {
  const mentioned = cardsMentionedInPost(post, offers);
  const program = mentioned.length === 0 ? pointsProgramForPost(post, offers) : null;

  if (mentioned.length > 0) {
    return (
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
    </NextSteps>
  );
}
