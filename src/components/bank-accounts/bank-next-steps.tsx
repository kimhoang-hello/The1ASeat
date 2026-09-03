import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { bankComparePath } from "@/lib/bank-compare";
import {
  accountMetaLine,
  cardsFromBank,
  otherAccountsFromBank,
  relatedPostsForAccount,
  siblingAccountsAtBank,
} from "@/lib/bank-next-steps";
import { formatDate } from "@/lib/format-date";
import { bankAccountPath, type Bank, type BankAccount } from "@/lib/bank-accounts";
import type { BlogPost, CreditCardOffer } from "@/lib/content";
import { t as translate } from "@/lib/t";

const t = translate("bankNextSteps");
const next = translate("nextSteps");

/** Một dòng dẫn tới trang khác, cùng hình dạng với `StepLink`. */
function LinkRow({
  href,
  title,
  meta,
}: {
  href: string;
  title: string;
  meta: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary"
      >
        <span>
          <span className="block font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{meta}</span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-primary" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * Câu hỏi kế tiếp của người vừa đọc xong một trang tài khoản — bản song song
 * của `CardNextSteps`.
 *
 * Nút "so sánh" vốn đứng cạnh nút apply nay chuyển hẳn vào đây: ở đó nó là một
 * dòng chữ `text-sm` nép bên một nút lớn, còn khối này là chỗ người đọc tìm khi
 * đã đọc hết mà chưa quyết. Mọi mục còn lại chỉ hiện khi thật sự có dữ liệu.
 */
export function BankNextSteps({
  account,
  accounts,
  bank,
  offers,
  posts,
  className = "",
}: {
  account: BankAccount;
  accounts: BankAccount[];
  bank: Bank;
  offers: CreditCardOffer[];
  posts: BlogPost[];
  className?: string;
}) {
  const others = otherAccountsFromBank(account, accounts);
  const siblings = siblingAccountsAtBank(account, accounts);
  const cards = cardsFromBank(bank, offers);
  const related = relatedPostsForAccount(account, bank, posts);

  return (
    <section className={className}>
      <NextSteps title={next("title")}>
        <StepLink
          href={bankComparePath([account.slug])}
          label={t("compareLabel")}
          description={t("compareDescription")}
        />

        {/* Cùng luật với trang thẻ: chỉ giữ cửa "xem tất cả" khi còn tài
            khoản không lọt vào danh sách ngay bên dưới. */}
        {others && others.count > siblings.length && (
          <StepLink
            href={others.href}
            label={t("moreAccountsLabel", { bank: bank.name })}
            description={t("moreAccountsDescription", {
              count: others.count - siblings.length,
            })}
          />
        )}
      </NextSteps>

      {/* Link THẲNG sang từng tài khoản cùng ngân hàng. Xem chú thích của
          `siblingAccountsAtBank`: chừng nào chỉ có link lọc thì cả 29 trang
          tài khoản chỉ có đúng một đường nội bộ dẫn vào, từ trang danh sách. */}
      {siblings.length > 0 && (
        <>
          <h3 className="mt-8 font-display text-base font-bold text-foreground">
            {t("otherAccountsTitle", { bank: bank.name })}
          </h3>
          <ul className="mt-3 space-y-2">
            {siblings.map((sibling) => (
              <LinkRow
                key={sibling.slug}
                href={bankAccountPath(sibling.slug)}
                title={sibling.name}
                meta={accountMetaLine(sibling)}
              />
            ))}
          </ul>
        </>
      )}

      {/* Người vừa mở tài khoản ở một ngân hàng là người dễ mở thẻ của chính
          ngân hàng đó nhất — và trước khối này trang không có đường nào sang
          mục thẻ. Bốn ngân hàng không phát hành thẻ trên site thì mục này
          không hiện. */}
      {cards.length > 0 && (
        <>
          <h3 className="mt-8 font-display text-base font-bold text-foreground">
            {t("cardsTitle", { bank: bank.name })}
          </h3>
          <ul className="mt-3 space-y-2">
            {cards.map((offer) => (
              <LinkRow
                key={offer.slug}
                href={`/credit-cards/${offer.slug}`}
                title={offer.name}
                meta={`${offer.cardType} · ${offer.annualFee}`}
              />
            ))}
          </ul>
        </>
      )}

      {related.length > 0 && (
        <>
          <h3 className="mt-8 font-display text-base font-bold text-foreground">
            {t("relatedTitle")}
          </h3>
          <ul className="mt-3 space-y-2">
            {related.map((post) => (
              <LinkRow
                key={post.slug}
                href={`/blog/${post.slug}`}
                title={post.title}
                meta={`${post.category} · ${formatDate(post.publishedAt)}`}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
