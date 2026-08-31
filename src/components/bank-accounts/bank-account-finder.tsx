"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CaretDown, Info } from "@phosphor-icons/react";
import { OfferDisclosure } from "@/components/credit-cards/offer-disclosure";
import { HotTip, RebateChip } from "@/components/ui/hot-tip";
import { ApplyButton } from "@/components/ui/apply-button";
import { t as translate } from "@/lib/t";
import {
  AVAILABLE_FILTERS,
  hasLiveBonus,
  BANKS,
  BANK_ACCOUNTS,
  BANK_ACCOUNTS_VERIFIED_ON,
  SORT_OPTIONS,
  bankAccountPath,
  bankById,
  formatIsoDate,
  formatMoney,
  formatRate,
  matchesFilter,
  sortAccounts,
  type AccountKind,
  type BankAccount,
  type BankId,
  type FilterId,
  type SortId,
} from "@/lib/bank-accounts";

const t = translate("bankAccounts");
// Nhãn hết hạn lấy chung với trang thẻ tín dụng — cùng một sự việc thì phải
// gọi cùng một tên, và gọi từ cùng một chỗ thì không thể lệch nhau về sau.
const offers = translate("offers");

type Selection = {
  bank: BankId | "all";
  filter: FilterId;
  sort: SortId;
};

/** Nhãn phân loại in trên thẻ — khác với danh sách bộ lọc, ở đây không có
 *  "Tất cả" vì mỗi tài khoản chỉ thuộc đúng một loại. */
const KIND_LABEL_KEYS: Record<AccountKind, string> = {
  chequing: "kindChequing",
  savings: "kindSavings",
};

const TAG_LABEL_KEYS = {
  newcomer: "tagNewcomer",
  student: "tagStudent",
} as const;

/**
 * Ngân hàng đang chọn có thể không còn tài khoản nào dưới bộ lọc nhanh hiện
 * tại. Khi đó coi như "tất cả" — hiện danh sách rỗng thì người đọc không biết
 * phải làm gì tiếp, còn "tất cả" luôn có đường đi tiếp.
 *
 * Một hàm dùng cho cả hai chỗ: lúc bấm chip, và lúc mở một URL có sẵn. Tách
 * làm hai bản là mời gọi chúng lệch nhau.
 */
function normalize(selection: Selection): Selection {
  if (selection.bank === "all") return selection;

  const survives = BANK_ACCOUNTS.some(
    (account) => account.bank === selection.bank && matchesFilter(account, selection.filter),
  );
  return survives ? selection : { ...selection, bank: "all" };
}

function readParams(params: URLSearchParams): Selection {
  const bank = params.get("bank");
  const filter = params.get("filter");
  const sort = params.get("sort");

  return {
    bank: BANKS.some((b) => b.id === bank) ? (bank as BankId) : "all",
    filter: AVAILABLE_FILTERS.some((f) => f.id === filter) ? (filter as FilterId) : "all",
    sort: SORT_OPTIONS.some((s) => s.id === sort) ? (sort as SortId) : "bonus",
  };
}

/**
 * Logo ngân hàng, đặt trên nền trắng vì logo ngân hàng được thiết kế cho nền
 * trắng — nền kem của trang làm phần trắng bên trong logo lộ ra thành vệt.
 *
 * `alt` để trống có chủ ý: tên ngân hàng đã nằm ngay trong tên tài khoản bên
 * dưới ("Scotiabank® Preferred Package"), nên logo là trang trí — mô tả nó nữa
 * chỉ làm người dùng screen reader nghe tên ngân hàng hai lần liên tiếp.
 *
 * Ô rộng cố định và `object-contain` vì logo mỗi ngân hàng một tỷ lệ: wordmark
 * Scotiabank® dài gần gấp đôi logo BMO®. Nếu ô co theo ảnh thì khi có lại
 * nhiều ngân hàng, hai thẻ cạnh nhau sẽ lệch hẳn nhau ở góc trên.
 */
function BankMark({ bank }: { bank: BankId }) {
  const { logo } = bankById(bank);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={logo}
      alt=""
      className="h-9 w-28 shrink-0 rounded-md border border-border bg-white object-contain p-1.5"
    />
  );
}

/**
 * Tài khoản không có welcome bonus lẫn lãi suất công bố thì monthly fee chính
 * là con số đáng nhìn nhất — nó lên làm số lớn, và ô monthly fee bên phải bị bỏ
 * đi. Trang tham khảo không làm vậy nên thẻ của họ in "$4 / Monthly fee" hai
 * lần cạnh nhau, đọc như một lỗi hiển thị.
 */
function feeIsHeadline(account: BankAccount): boolean {
  return (
    !hasLiveBonus(account) &&
    account.interestRate === undefined &&
    account.noRateNoteVi === undefined
  );
}

/**
 * Con số lớn nhất trên mỗi thẻ. Tài khoản chi tiêu bán welcome bonus, tài
 * khoản tiết kiệm bán lãi suất, còn lại thì bán monthly fee — chỗ này đổi ý
 * nghĩa theo tài khoản thay vì để trống.
 */
function Headline({ account }: { account: BankAccount }) {
  // `hasLiveBonus` chứ không phải `bonusLabelVi`: bonus hết hạn thì thẻ rơi
  // xuống nói về lãi suất hoặc phí, chứ không quảng cáo một con số không lấy
  // được nữa.
  if (hasLiveBonus(account)) {
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
  return (
    <li className="flex flex-col rounded-2xl border border-border bg-card p-5">
      {/* Nhãn phân loại làm dòng đầu, rồi logo và tên đứng cùng hàng — cùng
          thứ tự và cùng lý do như trang riêng của tài khoản: logo và tên trả
          lời chung một câu hỏi nên đi liền nhau.
          Ở đây tên chỉ 18px chứ không phải 30px như trang riêng, nên nó đủ chỗ
          nằm cạnh logo ngay cả trên điện thoại, không cần xuống dòng. */}
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <div className="flex flex-wrap gap-1.5">
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
        {account.rebate && <RebateChip amount={account.rebate} label={t("rebate")} />}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <BankMark bank={account.bank} />
        {/* `wrap-anywhere` chứ không phải `break-words`: chỉ `overflow-wrap:
            anywhere` mới tính vào min-content của thẻ. Cạnh một logo rộng cố
            định 112px, một từ dài như "MomentumPLUS" hay "Wealthsimple®" đẩy
            min-content của cả cột grid lên 312px trong khi cột chỉ có 288px,
            và ở màn 320px cả trang bị trượt ngang 8px. `break-words` không
            sửa được vì nó không đổi min-content — chỗ này đúng là cái bẫy mà
            hai utility đó hay bị nhầm với nhau. */}
        {/* h2 chứ không phải h3: trang chỉ có một h1 (tiêu đề trang) nên tên
            tài khoản là cấp tiếp theo — h3 ở đây tạo ra một bậc nhảy cóc,
            đúng thứ mà bản kiểm tra tiêu đề của site vẫn bắt lỗi. */}
        <h2 className="wrap-anywhere font-display text-lg font-bold leading-snug text-foreground">
          <Link href={bankAccountPath(account.slug)} className="cursor-pointer hover:text-primary">
            {account.name}
          </Link>
        </h2>
      </div>

      {/* Con số lớn và monthly fee nằm cạnh nhau: gần như câu hỏi nào của người
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
              {offers("expiresOn")} {formatIsoDate(account.bonusExpiresOn)}
            </p>
          )}
        </details>
      )}

      {account.rebate && (
        <div className="mt-3">
          <HotTip compact>{t("rebateHotTip", { amount: account.rebate })}</HotTip>
        </div>
      )}

      {/* Cùng một nút với trang thẻ tín dụng. `affiliate` bật theo dữ liệu chứ
          không đặt cứng: tài khoản có link FinlyWealth thì nút mang
          `rel="sponsored"`, tài khoản chưa có thì trỏ thẳng trang ngân hàng
          với rel thường. */}
      <div className="mt-auto flex flex-wrap items-center gap-4 pt-4">
        <ApplyButton
          href={account.affiliateUrl ?? account.url}
          affiliate={Boolean(account.affiliateUrl)}
          placement="account_list"
          product={account.slug}
        />
        <Link
          href={bankAccountPath(account.slug)}
          className="cursor-pointer text-sm font-semibold text-foreground/80 hover:text-primary hover:underline"
        >
          {t("details")} &rarr;
        </Link>
      </div>
    </li>
  );
}

/**
 * `role="radiogroup"` là một lời hứa về bàn phím chứ không phải cái nhãn suông:
 * chuẩn ARIA quy định cả nhóm là MỘT điểm dừng Tab, và phím mũi tên mới là thứ
 * chuyển giữa các lựa chọn. Thiếu phần đó thì trình đọc màn hình vẫn đọc "nhóm
 * chọn, mục 3 trên 7", người dùng bấm mũi tên theo phản xạ và không có gì xảy
 * ra — tệ hơn là không gắn `role` nào, vì khi đó "một loạt nút bấm" ít nhất là
 * mô tả đúng, và Tab từng cái là hành vi đúng của nút bấm.
 *
 * Bắt phím ở cấp nhóm rồi tự tìm các `role="radio"` con trong DOM, để hai loại
 * chip bên dưới không phải biết gì về nhóm chứa chúng — chúng khác nhau về hình
 * dạng có chủ ý, và sẽ còn khác nữa.
 *
 * ĐIỀU KIỆN bắt buộc khi dùng lại: nhóm phải LUÔN có đúng một chip `active`.
 * Không chip nào active thì cả nhóm không có điểm dừng Tab nào và người dùng
 * bàn phím không vào được; hai chip active thì nhóm có hai điểm dừng, tức mất
 * đúng cái vừa sửa. Hai nhóm hiện tại thoả điều kiện: bộ lọc luôn rơi về
 * `"all"`, còn ngân hàng đi qua `activeBank` cũng rơi về `"all"`.
 */
const RADIO_KEYS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];

function RadioGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!RADIO_KEYS.includes(event.key)) return;

    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const current = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;

    event.preventDefault();

    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? radios.length - 1
          : (current + (forward ? 1 : -1) + radios.length) % radios.length;

    // Chuẩn radio: di chuyển tới đâu là chọn luôn tới đó, không phải chuyển
    // rồi chờ bấm Space. `focus` trước `click` để con trỏ ở đúng chip mới sau
    // khi React render lại.
    radios[next].focus();
    radios[next].click();
  }

  return (
    <div role="radiogroup" aria-label={label} className={className} onKeyDown={handleKeyDown}>
      {children}
    </div>
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
      role="radio"
      aria-checked={active}
      // Chỉ chip đang chọn nằm trong luồng Tab: cả nhóm là một điểm dừng, đúng
      // như `radiogroup` đã hứa. Trước đây 12 chip là 12 lần bấm Tab mới xuống
      // được tới danh sách tài khoản.
      tabIndex={active ? 0 : -1}
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

/**
 * Chip có số đếm, viền mảnh — hình dạng của hàng Điểm thưởng bên trang thẻ tín
 * dụng. Khác `Chip` ở trên có chủ ý: hai hàng nằm sát nhau và lọc hai thứ khác
 * nhau, cùng một hình dạng thì đọc như một nhóm chọn duy nhất bị vỡ dòng.
 */
function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-border text-foreground/70 hover:border-primary hover:text-primary"
      }`}
    >
      {children}
      <span className="ml-1 text-xs text-muted-foreground">{count}</span>
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

/** Cái mà một người mở /bank-accounts không kèm tham số nào sẽ thấy. */
const DEFAULT_SELECTION: Selection = { bank: "all", filter: "all", sort: "bonus" };

/**
 * Toàn bộ phần nhìn thấy được, tách khỏi chỗ đọc URL. Tách ra để nó render
 * được cả ở server (xem `BankAccountFinder` bên dưới) chứ không chỉ sau khi
 * JavaScript chạy xong.
 */
function FinderView({
  selection,
  update,
}: {
  selection: Selection;
  update: (patch: Partial<Selection>) => void;
}) {
  const { bank, filter, sort } = selection;

  // Không useMemo: danh sách chỉ mười mấy dòng, lọc lại mỗi lần render rẻ hơn
  // nhiều so với cái giá thật sự — React Compiler từ chối tối ưu cả component
  // khi thấy memo thủ công phụ thuộc vào giá trị nó nghĩ có thể đổi sau.
  const inFilter = BANK_ACCOUNTS.filter((account) => matchesFilter(account, filter));
  // Nhiều tài khoản nhất đứng trước, giống hàng chip điểm thưởng ở trang thẻ
  // (getCardPointsPrograms). Thứ tự khai báo trong BANKS đọc như thể đã sắp
  // theo số lượng — Scotiabank® 6 rồi BMO® 4 — nên RBC® 5 nằm cuối, sau
  // National Bank® 1, trông như sót chứ không như một thứ tự có chủ ý. Sort
  // của JS ổn định, nên hai ngân hàng bằng điểm vẫn giữ nguyên thứ tự BANKS.
  const availableBanks = BANKS.map((b) => ({
    ...b,
    count: inFilter.filter((account) => account.bank === b.id).length,
  }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count);

  // Ngân hàng đang chọn có thể vừa biến mất khỏi hàng chip vì bộ lọc nhanh
  // vừa đổi. Coi như "tất cả" thay vì hiện danh sách rỗng — cùng cách trang
  // thẻ tín dụng xử lý một ?points= không còn tài khoản nào.
  const activeBank = availableBanks.some((b) => b.id === bank) ? bank : "all";

  // `selection.bank` có thể trỏ tới một ngân hàng vừa rơi khỏi hàng chip vì bộ
  // lọc nhanh; `activeBank` là cái người đọc đang thật sự thấy. Ghi cái họ
  // thấy vào URL — nếu ghi giá trị thô thì chọn Scotiabank®, lọc "newcomer"
  // (Scotiabank® không có tài khoản nào), rồi gạt bộ lọc về "tất cả" sẽ làm
  // Scotiabank® sống lại sau lưng họ, dù giao diện vẫn hiện "tất cả ngân hàng".
  const patch = (next: Partial<Selection>) => {
    const merged = { ...selection, bank: activeBank, ...next };
    // Chuẩn hoá theo BỘ LỌC MỚI, không phải bộ lọc cũ: `activeBank` ở trên
    // tính theo `filter` hiện tại, nên nếu chỉ dựa vào nó thì bấm "newcomer"
    // lúc đang chọn Scotiabank® sẽ ghi `bank=scotiabank&filter=newcomer` vào
    // URL trong khi màn hình hiện tất cả ngân hàng — link chia sẻ nói một
    // đằng, trang hiện một nẻo.
    update(normalize(merged));
  };
  const accounts = sortAccounts(
    inFilter.filter((account) => activeBank === "all" || account.bank === activeBank),
    sort,
  );

  return (
    <div className="mx-auto max-w-page">
      {/* Một nhóm, một lựa chọn. `radiogroup` nói đúng điều mắt đã thấy, và
          "Tất cả" là đường quay ra — nên bấm lại chip đang bật không cần làm
          gì cả, khác với khi hàng này còn là hai nhóm chồng lên nhau. */}
      <RadioGroup label={t("filterLabel")} className="flex flex-wrap gap-2">
        {AVAILABLE_FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => patch({ filter: f.id })}>
            {t(f.labelKey)}
          </Chip>
        ))}
      </RadioGroup>

      {/* Hàng ngân hàng đọc như hàng Điểm thưởng bên trang thẻ tín dụng: nhãn
          nhỏ rồi tới chip có số đếm. Số đếm tính trong phạm vi bộ lọc nhanh
          đang chọn, nên không chip nào hứa một con số mà bấm vào lại ra danh
          sách rỗng — ngân hàng không còn tài khoản nào thì chip tự biến mất.
          Một mình một ngân hàng thì cả hàng biến mất: lọc theo nó không đổi
          được gì.

          `radiogroup` chứ không phải `nav > ul`: đây là những nút chọn một
          trong nhiều, không phải link điều hướng, và một `role="radio"` không
          nằm trong `radiogroup` là ARIA nói dối — trình đọc màn hình đọc ra
          một nhóm không có nhãn và không biết có mấy lựa chọn. */}
      {availableBanks.length > 1 && (
        <RadioGroup
          label={t("bankLabel")}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          {/* `aria-hidden`: chính chữ này đã là `aria-label` của nhóm, để lộ ra
              thì trình đọc màn hình đọc "Ngân hàng" hai lần liên tiếp. */}
          <span
            aria-hidden="true"
            className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t("bankLabel")}
          </span>
          <FilterChip
            active={activeBank === "all"}
            count={inFilter.length}
            onClick={() => patch({ bank: "all" })}
          >
            {t("bankAll")}
          </FilterChip>
          {availableBanks.map((b) => (
            <FilterChip
              key={b.id}
              active={activeBank === b.id}
              count={b.count}
              onClick={() => patch({ bank: b.id })}
            >
              {b.name}
            </FilterChip>
          ))}
        </RadioGroup>
      )}

      <div className="mt-4">
        <Field
          label={t("sortLabel")}
          value={sort}
          onChange={(value) => patch({ sort: value as SortId })}
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
          /* Có chữ nhưng trước đây không có đường thoát. Nút xoá bộ lọc chứ
             không phải link: đây là công cụ lọc tại chỗ, một link `/bank-accounts`
             sẽ vứt luôn cả `sort` người dùng đang chọn lẫn `utm_*` trên URL. */
          <li className="rounded-2xl border border-border bg-card p-8 text-center xl:col-span-2">
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
            <button
              type="button"
              onClick={() => update({ bank: "all", filter: "all" })}
              className="mt-3 cursor-pointer text-sm font-semibold text-primary hover:underline"
            >
              {t("emptyCta")}
            </button>
          </li>
        )}
      </ul>

      {/* Ngày đối chiếu số liệu. PRODUCT.md hứa "dữ liệu có ghi ngày kiểm
          tra" và trang Award chart đã làm đúng vậy; ở đây hằng số vẫn được
          cập nhật mỗi lần rà lại nhưng chưa bao giờ hiện ra, nên lời hứa chỉ
          nằm trong code. Đặt ngay dưới danh sách, cùng chỗ trang Award chart
          đặt nó. */}
      <p className="mt-4 text-xs text-muted-foreground">
        {t("verifiedOn", { date: formatIsoDate(BANK_ACCOUNTS_VERIFIED_ON) })}
      </p>

      {/* Lời dặn đọc kỹ đứng trước: nó là điều người đọc cần làm tiếp. Đoạn
          disclosure affiliate là nghĩa vụ công bố, đứng sau cùng như ở footer
          và ở trang thẻ tín dụng. */}
      <div className="mt-6 flex gap-3 rounded-xl border border-border bg-secondary p-4">
        <Info size={20} weight="fill" className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">{t("disclaimerHeading")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("disclaimer")}</p>
        </div>
      </div>

      <OfferDisclosure className="mt-4" />
    </div>
  );
}

function Finder() {
  const searchParams = useSearchParams();

  // URL là nguồn sự thật duy nhất, không phải bản sao của state — cùng lý do
  // đã ghi trong Award Flight Finder: trang được prerender nên seed state từ
  // search params sẽ đóng băng giá trị mặc định và làm hỏng link chia sẻ.
  const selection = readParams(searchParams);

  /**
   * Ghi ba tham số của bộ lọc lên URL hiện có thay vì dựng lại query từ đầu:
   * `new URLSearchParams(selection)` xoá sạch mọi thứ khác, nên chỉ cần bấm một
   * cái chip là `utm_source` của chiến dịch dẫn người đọc tới đây biến mất khỏi
   * thanh địa chỉ — và biến mất khỏi link họ copy đi.
   */
  function queryFor(next: Selection): string {
    const params = new URLSearchParams(searchParams);
    params.set("bank", next.bank);
    params.set("filter", next.filter);
    params.set("sort", next.sort);
    return params.toString();
  }

  function update(patch: Partial<Selection>) {
    window.history.replaceState(null, "", `?${queryFor({ ...selection, ...patch })}`);
  }

  // Mở một link trỏ tới tổ hợp không còn tồn tại — `?bank=scotiabank&
  // filter=newcomer`, mà Scotiabank® không có tài khoản newcomer nào — thì danh
  // sách hiện đúng (đã chuẩn hoá) nhưng thanh địa chỉ vẫn nói khác. Ai copy link
  // đó gửi đi là truyền tiếp một tham số nói dối. Áp dụng cho cả tham số rác
  // (`?filter=rac`), vì `readParams` đã âm thầm bỏ qua nó rồi.
  //
  // Chỉ sửa tham số ĐANG CÓ MẶT mà sai: URL sạch không query thì để yên, không
  // ai muốn vào trang xong tự dưng thấy `?bank=all&filter=all&sort=bonus` mọc ra.
  // `replaceState` nên không thêm mục nào vào lịch sử back.
  const canonical = normalize(selection);
  const canonicalQuery = queryFor(canonical);
  const needsRewrite = (["bank", "filter", "sort"] as const).some((key) => {
    // `getAll` chứ không phải `get`: `?bank=bmo&bank=rác` thì `get` chỉ thấy
    // giá trị đầu và tưởng URL đã sạch, trong khi cái thứ hai vẫn nằm đó.
    const values = searchParams.getAll(key);
    if (values.length === 0) return false;
    return values.length > 1 || values[0] !== canonical[key];
  });

  useEffect(() => {
    if (needsRewrite) window.history.replaceState(null, "", `?${canonicalQuery}`);
  }, [needsRewrite, canonicalQuery]);

  return <FinderView selection={selection} update={update} />;
}

export function BankAccountFinder() {
  // useSearchParams đẩy `Finder` sang client, nên phần trong Suspense không
  // nằm trong HTML dựng sẵn. Trước đây fallback là một ô xám, nghĩa là HTML
  // của /bank-accounts không có lấy một tài khoản nào: người đọc thấy ô xám
  // chớp một cái, còn crawler nào không chạy JavaScript thì thấy một trang so
  // sánh rỗng — trong khi 29 trang con lại đầy đủ.
  //
  // Fallback bây giờ là chính danh sách đó ở trạng thái mặc định, dựng sẵn ở
  // server. Ai vào bằng link có sẵn bộ lọc thì sau khi hydrate danh sách đổi
  // lại cho đúng tham số; ai vào thẳng — gần như tất cả — thấy đúng cái sẽ
  // hiện ra, ngay lập tức. Nút bấm chưa chạy trước lúc hydrate, nhưng trước
  // đây cũng vậy.
  return (
    <Suspense fallback={<FinderView selection={DEFAULT_SELECTION} update={() => {}} />}>
      <Finder />
    </Suspense>
  );
}
