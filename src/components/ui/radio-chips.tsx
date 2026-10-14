"use client";

/**
 * Nhóm chip chọn-một dùng chung cho các bộ lọc tại chỗ: `/bank-accounts` (hàng
 * ngân hàng) và `/hotels` (điểm đến, thương hiệu, phân khúc). Tách khỏi
 * `bank-account-finder.tsx` ngày 14/10/2026 khi có nơi dùng thứ hai — cùng luật
 * "một thứ, một chỗ" của DESIGN-SYSTEM.md, thay vì chép lại cả phần bàn phím.
 */

/**
 * `role="radiogroup"` là một lời hứa về bàn phím chứ không phải cái nhãn suông:
 * chuẩn ARIA quy định cả nhóm là MỘT điểm dừng Tab, và phím mũi tên mới là thứ
 * chuyển giữa các lựa chọn. Thiếu phần đó thì trình đọc màn hình vẫn đọc "nhóm
 * chọn, mục 3 trên 7", người dùng bấm mũi tên theo phản xạ và không có gì xảy
 * ra — tệ hơn là không gắn `role` nào, vì khi đó "một loạt nút bấm" ít nhất là
 * mô tả đúng, và Tab từng cái là hành vi đúng của nút bấm.
 *
 * Bắt phím ở cấp nhóm rồi tự tìm các `role="radio"` con trong DOM, để các loại
 * chip không phải biết gì về nhóm chứa chúng — chúng khác nhau về hình dạng có
 * chủ ý, và sẽ còn khác nữa.
 *
 * ĐIỀU KIỆN bắt buộc khi dùng lại: nhóm phải LUÔN có đúng một chip `active`.
 * Không chip nào active thì cả nhóm không có điểm dừng Tab nào và người dùng
 * bàn phím không vào được; hai chip active thì nhóm có hai điểm dừng, tức mất
 * đúng cái vừa sửa. Mọi nhóm hiện tại thoả điều kiện vì đều có chip "Tất cả"
 * và lựa chọn luôn rơi về `"all"`.
 */
const RADIO_KEYS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];

export function RadioGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!RADIO_KEYS.includes(event.key)) return;

    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const current = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;

    event.preventDefault();

    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? radios.length - 1
          : (current + (forward ? 1 : -1) + radios.length) % radios.length;

    // Chuẩn radio: di chuyển tới đâu là chọn luôn tới đó, không phải chuyển
    // rồi chờ bấm Space. `focus` trước `click` để con trỏ ở đúng chip mới sau
    // khi React render lại.
    radios[next].focus();
    radios[next].click();
  }

  return (
    <div role="radiogroup" aria-label={label} className={className} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}

/**
 * Chip có số đếm, viền mảnh — hình dạng của hàng Điểm thưởng bên trang thẻ tín
 * dụng. Ở `/bank-accounts` nó cố ý khác chip đặc của hàng bộ lọc nhanh nằm
 * ngay trên: hai hàng lọc hai thứ khác nhau, cùng một hình dạng thì đọc như
 * một nhóm chọn duy nhất bị vỡ dòng.
 */
export function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors pointer-coarse:py-2 ${
        active
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-border text-foreground/70 hover:border-primary hover:text-primary"
      }`}
    >
      {children}
      <span className="ml-1 text-xs text-muted-foreground">{count}</span>
    </button>
  );
}
