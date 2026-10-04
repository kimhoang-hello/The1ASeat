import Link from "next/link";
import type { CanadianAnswer, UsCardCanadianPerspective } from "@/lib/us-credit-cards";
import { Flag } from "@/components/ui/flag";
import { t as translate } from "@/lib/t";

const us = translate("usCards");

/**
 * "Góc nhìn từ Canada" trên trang của một thẻ Mỹ: năm câu hỏi người Canada
 * luôn hỏi trước khi apply thẻ US, mỗi câu một câu trả lời đọc lướt được (in
 * đậm) và một dòng giải thích.
 *
 * Câu trả lời là CHỮ, không phải yes/no, vì với người không cư trú ngân hàng
 * Mỹ gần như không công bố điều kiện — "Tuỳ trường hợp" kèm lý do là câu trả
 * lời trung thực, còn ép thành "Có"/"Không" là hứa một điều không ai kiểm được.
 *
 * Khung và nền theo `EditorsTake` ngay phía trên nó trong trang: cùng một loại
 * "Ghế 1A nói gì về thẻ này", nên cùng một hình dạng.
 */
export function CanadianPerspective({
  perspective,
  guideHref,
  className = "",
}: {
  perspective: UsCardCanadianPerspective;
  /** Vắng khi bài hướng dẫn chưa có — link khi đó tự ẩn. */
  guideHref?: string;
  className?: string;
}) {
  const rows: { label: string; answer: CanadianAnswer }[] = [
    { label: us("perspectiveItin"), answer: perspective.itin },
    { label: us("perspectiveHistory"), answer: perspective.usCreditHistory },
    { label: us("perspectiveAddress"), answer: perspective.usAddress },
    { label: us("perspectiveFtf"), answer: perspective.foreignTransactionFee },
    { label: us("perspectivePoints"), answer: perspective.pointsFromCanada },
  ];

  return (
    <section className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
      <h2 className="flex items-center gap-[0.35em] font-display text-xl font-bold text-foreground">
        <Flag country="ca" />
        {us("perspectiveTitle")}
      </h2>

      <dl className="mt-3 divide-y divide-border">
        {rows.map(({ label, answer }) => (
          // Nhãn và câu trả lời chung một hàng từ `sm`, chồng lên nhau dưới
          // đó — cột nhãn 12rem trên màn 375px chỉ để lại chưa tới 10rem cho
          // phần giải thích.
          <div key={label} className="py-3 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 sm:mt-0">
              <span className="font-semibold text-foreground">{answer.short}</span>
              {answer.note && (
                <span className="mt-0.5 block text-sm leading-relaxed text-foreground/80">
                  {answer.note}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/* Một hàng nữa sau đường kẻ, không phải hộp nền kem lồng trong khối
          (04/10/2026). Nhãn màu hổ phách: đây đúng nghĩa "cần chú ý" của token
          `warning` (DESIGN-SYSTEM.md 3.2), không phải navy — màu của link. */}
      <div className="border-t border-border pt-3">
        <p className="text-sm font-semibold text-warning">{us("perspectiveWatchOut")}</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{perspective.watchOut}</p>
      </div>

      {guideHref && (
        <Link
          href={guideHref}
          className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          &rarr; {us("perspectiveGuide")}
        </Link>
      )}
    </section>
  );
}
