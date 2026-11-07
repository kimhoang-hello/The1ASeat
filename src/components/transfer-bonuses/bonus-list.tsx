import { ArrowRight, ArrowSquareOut } from "@phosphor-icons/react/ssr";
import { EDITORIAL_REL, relForUrl } from "@/lib/affiliate-links";
import { formatDate } from "@/lib/format-date";
import { t } from "@/lib/t";
import type { BonusView } from "@/lib/transfer-bonus-view";

const tb = t("bonuses");

/**
 * Danh sách transfer bonus — dùng ở `/transfer-bonuses` (mỗi nước một danh sách)
 * và ở khối trang chủ (`compact`: bỏ ghi chú và dòng tỷ lệ cho gọn).
 *
 * Hàng có `url` (bonus Canada: trang điều khoản chính chủ) là link mở tab mới,
 * kèm icon mũi tên ra ngoài. Bonus Mỹ không có trang riêng nào — nguồn là bảng
 * tổng của Daily Drop, ghi một lần ở đầu mục — nên hàng chỉ là thông tin, không
 * giả làm link.
 *
 * Mỗi danh sách chỉ chứa bonus của MỘT nước — cờ nằm trên tiêu đề mục/cột bọc
 * ngoài, không lặp lại ở từng hàng.
 *
 * `compact` xếp chồng hai dòng (cặp chương trình, rồi hạn + phần trăm) ở mọi
 * khổ: trang chủ chia hai cột, mỗi cột chỉ còn ~36rem, và đặt hạn + phần trăm
 * bên phải thì cặp tên bị bẻ thành hai dòng lệch nhau.
 */
export function BonusList({ bonuses, compact = false }: { bonuses: BonusView[]; compact?: boolean }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
      {bonuses.map((bonus) => (
        <li key={`${bonus.region}-${bonus.slug}`}>
          <BonusRow bonus={bonus} compact={compact} />
        </li>
      ))}
    </ul>
  );
}

function BonusRow({ bonus, compact }: { bonus: BonusView; compact: boolean }) {
  const body = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <ProgramLogo logo={bonus.logo} name={bonus.toProgram} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-foreground">
            <span>{bonus.fromProgram}</span>
            <ArrowRight size={14} className="text-muted-foreground" aria-hidden />
            <span className="sr-only">{tb("to")}</span>
            <span>{bonus.toProgram}</span>
          </p>
          {!compact && bonus.ratio && (
            <p className="mt-1 text-sm text-foreground">
              {tb("ratio", { from: bonus.ratio.from, boosted: bonus.ratio.boosted, base: bonus.ratio.base })}
            </p>
          )}
          {!compact && bonus.note && <p className="mt-1 text-xs text-muted-foreground">{bonus.note}</p>}
        </div>
      </div>
      <div className={`flex shrink-0 items-center gap-3 pl-11 text-sm ${compact ? "" : "sm:pl-0"}`}>
        <span className="font-medium text-warning">
          {tb("expires")} {formatDate(bonus.expiresAt)}
        </span>
        <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
          +{bonus.bonusPercent}%
        </span>
        {bonus.url && <ArrowSquareOut size={16} className="text-muted-foreground" aria-hidden />}
      </div>
    </>
  );

  const layout = compact
    ? "flex flex-col gap-2 px-4 py-3.5 sm:px-5"
    : "flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5";

  if (!bonus.url) return <div className={layout}>{body}</div>;

  return (
    <a
      href={bonus.url}
      target="_blank"
      rel={relForUrl(bonus.url) ?? EDITORIAL_REL}
      className={`${layout} cursor-pointer transition-colors hover:bg-secondary`}
    >
      {body}
      <span className="sr-only">{tb("opensTerms")}</span>
    </a>
  );
}

/**
 * Logo vuông của chương trình nhận — cùng bộ `/images/logos/programs/` với bảng
 * Transfer Partners. Chương trình chưa có trong bảng (chưa có logo) thì một ô
 * cùng cỡ mang chữ cái đầu, để cột chữ của mọi hàng vẫn thẳng nhau.
 */
function ProgramLogo({ logo, name }: { logo?: string; name: string }) {
  const box = "h-8 w-8 shrink-0 rounded-md border border-border bg-white";
  if (!logo) {
    return (
      <span aria-hidden className={`${box} flex items-center justify-center text-xs font-bold text-muted-foreground`}>
        {name.trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" width={32} height={32} loading="lazy" decoding="async" className={`${box} object-contain p-1`} />
  );
}
