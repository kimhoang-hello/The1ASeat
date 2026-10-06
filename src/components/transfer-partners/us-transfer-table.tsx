import { t } from "@/lib/t";
import { formatDate } from "@/lib/format-date";
import {
  US_TRANSFER_AIRLINES,
  US_TRANSFER_HOTELS,
  US_TRANSFER_ISSUERS,
  legOn,
  partnerCount,
  type UsTransferPartnerRow,
} from "@/lib/us-transfer-partners";
import {
  GroupHeaderRow,
  IssuerNameCell,
  ProgramCell,
  ProgramColumnHead,
  RatioCell,
  STICKY_COL,
  TABLE_FRAME,
  stripeFor,
} from "./table-parts";

const tp = t("transferPartners");

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
      <GroupHeaderRow title={title} columns={US_TRANSFER_ISSUERS.length} />
      {rows.map((row, i) => (
        <tr key={row.program} className={stripeFor(i)}>
          <ProgramCell
            program={row.program}
            detail={row.detail}
            logo={row.logo}
            stripe={stripeFor(i)}
            quotable={quotable.has(row.program)}
          />
          {US_TRANSFER_ISSUERS.map((issuer) => {
            const leg = legOn(row, issuer.id, today);
            const lines = leg
              ? [
                  ...(leg.note ? [{ text: leg.note }] : []),
                  ...(leg.upcoming
                    ? [
                        {
                          text: tp("usChangeFrom", {
                            date: formatDate(leg.upcoming.from),
                            ratio: leg.upcoming.ratio,
                          }),
                        },
                      ]
                    : []),
                  ...(leg.time ? [{ text: leg.time, muted: true }] : []),
                ]
              : [];
            return <RatioCell key={issuer.id} ratio={leg?.ratio ?? null} lines={lines} />;
          })}
        </tr>
      ))}
    </tbody>
  );
}

/**
 * Bảng sáu hệ điểm Mỹ, dựng từ cùng các mảnh với bảng Canada (`table-parts`).
 *
 * `today` truyền từ trang (ngày Toronto) chứ không tự tính ở đây, để ô có
 * tỷ lệ sắp đổi (`change`) đổi đúng ngày theo cùng một đồng hồ với cả trang.
 */
export function UsTransferTable({ today, quotable }: { today: string; quotable: Set<string> }) {
  return (
    <div className={TABLE_FRAME}>
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
            <ProgramColumnHead />
            {US_TRANSFER_ISSUERS.map((issuer) => (
              <IssuerNameCell key={issuer.id} name={issuer.name} count={partnerCount(issuer.id)} />
            ))}
          </tr>
        </thead>
        <RowGroup
          title={tp("groupAirlines", { count: US_TRANSFER_AIRLINES.length })}
          rows={US_TRANSFER_AIRLINES}
          today={today}
          quotable={quotable}
        />
        <RowGroup
          title={tp("groupHotels", { count: US_TRANSFER_HOTELS.length })}
          rows={US_TRANSFER_HOTELS}
          today={today}
          quotable={quotable}
        />
      </table>
    </div>
  );
}
