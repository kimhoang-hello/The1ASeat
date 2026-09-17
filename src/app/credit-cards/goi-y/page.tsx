import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getCreditCardOffers } from "@/lib/content";
import { RECOMMENDER_PUBLISHED } from "@/lib/feature-flags";
import { todayInSiteZone } from "@/lib/format-date";
import { asksForAttention, followUpAfterSkips } from "@/lib/recommender/follow-up";
import { answeredRows, presentRun } from "@/lib/recommender/present";
import { questionFor, questionFromKey } from "@/lib/recommender/questions";
import {
  currentUserId,
  loadState,
  recommenderStorageReady,
  runForDisplay,
  skippedQuestions,
} from "@/lib/recommender/session";
import { resetRecommendation } from "@/app/credit-cards/goi-y/actions";
import { PageHeader } from "@/components/layout/page-header";
import { ExplainedWhy } from "@/components/recommender/explanation";
import { QuestionCard } from "@/components/recommender/question-card";
import { DeterministicWhy, Result } from "@/components/recommender/result";
import { StartPanel } from "@/components/recommender/start-panel";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

/**
 * Gợi ý thẻ theo hoàn cảnh của từng người — mặt trước của recommendation engine.
 *
 * LUÔN ĐỘNG. Trang đọc cookie và hồ sơ trong database, nên nó không được cache:
 * một bản HTML dùng chung là kết quả của người này hiện ra cho người kia.
 *
 * Next tự gắn `Cache-Control: no-cache, must-revalidate` cho route động, và nó
 * ghi đè cả header khai trong `next.config.ts` — nên KHÔNG có cách nào khai
 * thêm một lớp bảo vệ ở đó (đã thử: header của config không tới được response
 * này). Lớp còn lại là CDN: trước khi bật `RECOMMENDER_PUBLISHED`, phải mở
 * trang bằng hai trình duyệt khác nhau trên production và xác nhận mỗi bên
 * thấy hồ sơ của chính mình.
 *
 * Ba trạng thái, theo đúng thứ tự:
 *
 *   chưa có hồ sơ  → màn hình bắt đầu (mục tiêu + nước ở);
 *   còn câu GÁC CỔNG → hỏi một câu, chưa hiện kết quả — câu trả lời có thể đổi
 *                      cả tập ứng viên (`followUp.basis === "gatekeeper"`), nên
 *                      hiện kết quả lúc này là hiện một thứ sắp đổi;
 *   còn lại        → kết quả, kèm MỘT câu hỏi tinh chỉnh nếu còn câu đáng hỏi.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Gợi ý thẻ tín dụng theo hoàn cảnh của bạn",
    description:
      "Trả lời vài câu, Ghế 1A gợi ý bước tiếp theo: nên mở thẻ nào, hay chưa cần mở thẻ nào cả.",
    path: "/credit-cards/goi-y",
  }),
  // Công cụ còn là bản nháp thì không cho Google index — cùng cách làm với
  // trang Ngân hàng và "Bắt đầu ở đây" lúc chúng còn nháp.
  ...(RECOMMENDER_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? null) : null;
}

export default async function RecommenderPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = first(params.loi);
  const outsideCanada = first(params["ngoai-canada"]) !== null;
  const editKey = first(params.sua);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: "Thẻ tín dụng", path: "/credit-cards" },
        { name: "Gợi ý cho bạn", path: "/credit-cards/goi-y" },
      ]),
    ],
  };

  return (
    <>
      {!RECOMMENDER_PUBLISHED && (
        <p className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900 sm:px-6 lg:px-8">
          Bản nháp — công cụ đang thử, nội dung có thể đổi.
        </p>
      )}
      <JsonLd data={jsonLd} />
      <PageHeader
        eyebrow="Công cụ"
        title="Gợi ý thẻ cho hoàn cảnh của bạn"
        subtitle="Trả lời vài câu. Mình chỉ hỏi những gì thật sự đổi được kết quả, và nói thẳng khi câu trả lời là chưa nên mở thẻ nào."
      />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-5">
          {error && (
            <p className="rounded-xl border border-border bg-card px-4 py-3 text-base text-destructive">
              {error}
            </p>
          )}
          {outsideCanada && <OutsideCanadaNotice />}
          <Body editKey={editKey} />
        </div>
      </section>
    </>
  );
}

function OutsideCanadaNotice() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-foreground">
        Công cụ này chỉ dùng được cho người đang ở Canada
      </h2>
      <p className="mt-2 text-base leading-relaxed text-foreground/90">
        Mọi thẻ Ghế 1A theo dõi đều là thẻ Canada, và ngân hàng đòi bạn cư trú ở Canada mới mở được.
        Gợi ý thẻ cho người ở nước khác thì mình sẽ khuyên một thứ bạn không mở nổi, nên mình không
        làm vậy.
      </p>
      <p className="mt-3 text-base leading-relaxed text-foreground/90">
        Bạn vẫn đọc được{" "}
        <Link href="/blog" className="font-semibold text-primary underline underline-offset-4">
          các bài hướng dẫn
        </Link>{" "}
        và{" "}
        <Link
          href="/award-flight-finder"
          className="font-semibold text-primary underline underline-offset-4"
        >
          công cụ tra vé thưởng
        </Link>
        .
      </p>
    </section>
  );
}

function BrokenProfileNotice() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-foreground">
        Hồ sơ cũ của bạn không chạy lại được
      </h2>
      <p className="mt-2 text-base leading-relaxed text-foreground/90">
        Có thể do dữ liệu thẻ đã đổi kể từ lần trước. Bắt đầu lại giúp mình — chỉ mất vài câu.
      </p>
      <form action={resetRecommendation} className="mt-4">
        <button
          type="submit"
          className="inline-block cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Làm lại từ đầu &rarr;
        </button>
      </form>
    </section>
  );
}

async function Body({ editKey }: { editKey: string | null }) {
  if (!recommenderStorageReady()) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-foreground">Công cụ đang tạm nghỉ</h2>
        <p className="mt-2 text-base leading-relaxed text-foreground/90">
          Chỗ lưu hồ sơ chưa sẵn sàng, nên mình chưa chạy gợi ý được. Thử lại sau giúp mình.
        </p>
      </section>
    );
  }

  const userId = await currentUserId();
  const stored = userId === null ? null : await loadState(userId);
  if (userId === null || stored === null) return <StartPanel />;

  let run;
  try {
    run = await runForDisplay(userId, stored);
  } catch (error) {
    // Hồ sơ trong kho không chạy được (dữ liệu cũ, một trường đã đổi nghĩa).
    // Người dùng phải còn đường ra: không có khối này thì mọi lần mở trang đều
    // nổ TRƯỚC khi nút "Làm lại từ đầu" kịp hiện (Codex vòng 2).
    console.error("[goi-y] không chạy được hồ sơ đã lưu", error);
    return <BrokenProfileNotice />;
  }
  const { record, dataset } = run;
  const offers = await getCreditCardOffers();
  const view = presentRun(record, dataset, offers);
  if (view === null) return <StartPanel />;

  const ctx = { dataset, today: todayInSiteZone() };
  const skipped = await skippedQuestions();

  // Người dùng bấm "Sửa" trên một dòng đã trả lời: hỏi lại đúng câu đó, không
  // phải câu engine đang muốn hỏi.
  const edit = editKey === null ? null : questionFromKey(editKey, stored.state, ctx);
  if (edit !== null) {
    return (
      <>
        <QuestionCard spec={edit} lead="Sửa câu trả lời" />
        <p className="text-sm text-muted-foreground">
          Trả lời xong mình tính lại ngay. Bấm &ldquo;Bỏ qua câu này&rdquo; để giữ nguyên câu trả lời
          cũ.
        </p>
      </>
    );
  }

  const followUp = followUpAfterSkips(record, dataset, skipped);
  const question =
    followUp === null
      ? null
      : questionFor({ kind: followUp.gapKind, subject: followUp.subject }, stored.state, ctx);

  // Câu GÁC CỔNG hỏi trước khi hiện kết quả: nó có thể đổi cả tập ứng viên
  // (bạn đang giữ thẻ nào, có điểm ở đâu), nên kết quả hiện lúc này là kết quả
  // sắp đổi. Các câu còn lại chỉ tinh chỉnh, nên hiện kết quả trước.
  if (question !== null && followUp?.basis === "gatekeeper") {
    return <QuestionCard spec={question} lead="Câu hỏi nền" />;
  }

  // Câu KHÔNG đo được là đổi kết quả thì không chiếm chỗ của một câu hỏi thật:
  // nó nằm trong khối gập "muốn chắc hơn" — xem `asksForAttention`.
  const upfront = question !== null && followUp !== null && asksForAttention(followUp);

  return (
    <Result
      view={view}
      answered={answeredRows(stored.state, dataset)}
      // Phase 6: lời giải thích của Claude CHỈ thay khối "vì sao hợp". Kết quả,
      // cảnh báo, độ chắc chắn, nút đăng ký đã hiện xong trước khi nó tới, và
      // mọi nhánh hỏng của nó dựng lại đúng khối bảng tra (fallback).
      why={
        <Suspense fallback={<DeterministicWhy action={view.primary} />}>
          <ExplainedWhy view={view} />
        </Suspense>
      }
    >
      {question !== null &&
        (upfront ? (
          <QuestionCard
            spec={question}
            lead={
              followUp?.basis === "measured"
                ? "Câu này có thể ĐỔI thẻ được gợi ý"
                : "Một câu nữa thôi"
            }
          />
        ) : (
          <details className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <summary className="cursor-pointer font-display text-lg font-bold text-foreground">
              Muốn chắc hơn? Trả lời thêm một câu
            </summary>
            <p className="mt-2 text-base leading-relaxed text-foreground/80">
              Câu này không đổi thẻ mình đang gợi ý, nhưng nó lấp một chỗ mình còn chưa biết.
            </p>
            <div className="mt-4">
              <QuestionCard spec={question} />
            </div>
          </details>
        ))}
    </Result>
  );
}
