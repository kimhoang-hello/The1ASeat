import { ArrowRight } from "@phosphor-icons/react/ssr";

import { startRecommendation } from "@/app/credit-cards/goi-y/actions";
import { GOAL_OPTIONS } from "@/lib/recommender/questions";

/**
 * Màn hình đầu: mục tiêu, và một câu xác nhận đang ở Canada.
 *
 * Hai thứ trong một lần bấm vì cả hai đều là điều kiện để có hồ sơ: không mục
 * tiêu thì không hàm chấm điểm nào áp được (§10), còn nước ở thì `validateUserState`
 * đòi phải có. Mọi câu khác đều hỏi sau, và chỉ khi câu trả lời đổi được kết quả.
 */
export function StartPanel() {
  return (
    <form action={startRecommendation} className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
          Mục tiêu của bạn là gì?
        </h2>
        <p className="mt-2 text-base leading-relaxed text-foreground/80">
          Chọn một mục tiêu. Câu nào đổi được gợi ý thì mình hỏi trước — thường là ba tới năm câu.
        </p>

        <label className="mt-5 flex items-start gap-2.5 rounded-xl border border-border px-4 py-3 text-base text-foreground">
          <input type="checkbox" name="canada" value="yes" defaultChecked className="mt-1 size-4" />
          <span>
            Mình đang sống ở Canada
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Mọi thẻ ở đây là thẻ Canada, và ngân hàng đòi bạn cư trú ở Canada.
            </span>
          </span>
        </label>

        <ul className="mt-4 space-y-2">
          {GOAL_OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="submit"
                name="goal"
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
      </section>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Câu trả lời của bạn được lưu ẩn danh trên máy chủ của Ghế 1A để mình đưa ra gợi ý và kiểm lại
        được khi có ai đó nói gợi ý sai. Mình không hỏi tên, email hay số tài khoản, và không có chỗ
        nào để điền chúng.
      </p>
    </form>
  );
}
