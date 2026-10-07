import Link from "next/link";
import { t } from "@/lib/t";
import { creditCardsPath } from "@/lib/card-points-programs";
import { TRANSFER_PARTNERS, type TransferPartnerRow } from "@/lib/transfer-partners";
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

/**
 * Hai cột của bảng Canada, khai đúng một lần — và mảng này là NGUỒN DUY NHẤT
 * quyết định thứ tự cột: hàng logo, hàng tên cột, ô tỷ lệ trong từng hàng, và
 * khối "thẻ tích hệ này" ở trang đều `map` qua nó.
 *
 * Đó là điều kiện để đảo thứ tự ở đây là đảo cả bảng. Bản đầu chỉ gom hàng
 * logo, còn hàng tên cột và `row.amex`/`row.rbc` vẫn gõ tay theo đúng thứ tự
 * cũ — nên đảo mảng sẽ cho logo Amex® đứng trên cột tỷ lệ của RBC®, sai lặng
 * lẽ trên đúng cái bảng mà cả nội dung là "hệ nào chuyển sang chương trình
 * nào". `as const` giữ `legKey` ở kiểu chuỗi hẹp, nên `row[column.legKey]` là
 * cửa kiểm của `tsc`: gõ sai một chữ là build đỏ, không phải cột trống.
 */
export const CANADA_ISSUER_COLUMNS = [
  {
    programId: "amex-mr",
    legKey: "amex",
    logo: "/images/logos/amex.svg",
    alt: "American Express®",
    logoClass: "mx-auto h-6 w-auto",
    ariaKey: "amexCardsAria",
    nameKey: "columnAmex",
  },
  {
    programId: "avion",
    legKey: "rbc",
    logo: "/images/logos/rbc.svg",
    alt: "RBC®",
    logoClass: "mx-auto h-8 w-auto",
    ariaKey: "rbcCardsAria",
    nameKey: "columnRbc",
  },
] as const;

/**
 * Logo hệ điểm ở đầu cột dẫn tới danh sách thẻ tích hệ đó — nhưng CHỈ khi hệ đó
 * thật sự có thẻ trên site. `/credit-cards` cố ý cho `?points=` lạ rơi về danh
 * sách KHÔNG lọc, nên một link tới hệ không có thẻ nào sẽ trả về nguyên danh
 * sách mà người đọc tưởng là kết quả lọc. `amex-mr` từng đúng vào ca đó cho tới
 * 06/09/2026; cửa kiểm vẫn giữ, vì nó canh tồn kho chứ không canh một ngày.
 */
function IssuerLogo({
  column,
  linkable,
}: {
  column: (typeof CANADA_ISSUER_COLUMNS)[number];
  linkable: boolean;
}) {
  /* eslint-disable-next-line @next/next/no-img-element */
  const logo = <img src={column.logo} alt={column.alt} className={column.logoClass} />;
  if (!linkable) return logo;
  return (
    <Link
      href={creditCardsPath({ points: column.programId })}
      aria-label={tp(column.ariaKey)}
      className="block rounded-md py-1 transition-opacity hover:opacity-70"
    >
      {logo}
    </Link>
  );
}

function RowGroup({
  title,
  rows,
  quotable,
}: {
  title: string;
  rows: TransferPartnerRow[];
  quotable: Set<string>;
}) {
  return (
    <tbody>
      <GroupHeaderRow title={title} columns={CANADA_ISSUER_COLUMNS.length} />
      {rows.map((row, i) => (
        <tr key={row.program} className={stripeFor(i)}>
          <ProgramCell
            program={row.program}
            logo={row.logo}
            stripe={stripeFor(i)}
            quotable={quotable.has(row.program)}
          />
          {CANADA_ISSUER_COLUMNS.map((column) => {
            const leg = row[column.legKey];
            return (
              <RatioCell
                key={column.programId}
                ratio={leg?.ratio ?? null}
                lines={[
                  ...(leg?.note ? [{ text: leg.note }] : []),
                  ...(leg?.time ? [{ text: leg.time, muted: true }] : []),
                ]}
              />
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}

/**
 * Bảng Amex® Membership Rewards® (Canada) và RBC® Avion®, dựng từ cùng các mảnh
 * với bảng Mỹ: nhóm Hãng bay / Khách sạn, số đối tác dưới tên cột, hàng tên cột
 * dính từ `xl`. Thứ tự hàng trong `TRANSFER_PARTNERS` giữ nguyên (theo tên);
 * chia nhóm ở đây theo `kind`.
 */
export function CanadaTransferTable({
  linkablePrograms,
  quotable,
}: {
  linkablePrograms: Set<string>;
  quotable: Set<string>;
}) {
  const airlines = TRANSFER_PARTNERS.filter((row) => row.kind === "airline");
  const hotels = TRANSFER_PARTNERS.filter((row) => row.kind === "hotel");
  const count = (legKey: "amex" | "rbc") => TRANSFER_PARTNERS.filter((row) => row[legKey]).length;

  return (
    <div className={TABLE_FRAME}>
      <table className="w-full min-w-[35rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-card">
            <th className={`${STICKY_COL} bg-card px-4 py-3`} />
            {CANADA_ISSUER_COLUMNS.map((column) => (
              <th key={column.programId} className="px-2 py-3">
                <IssuerLogo column={column} linkable={linkablePrograms.has(column.programId)} />
              </th>
            ))}
          </tr>
          <tr className="bg-primary text-primary-foreground">
            <ProgramColumnHead />
            {CANADA_ISSUER_COLUMNS.map((column) => (
              <IssuerNameCell
                key={column.programId}
                name={tp(column.nameKey)}
                count={count(column.legKey)}
              />
            ))}
          </tr>
        </thead>
        <RowGroup title={tp("groupAirlines", { count: airlines.length })} rows={airlines} quotable={quotable} />
        <RowGroup title={tp("groupHotels", { count: hotels.length })} rows={hotels} quotable={quotable} />
      </table>
    </div>
  );
}
