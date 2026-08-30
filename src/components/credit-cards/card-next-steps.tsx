import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import type { BlogPost, CreditCardOffer } from "@/lib/content";
import { comparePath } from "@/lib/card-compare";
import { pointsToolFor, relatedPostsForCard, samePointsProgramLink } from "@/lib/card-next-steps";
import { formatDate } from "@/lib/format-date";
import { t as translate } from "@/lib/t";

const t = translate("cardNextSteps");

/**
 * Câu hỏi kế tiếp của người vừa đọc xong một trang thẻ.
 *
 * Trước khối này, trang chi tiết thẻ là ngõ cụt: nút apply, link về danh sách,
 * link về trang chủ. Người đọc vừa biết thẻ này tích Aeroplan® thì câu hỏi
 * ngay sau đó — "vậy Aeroplan® bay được đâu, tốn bao nhiêu" — không có đường
 * nào dẫn tới, dù site có sẵn cả một công cụ trả lời.
 *
 * Mọi đường ở đây đều tự suy ra từ dữ liệu (xem `lib/card-next-steps.ts`), và
 * đường nào không có thì KHÔNG hiện. Thẻ WestJet® không có bài viết nào, không
 * có thẻ nào cùng chương trình, và công cụ của site không nói về WestJet® —
 * nên nó chỉ thấy đúng ô so sánh. Thà ít hơn là dẫn người đọc tới một trang
 * không nói gì về thứ họ đang xem.
 */
export function CardNextSteps({
  offer,
  offers,
  posts,
  className = "",
}: {
  offer: CreditCardOffer;
  offers: CreditCardOffer[];
  posts: BlogPost[];
  className?: string;
}) {
  const tool = pointsToolFor(offer, {
    awardLabel: t("awardLabel"),
    awardDescription: t("awardDescription"),
    transferLabel: t("transferLabel"),
    transferDescription: t("transferDescription"),
  });
  const sameProgram = samePointsProgramLink(offer, offers);
  const related = relatedPostsForCard(offer, posts, offers);

  return (
    <section className={className}>
      <NextSteps title={t("title")}>
        <StepLink
          href={comparePath([offer.slug])}
          label={t("compareLabel")}
          description={t("compareDescription")}
        />

        {tool && <StepLink href={tool.href} label={tool.label} description={tool.description} />}

        {sameProgram && (
          <StepLink
            href={sameProgram.href}
            label={t("sameProgramLabel", { program: sameProgram.programName })}
            description={t("sameProgramDescription", { count: sameProgram.count })}
          />
        )}
      </NextSteps>

      {related.length > 0 && (
        <>
          <h3 className="mt-8 font-display text-base font-bold text-foreground">
            {t("relatedTitle")}
          </h3>
          <ul className="mt-3 space-y-2">
            {related.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary"
                >
                  <span>
                    <span className="block font-semibold text-foreground">{post.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {post.category} · {formatDate(post.publishedAt)}
                    </span>
                  </span>
                  <ArrowRight size={18} className="shrink-0 text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
