import { ArrowDown, ArrowRight, Check, HourglassMedium, X } from "@phosphor-icons/react/ssr";
import type { Chip, ChipTone } from "@/lib/refundable-hotel-trick";

/**
 * Một tông = một nghĩa, theo ba màu trạng thái của site (DESIGN-SYSTEM 3.2):
 * xanh = đây là lúc làm, đỏ = quá trễ / đừng làm, hổ phách = chưa tới lúc.
 * Bước bình thường thì trung tính — chỉ khoảnh khắc quyết định mới có màu, để
 * "PENDING → REDEEM" của CIBC® và "POSTED → REDEEM" của Scene+™ là thứ nổi nhất
 * trong mỗi chuỗi.
 */
const TONE: Record<ChipTone, string> = {
  neutral: "border-border bg-card text-foreground",
  // Nền đặc — chỉ cho đúng một khoảnh khắc "redeem ngay bây giờ" mỗi chuỗi.
  go: "border-success bg-success text-primary-foreground",
  good: "border-success/30 bg-success-soft text-success",
  bad: "border-destructive/30 bg-destructive-soft text-destructive",
  wait: "border-warning/30 bg-warning-soft text-warning",
};

const ICON = { go: Check, good: Check, bad: X, wait: HourglassMedium } as const;

/** Lớp màu của một tông — cho chỗ cần vẽ chip theo hình khác (khối so sánh). */
export function chipToneClass(tone: ChipTone = "neutral"): string {
  return TONE[tone];
}

const SIZE = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
} as const;

export function FlowChip({
  chip,
  size = "md",
  withIcon = false,
}: {
  chip: Chip;
  size?: keyof typeof SIZE;
  /** Thêm ✓/✕/⏳ — dành cho khối "trạng thái → làm gì", không cho mọi chuỗi. */
  withIcon?: boolean;
}) {
  const tone = chip.tone ?? "neutral";
  const Icon = withIcon && tone !== "neutral" ? ICON[tone] : null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${SIZE[size]} ${TONE[tone]}`}
    >
      {chip.label}
      {Icon && <Icon size={size === "sm" ? 12 : 14} weight="bold" aria-hidden />}
    </span>
  );
}

/**
 * Chuỗi bước có mũi tên. Là `<ol>` để screen reader đọc ra đúng thứ tự; mũi tên
 * chỉ để nhìn.
 *
 * `row` tự xuống dòng khi hết chỗ — trên điện thoại một chuỗi sáu bước không
 * vừa một hàng, và cuộn ngang là thứ site đã cấm (DESIGN-SYSTEM 5.4). `column`
 * cho chuỗi đọc như những lần bấm nối nhau: đường vào menu app, Product Switch.
 */
export function FlowChips({
  chips,
  direction = "row",
  size = "md",
  label,
  className = "",
}: {
  chips: Chip[];
  direction?: "row" | "column";
  size?: keyof typeof SIZE;
  label?: string;
  className?: string;
}) {
  if (direction === "column") {
    return (
      <ol aria-label={label} className={`flex flex-col items-start gap-1 ${className}`}>
        {chips.map((chip, index) => (
          <li key={`${chip.label}-${index}`} className="flex flex-col items-start gap-1">
            {index > 0 && (
              <ArrowDown
                size={14}
                weight="bold"
                className="ml-4 text-muted-foreground"
                aria-hidden
              />
            )}
            <FlowChip chip={chip} size={size} />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol aria-label={label} className={`flex flex-wrap items-center gap-x-1.5 gap-y-2 ${className}`}>
      {chips.map((chip, index) => (
        <li key={`${chip.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && (
            <ArrowRight
              size={14}
              weight="bold"
              className="shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          <FlowChip chip={chip} size={size} />
        </li>
      ))}
    </ol>
  );
}
