import { ArrowRight } from "@phosphor-icons/react/ssr";

import type { QuestionSpec } from "@/lib/recommender/questions";
import { answerQuestion, skipCurrentQuestion } from "@/app/credit-cards/goi-y/actions";

/**
 * Một câu hỏi = một form.
 *
 * MỖI LỰA CHỌN LÀ MỘT NÚT GỬI. Không có bước "chọn rồi bấm Tiếp tục": một chạm
 * là một câu trả lời, và không cần JavaScript để hoạt động. Với câu chọn nhiều
 * (thẻ đang giữ, chương trình điểm) thì phải có nút gửi riêng — đó là lý do duy
 * nhất nó tồn tại.
 *
 * "Bỏ qua" luôn có mặt, trừ câu mục tiêu: không có mục tiêu thì không có gì để
 * tính, còn mọi câu khác đều được phép không trả lời (hồ sơ thiếu vẫn ra kết
 * quả, chỉ kém chắc hơn — §29/§30).
 */
export function QuestionCard({
  spec,
  lead,
  skippable = true,
}: {
  spec: QuestionSpec;
  /** Một dòng nói vì sao câu này đáng trả lời NGAY BÂY GIỜ. */
  lead?: string;
  skippable?: boolean;
}) {
  const holding = new Set(spec.input.type === "cards" ? spec.input.holding : []);
  const closed = new Set(spec.input.type === "cards" ? spec.input.closed : []);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      {lead && <p className="text-xs font-semibold uppercase tracking-wide text-primary">{lead}</p>}
      <h2 className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">{spec.title}</h2>
      <p className="mt-2 text-base leading-relaxed text-foreground/80">{spec.help}</p>

      <form action={answerQuestion} className="mt-5">
        <input type="hidden" name="question" value={spec.key} />

        {spec.input.type === "choice" && (
          <ul className="space-y-2">
            {spec.input.options.map((option) => (
              <li key={option.value}>
                <button
                  type="submit"
                  name="answer"
                  value={option.value}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-4 py-3.5 text-left transition-colors hover:border-primary hover:text-primary"
                >
                  <span>
                    <span className="block text-base font-semibold">{option.label}</span>
                    {option.hint && (
                      <span className="mt-0.5 block text-sm text-muted-foreground">{option.hint}</span>
                    )}
                  </span>
                  <ArrowRight size={18} className="shrink-0 text-primary" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {spec.input.type === "cards" && (
          <div className="space-y-4">
            {/* Lối ra NGẮN NHẤT nằm trên đầu: phần lớn người mới không có thẻ
                nào, và bắt họ cuộn qua 34 thẻ (68 ô tick) để tới nút "xong" là
                bắt họ trả giá cho trường hợp của người khác. */}
            {/* `none` là cờ ghi đè: nút này nằm CÙNG form với các ô tick, nên
                nếu người dùng tick vài thẻ rồi đổi ý bấm vào đây, các ô đã tick
                vẫn được gửi lên. Cờ nói với máy chủ rằng câu trả lời là "không
                có gì", bất kể ô nào đang tick (Codex, vòng UX). */}
            <button
              type="submit"
              name="none"
              value="1"
              className="w-full cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Mình chưa có thẻ nào &rarr;
            </button>
            <p className="text-sm text-muted-foreground">
              Có rồi thì mở ngân hàng tương ứng và tick thẻ của bạn — cả thẻ đang giữ lẫn thẻ từng
              giữ rồi đóng.
            </p>
            {spec.input.groups.map((group) => (
              <details
                key={group.issuer}
                // Đang sửa thì ngân hàng có thẻ đã khai mở sẵn: thẻ tick sẵn mà
                // nằm trong khối gập thì người dùng không thấy nó còn đó.
                open={group.cards.some(
                  (card) => holding.has(card.value) || closed.has(card.value),
                )}
                className="rounded-xl border border-border px-4 py-3"
              >
                <summary className="cursor-pointer text-base font-semibold text-foreground">
                  {group.issuer}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {group.cards.length} thẻ
                  </span>
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {group.cards.map((card) => (
                    <li
                      key={card.value}
                      className="flex flex-col gap-1 rounded-xl border border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-base text-foreground">{card.label}</span>
                      <span className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-sm text-foreground/80">
                          <input
                            type="checkbox"
                            name="holding"
                            value={card.value}
                            defaultChecked={holding.has(card.value)}
                            className="size-4"
                          />
                          Đang giữ
                        </label>
                        <label className="flex items-center gap-1.5 text-sm text-foreground/80">
                          <input
                            type="checkbox"
                            name="closed"
                            value={card.value}
                            defaultChecked={closed.has(card.value)}
                            className="size-4"
                          />
                          Đã đóng
                        </label>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <SubmitRow label="Xong" />
          </div>
        )}

        {spec.input.type === "programs" && (
          <div className="space-y-4">
            <button
              type="submit"
              name="none"
              value="1"
              className="w-full cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Mình chưa có điểm ở đâu cả &rarr;
            </button>
            <p className="text-sm text-muted-foreground">
              Có rồi thì tick những chương trình bạn đang có tài khoản.
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {spec.input.programs.map((program) => (
                <li key={program.value}>
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-base text-foreground">
                    <input
                      type="checkbox"
                      name="programs"
                      value={program.value}
                      defaultChecked={spec.input.type === "programs" && spec.input.selected.includes(program.value)}
                      className="size-4"
                    />
                    {program.label}
                  </label>
                </li>
              ))}
            </ul>
            <SubmitRow label="Xong" />
          </div>
        )}

        {spec.input.type === "number" && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              name="answer"
              inputMode="numeric"
              min={spec.input.min}
              max={spec.input.max}
              step={1}
              required
              defaultValue={spec.input.current ?? undefined}
              placeholder={spec.input.placeholder}
              className="w-40 rounded-lg border border-border bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary"
            />
            <SubmitRow label="Xong" inline />
          </div>
        )}

        {spec.input.type === "month" && (
          <div className="flex flex-wrap items-center gap-3">
            <select
              name="month"
              required
              defaultValue={spec.input.current ?? undefined}
              className="rounded-lg border border-border bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary"
            >
              {spec.input.months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <SubmitRow label="Xong" inline />
          </div>
        )}
      </form>

      {skippable && (
        <form action={skipCurrentQuestion} className="mt-4">
          <input type="hidden" name="question" value={spec.key} />
          <button
            type="submit"
            className="cursor-pointer text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            Bỏ qua câu này
          </button>
        </form>
      )}
    </section>
  );
}

function SubmitRow({ label, inline = false }: { label: string; inline?: boolean }) {
  return (
    <button
      type="submit"
      className={`${inline ? "" : "mt-1 "}inline-block cursor-pointer rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover`}
    >
      {label} &rarr;
    </button>
  );
}
