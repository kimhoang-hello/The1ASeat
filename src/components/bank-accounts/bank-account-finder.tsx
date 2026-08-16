"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowSquareOut, CaretDown, Info } from "@phosphor-icons/react";
import { t as translate } from "@/lib/t";
import {
  ACCOUNT_FEATURES,
  BANKS,
  BANK_ACCOUNTS,
  BANK_ACCOUNTS_VERIFIED_ON,
  SORT_OPTIONS,
  bankById,
  formatIsoDate,
  formatMoney,
  formatRate,
  matchesFeature,
  sortAccounts,
  type AccountKind,
  type BankAccount,
  type BankId,
  type FeatureId,
  type SortId,
} from "@/lib/bank-accounts";

const t = translate("bankAccounts");

type Selection = {
  bank: BankId | "all";
  kind: AccountKind | "all";
  feature: FeatureId | "all";
  sort: SortId;
};

const KINDS: (AccountKind | "all")[] = ["all", "chequing", "savings"];

const KIND_LABEL_KEYS: Record<AccountKind, string> = {
  chequing: "kindChequing",
  savings: "kindSavings",
};

const TAG_LABEL_KEYS = {
  newcomer: "tagNewcomer",
  student: "tagStudent",
} as const;

function readParams(params: URLSearchParams): Selection {
  const bank = params.get("bank");
  const kind = params.get("kind");
  const feature = params.get("feature");
  const sort = params.get("sort");

  return {
    bank: BANKS.some((b) => b.id === bank) ? (bank as BankId) : "all",
    kind: kind === "chequing" || kind === "savings" ? kind : "all",
    feature: ACCOUNT_FEATURES.some((f) => f.id === feature) ? (feature as FeatureId) : "all",
    sort: SORT_OPTIONS.some((s) => s.id === sort) ? (sort as SortId) : "bonus",
  };
}

/**
 * Ô logo ngân hàng. Trang chưa có file logo nào của BMO® hay Scotiabank®, nên
 * thay vì mượn ảnh ở đâu đó, ô này dùng chính màu thương hiệu và tên viết tắt —
 * vẫn phân biệt được hai ngân hàng ngay từ xa mà không đưa lên trang một tài
 * sản không rõ nguồn.
 */
function BankMark({ bank }: { bank: BankId }) {
  const { short, color } = bankById(bank);

  return (
    <span
      className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold uppercase tracking-wide text-white"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {short}
    </span>
  );
}

/**
 * Tài khoản không có welcome bonus lẫn lãi suất công bố thì phí tháng chính
 * là con số đáng nhìn nhất — nó lên làm số lớn, và ô phí tháng bên phải bị bỏ
 * đi. Trang tham khảo không làm vậy nên thẻ của họ in "$4 / Monthly fee" hai
 * lần cạnh nhau, đọc như một lỗi hiển thị.
 */
function feeIsHeadline(account: BankAccount): boolean {
  return (
    account.bonusLabelVi === undefined &&
    account.interestRate === undefined &&
    account.noRateNoteVi === undefined
  );
}

/**
 * Con số lớn nhất trên mỗi thẻ. Tài khoản chi tiêu bán welcome bonus, tài
 * khoản tiết kiệm bán lãi suất, còn lại thì bán phí tháng — chỗ này đổi ý
 * nghĩa theo tài khoản thay vì để trống.
 */
function Headline({ account }: { account: BankAccount }) {
  if (account.bonusLabelVi) {
    return (
      <>
        <p className="font-display text-2xl font-extrabold leading-tight text-primary">
          {account.bonusLabelVi}
        </p>
        <p className="text-xs text-muted-foreground">{t("welcomeBonus")}</p>
      </>
    );
  }

  if (account.interestRate !== undefined) {
    return (
      <>
        <p className="font-display text-2xl font-extrabold leading-tight text-primary">
          {formatRate(account.interestRate)}
          {account.promoNoteVi && <span className="align-super text-base">*</span>}
        </p>
        <p className="text-xs text-muted-foreground">{t("interestRate")}</p>
      </>
    );
  }

  if (account.noRateNoteVi) {
    return (
      <>
        <p className="font-display text-lg font-bold leading-tight text-muted-foreground">
          {t("noRate")}
        </p>
        <p className="text-xs text-muted-foreground">{t("interestRate")}</p>
      </>
    );
  }

  return (
    <>
      <p className="font-display text-2xl font-extrabold leading-tight text-foreground">
        {account.monthlyFee === 0 ? t("free") : formatMoney(account.monthlyFee)}
      </p>
      <p className="text-xs text-muted-foreground">{t("monthlyFee")}</p>
    </>
  );
}

function AccountCard({ account }: { account: BankAccount }) {
  const bank = bankById(account.bank);

  return (
    <li className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <BankMark bank={account.bank} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
              {t(KIND_LABEL_KEYS[account.kind])}
            </span>
            {account.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary"
              >
                {t(TAG_LABEL_KEYS[tag])}
              </span>
            ))}
          </div>
          <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-foreground">
            {account.name}
          </h3>
          <p className="text-sm text-muted-foreground">{bank.name}</p>
        </div>
      </div>

      {/* Con số lớn và phí tháng nằm cạnh nhau: gần như câu hỏi nào của người
          đọc cũng là "được bao nhiêu" trừ đi "mất bao nhiêu". */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-xl bg-secondary/70 px-4 py-3">
        <div>
          <Headline account={account} />
        </div>
        {!feeIsHeadline(account) && (
          <div className="text-right">
            <p className="font-display text-lg font-bold text-foreground">
              {account.monthlyFee === 0 ? t("free") : formatMoney(account.monthlyFee)}
            </p>
            <p className="text-xs text-muted-foreground">{t("monthlyFee")}</p>
          </div>
        )}
      </div>

      {account.promoNoteVi && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold">* </span>
          {account.promoNoteVi}
          {account.regularRate !== undefined && (
            <> {t("regularRate", { rate: formatRate(account.regularRate) })}</>
          )}
        </p>
      )}

      {account.noRateNoteVi && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{account.noRateNoteVi}</p>
      )}

      {account.feeWaiverVi && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{account.feeWaiverVi}</p>
      )}

      <ul className="mt-3 ml-5 list-disc space-y-1 text-sm leading-relaxed text-foreground/90">
        {account.keyBenefitsVi.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      {account.bonusConditionsVi && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-foreground/80 hover:text-primary">
            <CaretDown size={14} className="transition-transform group-open:rotate-180" />
            {t("bonusConditions")}
          </summary>
          <ul className="ml-5 mt-2 list-disc space-y-1 text-sm leading-relaxed text-muted-foreground">
            {account.bonusConditionsVi.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
          {account.bonusExpiresOn && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {t("bonusExpires", { date: formatIsoDate(account.bonusExpiresOn) })}
            </p>
          )}
        </details>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-4 pt-4">
        <a
          href={account.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {t("openAccount")}
          <ArrowSquareOut size={16} weight="bold" />
        </a>
        <span className="text-xs text-muted-foreground">{t("officialLink")}</span>
      </div>
    </li>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-foreground/70 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full cursor-pointer rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
      >
        {children}
      </select>
    </label>
  );
}

function Finder() {
  const searchParams = useSearchParams();

  // URL là nguồn sự thật duy nhất, không phải bản sao của state — cùng lý do
  // đã ghi trong Award Flight Finder: trang được prerender nên seed state từ
  // search params sẽ đóng băng giá trị mặc định và làm hỏng link chia sẻ.
  const selection = readParams(searchParams);
  const { bank, kind, feature, sort } = selection;

  function update(patch: Partial<Selection>) {
    const next = { ...selection, ...patch };
    window.history.replaceState(null, "", `?${new URLSearchParams(next).toString()}`);
  }

  // Không useMemo: danh sách chỉ mười mấy dòng, lọc lại mỗi lần render rẻ hơn
  // nhiều so với cái giá thật sự — React Compiler từ chối tối ưu cả component
  // khi thấy memo thủ công phụ thuộc vào giá trị nó nghĩ có thể đổi sau.
  const accounts = sortAccounts(
    BANK_ACCOUNTS.filter(
      (account) =>
        (bank === "all" || account.bank === bank) &&
        (kind === "all" || account.kind === kind) &&
        (feature === "all" || matchesFeature(account, feature)),
    ),
    sort,
  );

  return (
    <div className="mx-auto max-w-page">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((value) => (
          <Chip key={value} active={kind === value} onClick={() => update({ kind: value })}>
            {value === "all" ? t("kindAll") : t(KIND_LABEL_KEYS[value])}
          </Chip>
        ))}
        {ACCOUNT_FEATURES.map((f) => (
          <Chip
            key={f.id}
            active={feature === f.id}
            // Bấm lại chip đang bật thì tắt nó — nếu không, người đọc lọc vào
            // "Sinh viên" rồi không có đường quay ra ngoài trừ khi tải lại trang.
            onClick={() => update({ feature: feature === f.id ? "all" : f.id })}
          >
            {t(f.labelKey)}
          </Chip>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label={t("bankLabel")}
          value={bank}
          onChange={(value) => update({ bank: value as Selection["bank"] })}
        >
          <option value="all">{t("bankAll")}</option>
          {BANKS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Field>

        <Field
          label={t("sortLabel")}
          value={sort}
          onChange={(value) => update({ sort: value as SortId })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {t(option.labelKey)}
            </option>
          ))}
        </Field>
      </div>

      <p className="mt-6 text-sm font-medium text-muted-foreground" aria-live="polite">
        {t("resultCount", { count: accounts.length })}
      </p>

      <ul className="mt-3 grid gap-5 xl:grid-cols-2">
        {accounts.map((account) => (
          <AccountCard key={account.slug} account={account} />
        ))}

        {accounts.length === 0 && (
          <li className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground xl:col-span-2">
            {t("empty")}
          </li>
        )}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        {t("verifiedOn", { date: formatIsoDate(BANK_ACCOUNTS_VERIFIED_ON) })}
      </p>

      <div className="mt-6 flex gap-3 rounded-xl border border-border bg-secondary p-4">
        <Info size={20} weight="fill" className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">{t("disclaimerHeading")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}

export function BankAccountFinder() {
  // useSearchParams đẩy cả nhánh này sang client, nên boundary giữ phần còn
  // lại của trang vẫn prerender được — giống hệt Award Flight Finder.
  return (
    <Suspense
      fallback={<div className="mx-auto h-96 max-w-page animate-pulse rounded-2xl bg-secondary" />}
    >
      <Finder />
    </Suspense>
  );
}
