import { t as translate } from "@/lib/t";

const offers = translate("offers");

/**
 * Dòng "HOT TIP" — câu nói cho người đọc biết phải làm gì để lấy thêm tiền.
 *
 * Trước đây nó nằm chôn trong EditorsTake và chỉ trang thẻ tín dụng dùng
 * được. Tách ra đây để tài khoản ngân hàng dùng đúng cái hộp đó: cùng màu,
 * cùng viền trái, cùng chữ nhãn — người đọc đã học nghĩa của hộp xanh này ở
 * trang thẻ thì sang trang ngân hàng không phải học lại.
 */
export function HotTip({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <p
      className={`flex gap-2 rounded-md border-l-4 border-emerald-600 bg-emerald-50 px-3 py-2 leading-relaxed text-emerald-950 ${
        compact ? "text-sm" : ""
      }`}
    >
      <span className="shrink-0 font-extrabold uppercase tracking-wide text-emerald-700">
        {offers("hotTip")}
      </span>
      <span>{children}</span>
    </p>
  );
}

/**
 * Nhãn rebate, dùng chung cho thẻ tín dụng và tài khoản ngân hàng.
 *
 * Thay cho ribbon có khía từng treo ở góc ảnh thẻ. Ribbon chỉ sống được ở nơi
 * có ảnh để dán lên, nên trang tài khoản ngân hàng không dùng lại được, và hai
 * trang đi hai kiểu. Viên pill thì đứng được trong hàng badge ở bất cứ đâu —
 * cùng màu xanh lá, cùng chữ, một hình dáng cho cả site.
 */
export function RebateChip({ amount, label }: { amount: string; label: string }) {
  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-extrabold uppercase tracking-wide text-emerald-700">
      +{amount} {label}
    </span>
  );
}
