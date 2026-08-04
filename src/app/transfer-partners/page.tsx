import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { t } from "@/lib/t";
import { TRANSFER_PARTNERS, type TransferLeg } from "@/lib/transfer-partners";

const tp = t("transferPartners");

export const metadata: Metadata = { title: tp("title") };

const BADGE_STYLES = {
  amex: "bg-[#e7f2ea] text-[#1f6f43]",
  rbc: "bg-[#fdf1d8] text-[#8a5a10]",
} as const;

function LegCell({ leg, tint }: { leg: TransferLeg; tint: keyof typeof BADGE_STYLES }) {
  if (!leg) {
    return <td className="px-4 py-4 text-center text-muted-foreground/50">{tp("noData")}</td>;
  }
  return (
    <td className="px-2 py-3">
      <div
        className={`mx-auto flex max-w-[180px] flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-center ${BADGE_STYLES[tint]}`}
      >
        <span className="text-sm font-bold">{leg.ratio}</span>
        <span className="text-xs opacity-80">{leg.note}</span>
      </div>
    </td>
  );
}

export default function TransferPartnersPage() {
  return (
    <>
      <PageHeader eyebrow={tp("eyebrow")} title={tp("title")} subtitle={tp("subtitle")} />
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-3" />
                  <th className="px-2 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/logos/amex.svg"
                      alt="American Express"
                      className="mx-auto h-6 w-auto"
                    />
                  </th>
                  <th className="px-2 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/logos/rbc.svg"
                      alt="RBC"
                      className="mx-auto h-8 w-auto"
                    />
                  </th>
                </tr>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {tp("columnProgram")}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                    {tp("columnAmex")}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                    {tp("columnRbc")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {TRANSFER_PARTNERS.map((row, i) => (
                  <tr
                    key={row.program}
                    className={i % 2 === 0 ? "bg-card" : "bg-background"}
                  >
                    <td className="px-4 py-4 font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.logo}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-md border border-border object-contain bg-white p-1"
                        />
                        <span>{row.program}</span>
                      </div>
                    </td>
                    <LegCell leg={row.amex} tint="amex" />
                    <LegCell leg={row.rbc} tint="rbc" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{tp("aeroplanNote")}</p>
        </div>
      </section>
    </>
  );
}
