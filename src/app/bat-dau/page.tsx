import type { Metadata } from "next";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { getCreditCardOffers, getPosts, type BlogPost } from "@/lib/content";
import { PROGRAMS } from "@/lib/award-charts";
import { BANK_ACCOUNTS } from "@/lib/bank-accounts";
import { BANK_ACCOUNTS_PUBLISHED } from "@/lib/feature-flags";
import { isElevatedLive } from "@/lib/credit-card-state";
import { categoryPath, getCategories } from "@/lib/blog-categories";
import { COMPARE_PATH } from "@/lib/card-compare";
import { creditCardsPath } from "@/lib/card-points-programs";
import { START_HERE_PUBLISHED } from "@/lib/feature-flags";
import { FOUNDATION_SLUGS, foundationPosts, missingFoundationSlugs } from "@/lib/start-here";

import { PageHeader } from "@/components/layout/page-header";
import { NewsletterForm } from "@/components/home/newsletter-form";
import { StartHereRouter } from "@/components/home/start-here-router";
import { StartHereLink } from "@/components/home/start-here-link";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { t as translate } from "@/lib/t";

const t = translate("startHere");

/**
 * Đường vào cho người mới.
 *
 * Site có sáu bài kiến thức và bốn công cụ, nhưng không có chỗ nào nói nên đọc
 * cái gì trước và làm gì tiếp theo — người mới sang Canada mở trang chủ ra thì
 * thấy một danh sách thẻ và một danh sách bài, không thấy một con đường.
 *
 * Mọi con số trên trang này tính lúc render từ dữ liệu thật (số bài, số thẻ,
 * số thẻ đang chạy elevated offer, số chương trình trong Award Flight Finder),
 * nên không có câu nào có thể cũ đi mà không ai biết.
 */
export const revalidate = 60;

/** Chuyên mục chứa các bài nền tảng. Khớp đúng tên trong Contentful. Chỉ dùng
 *  cho link "Xem cả chuyên mục" ở cuối Bước 1 — lộ trình đọc KHÔNG lấy từ đây. */
const FOUNDATION_CATEGORY = "Kiến thức";

export const metadata: Metadata = {
  ...pageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/bat-dau",
  }),
  // Chưa công bố thì cũng không cho Google index — cùng lý do với trang Ngân
  // hàng lúc còn là bản nháp.
  ...(START_HERE_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
};

function Step({
  n,
  id,
  title,
  body,
  children,
}: {
  n: number;
  id?: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li
      id={id}
      className="relative scroll-mt-28 rounded-2xl border border-border bg-card p-5 sm:p-7"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {t("stepLabel", { n })}
      </p>
      <h2 className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-foreground/90">{body}</p>
      <div className="mt-5">{children}</div>
    </li>
  );
}

/**
 * `note` là dòng phụ nói link này dẫn tới cái gì, cùng vai trò với dòng phụ ở
 * bốn ô ngã ba. Hai link trong khối newcomer cần nó nhất: đó là chỗ duy nhất
 * trên trang nói ra *căn cứ* của hai lựa chọn mà site dám đưa cho người chưa
 * có credit history.
 */
function StepLink({
  href,
  step,
  target,
  note,
  children,
}: {
  href: string;
  step: number;
  target: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <StartHereLink
        href={href}
        step={step}
        target={target}
        className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3.5 text-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <span>
          <span className="block text-base font-semibold">{children}</span>
          {note && <span className="mt-0.5 block text-sm text-muted-foreground">{note}</span>}
        </span>
        <ArrowRight size={18} className="shrink-0 text-primary" />
      </StartHereLink>
    </li>
  );
}

/**
 * Có `excerpt` chứ không chỉ tiêu đề: một bài trong lộ trình tên "Know Your
 * Minimum" — tiếng Anh, không phụ đề — thì người mới sang Canada không đoán
 * được "minimum" là minimum spend, mức điểm tối thiểu để đổi, hay nguyên tắc
 * chi tiêu. `excerptVi` của cả sáu bài đều do người viết, không phải chuỗi tự
 * sinh, nên nó là ngữ cảnh thật chứ không phải chữ lấp chỗ.
 */
function PostStep({ post, order }: { post: BlogPost; order: number }) {
  return (
    <li>
      <StartHereLink
        href={`/blog/${post.slug}`}
        step={1}
        target={post.slug}
        className="flex items-start gap-4 rounded-xl border border-border px-4 py-3.5 transition-colors hover:border-primary"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
          {order}
        </span>
        <span>
          <span className="block font-semibold text-foreground">{post.title}</span>
          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
            {post.excerpt}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t("readingTime", { minutes: post.minutesRead })}
          </span>
        </span>
      </StartHereLink>
    </li>
  );
}

export default async function StartHerePage() {
  const [posts, offers] = await Promise.all([getPosts(), getCreditCardOffers()]);

  const category = getCategories(posts).find((c) => c.name === FOUNDATION_CATEGORY);

  const foundation = foundationPosts(posts);

  // Một slug biến mất khỏi Contentful (đổi slug, unpublish, xoá) thì bài đó
  // lặng lẽ rơi khỏi lộ trình và không chỗ nào đỏ lên. Ghi ra log server để
  // lượt deploy sau còn nhìn thấy; trang vẫn render với những bài còn lại,
  // vì một lộ trình thiếu một bài vẫn tốt hơn một trang gãy.
  if (foundation.length !== FOUNDATION_SLUGS.length) {
    console.warn(
      `[bat-dau] Thiếu bài trong lộ trình Bước 1: ${missingFoundationSlugs(posts).join(", ")}`,
    );
  }

  const elevated = offers.filter(isElevatedLive).length;
  // Chỉ những tài khoản mà chính ngân hàng công bố là dành cho người mới định
  // cư. Mục Ngân hàng còn là bản nháp thì khối này biến mất cùng nó.
  const newcomerAccounts = BANK_ACCOUNTS_PUBLISHED
    ? BANK_ACCOUNTS.filter((account) => account.tags.includes("newcomer"))
    : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [breadcrumbJsonLd([{ name: t("title"), path: "/bat-dau" }])],
  };

  return (
    <>
      {/* Trang chưa công bố vẫn vào được bằng URL trực tiếp, nên nó phải tự
          nói ra điều đó. Dải này biến mất cùng lúc với việc bật cờ. */}
      {!START_HERE_PUBLISHED && (
        <p className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900 sm:px-6 lg:px-8">
          {t("draftNotice")}
        </p>
      )}

      <JsonLd data={jsonLd} />
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <StartHereRouter
            title={t("routerTitle")}
            cards={{
              // Danh sách, KHÔNG phải trang so sánh: người chưa biết chọn gì
              // thì chưa có hai ứng viên để đặt cạnh nhau.
              href: "/credit-cards",
              label: t("routerCards"),
              note: t("routerCardsNote", { cards: offers.length, elevated }),
            }}
            award={{
              href: "/award-flight-finder",
              label: t("routerAward"),
              note: t("routerAwardNote", { programs: PROGRAMS.length }),
            }}
            basics={
              // Lộ trình rỗng thì lối này dẫn tới một khối trống — bỏ hẳn lối
              // đi còn hơn để nó dẫn vào chỗ không có gì.
              foundation.length > 0
                ? {
                    href: "#co-ban",
                    label: t("routerBasics"),
                    note: t("routerBasicsNote", { count: foundation.length }),
                  }
                : undefined
            }
            newcomer={
              // Chỉ khi khối bên dưới thật sự được render — xem chú thích ở
              // `StartHereRouter`.
              newcomerAccounts.length > 0
                ? {
                    href: "#moi-sang-canada",
                    label: t("routerNewcomer"),
                    note: t("routerNewcomerNote"),
                  }
                : undefined
            }
          />

          {/* Ngay dưới ngã ba, không phải cuối trang: nhóm mới định cư là một
              trong hai nhóm độc giả cốt lõi, và câu quan trọng nhất với họ là
              câu nói thẳng site này chưa biết gì. */}
          {newcomerAccounts.length > 0 && (
            <section
              id="moi-sang-canada"
              className="scroll-mt-28 rounded-2xl border border-border bg-card p-5 sm:p-6"
            >
              <h2 className="font-display text-lg font-bold text-foreground">
                {t("newcomerTitle")}
              </h2>
              <p className="mt-2 text-base leading-relaxed text-foreground/90">
                {t("newcomerBody")}
              </p>
              <ul className="mt-4 space-y-2">
                <StepLink
                  href="/bank-accounts?filter=newcomer"
                  step={0}
                  target="bank-accounts"
                  note={t("newcomerAccountsNote")}
                >
                  {t("newcomerAccounts", { count: newcomerAccounts.length })}
                </StepLink>
                {foundation.length > 0 && (
                  <StepLink
                    href="#co-ban"
                    step={0}
                    target="basics"
                    note={t("newcomerBasicsNote")}
                  >
                    {t("newcomerBasics")}
                  </StepLink>
                )}
              </ul>
            </section>
          )}

        <ol className="flex flex-col gap-5">
          <Step
            n={1}
            id="co-ban"
            title={t("step1Title")}
            body={
              // Không bao giờ in "0 bài dưới đây xếp theo đúng thứ tự nên đọc".
              // Bước 1 vẫn phải render kể cả khi rỗng, nếu không thì còn lại
              // Bước 2, 3, 4 mà không có Bước 1.
              foundation.length > 0
                ? t("step1Body", { count: foundation.length })
                : t("step1BodyEmpty")
            }
          >
            {foundation.length > 0 && (
              <ul className="space-y-2">
                {foundation.map((post, index) => (
                  <PostStep key={post.slug} post={post} order={index + 1} />
                ))}
              </ul>
            )}
            {category && (
              <StartHereLink
                href={categoryPath(category.slug)}
                step={1}
                target="category"
                className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
              >
                {t("step1Cta")} &rarr;
              </StartHereLink>
            )}
          </Step>

          <Step
            n={2}
            title={t("step2Title")}
            body={t("step2Body", { cards: offers.length, elevated })}
          >
            <ul className="space-y-2">
              <StepLink href="/credit-cards" step={2} target="credit-cards">
                {t("step2LinkCards")}
              </StepLink>
              <StepLink href={creditCardsPath({ type: "noi-bat" })} step={2} target="elevated">
                {t("step2LinkElevated")}
              </StepLink>
              <StepLink href={COMPARE_PATH} step={2} target="compare">
                {t("step2LinkCompare")}
              </StepLink>
            </ul>
          </Step>

          <Step n={3} title={t("step3Title")} body={t("step3Body")}>
            <ul className="space-y-2">
              <StepLink href="/award-flight-finder" step={3} target="award-finder">
                {t("step3LinkAward", { programs: PROGRAMS.length })}
              </StepLink>
              <StepLink href="/transfer-partners" step={3} target="transfer-partners">
                {t("step3LinkPartners")}
              </StepLink>
              <StepLink href="/calculator" step={3} target="calculator">
                {t("step3LinkCalculator")}
              </StepLink>
            </ul>
          </Step>

          <Step n={4} title={t("step4Title")} body={t("step4Body")}>
            <ul className="space-y-2">
              <StepLink href="/transfer-bonuses" step={4} target="transfer-bonuses">
                {t("step4LinkBonuses")}
              </StepLink>
            </ul>
            <p className="mt-5 text-base text-foreground/90">{t("step4Newsletter")}</p>
            <div className="mt-3">
              <NewsletterForm id="start-here-newsletter" source="start_here" />
            </div>
          </Step>
        </ol>
        </div>
      </section>
    </>
  );
}
