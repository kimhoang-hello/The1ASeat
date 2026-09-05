import { TRANSFER_PARTNERS } from "@/lib/transfer-partners";
import { formatPoints, type Program, type RoutingOption } from "@/lib/award-charts";
import type { CheapestByCabin, ProgramRow } from "@/lib/award-routes";
import { t as translate } from "@/lib/t";

/**
 * Bảng và danh sách đường bay của MỘT chặng, render trên server.
 *
 * CỐ Ý không dùng lại `QuoteCard` của `award-chart-finder.tsx`. Công cụ đó
 * hỏi một hạng ghế mỗi lần và trả về sáu thẻ; ở đây chặng đã cố định nên
 * dựng được thứ công cụ không dựng được: cả ba hạng ghế trên cùng một hàng,
 * và danh sách hành trình in đúng MỘT lần thay vì ba lần giống hệt nhau —
 * hành trình không đổi theo hạng ghế, chỉ con số đổi.
 *
 * Chữ dùng chung namespace `awardCharts` chứ không chép sang `awardRoutes`:
 * "Đã công bố", "Surcharge thấp", "Không tra trước được" phải đọc ra y hệt ở
 * công cụ và ở đây, nếu không thì cùng một dữ liệu nói hai giọng.
 */
const t = translate("awardCharts");
const r = translate("awardRoutes");

const CONFIDENCE_LABELS: Record<Program["confidence"], string> = {
  published: "confidencePublished",
  unpublished: "confidenceUnpublished",
  unquotable: "confidenceUnquotable",
};

const CONFIDENCE_STYLES: Record<Program["confidence"], string> = {
  published: "bg-[#e7f2ea] text-[#1f6f43]",
  unpublished: "bg-[#fdf1d8] text-[#8a5a10]",
  unquotable: "bg-secondary text-muted-foreground",
};

const SURCHARGE_LABELS = { low: "surchargeLow", medium: "surchargeMedium", high: "surchargeHigh" } as const;
const SURCHARGE_STYLES = {
  low: "text-[#1f6f43]",
  medium: "text-[#8a5a10]",
  high: "text-[#a3352b]",
} as const;

/** Ô "không có số". Ba lý do khác nhau đọc ra ba câu khác nhau — cùng luật với
 *  `NoPrice` bên công cụ: đừng đổ lỗi cho bảng giá khi vấn đề là không có
 *  chuyến bay, và ngược lại. Dấu gạch trần thì screen reader đọc ra "dash". */
function NoNumber({ label }: { label: string }) {
  return (
    <span className="text-sm text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Vì sao ô của hàng này trống, nói đúng lý do của nó.
 *
 *  Hành trình không đổi theo hạng ghế (chỉ con số đổi), nên một lý do cho cả
 *  hàng là đủ — trừ một chỗ: nhánh "chỉ có đường phải nối chuyến nội địa" chỉ
 *  đúng với chương trình KHÔNG tính được vé có chặng nội địa. Aeroplan® tính
 *  được, nên với nó nhánh đó phải im.
 *
 *  Bỏ điều kiện `pricesWithFeeder` ra thì hàng tự mâu thuẫn ngay trên màn
 *  hình: Calgary → Đà Nẵng có giá ở Phổ thông và Thương gia, mà ô Phổ thông
 *  đặc biệt lại giải thích là "cần nối chuyến nội địa" — trong khi lý do thật
 *  là bảng partner của Aeroplan® không in hạng đó. Công cụ ở
 *  `award-chart-finder.tsx` hỏi từng hạng một nên không lộ ra mâu thuẫn này,
 *  nhưng câu giải thích ở đó cũng sai y hệt, và đã sửa cùng lúc. */
function whyNoPrice(row: ProgramRow): string {
  const { quote } = row;
  if (quote.options.length === 0) return t("noRoutingShort");
  if (quote.program.pricing.kind === "unquotable") return t(quote.program.pricing.labelKey);
  if (!quote.program.pricesWithFeeder && quote.options.every((o) => o.needsFeeder))
    return t("feederOnlyShort");
  return t("notPublished");
}

function Points({ points, startingAt }: { points: number; startingAt: boolean }) {
  return (
    <span className="font-display font-bold text-foreground">
      {startingAt && <span className="font-normal text-muted-foreground">{t("fromPrefix")} </span>}
      {formatPoints(points)}
    </span>
  );
}

/** Ba ô số liệu đầu trang: rẻ nhất mỗi hạng, kèm tên chương trình cho nó. */
export function CheapestTiles({ rows }: { rows: CheapestByCabin[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.cabin} className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t(row.labelKey)}</p>
          {row.points === null ? (
            <>
              <p className="mt-1 font-display text-lg font-bold leading-tight text-muted-foreground">
                {r("cheapestNone")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("notPublished")}</p>
            </>
          ) : (
            <>
              <p className="mt-1 font-display text-2xl font-extrabold leading-tight text-primary">
                {row.startingAt && <span className="mr-1 text-base font-semibold">{t("fromPrefix")}</span>}
                {formatPoints(row.points)}
              </p>
              {/* Logo đứng cạnh tên chương trình, không thay cho nó: logo giúp
                  mắt quét nhanh, còn tên mới là thứ đọc được với độc giả chưa
                  quen mặt logo. `alt=""` vì tên nằm ngay bên phải. */}
              <div className="mt-1 flex items-center gap-1.5">
                {row.programLogo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={row.programLogo}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded border border-border bg-white object-contain p-px"
                  />
                )}
                <p className="text-xs leading-snug text-muted-foreground">
                  {r("cheapestVia", { program: row.programName ?? "" })}
                </p>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** Hai chân chuyển điểm của một chương trình, dạng chữ ngắn cho ô bảng.
 *
 *  Giống `TransferLegs` bên công cụ nhưng KHÔNG có chip bấm được, và cố ý:
 *  cùng lý do đã ghi ở đó — `?points=amex-mr` hiện không khớp thẻ nào trên
 *  site, mà `/credit-cards` lại cho id lạ rơi về danh sách không lọc. Đường
 *  sang trang thẻ nằm ở khối "Thẻ nào tích được loại điểm này?" bên dưới, nơi
 *  danh sách thẻ thật đã được kiểm trước khi dựng link. */
function TransferCell({ program }: { program: Program }) {
  const row = TRANSFER_PARTNERS.find((p) => p.program === program.transferPartnerKey);
  const legs = [
    { issuer: "Amex® MR", leg: row?.amex ?? null },
    { issuer: "RBC® Avion®", leg: row?.rbc ?? null },
  ].filter((entry) => entry.leg !== null);

  if (legs.length === 0) {
    return (
      <span className="text-xs leading-relaxed text-muted-foreground">
        {t(program.transferNoteKey ?? "transferNone")}
      </span>
    );
  }

  return (
    <span className="block space-y-0.5">
      {legs.map(({ issuer, leg }) => (
        <span key={issuer} className="block text-xs leading-snug text-foreground/80">
          {issuer} · {leg!.ratio}
        </span>
      ))}
    </span>
  );
}

export function RouteAwardTable({
  rows,
  name,
  describedBy,
}: {
  rows: ProgramRow[];
  /** TÊN của bảng, cho `<caption>`. Khác với đoạn mô tả — xem chú thích dưới. */
  name: string;
  describedBy: string;
}) {
  const cabins = rows[0].prices;

  return (
    // Hai thứ khác nhau, cố ý tách rời:
    //
    //  - `<caption>` đặt TÊN cho bảng ("Số điểm sáu chương trình cho chặng
    //    Toronto → Sài Gòn"). Không có nó thì screen reader gặp một bảng vô
    //    danh, và tiêu đề đứng ngay trên không tự nối vào bảng.
    //  - `aria-describedby` trỏ tới đoạn MÔ TẢ nhìn thấy được ("một chiều,
    //    một người, vuốt ngang…"). Đoạn đó phải nằm NGOÀI khung
    //    `overflow-x-auto` để người nhìn thấy nó không bị cuộn mất theo bảng.
    //
    // Bản trước gộp cả hai vào `<caption>` rồi lại in nguyên câu đó ra ngoài,
    // nên screen reader đọc đúng một câu hai lần; bản sau đó bỏ hẳn caption,
    // và bảng mất tên. Hai chuỗi khác nhau ở hai vai khác nhau mới là đủ.
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table
        aria-describedby={describedBy}
        className="w-full min-w-[36rem] border-collapse text-left"
      >
        <caption className="sr-only">{name}</caption>
        <thead>
          <tr className="bg-secondary">
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {r("programColumn")}
            </th>
            {cabins.map((cabin) => (
              <th
                key={cabin.cabin}
                scope="col"
                className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t(cabin.labelKey)}
              </th>
            ))}
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {r("transferColumn")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const reason = whyNoPrice(row);
            return (
              <tr key={row.quote.program.id} className="border-t border-border align-top">
                <th scope="row" className="px-4 py-3 font-normal">
                  <span className="block text-sm font-semibold text-foreground">
                    {row.quote.program.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        CONFIDENCE_STYLES[row.quote.program.confidence]
                      }`}
                    >
                      {t(CONFIDENCE_LABELS[row.quote.program.confidence])}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${SURCHARGE_STYLES[row.quote.program.surcharge]}`}
                    >
                      {t(SURCHARGE_LABELS[row.quote.program.surcharge])}
                    </span>
                  </span>
                </th>
                {row.prices.map((cell) => (
                  <td key={cell.cabin} className="px-4 py-3 text-right text-sm tabular-nums">
                    {cell.points === null ? (
                      <NoNumber label={reason} />
                    ) : (
                      <Points points={cell.points} startingAt={cell.startingAt} />
                    )}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <TransferCell program={row.quote.program} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OptionLine({ option }: { option: RoutingOption }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-secondary/60 px-3 py-2">
      <span className="font-mono text-sm text-foreground">{option.routing.join(" → ")}</span>
      <span className="text-[11px] text-muted-foreground">
        {option.carriers.map((c) => c.name).join(" + ")} ·{" "}
        {t("routingMiles", { miles: formatPoints(option.miles) })}
      </span>
      {option.needsFeeder && (
        <span className="rounded bg-[#fdf1d8] px-1.5 py-0.5 text-[11px] font-medium text-[#8a5a10]">
          {r("feederBadge")}
        </span>
      )}
    </li>
  );
}

/** Hành trình của từng chương trình, in đúng một lần cho cả ba hạng ghế.
 *
 *  Chương trình không có hành trình nào thì KHÔNG hiện — một tiêu đề trống
 *  không nói thêm điều gì mà bảng bên trên chưa nói. */
export function RouteRoutings({ rows }: { rows: ProgramRow[] }) {
  const withOptions = rows.filter((row) => row.quote.options.length > 0);

  if (withOptions.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-border bg-secondary p-4 text-sm leading-relaxed text-foreground/80">
        {r("routingsNone")}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-5">
      {withOptions.map((row) => (
        <div key={row.quote.program.id}>
          <h3 className="text-sm font-semibold text-foreground">
            {r("routingsFor", {
              program: row.quote.program.name,
              count: row.quote.options.length,
            })}
          </h3>
          {row.quote.routeNoteKey && (
            <p
              className={`mt-1.5 rounded-lg border px-3 py-2 text-xs font-medium leading-relaxed ${
                row.quote.routeNoteTone === "highlight"
                  ? "border-[#8a5a10]/30 bg-[#fdf1d8] text-[#8a5a10]"
                  : "border-border bg-secondary text-foreground/80"
              }`}
            >
              {t(row.quote.routeNoteKey)}
            </p>
          )}
          <ul className="mt-2 grid gap-1.5">
            {row.quote.options.map((option) => (
              <OptionLine
                // Cùng bẫy key như bên công cụ: chỉ dùng sân bay là không đủ,
                // một chặng có thể xuất hiện hai lần với hai hãng khác nhau.
                key={`${option.routing.join("-")}-${option.carriers.map((c) => c.code).join("")}${
                  option.dynamicPrice ? "-dyn" : ""
                }`}
                option={option}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
