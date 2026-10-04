/**
 * Cờ Mỹ / Canada vẽ bằng SVG, thay cho emoji cờ (04/10/2026, audit UX/UI).
 *
 * Chrome và Edge trên Windows không có font emoji cờ: "🇺🇸 Thẻ Mỹ" hiện thành
 * "US Thẻ Mỹ" — hai chữ cái lạc trên thanh menu và trên mọi tiêu đề mục Thẻ Mỹ.
 * SVG nội tuyến thì máy nào cũng vẽ giống nhau, và không phải thêm thư viện
 * icon thứ hai (DESIGN-SYSTEM.md 9).
 *
 * Chỉ để trang trí: chữ đứng cạnh luôn đã nói "Mỹ" hay "Canada", nên
 * `aria-hidden` — trình đọc màn hình không đọc "cờ Mỹ" trước mỗi nhãn. Cỡ theo
 * `em` để lá cờ lớn nhỏ cùng dòng chữ nó đứng cạnh, như emoji trước đây.
 */
export function Flag({ country, className = "" }: { country: "us" | "ca"; className?: string }) {
  // Viền mảnh `ring-black/10`: nửa trắng của lá cờ không tan vào nền kem.
  const frame = `inline-block h-[0.75em] shrink-0 rounded-[2px] ring-1 ring-black/10 ${className}`;

  if (country === "us") {
    return (
      <svg viewBox="0 0 19 10" aria-hidden="true" focusable="false" className={`w-[1.425em] ${frame}`}>
        <rect width="19" height="10" fill="#fff" />
        {/* Bảy sọc đỏ, mỗi sọc cao 10/13. */}
        <path
          fill="#B22234"
          d="M0 0h19v.77H0zm0 1.54h19v.77H0zm0 1.54h19v.77H0zm0 1.54h19v.77H0zm0 1.54h19v.77H0zm0 1.54h19v.77H0zm0 1.54h19v.77H0z"
        />
        <rect width="7.6" height="5.39" fill="#3C3B6E" />
        {/* Ở cỡ 12px năm mươi ngôi sao không còn thấy được; chín chấm đủ để ô xanh
            đọc ra là cờ Mỹ chứ không phải một ô màu. */}
        <g fill="#fff">
          {[1.3, 3.8, 6.3].flatMap((x) =>
            [1.1, 2.7, 4.3].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.42" />),
          )}
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="-2400 0 9600 4800" aria-hidden="true" focusable="false" className={`w-[1.5em] ${frame}`}>
      <rect x="-2400" width="9600" height="4800" fill="#fff" />
      <rect x="-2400" width="2400" height="4800" fill="#D52B1E" />
      <rect x="4800" width="2400" height="4800" fill="#D52B1E" />
      <path
        fill="#D52B1E"
        d="M2340 4485l47-908c3-67-55-121-121-109l-904 159 122-336c10-28 2-59-21-78L473 2411l223-104c19-9 28-31 22-51l-196-602 570 121c31 6 62-10 75-40l111-261 445 478c51 54 141 8 125-64l-215-1107 344 199c33 19 75 7 95-28l328-690 328 690c20 35 62 47 95 28l344-199-215 1107c-16 72 74 118 125 64l445-478 111 261c13 30 44 46 75 40l570-121-196 602c-6 20 3 42 22 51l223 104-990 802c-23 19-31 50-21 78l122 336-904-159c-66-12-124 42-121 109l47 908z"
      />
    </svg>
  );
}
