import type { CreditCardOffer } from "@/lib/content";
import { t as translate } from "@/lib/t";
import { splitAnnualFee } from "@/lib/annual-fee";

const offers = translate("offers");

/**
 * Dải số liệu trên mỗi thẻ: được bao nhiêu ở bên trái, mất bao nhiêu ở bên
 * phải. Mượn nguyên bố cục đã dùng cho tài khoản ngân hàng, vì người đọc tới
 * hai trang này với cùng một câu hỏi và không có lý do gì để hai trang trả lời
 * bằng hai hình dạng khác nhau.
 */

function Figure({ value, label, muted }: { value: string; label: string; muted?: boolean }) {
  return (
    <div>
      <p
        className={`font-display text-2xl font-bold leading-tight ${
          muted ? "text-foreground" : "text-primary"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function OfferStats({
  offer,
  className = "",
}: {
  offer: CreditCardOffer;
  className?: string;
}) {
  const fee = splitAnnualFee(offer.annualFee);

  return (
    <div className={className}>
      {/* Hai đường kẻ mảnh thay cho hộp nền kem (03/10/2026): con số vẫn tách
          khỏi phần chữ quanh nó mà không thêm một bề mặt nữa trong ô thẻ. */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-y border-border py-3">
        {offer.welcomeBonus ? (
          <>
            <Figure value={offer.welcomeBonus} label={offers("welcomeBonus")} />
            {/* `ml-auto`: con số bonus dài (điện thoại, lưới hai cột) đẩy ô phí
                xuống dòng riêng, và `justify-between` của một dòng chỉ có một
                phần tử là đặt nó sát TRÁI — chữ căn phải trong một ô nằm bên
                trái làm nhãn "Annual fee" thụt vào giữa. Đẩy cả ô sang phải thì
                bonus trái, phí phải ở mọi thẻ. */}
            <div className="ml-auto text-right">
              <p className="font-display text-lg font-bold text-foreground">{fee.amount}</p>
              <p className="text-xs text-muted-foreground">{offers("annualFee")}</p>
            </div>
          </>
        ) : (
          // Thẻ không có welcome bonus (cashback, hoặc thẻ bán tỷ lệ tích điểm)
          // thì annual fee lên làm số lớn. Để trống nửa bên trái sẽ tạo
          // một khoảng lặng ngay chỗ mắt tìm con số, còn nhét tỷ lệ tích điểm
          // vào ô "welcome bonus" thì đơn giản là nói sai.
          <Figure value={fee.amount} label={offers("annualFee")} muted />
        )}
      </div>

      {fee.note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{fee.note}</p>}
    </div>
  );
}
