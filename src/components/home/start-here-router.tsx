"use client";

import Link from "next/link";
import { sendGAEvent } from "@next/third-parties/google";
import { ArrowRight } from "@phosphor-icons/react";

/**
 * Ngã ba đầu trang "Bắt đầu ở đây".
 *
 * BỐN Ô BẰNG NHAU, cố ý.
 *
 * Bản đầu chia hai tầng: "chọn thẻ" và "bay về Việt Nam" là nút lớn, "chưa
 * hiểu gì" và "mới sang Canada" là link nhỏ. Bỏ, vì thứ bậc đó ngược trên đúng
 * trang này. Trang tên là "Bắt đầu ở đây" nên người tới đây theo định nghĩa là
 * người chưa biết bắt đầu từ đâu — "tôi chưa hiểu Miles & Points là gì" nhiều
 * khả năng là nhu cầu phổ biến NHẤT ở đây, mà nó lại là thứ nhỏ nhất. Ai đã
 * biết mình muốn chọn thẻ thì bấm thẳng "Thẻ tín dụng" trên nav. Và người mới
 * định cư là một trong hai nhóm độc giả cốt lõi trong PRODUCT.md.
 *
 * Sâu hơn: thứ bậc mã hoá một phỏng đoán về nhu cầu nào phổ biến hơn — đúng
 * câu hỏi mà `start_here_goal` được gắn vào để trả lời. Trước khi có số, bốn ô
 * bằng nhau là mặc định trung thực. Có số rồi thì nâng cái thắng lên, và lúc
 * đó là quyết định dựa trên dữ liệu chứ không phải trực giác.
 *
 * Ô bằng nhau cũng cho cả bốn một vùng chạm thật — PRODUCT.md ghi rõ có độc
 * giả lớn tuổi và mobile là mặt trận chính, mà link `text-sm` là kiểu phần tử
 * tệ nhất cho cả hai ràng buộc đó.
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

function Choice({
  href,
  goal,
  label,
  note,
}: {
  href: string;
  goal: string;
  label: string;
  /** Bỏ trống ở hai lối không có con số nào đáng nói kèm. Ô vẫn cùng cỡ. */
  note?: string;
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
        {note && <span className="mt-1 block text-sm text-muted-foreground">{note}</span>}
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
  /** Bỏ trống khi lộ trình Bước 1 rỗng — cùng lý do với `newcomer` bên dưới. */
  basics?: { href: string; label: string; note: string };
  /** Bỏ trống khi khối newcomer không được render (mục Ngân hàng còn là nháp,
   *  hoặc không tài khoản nào gắn tag `newcomer`). Lối đi mà đích của nó không
   *  tồn tại thì bấm vào không xảy ra gì — tệ hơn là không có lối đó. */
  newcomer?: { href: string; label: string; note: string };
}) {
  return (
    <section className="rounded-2xl border border-border bg-secondary p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">{title}</h2>

      {/* `auto-rows-fr` chứ không phải `items-stretch`. Cái sau chỉ kéo ô cho
          bằng nhau TRONG một hàng, không kéo giữa các hàng — mà trên mobile
          bốn ô nằm bốn hàng riêng, nên nhãn dài hai dòng cho ra ô cao hơn và
          bốn ô lại lệch. Bốn ô lệch cao đọc ra là bốn mức quan trọng khác
          nhau, đúng thứ vừa bỏ đi. */}
      <div className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2">
        <Choice href={cards.href} goal="cards" label={cards.label} note={cards.note} />
        <Choice href={award.href} goal="award" label={award.label} note={award.note} />
        {basics && (
          <Choice href={basics.href} goal="basics" label={basics.label} note={basics.note} />
        )}
        {newcomer && (
          <Choice
            href={newcomer.href}
            goal="newcomer"
            label={newcomer.label}
            note={newcomer.note}
          />
        )}
      </div>
    </section>
  );
}
