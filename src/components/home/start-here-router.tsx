"use client";

import Link from "next/link";
import { sendGAEvent } from "@next/third-parties/google";
import { ArrowRight } from "@phosphor-icons/react";

/**
 * Ngã ba đầu trang "Bắt đầu ở đây".
 *
 * CÓ THỨ BẬC, không phải bốn nút ngang hàng: bốn lựa chọn cùng cỡ ngầm nói bốn
 * nhu cầu phổ biến như nhau, mà không phải vậy. Hai việc người đọc tới đây hay
 * cần nhất đứng thành nút lớn; hai lối còn lại là link, nhỏ hơn nhưng vẫn nhìn
 * thấy được — nhóm mới định cư là một trong hai nhóm độc giả cốt lõi, không
 * phải thứ để chôn xuống cuối trang.
 *
 * KHÔNG phải wizard. Đã cân nhắc một luồng ba câu hỏi rồi bỏ: nó thêm hai bậc
 * chuyển đổi trước khi trả được giá trị nào, trên một trang chưa có traffic để
 * biện minh. Ở đây một cú bấm là tới đích, và không có state nào để lưu.
 *
 * Đây là component client CHỈ vì `sendGAEvent`. Mọi lựa chọn đều là `<Link>`
 * thật, nên không có JavaScript thì vẫn đi được — chỉ mất số đo.
 */
function track(goal: string) {
  sendGAEvent("event", "start_here_goal", { goal });
}

function Primary({
  href,
  goal,
  label,
  note,
}: {
  href: string;
  goal: string;
  label: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => track(goal)}
      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary"
    >
      <span>
        <span className="block font-display text-base font-bold text-foreground sm:text-lg">
          {label}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{note}</span>
      </span>
      <ArrowRight size={20} weight="bold" className="shrink-0 text-primary" />
    </Link>
  );
}

export function StartHereRouter({
  title,
  cards,
  award,
  basics,
  newcomer,
}: {
  title: string;
  cards: { href: string; label: string; note: string };
  award: { href: string; label: string; note: string };
  basics: { href: string; label: string };
  /** Bỏ trống khi khối newcomer không được render (mục Ngân hàng còn là nháp,
   *  hoặc không tài khoản nào gắn tag `newcomer`). Lối đi mà đích của nó không
   *  tồn tại thì bấm vào không xảy ra gì — tệ hơn là không có lối đó. */
  newcomer?: { href: string; label: string };
}) {
  return (
    <section className="rounded-2xl border border-border bg-secondary p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">{title}</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Primary href={cards.href} goal="cards" label={cards.label} note={cards.note} />
        <Primary href={award.href} goal="award" label={award.label} note={award.note} />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-6">
        <Link
          href={basics.href}
          onClick={() => track("basics")}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {basics.label} &rarr;
        </Link>
        {newcomer && (
          <Link
            href={newcomer.href}
            onClick={() => track("newcomer")}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {newcomer.label} &rarr;
          </Link>
        )}
      </div>
    </section>
  );
}
