// Tài khoản ngân hàng Canada — bản demo hiện chỉ gồm Scotiabank®.
//
// BMO® đã có đủ dữ liệu và logo (`public/images/logos/banks/bmo.svg` vẫn nằm
// đó) nhưng tạm gỡ khỏi danh sách theo yêu cầu, sẽ bổ sung lại sau. Xem lịch
// sử git nếu cần lấy lại 9 tài khoản BMO® đã viết.
//
// Nguồn số liệu, kiểm tra ngày 2026-08-16:
//  - Phí tháng, lãi suất và danh sách quyền lợi: bảng tổng hợp
//    princeoftravel.com/bank-accounts (đọc trực tiếp ngày 16/08/2026).
//  - Điều kiện welcome bonus đối chiếu lại với công bố của chính ngân hàng:
//    Cash Bonus Bundle $700 chạy từ 03/07/2026 đến 29/10/2026, direct deposit
//    trong 60 ngày và duy trì 6 tháng liên tiếp (scotiabank.com, trang "New
//    bank account offers and promotions"). Miễn phí tháng năm đầu cho người
//    mới định cư theo Scotiabank StartRight®.
//
// Lãi suất khuyến mãi của tài khoản tiết kiệm thay đổi liên tục và các nguồn
// tổng hợp thường lệch nhau. Vì vậy mỗi mức lãi khuyến mãi đều đi kèm
// `promoNoteVi` nói rõ điều kiện, và trang luôn hiện ngày kiểm tra — đúng
// nguyên tắc "trung thực hơn là đầy đủ": chỗ nào ngân hàng không công bố thì
// để trống và nói thẳng, không đoán.
export type BankId = "scotiabank";

export type AccountKind = "chequing" | "savings";

/** Nhóm người dùng mà tài khoản nhắm tới — dùng cho bộ lọc nhanh. */
export type AccountTag = "newcomer" | "student";

export type Bank = {
  id: BankId;
  /** Tên đầy đủ, có ® như quy ước nội dung của trang. */
  name: string;
  /** File logo trong `public/images/logos/banks`. */
  logo: string;
};

// Logo lấy từ Wikimedia Commons (BMO_Logo.svg, Scotiabank_logo.svg), dùng để
// nhận diện ngân hàng trong bài so sánh — cùng cách trang đang dùng logo hãng
// bay và khách sạn ở Transfer Partners.
export const BANKS: Bank[] = [
  { id: "scotiabank", name: "Scotiabank®", logo: "/images/logos/banks/scotiabank.svg" },
];

export function bankById(id: BankId): Bank {
  return BANKS.find((bank) => bank.id === id)!;
}

export type BankAccount = {
  slug: string;
  bank: BankId;
  name: string;
  kind: AccountKind;
  tags: AccountTag[];
  /** Phí tháng theo CAD. 0 nghĩa là không phí. */
  monthlyFee: number;
  /** Cách được miễn phí tháng, nếu có. */
  feeWaiverVi?: string;
  /**
   * Giá trị welcome bonus quy ra tiền, chỉ dùng để sắp xếp. Bonus không phải
   * tiền mặt (iPad, Tech Reward) vẫn có số để so sánh, nhưng nhãn hiển thị
   * mới là thứ người đọc thấy.
   */
  bonusValue?: number;
  bonusLabelVi?: string;
  /** Việc phải làm để nhận bonus — mở trong phần "Điều kiện nhận bonus". */
  bonusConditionsVi?: string[];
  /** ISO date. Ngày offer đóng theo công bố của ngân hàng. */
  bonusExpiresOn?: string;
  /** Lãi suất cao nhất đang chạy, %/năm. Bỏ trống nếu ngân hàng không công bố. */
  interestRate?: number;
  /** Lãi suất sau khi hết khuyến mãi, %/năm. */
  regularRate?: number;
  /** Điều kiện để hưởng mức lãi ở trên. */
  promoNoteVi?: string;
  /** Lý do không có con số, khi ngân hàng không công bố mức lãi cố định. */
  noRateNoteVi?: string;
  keyBenefitsVi: string[];
  /** Trang chính thức của ngân hàng. Không phải liên kết affiliate. */
  url: string;
};

export const BANK_ACCOUNTS: BankAccount[] = [
  // --------------------------------------------------------- Scotiabank
  {
    slug: "scotiabank-preferred-package",
    bank: "scotiabank",
    name: "Scotiabank® Preferred Package",
    kind: "chequing",
    tags: [],
    monthlyFee: 16.95,
    feeWaiverVi:
      "Miễn phí tháng nếu giữ số dư tối thiểu $4,000. Người mới định cư theo Scotiabank StartRight® được miễn phí tháng trong năm đầu.",
    bonusValue: 700,
    bonusLabelVi: "Tối đa $700",
    bonusExpiresOn: "2026-10-29",
    bonusConditionsVi: [
      "Mở tài khoản mới trong khoảng 03/07/2026 – 29/10/2026.",
      "Set up direct deposit trong 60 ngày đầu và duy trì ít nhất 6 tháng liên tiếp.",
      "Thêm một trong ba việc sau trong 60 ngày đầu: pre-authorized payment từ $50 duy trì 6 tháng, thanh toán hoá đơn từ $50, hoặc một giao dịch Visa Debit.",
    ],
    keyBenefitsVi: [
      "Giao dịch debit không giới hạn",
      "Tích điểm Scene+® ngay khi quẹt thẻ debit",
      "Rebate tới $150 phí thường niên thẻ tín dụng Scotiabank® năm đầu",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/preferred.html",
  },
  {
    slug: "scotiabank-ultimate-package",
    bank: "scotiabank",
    name: "Scotiabank® Ultimate Package",
    kind: "chequing",
    tags: [],
    monthlyFee: 30.95,
    feeWaiverVi: "Miễn phí tháng nếu giữ số dư tối thiểu $6,000.",
    bonusValue: 700,
    bonusLabelVi: "Tối đa $700",
    bonusExpiresOn: "2026-10-29",
    bonusConditionsVi: [
      "Mở tài khoản mới trong khoảng 03/07/2026 – 29/10/2026.",
      "Set up direct deposit trong 60 ngày đầu và duy trì ít nhất 6 tháng liên tiếp.",
      "Thêm một trong ba việc: pre-authorized payment từ $50 duy trì 6 tháng, thanh toán hoá đơn từ $50, hoặc một giao dịch Visa Debit.",
    ],
    keyBenefitsVi: [
      "Giao dịch debit và Interac e-Transfer® không giới hạn",
      "Rebate tới $150 phí thường niên thẻ tín dụng mỗi năm, không chỉ năm đầu",
      "Miễn phí sổ séc và bank draft không giới hạn",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/ultimate-package.html",
  },
  {
    slug: "scotiabank-basic-plus",
    bank: "scotiabank",
    name: "Scotiabank® Basic Plus Bank Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 11.95,
    feeWaiverVi: "Miễn phí tháng nếu giữ số dư tối thiểu $4,000.",
    keyBenefitsVi: [
      "25 giao dịch debit miễn phí mỗi tháng, sau đó $1.25 mỗi giao dịch",
      "Interac e-Transfer® miễn phí",
      "Giảm tới 3 cent mỗi lít xăng tại Shell",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/basic-plus.html",
  },
  {
    slug: "scotiabank-preferred-students",
    bank: "scotiabank",
    name: "Scotiabank® Preferred Package for Students & Youth",
    kind: "chequing",
    tags: ["student"],
    monthlyFee: 0,
    bonusValue: 175,
    bonusLabelVi: "$175",
    keyBenefitsVi: [
      "Giao dịch debit và Interac e-Transfer® không giới hạn",
      "Tích điểm Scene+® khi quẹt thẻ debit",
      "Rebate tới $150 phí thường niên thẻ tín dụng năm đầu",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/student-banking.html",
  },
  {
    slug: "scotiabank-momentumplus-savings",
    bank: "scotiabank",
    name: "Scotiabank® MomentumPLUS Savings Account",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    interestRate: 4.05,
    regularRate: 0.4,
    promoNoteVi:
      "Mức cao nhất gồm lãi thưởng của “premium period” — phải để tiền yên trong kỳ đã chọn, rút ra là mất phần thưởng. Cộng thêm 0.10% nếu có Ultimate Package, 0.05% với Preferred Package.",
    keyBenefitsVi: [
      "Chia được nhiều mục tiêu tiết kiệm trong cùng một tài khoản",
      "Không phí tháng, không yêu cầu số dư tối thiểu",
      "Lãi tính theo ngày, trả hàng tháng",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/savings-accounts/momentum-plus-savings-account.html",
  },
  {
    slug: "scotiabank-money-master",
    bank: "scotiabank",
    name: "Scotiabank® Money Master Savings Account",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    interestRate: 0.5,
    regularRate: 0.01,
    promoNoteVi:
      "Chỉ đạt mức này khi bật Smart Savings Tool và giữ được điều kiện tiết kiệm tự động.",
    keyBenefitsVi: [
      "Không phí tháng, mở tài khoản chỉ với $1",
      "Chuyển tiền miễn phí giữa các tài khoản Scotiabank®",
      "Lãi tính theo ngày",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/savings-accounts/money-master-savings-account.html",
  },
  {
    slug: "scotiabank-savings-accelerator",
    bank: "scotiabank",
    name: "Scotiabank® Savings Accelerator Account",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    interestRate: 0.1,
    keyBenefitsVi: [
      "Không phí tháng, không yêu cầu số dư tối thiểu",
      "Chuyển tiền miễn phí không giới hạn sang tài khoản Scotiabank® khác",
      "Mở được trong cả tài khoản đăng ký thuế (TFSA, RRSP) lẫn tài khoản thường",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/savings-accounts/savings-accelerator-account.html",
  },
];

/** Ngày đối chiếu toàn bộ số liệu ở trên với nguồn. */
export const BANK_ACCOUNTS_VERIFIED_ON = "2026-08-16";

export function bankAccountBySlug(slug: string): BankAccount | undefined {
  return BANK_ACCOUNTS.find((account) => account.slug === slug);
}

/** Đường dẫn trang riêng của một tài khoản. */
export function bankAccountPath(slug: string): string {
  return `/bank-accounts/${slug}`;
}

/**
 * Bộ lọc nhanh — mỗi cái là một câu hỏi người đọc thật sự hỏi, và **chỉ một
 * cái đúng tại một thời điểm**.
 *
 * Trước đây đây là hai danh sách: loại tài khoản (chi tiêu/tiết kiệm) và đặc
 * điểm (không phí tháng, có bonus, người mới định cư, sinh viên). Về dữ liệu
 * thì chúng độc lập nên chọn cùng lúc được, nhưng cả hai đều vẽ ra thành một
 * hàng pill giống hệt nhau — nên "Tất cả" và "Người mới định cư" sáng cùng
 * lúc, và một hàng nút chỉ có thể có một cái được chọn thì mới đọc được. Gộp
 * lại thành một danh sách khiến quy tắc đó thành thật ở tầng dữ liệu, chứ
 * không phải chỉ là quy ước bề mặt.
 *
 * `id` cố tình trùng với `AccountKind` và `AccountTag` để `matchesFilter` bên
 * dưới so thẳng, không cần bảng ánh xạ.
 */
export const ACCOUNT_FILTERS = [
  { id: "all", labelKey: "kindAll" },
  { id: "chequing", labelKey: "kindChequing" },
  { id: "savings", labelKey: "kindSavings" },
  { id: "no-fee", labelKey: "featureNoFee" },
  { id: "bonus", labelKey: "featureBonus" },
  { id: "newcomer", labelKey: "featureNewcomer" },
  { id: "student", labelKey: "featureStudent" },
] as const;

export type FilterId = (typeof ACCOUNT_FILTERS)[number]["id"];

export const SORT_OPTIONS = [
  { id: "bonus", labelKey: "sortBonus" },
  { id: "interest", labelKey: "sortInterest" },
  { id: "fee", labelKey: "sortFee" },
  { id: "az", labelKey: "sortAz" },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

export function matchesFilter(account: BankAccount, filter: FilterId): boolean {
  switch (filter) {
    case "all":
      return true;
    case "chequing":
    case "savings":
      return account.kind === filter;
    case "no-fee":
      return account.monthlyFee === 0;
    case "bonus":
      return account.bonusLabelVi !== undefined;
    case "newcomer":
    case "student":
      return account.tags.includes(filter);
  }
}

/**
 * Bộ lọc còn ý nghĩa với dữ liệu đang có. Khi danh sách chỉ còn Scotiabank®
 * thì không tài khoản nào mang nhãn "người mới định cư" nữa, và một chip bấm
 * vào ra danh sách rỗng là một lời hứa suông. Tính từ dữ liệu chứ không xoá
 * tay, để chip tự quay lại đúng lúc dữ liệu quay lại.
 */
export const AVAILABLE_FILTERS = ACCOUNT_FILTERS.filter(
  (filter) => filter.id === "all" || BANK_ACCOUNTS.some((a) => matchesFilter(a, filter.id)),
);

/**
 * Sắp xếp. Tài khoản không có số ở tiêu chí đang chọn (không bonus khi sắp
 * theo bonus, không công bố lãi khi sắp theo lãi) bị đẩy xuống cuối thay vì
 * coi như bằng 0 — nếu không, "không công bố" sẽ nằm lẫn với "0%", hai chuyện
 * khác hẳn nhau.
 */
export function sortAccounts(accounts: BankAccount[], sort: SortId): BankAccount[] {
  const byName = (a: BankAccount, b: BankAccount) => a.name.localeCompare(b.name, "vi");

  return [...accounts].sort((a, b) => {
    switch (sort) {
      case "bonus": {
        const diff = (b.bonusValue ?? -1) - (a.bonusValue ?? -1);
        return diff !== 0 ? diff : byName(a, b);
      }
      case "interest": {
        const diff = (b.interestRate ?? -1) - (a.interestRate ?? -1);
        return diff !== 0 ? diff : byName(a, b);
      }
      case "fee": {
        const diff = a.monthlyFee - b.monthlyFee;
        return diff !== 0 ? diff : byName(a, b);
      }
      case "az":
        return byName(a, b);
    }
  });
}

/** "$17.95" / "$4" — bỏ phần thập phân khi nó bằng 0, giữ 2 chữ số khi có. */
export function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/**
 * "4.65%" / "0.50%" — luôn hai chữ số thập phân. Lãi suất viết là 0.5% đọc
 * như một con số làm tròn vội, trong khi 0.50% là cách chính ngân hàng công
 * bố, và nó xếp thẳng cột với 4.65% ngay bên cạnh.
 */
export function formatRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

/**
 * "2026-11-02" -> "02/11/2026". Cắt chuỗi chứ không đi qua `new Date()`:
 * ngày trần không có múi giờ được hiểu là UTC, nên ở Canada nó lùi lại một
 * ngày và offer hết hạn 02/11 sẽ hiện thành 01/11. Đây đúng là cái bẫy mà
 * `format-date.ts` đã ghi lại.
 */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
