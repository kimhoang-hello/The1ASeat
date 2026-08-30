import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { t as translate } from "@/lib/t";

const t = translate("startHereBand");

/**
 * Cửa vào `/bat-dau` trên trang chủ.
 *
 * VỊ TRÍ: ngay dưới hero và trên khối offers, không nằm trong hero nữa.
 * Bản trước là một nút viền đặt bên trong hero, phía trên ô đăng ký bản tin —
 * đúng chỗ đó thì nó tranh chỗ với đúng một nhiệm vụ chính của hero là lấy
 * email, mà lấy email là một trong hai thước đo thành công. Đẩy xuống dưới ô
 * đăng ký thì bản tin giữ nguyên vị trí số một, còn người chưa biết bắt đầu từ
 * đâu vẫn gặp lối đi trước khi gặp danh sách thẻ.
 *
 * MÀU: `bg-secondary` (#F1E9D8) giữa hai khối `bg-background` (#FAF6EC). Đây
 * là cách duy nhất một dải ngang tự tách ra khỏi trang khi nó không có ảnh và
 * không có viền dày — hero ở trên và offers ở dưới cùng một nền, nên chỉ cần
 * đổi nền một bậc là mắt đọc ra ba khối chứ không phải một dải dài. Viền trên
 * dưới để mép dải sắc ở chỗ hai màu gần nhau.
 *
 * KHOẢNG TRẮNG: `pb` của hero rút từ 80px xuống 56px cho bằng `pt` của dải này.
 * Hai khối đứng liền nhau thì khoảng trắng của chúng cộng dồn, không phải cái
 * lớn hơn nuốt cái nhỏ hơn — 80+56 cho ra 136px trống giữa dòng "Không spam"
 * và chữ đầu của dải, trong khi phía dưới chỉ có 56+64=120px. Dải trông như bị
 * đẩy xuống. Nay hai bên là 112 và 120, và ở 2xl thì đúng 128 cả hai.
 *
 * CỬA, KHÔNG PHẢI ĐÍCH: chỉ tiêu đề, một câu, một nút. Bốn ô lựa chọn của
 * `StartHereRouter` ở lại trên chính `/bat-dau` — bê lên đây thì trang chủ có
 * hai ngã ba chồng nhau (bốn ô này và bốn thẻ offers ngay dưới), và cái đích
 * mất lý do tồn tại.
 */
export function StartHereBand() {
  return (
    <section className="border-y border-border bg-secondary px-4 py-14 sm:px-6 lg:px-8 2xl:py-16">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <p className="text-xs font-semibold tracking-wide text-primary">{t("eyebrow")}</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-3 text-balance text-base leading-relaxed text-foreground/90 sm:text-lg">
          {t("body")}
        </p>
        {/* Nút đặc, cùng kiểu với nút "Đăng ký bản tin" trên header: trong một
            dải chỉ có chữ, nền đặc là thứ duy nhất nói đây là chỗ để bấm. */}
        <Link
          href="/bat-dau"
          className="mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {t("cta")}
          <ArrowRight size={18} weight="bold" />
        </Link>
      </div>
    </section>
  );
}
