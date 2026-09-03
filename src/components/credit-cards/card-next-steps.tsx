import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import type { BlogPost, CreditCardOffer } from "@/lib/content";
import { comparePath } from "@/lib/card-compare";
import {
  bankAccountsFromIssuer,
  pointsToolFor,
  relatedPostsForCard,
  samePointsProgramLink,
  siblingCardsInProgram,
} from "@/lib/card-next-steps";
import { accountMetaLine } from "@/lib/bank-next-steps";
import { BANK_ACCOUNTS, bankAccountPath } from "@/lib/bank-accounts";
import { BANK_ACCOUNTS_PUBLISHED } from "@/lib/feature-flags";
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
  const siblings = siblingCardsInProgram(offer, offers);
  // Hai chứ không phải ba như bên trang tài khoản: trang thẻ đã có ba khối
  // link ở đuôi (đi tiếp, thẻ cùng hệ điểm, bài viết liên quan), và đây là
  // khối họ hàng xa nhất trong bốn khối.
  //
  // Cờ `BANK_ACCOUNTS_PUBLISHED` phải kiểm ở đây: mục tài khoản khi tắt cờ vẫn
  // build và vẫn vào được bằng URL trực tiếp, nhưng không được xuất hiện ở bất
  // cứ chỗ nào người đọc bấm nhầm vào — xem chú thích của chính cờ đó.
  const issuerBank = BANK_ACCOUNTS_PUBLISHED
    ? bankAccountsFromIssuer(offer, BANK_ACCOUNTS, 2)
    : null;
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

        {/* Chỉ là cửa "xem tất cả" khi còn thẻ không lọt vào danh sách ngay
            bên dưới. Còn dưới ngưỡng đó thì ba link thẳng đã nói đủ, và thêm
            một link lọc ra đúng ba thẻ ấy chỉ tổ làm loãng. */}
        {sameProgram && sameProgram.count > siblings.length && (
          <StepLink
            href={sameProgram.href}
            label={t("moreProgramLabel", { program: sameProgram.programName })}
            description={t("moreProgramDescription", {
              count: sameProgram.count - siblings.length,
            })}
          />
        )}
      </NextSteps>

      {/* Link THẲNG sang từng thẻ cùng hệ điểm, không phải một link lọc.
          Xem chú thích của `siblingCardsInProgram`: chừng nào chỉ có link lọc
          thì tám trang thẻ — trong đó cả bốn thẻ Aeroplan® — chỉ có đúng một
          đường nội bộ dẫn vào, từ trang danh sách. */}
      {sameProgram && siblings.length > 0 && (
        <NextSteps
          title={t("siblingsTitle", { program: sameProgram.programName })}
          headingLevel="h3"
          compact
          className="mt-8"
        >
          {siblings.map((sibling) => (
            <StepLink
              key={sibling.slug}
              href={`/credit-cards/${sibling.slug}`}
              label={sibling.name}
              description={`${sibling.cardType} · ${sibling.annualFee}`}
            />
          ))}
        </NextSteps>
      )}

      {/* Chiều còn thiếu giữa hai mục lớn nhất của site: trang tài khoản đã
          trỏ sang thẻ cùng ngân hàng từ đầu, trang thẻ thì chưa trỏ ngược
          lại. Xem chú thích của `bankAccountsFromIssuer`. */}
      {issuerBank && (
        <NextSteps
          title={t("bankAccountsTitle", { bank: issuerBank.bank.name })}
          headingLevel="h3"
          compact
          className="mt-8"
        >
          {issuerBank.accounts.map((account) => (
            <StepLink
              key={account.slug}
              href={bankAccountPath(account.slug)}
              label={account.name}
              description={accountMetaLine(account)}
            />
          ))}
        </NextSteps>
      )}

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
