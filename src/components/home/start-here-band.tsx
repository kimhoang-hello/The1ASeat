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
 * MÀU: từ 03/10/2026 là MỘT TẤM THẺ TRẮNG nằm trên nền kem, không còn dải
 * beige chạy hết bề ngang. Trang chủ bỏ kiểu nền kẻ sọc (kem/beige xen kẽ bảy
 * dải), nên cửa này phải tự tách khỏi trang bằng cách khác: một bề mặt trắng có
 * viền là vật thể riêng giữa hai khối cùng nền kem — vẫn là thứ dễ nhận ra nhất
 * ngay dưới hero, đúng yêu cầu khi chốt dải này.
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
    <section className="px-4 pb-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center rounded-2xl border border-border bg-card px-5 py-10 text-center sm:px-10 2xl:py-12">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-3 text-balance text-base leading-relaxed text-foreground/90 sm:text-lg">
          {t("body")}
        </p>
        {/* Nút đặc, cùng kiểu với nút "Đăng ký bản tin" trên header: trong một
            dải chỉ có chữ, nền đặc là thứ duy nhất nói đây là chỗ để bấm.

            NHÃN DÙNG CHUNG: cùng một câu ở cả ba lối vào /bat-dau — dải này,
            nút cuối bio trang Giới thiệu, và nút trong email chào mừng
            (api/subscribe/route.ts). Sửa một chỗ thì sửa cả ba, nếu không một
            trang đích lại mang ba tên gọi. Nhãn cũ "Xem lộ trình 4 bước" bỏ đi
            vì con số đã nằm sẵn trong câu ngay trên nó.

            DƯỚI 360px: nhãn mới dài hơn nhãn cũ đúng một chút quá sức chứa. Ở
            320px, chữ 16px cần 315px mà khung chỉ có 288px, nên "đây" rớt lẻ
            xuống dòng hai — nút duy nhất trên trang chủ bị vậy. Rút padding
            không đủ (vẫn cần 291px), nên hạ một bậc cỡ chữ, và chỉ hạ ở dưới
            360px để máy 375/390/414 giữ nguyên nút 16px như cũ. */}
        <Link
          href="/bat-dau"
          className="mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover max-[359px]:px-6 max-[359px]:text-sm"
        >
          {t("cta")}
          <ArrowRight size={18} weight="bold" />
        </Link>
      </div>
    </section>
  );
}
