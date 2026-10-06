import Link from "next/link";
import { t } from "@/lib/t";
import { formatDate } from "@/lib/format-date";
import {
  US_TRANSFER_AIRLINES,
  US_TRANSFER_HOTELS,
  US_TRANSFER_ISSUERS,
  legOn,
  partnerCount,
  type UsTransferIssuerId,
  type UsTransferPartnerRow,
} from "@/lib/us-transfer-partners";

const tp = t("transferPartners");

/** Cùng lý do với bảng Canada: cột tên chương trình dính mép trái khi các cột tỷ lệ cuộn ngang. */
const STICKY_COL = "sticky left-0 z-10";

/**
 * Hàng tên cột dính dưới khối dính của site từ `xl` — bảng có 36 hàng, cuộn
 * tới Wyndham thì không còn biết ô nào của ngân hàng nào. Chỉ từ `xl` vì đó là
 * chỗ bảng đủ chỗ không cần cuộn ngang: khung đổi sang `overflow-clip`, KHÔNG
 * phải `overflow-hidden` — `hidden` tạo khung cuộn riêng và nuốt luôn `sticky`.
 * Dưới `xl` khung còn `overflow-x-auto` nên hàng này không dính được; ở đó cột
 * tên chương trình dính trái là thứ giữ hướng cho người đọc.
 *
 * Đỉnh là `--chrome-h` (chiều cao thật của khối dính, `StickyChrome` đo), không
 * phải `top-chrome`: 9rem để hở một khe mà các hàng cuộn qua lộ ra phía trên
 * hàng tiêu đề (đo 06/10/2026 ở 1280px: khối cao 113px, khe 31px).
 */
const STICKY_HEAD = "xl:sticky xl:top-[var(--chrome-h,9rem)]";

function UsLegCell({
  row,
  issuer,
  today,
}: {
  row: UsTransferPartnerRow;
  issuer: UsTransferIssuerId;
  today: string;
}) {
  const leg = legOn(row, issuer, today);

  if (!leg) {
    return (
      <td className="px-2 py-3 text-center text-muted-foreground">
        <span aria-hidden>{tp("noData")}</span>
        <span className="sr-only">{tp("noDataLabel")}</span>
      </td>
    );
  }

  return (
    <td className="px-1 py-2.5">
      <div className="mx-auto flex max-w-[9.5rem] flex-col items-center gap-0.5 rounded-lg bg-secondary px-2 py-1.5 text-center text-foreground">
        <span className="whitespace-nowrap text-sm font-bold">{leg.ratio}</span>
        {leg.note && <span className="text-xs">{leg.note}</span>}
        {leg.upcoming && (
          <span className="text-xs">
            {tp("usChangeFrom", { date: formatDate(leg.upcoming.from), ratio: leg.upcoming.ratio })}
          </span>
        )}
        {leg.time && <span className="text-xs opacity-80">{leg.time}</span>}
      </div>
    </td>
  );
}

function RowGroup({
  title,
  rows,
  today,
  quotable,
}: {
  title: string;
  rows: UsTransferPartnerRow[];
  today: string;
  quotable: Set<string>;
}) {
  return (
    <tbody>
      {/* Nhãn nhóm nằm trong ô dính trái, không phải một ô `colSpan` trải hết
          hàng: ô rộng hơn khung cuộn thì `sticky` không giữ được chữ, và trên
          điện thoại nhãn trôi mất khi vuốt sang các cột bên phải. */}
      <tr className="border-t border-border bg-background">
        <th
          scope="rowgroup"
          className={`${STICKY_COL} bg-background px-3 pb-2 pt-5 text-left text-sm font-semibold text-muted-foreground sm:px-4`}
        >
          {title}
        </th>
        <td colSpan={US_TRANSFER_ISSUERS.length} className="bg-background" />
      </tr>
      {rows.map((row, i) => {
        const stripe = i % 2 === 0 ? "bg-card" : "bg-background";
        return (
          <tr key={row.program} className={stripe}>
            <th
              scope="row"
              className={`${STICKY_COL} px-3 py-3 text-left font-medium text-foreground sm:px-4 ${stripe}`}
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.logo}
                  alt=""
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                  className="h-8 w-8 shrink-0 rounded-md border border-border bg-white object-contain p-1"
                />
                <span className="min-w-0">
                  {/* Cùng luật với bảng Canada: chương trình nào Award Flight
                      Finder có bảng giá thì tên thành link sang đó. */}
                  {quotable.has(row.program) ? (
                    <Link
                      href="/award-flight-finder"
                      className="text-primary underline decoration-border underline-offset-4 hover:decoration-primary"
                    >
                      {row.program}
                    </Link>
                  ) : (
                    <span>{row.program}</span>
                  )}
                  {row.detail && (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {row.detail}
                    </span>
                  )}
                </span>
              </div>
            </th>
            {US_TRANSFER_ISSUERS.map((issuer) => (
              <UsLegCell key={issuer.id} row={row} issuer={issuer.id} today={today} />
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}

/**
 * Bảng sáu hệ điểm Mỹ. Cùng hình dạng với bảng Canada (hàng logo, hàng tên
 * cột navy, cột chương trình là `th scope="row"` dính trái, ô tỷ lệ trung tính)
 * để hai bảng trên một trang đọc như một, cộng hai thứ chỉ bảng 36 hàng mới cần:
 * nhóm Hãng bay / Khách sạn, và hàng tên cột dính từ `xl`.
 *
 * `today` truyền từ trang (ngày Toronto) chứ không tự tính ở đây, để ô có
 * tỷ lệ sắp đổi (`change`) đổi đúng ngày theo cùng một đồng hồ với cả trang.
 */
export function UsTransferTable({ today, quotable }: { today: string; quotable: Set<string> }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-border xl:overflow-clip">
      <table className="w-full min-w-[58rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-card">
            <th className={`${STICKY_COL} bg-card px-4 py-3`} />
            {US_TRANSFER_ISSUERS.map((issuer) => (
              <th key={issuer.id} className="px-2 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={issuer.logo} alt={issuer.alt} className={issuer.logoClass} />
              </th>
            ))}
          </tr>
          <tr className="bg-primary text-primary-foreground">
            <th
              className={`${STICKY_COL} ${STICKY_HEAD} min-w-[9.5rem] bg-primary px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide sm:min-w-[13rem] sm:px-4 xl:z-30`}
            >
              {tp("columnProgram")}
            </th>
            {US_TRANSFER_ISSUERS.map((issuer) => (
              <th
                key={issuer.id}
                className={`${STICKY_HEAD} min-w-[7.5rem] bg-primary px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide xl:z-20`}
              >
                {issuer.name}
                <span className="mt-0.5 block font-normal normal-case tracking-normal opacity-80">
                  {tp("usPartnerCount", { count: partnerCount(issuer.id) })}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <RowGroup
          title={tp("usGroupAirlines", { count: US_TRANSFER_AIRLINES.length })}
          rows={US_TRANSFER_AIRLINES}
          today={today}
          quotable={quotable}
        />
        <RowGroup
          title={tp("usGroupHotels", { count: US_TRANSFER_HOTELS.length })}
          rows={US_TRANSFER_HOTELS}
          today={today}
          quotable={quotable}
        />
      </table>
    </div>
  );
}
