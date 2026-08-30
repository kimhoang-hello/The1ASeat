import type { CreditCardOffer } from "@/lib/content";
import { t as translate } from "@/lib/t";

const offers = translate("offers");

/**
 * Dải số liệu trên mỗi thẻ: được bao nhiêu ở bên trái, mất bao nhiêu ở bên
 * phải. Mượn nguyên bố cục đã dùng cho tài khoản ngân hàng, vì người đọc tới
 * hai trang này với cùng một câu hỏi và không có lý do gì để hai trang trả lời
 * bằng hai hình dạng khác nhau.
 */

/**
 * `annualFee` trong Contentful là câu văn: "$120/năm (thẻ phụ: $50/năm)".
 * Con số đứng đầu là thứ so sánh được giữa các thẻ, phần trong ngoặc là điều
 * kiện — nên tách ra, số vào ô lớn còn điều kiện xuống dòng nhỏ bên dưới.
 *
 * Nhận dạng cố ý hẹp: chỉ đúng dạng "$X/năm" hoặc "Miễn phí", có thể kèm một
 * cặp ngoặc. Không khớp thì trả nguyên câu và không bịa ra phần ghi chú —
 * đoán sai một con số phí trên trang tạo doanh thu tệ hơn nhiều so với một ô
 * hơi dài. (Đã kiểm: cả 20 thẻ hiện tại đều khớp.)
 */
export function splitAnnualFee(annualFee: string): { amount: string; note?: string } {
  const match = /^(\$[\d,]+\/năm|Miễn phí)\s*(?:\((.+)\))?$/.exec(annualFee.trim());
  if (!match) return { amount: annualFee };
  return { amount: match[1], note: match[2] };
}

function Figure({ value, label, muted }: { value: string; label: string; muted?: boolean }) {
  return (
    <div>
      <p
        className={`font-display text-2xl font-extrabold leading-tight ${
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
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-secondary/70 px-4 py-3">
        {offer.welcomeBonus ? (
          <>
            <Figure value={offer.welcomeBonus} label={offers("welcomeBonus")} />
            <div className="text-right">
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
