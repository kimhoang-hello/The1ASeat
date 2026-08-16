import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { HotTip, RebateChip } from "@/components/ui/hot-tip";
import { ApplyButton } from "@/components/ui/apply-button";
import {
  BANK_ACCOUNTS,
  bankAccountBySlug,
  bankAccountPath,
  bankById,
  formatIsoDate,
  formatMoney,
  formatRate,
  type BankAccount,
} from "@/lib/bank-accounts";
import { BANK_ACCOUNTS_PUBLISHED } from "@/lib/feature-flags";
import { t as translate } from "@/lib/t";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

const bank_t = translate("bankAccounts");
// Xem chú thích ở bank-account-finder.tsx: nhãn hết hạn dùng chung với thẻ.
const offers = translate("offers");
const common = translate("common");
const seo = translate("seo");

const KIND_LABEL_KEYS = {
  chequing: "kindChequing",
  savings: "kindSavings",
} as const;

const TAG_LABEL_KEYS = {
  newcomer: "tagNewcomer",
  student: "tagStudent",
} as const;

export function generateStaticParams() {
  return BANK_ACCOUNTS.map((account) => ({ slug: account.slug }));
}

/**
 * Mô tả cho thẻ meta, ghép từ chính số liệu của tài khoản. Viết tay 16 đoạn
 * mô tả thì đoạn thứ mười bảy sẽ bị quên, và một mô tả chép lại của nhau còn
 * tệ hơn là không có.
 */
function description(account: BankAccount): string {
  const parts = [account.name + ":"];
  if (account.bonusLabelVi) parts.push(seo("bankAccountBonus", { bonus: account.bonusLabelVi }));
  if (account.interestRate !== undefined) {
    parts.push(seo("bankAccountRate", { rate: formatRate(account.interestRate) }));
  }
  // "Monthly fee miễn phí" đọc như một lỗi ghép chuỗi; không phí thì nói
  // thẳng là không mất phí.
  parts.push(
    account.monthlyFee === 0
      ? seo("bankAccountNoFee")
      : seo("bankAccountFee", { fee: formatMoney(account.monthlyFee) }),
  );
  parts.push(seo("bankAccountTail"));
  return parts.join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const account = bankAccountBySlug(slug);
  if (!account) return {};

  return {
    ...pageMetadata({
      title: account.name,
      description: description(account),
      path: bankAccountPath(account.slug),
    }),
    // Cùng lý do với trang danh sách: bản nháp thì không cho Google index.
    ...(BANK_ACCOUNTS_PUBLISHED ? {} : { robots: { index: false, follow: false } }),
  };
}

/** Một ô số liệu. Trang riêng có chỗ nên mỗi con số được đứng một mình, thay
 *  vì phải chen nhau trên một dòng như ở danh sách. */
function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-display text-2xl font-extrabold leading-tight text-primary">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function BankAccountDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const account = bankAccountBySlug(slug);

  if (!account) notFound();

  const bank = bankById(account.bank);
  const path = bankAccountPath(account.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd([
        { name: seo("breadcrumbBankAccounts"), path: "/bank-accounts" },
        { name: account.name, path },
      ]),
      {
        "@type": "BankAccount",
        name: account.name,
        description: description(account),
        url: account.url,
        provider: { "@type": "BankOrCreditUnion", name: bank.name },
        ...(account.feeWaiverVi && { feesAndCommissionsSpecification: account.feeWaiverVi }),
        ...(account.interestRate !== undefined && { interestRate: account.interestRate }),
      },
    ],
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd data={jsonLd} />

      {!BANK_ACCOUNTS_PUBLISHED && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {bank_t("draftNotice")}
        </p>
      )}

      <Link href="/bank-accounts" className="text-sm font-semibold text-primary hover:underline">
        &larr; {bank_t("viewAll")}
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-x-1.5 gap-y-3">
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
          {bank_t(KIND_LABEL_KEYS[account.kind])}
        </span>
        {account.tags.map((tag) => (
          <span
            key={tag}
            className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary"
          >
            {bank_t(TAG_LABEL_KEYS[tag])}
          </span>
        ))}
        {account.rebate && <RebateChip amount={account.rebate} label={bank_t("rebate")} />}
      </div>

      {/* Logo và tên đứng cùng hàng: hai thứ này cùng trả lời một câu hỏi —
          "đây là tài khoản nào của ai" — nên tách ra hai dòng chỉ làm mắt phải
          đi hai lần. Xuống dòng dưới 640px, vì cạnh một logo 144px thì tiêu đề
          30px chỉ còn chỗ cho khoảng chín ký tự mỗi dòng. */}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bank.logo}
          alt=""
          className="h-12 w-36 shrink-0 self-start rounded-lg border border-border bg-white object-contain p-2 sm:self-auto"
        />
        <h1 className="font-display text-3xl font-extrabold text-foreground">{account.name}</h1>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {account.bonusLabelVi && (
          <Stat
            value={account.bonusLabelVi}
            label={bank_t("welcomeBonus")}
            hint={
              account.bonusExpiresOn
                ? `${offers("expiresOn")} ${formatIsoDate(account.bonusExpiresOn)}`
                : undefined
            }
          />
        )}

        {account.interestRate !== undefined && (
          <Stat
            value={formatRate(account.interestRate)}
            label={bank_t("interestRate")}
            hint={
              account.promoNoteVi &&
              (account.regularRate !== undefined
                ? `${account.promoNoteVi} ${bank_t("regularRate", {
                    rate: formatRate(account.regularRate),
                  })}`
                : account.promoNoteVi)
            }
          />
        )}

        {account.noRateNoteVi && (
          <Stat
            value={bank_t("noRate")}
            label={bank_t("interestRate")}
            hint={account.noRateNoteVi}
          />
        )}

        <Stat
          value={account.monthlyFee === 0 ? bank_t("free") : formatMoney(account.monthlyFee)}
          label={bank_t("monthlyFee")}
        />
      </div>

      {account.feeWaiverVi && (
        <>
          <h2 className="mt-8 font-display text-xl font-bold text-foreground">
            {bank_t("feeWaiverHeading")}
          </h2>
          <p className="mt-2 leading-relaxed text-foreground/90">{account.feeWaiverVi}</p>
        </>
      )}

      <h2 className="mt-8 font-display text-xl font-bold text-foreground">
        {bank_t("keyBenefits")}
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
        {account.keyBenefitsVi.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      {/* Ở danh sách phần này phải bấm mới mở ra; ở đây nó là lý do người đọc
          bấm vào, nên mở sẵn. */}
      {account.bonusConditionsVi && (
        <>
          <h2 className="mt-8 font-display text-xl font-bold text-foreground">
            {bank_t("bonusConditions")}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-foreground/90">
            {account.bonusConditionsVi.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
          {account.bonusExpiresOn && (
            <p className="mt-3 text-sm font-medium text-amber-700">
              {offers("expiresOn")} {formatIsoDate(account.bonusExpiresOn)}
            </p>
          )}
        </>
      )}

      {account.rebate && (
        <div className="mt-8">
          <HotTip>{bank_t("rebateHotTip", { amount: account.rebate })}</HotTip>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <ApplyButton
          href={account.affiliateUrl ?? account.url}
          affiliate={Boolean(account.affiliateUrl)}
        />
        {/* Nút đi qua link affiliate, nên vẫn để sẵn đường tới trang gốc của
            ngân hàng — người đọc phải tự đối chiếu được số liệu mà không bị
            bắt buộc đi qua link có hoa hồng. */}
        {account.affiliateUrl && (
          <a
            href={account.url}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="cursor-pointer text-sm font-semibold text-foreground/80 hover:text-primary hover:underline"
          >
            {bank_t("officialLink")} &rarr;
          </a>
        )}
      </div>

      {/* Cùng thứ tự với trang danh sách: dặn dò trước, công bố affiliate sau. */}
      <div className="mt-8 rounded-xl border border-border bg-secondary p-4">
        <p className="text-sm font-semibold text-foreground">{bank_t("disclaimerHeading")}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{bank_t("disclaimer")}</p>
      </div>

      <OfferDisclosure className="mt-4" />

      <p className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <Link href={`/bank-accounts?bank=${account.bank}`} className="underline">
          {bank_t("otherFromBank", { bank: bank.name })}
        </Link>
        <Link href="/" className="underline">
          {common("backHome")}
        </Link>
      </p>
    </article>
  );
}
