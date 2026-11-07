import Link from "next/link";
import { t as translate } from "@/lib/t";
import { getTransferBonuses } from "@/lib/content";
import { todayInSiteZone } from "@/lib/format-date";
import { liveBonusViews, type BonusView } from "@/lib/transfer-bonus-view";
import { getUsTransferBonuses } from "@/lib/us-transfer-bonuses-data";
import { Flag } from "@/components/ui/flag";
import { BonusList } from "@/components/transfer-bonuses/bonus-list";

const t = translate("bonuses");

/** Mỗi nước tối đa ba bonus — đủ để thấy có gì đang chạy, phần còn lại ở `/transfer-bonuses`. */
const PER_REGION = 3;

/**
 * Một cột của một nước. Hai nước đứng CẠNH NHAU chứ không trộn vào một danh
 * sách: bonus Mỹ nhiều gấp mấy lần bonus Canada (06/11/2026: 10 so với 1), nên
 * ba ô "sắp hết hạn nhất" của danh sách chung toàn là bonus Mỹ, và người đọc
 * Canada — phần lớn độc giả — không thấy bonus của chính mình.
 */
function RegionColumn({
  country,
  bonuses,
  anchor,
  emptyText,
}: {
  country: "ca" | "us";
  bonuses: BonusView[];
  anchor: string;
  emptyText: string;
}) {
  const region = country === "us" ? t("regionUs") : t("regionCa");
  const hidden = bonuses.length - PER_REGION;

  return (
    <section aria-labelledby={`home-bonuses-${country}`}>
      <h3
        id={`home-bonuses-${country}`}
        className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground"
      >
        <Flag country={country} />
        {region}
        {bonuses.length > 0 && (
          <span className="text-sm font-normal text-muted-foreground">
            · {t("regionCount", { count: bonuses.length })}
          </span>
        )}
      </h3>
      {bonuses.length > 0 ? (
        <BonusList bonuses={bonuses.slice(0, PER_REGION)} compact />
      ) : (
        <p className="rounded-2xl border border-border px-5 py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
      {hidden > 0 && (
        <Link
          href={`/transfer-bonuses#${anchor}`}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
        >
          {t("moreInRegion", { count: bonuses.length, region })} &rarr;
        </Link>
      )}
    </section>
  );
}

export async function TransferBonusesSection() {
  const today = todayInSiteZone();
  // Lọc TRƯỚC khi cắt ba cái đầu, cùng lý do với `/transfer-bonuses`: danh
  // sách sắp theo `expiresAt` tăng dần nên cái chết trước đứng đầu, tức là
  // không lọc thì đúng mấy ô trên trang chủ là offer sắp chết hoặc đã chết.
  // Job `expire-offers` chạy 08:00 UTC mỗi ngày, nên một bonus hết hạn lúc nửa
  // đêm Toronto còn nằm đây vài tiếng — và nằm mãi nếu job hỏng. `revalidate`
  // 60 giây không cứu được: lượt render mới vẫn dựng lại đúng cái HTML đó.
  const ca = liveBonusViews(await getTransferBonuses(), today);
  const us = liveBonusViews(getUsTransferBonuses(), today);

  return (
    <section className="border-t border-border bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-page">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl xl:text-4xl">
              {t("title")}
            </h2>
          </div>
          <Link
            href="/transfer-bonuses"
            className="inline-flex min-h-11 cursor-pointer items-center text-base font-semibold text-primary hover:underline sm:items-end"
          >
            {t("viewAll")} &rarr;
          </Link>
        </div>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
          <RegionColumn country="ca" bonuses={ca} anchor="canada" emptyText={t("canadaEmpty")} />
          <RegionColumn country="us" bonuses={us} anchor="my" emptyText={t("usEmpty")} />
        </div>
      </div>
    </section>
  );
}
