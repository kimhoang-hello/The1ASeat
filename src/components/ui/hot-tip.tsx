import messages from "../../../messages/vi.json";
import { translator } from "@/lib/t";

const offers = translator(messages.offers);

/**
 * Dòng "HOT TIP" — câu nói cho người đọc biết phải làm gì để lấy thêm tiền.
 *
 * Trước đây nó nằm chôn trong EditorsTake và chỉ trang thẻ tín dụng dùng
 * được. Tách ra đây để tài khoản ngân hàng dùng đúng cái hộp đó: cùng màu,
 * cùng chữ nhãn — người đọc đã học nghĩa của hộp xanh này ở trang thẻ thì sang
 * trang ngân hàng không phải học lại.
 *
 * KHÔNG viền trái dày (bỏ 03/10/2026): nền xanh nhạt + nhãn đậm đã đủ nổi, và
 * đây phải là thứ nổi nhất trong ô thẻ vì nó là đường nhận tiền rebate.
 */
export function HotTip({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <p
      className={`flex gap-2 rounded-lg bg-success-soft px-3 py-2 leading-relaxed text-foreground ${
        compact ? "text-sm" : ""
      }`}
    >
      <span className="shrink-0 font-bold uppercase tracking-wide text-success">
        {offers("hotTip")}
      </span>
      <span>{children}</span>
    </p>
  );
}

/**
 * Nhãn rebate, dùng chung cho thẻ tín dụng và tài khoản ngân hàng.
 *
 * Thay cho ribbon có khía từng treo ở góc ảnh thẻ: cùng chỗ đứng, nhưng hình
 * pill dùng lại được ở nơi không có ảnh.
 *
 * Trang thẻ tín dụng treo nó ở mép dưới ảnh thẻ — chỗ nó nổi bật nhất và
 * không chen vào hàng chữ. Trang tài khoản ngân hàng không có ảnh nào để treo
 * nên đặt trong hàng badge. Khác chỗ đứng, nhưng cùng một viên: cùng màu, cùng
 * chữ, người đọc nhận ra ngay ở cả hai trang.
 */
export function RebateChip({
  amount,
  label,
  className = "",
}: {
  amount: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`whitespace-nowrap rounded-full bg-success-soft px-3 py-1 text-sm font-bold uppercase tracking-wide text-success ${className}`}
    >
      +{amount} {label}
    </span>
  );
}
