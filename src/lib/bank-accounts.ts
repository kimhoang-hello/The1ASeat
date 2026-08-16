// Tài khoản ngân hàng Canada — Scotiabank® và BMO®.
//
// BMO® từng có 9 tài khoản, bị gỡ hết ngày 16/08/2026, rồi thêm lại 4 tài
// khoản cùng ngày — đúng 4 cái tác giả có link affiliate. Số liệu viết lại từ
// đầu theo trang FinlyWealth chứ không chép lại bản cũ: bản cũ lấy số từ trang
// BMO® và đã lệch vài chỗ so với trang mà nút "Apply ngay" thật sự dẫn tới.
//
// NGUỒN: trang sản phẩm của FinlyWealth cho từng tài khoản (chính là đích của
// `affiliateUrl` bên dưới), đọc trực tiếp ngày 2026-08-16. FinlyWealth đăng
// bảng "Fees & limits" và "Interest Rates" lấy thẳng từ ngân hàng, nên số ở
// đây khớp với số người đọc sẽ thấy khi bấm nút.
//
// Bản đầu của file này lấy số từ một trang tổng hợp khác và sai ở bốn chỗ,
// đối chiếu lại mới phát hiện — giữ lại đây làm lời nhắc rằng bảng tổng hợp
// của bên thứ ba không thay được trang gốc:
//   · welcome bonus Preferred/Ultimate ghi $700, thật ra tới $1,000
//     ($700 mở tài khoản + tối đa $300 khi bundle savings/thẻ tín dụng)
//   · welcome bonus tài khoản sinh viên ghi $175, thật ra tới $200
//   · MomentumPLUS ghi 4.05%, thật ra cao nhất 0.95% và chỉ khi có Ultimate
//     Package kèm premium period 360 ngày — chênh hơn bốn lần
//   · Money Master ghi 0.50%, thật ra 0.40%
//
// Lãi suất và welcome bonus ở Canada thay đổi liên tục. Chỗ nào ngân hàng
// không công bố thì để trống và nói thẳng, không đoán.
export type BankId = "scotiabank" | "bmo";

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
  { id: "bmo", name: "BMO®", logo: "/images/logos/banks/bmo.svg" },
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
  /** Monthly fee theo CAD. 0 nghĩa là không mất phí. */
  monthlyFee: number;
  /** Cách được miễn monthly fee, nếu có. */
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
  /** Trang chính thức của ngân hàng — để người đọc tự đối chiếu số liệu. */
  url: string;
  /**
   * Link affiliate FinlyWealth. Có thì nút "Apply ngay" đi qua đây và mang
   * `rel="sponsored"`; không có thì nút trỏ thẳng `url` với `rel` thường.
   */
  affiliateUrl?: string;
  /**
   * Tiền rebate FinlyWealth trả thêm, đọc từ <title> của trang đích — cùng
   * chỗ và cùng cách mà job check-rebates đang đọc cho thẻ tín dụng. Chỉ link
   * `/rebates/...` mới có; link `/banking/...` là trang giới thiệu, không có
   * rebate.
   */
  rebate?: string;
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
      "Miễn monthly fee nếu giữ số dư tối thiểu $4,000. Người mới định cư theo Scotiabank StartRight® được miễn monthly fee trong năm đầu.",
    bonusValue: 1000,
    bonusLabelVi: "Tối đa $1,000",
    bonusExpiresOn: "2026-10-29",
    bonusConditionsVi: [
      "Mở tài khoản mới trong khoảng 03/07/2026 – 29/10/2026.",
      "$700 khi mở Preferred Package hoặc Ultimate Package mới và hoàn thành các giao dịch yêu cầu.",
      "Tối đa $300 nữa khi mở kèm Money Master Savings Account mới và/hoặc thẻ tín dụng Scotiabank® đủ điều kiện — chỉ tính khi bạn đã đạt phần $700.",
    ],
    keyBenefitsVi: [
      "Giao dịch debit không giới hạn",
      "Tích điểm Scene+® ngay khi quẹt thẻ debit",
      "Rebate tới $150 phí thường niên thẻ tín dụng Scotiabank® năm đầu",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/preferred.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fscotiabank-preferred-package-chequing-account&utm_source=ghe-1a",
    rebate: "$100",
  },
  {
    slug: "scotiabank-ultimate-package",
    bank: "scotiabank",
    name: "Scotiabank® Ultimate Package",
    kind: "chequing",
    tags: [],
    monthlyFee: 30.95,
    feeWaiverVi: "Miễn monthly fee nếu giữ số dư tối thiểu $6,000.",
    bonusValue: 1000,
    bonusLabelVi: "Tối đa $1,000",
    bonusExpiresOn: "2026-10-29",
    bonusConditionsVi: [
      "Mở tài khoản mới trong khoảng 03/07/2026 – 29/10/2026.",
      "$700 khi mở Preferred Package hoặc Ultimate Package mới và hoàn thành các giao dịch yêu cầu.",
      "Tối đa $300 nữa khi mở kèm Money Master Savings Account mới và/hoặc thẻ tín dụng Scotiabank® đủ điều kiện — chỉ tính khi bạn đã đạt phần $700.",
    ],
    keyBenefitsVi: [
      "Giao dịch debit và Interac e-Transfer® không giới hạn",
      "Rebate tới $150 phí thường niên thẻ tín dụng mỗi năm, không chỉ năm đầu",
      "Miễn phí sổ séc và bank draft không giới hạn",
      "Giao dịch miễn phí ở Scotia iTRADE®",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/ultimate-package.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fscotiabank-ultimate-package-chequing&utm_source=ghe-1a",
    rebate: "$100",
  },
  {
    slug: "scotiabank-basic-plus",
    bank: "scotiabank",
    name: "Scotiabank® Basic Plus Bank Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 11.95,
    feeWaiverVi: "Miễn monthly fee nếu giữ số dư tối thiểu $4,000.",
    keyBenefitsVi: [
      "25 giao dịch debit miễn phí mỗi tháng, sau đó $1.25 mỗi giao dịch",
      "Interac e-Transfer® miễn phí không giới hạn",
      "Chuyển tiền quốc tế $1.99 qua Scotia® International Money Transfer",
      "Giảm 3 cent mỗi lít xăng tại Shell",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/basic-plus.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fchequing-accounts%2Fscotiabank-basic-plus-bank-account&utm_source=ghe-1a",
  },
  {
    slug: "scotiabank-preferred-students",
    bank: "scotiabank",
    name: "Scotiabank® Preferred Package for Students & Youth",
    kind: "chequing",
    tags: ["student"],
    monthlyFee: 0,
    bonusValue: 200,
    bonusLabelVi: "Tối đa $200",
    bonusExpiresOn: "2026-11-01",
    bonusConditionsVi: [
      "Mở Preferred Package for Students and Youth mới trong khoảng 02/07/2026 – 01/11/2026.",
      "Làm hai trong ba việc sau trong 60 ngày đầu: set up direct deposit định kỳ duy trì ít nhất 3 tháng liên tiếp; set up pre-authorized transaction định kỳ duy trì ít nhất 3 tháng; hoặc thực hiện 5 giao dịch Visa Debit online bằng ScotiaCard®.",
    ],
    keyBenefitsVi: [
      "Giao dịch debit và Interac e-Transfer® không giới hạn",
      "Tích điểm Scene+® khi quẹt thẻ debit",
      "Rebate tới $150 phí thường niên thẻ tín dụng năm đầu",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/student-banking.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fscotiabank-preferred-package-student&utm_source=ghe-1a",
    rebate: "$50",
  },
  {
    slug: "scotiabank-momentumplus-savings",
    bank: "scotiabank",
    name: "Scotiabank® MomentumPLUS Savings Account",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    interestRate: 0.95,
    regularRate: 0.4,
    promoNoteVi:
      "Đây là mức cao nhất và rất khó chạm: phải vừa có Ultimate Package, vừa chọn premium period 360 ngày và để tiền yên suốt kỳ đó. Không kèm gì thì chỉ 0.40%.",
    keyBenefitsVi: [
      "Chia được nhiều mục tiêu tiết kiệm trong cùng một tài khoản",
      "Không mất monthly fee, không yêu cầu số dư tối thiểu",
      "Lãi tính theo ngày, trả hàng tháng",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/savings-accounts/momentum-plus-savings-account.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fsavings-accounts%2Fscotiabank-momentum-plus-savings-account&utm_source=ghe-1a",
  },
  {
    slug: "scotiabank-money-master",
    bank: "scotiabank",
    name: "Scotiabank® Money Master Savings Account",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    interestRate: 0.4,
    regularRate: 0.01,
    promoNoteVi:
      "Chỉ đạt 0.40% khi đăng ký Smart Savings tools của Scotiabank®; không đăng ký thì mọi số dư chỉ được 0.01%.",
    keyBenefitsVi: [
      "Không mất monthly fee, mở tài khoản chỉ với $1",
      "Chuyển tiền miễn phí giữa các tài khoản Scotiabank®",
      "Lãi tính theo ngày",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/savings-accounts/money-master-savings-account.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fscotiabank-money-master-savings-account&utm_source=ghe-1a",
    rebate: "$50",
  },

  // --------------------------------------------------------------- BMO
  // Cả ba tài khoản chequing thường ăn chung một offer $900 của BMO®: $700 cho
  // chequing, $150 cho Savings Amplifier và $50 cho My Financial Progress —
  // hai phần sau chỉ mở ra sau khi xong phần $700. Điều kiện viết theo đúng ba
  // bước đó thay vì gộp thành một dòng "tối đa $900", vì gộp lại thì con số
  // trông như tiền cho không.
  {
    slug: "bmo-newstart-performance",
    bank: "bmo",
    name: "BMO NewStart® program — Performance Account",
    kind: "chequing",
    tags: ["newcomer"],
    monthlyFee: 17.95,
    feeWaiverVi:
      "Người mới định cư theo BMO NewStart® được miễn monthly fee trong 2 năm; ngoài ra giữ số dư tối thiểu $4,000 cũng được miễn.",
    bonusValue: 900,
    bonusLabelVi: "Tối đa $900",
    bonusExpiresOn: "2026-11-02",
    bonusConditionsVi: [
      "Là thường trú nhân hoặc người có work permit đến Canada trong vòng 5 năm trở lại (BMO® yêu cầu PR Card, Confirmation of Permanent Residency hoặc IMM 1442).",
      "Mở và nạp tiền tài khoản mới trước 02/11/2026.",
      "Set up direct deposit từ $500/tháng (lương, chính phủ hoặc lương hưu), khoản đầu tiên về trước 31/12/2026.",
      "Thanh toán 2 hoá đơn online từ $50 cho 2 nhà cung cấp khác nhau, hoặc set up 2 pre-authorized debit từ $50, trước 31/12/2026.",
    ],
    keyBenefitsVi: [
      "Không cần credit history ở Canada để mở tài khoản",
      "Giao dịch và Interac e-Transfer® không giới hạn",
      "Kèm membership Walmart+ tới 12 tháng khi mở trước 02/11/2026",
    ],
    url: "https://www.bmo.com/en-ca/main/personal/newcomers-to-canada/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fbmo-newstart-performance&utm_source=ghe-1a",
    rebate: "$100",
  },
  {
    slug: "bmo-premium-chequing",
    bank: "bmo",
    name: "BMO® Premium Chequing Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 30.95,
    feeWaiverVi: "Miễn monthly fee nếu giữ số dư tối thiểu $6,000 trong tháng.",
    bonusValue: 900,
    bonusLabelVi: "Tối đa $900",
    bonusExpiresOn: "2026-11-02",
    bonusConditionsVi: [
      "$700: mở và nạp tiền tài khoản Performance hoặc Premium mới trước 02/11/2026, set up direct deposit từ $500/tháng, và thanh toán 2 hoá đơn online từ $50 cho 2 nhà cung cấp khác nhau (hoặc 2 pre-authorized debit từ $50) — tất cả trước 31/12/2026.",
      "$150 nữa: mở Savings Amplifier Account trước 02/11/2026, nạp từ $10,000 trong 30 ngày đầu và giữ mức đó thêm 120 + 90 ngày.",
      "$50 nữa: tạo 1 Goal và áp dụng 1 Strategy trong My Financial Progress trước 31/12/2026.",
      "Đã có tài khoản chequing BMO® trong khoảng 07/08/2025 – 02/11/2026 thì không đủ điều kiện; đóng tài khoản trước 02/11/2027 cũng mất bonus.",
    ],
    keyBenefitsVi: [
      "Giao dịch và Interac e-Transfer® không giới hạn",
      "Rút ATM ngoài mạng BMO® tại Canada không mất phí",
      "Rebate phí thường niên thẻ tín dụng BMO® và tỷ giá USD ưu đãi",
    ],
    url: "https://www.bmo.com/en-ca/main/personal/bank-accounts/chequing-accounts/premium-plan/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fbmo-premium-chequing-account&utm_source=ghe-1a",
    rebate: "$75",
  },
  {
    slug: "bmo-performance-chequing",
    bank: "bmo",
    name: "BMO® Performance Chequing Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 17.95,
    feeWaiverVi: "Miễn monthly fee nếu giữ số dư tối thiểu $4,000 trong tháng.",
    bonusValue: 900,
    bonusLabelVi: "Tối đa $900",
    bonusExpiresOn: "2026-11-02",
    bonusConditionsVi: [
      "$700: mở và nạp tiền tài khoản Performance hoặc Premium mới trước 02/11/2026, set up direct deposit từ $500/tháng, và thanh toán 2 hoá đơn online từ $50 cho 2 nhà cung cấp khác nhau (hoặc 2 pre-authorized debit từ $50) — tất cả trước 31/12/2026.",
      "$150 nữa: mở Savings Amplifier Account trước 02/11/2026, nạp từ $10,000 trong 30 ngày đầu và giữ mức đó thêm 120 + 90 ngày.",
      "$50 nữa: tạo 1 Goal và áp dụng 1 Strategy trong My Financial Progress trước 31/12/2026.",
      "Đã có tài khoản chequing BMO® trong khoảng 07/08/2025 – 02/11/2026 thì không đủ điều kiện; đóng tài khoản trước 02/11/2027 cũng mất bonus.",
    ],
    keyBenefitsVi: [
      "Giao dịch debit không giới hạn",
      "Interac e-Transfer® miễn phí, không giới hạn số lần",
      "Kèm membership Walmart+ tới 12 tháng khi mở trước 02/11/2026",
    ],
    url: "https://www.bmo.com/en-ca/main/personal/bank-accounts/chequing-accounts/performance-plan/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fbmo-performance-chequing-account&utm_source=ghe-1a",
    rebate: "$100",
  },
  {
    slug: "bmo-student-chequing",
    bank: "bmo",
    name: "BMO® Student Chequing Account",
    kind: "chequing",
    tags: ["student"],
    monthlyFee: 0,
    // Bonus là voucher Best Buy chứ không phải tiền mặt — bonusValue chỉ để
    // xếp hạng, nhãn mới là thứ người đọc thấy.
    bonusValue: 200,
    bonusLabelVi: "Tối đa $200 Tech Reward",
    bonusExpiresOn: "2026-11-03",
    bonusConditionsVi: [
      "Mở tài khoản Student Chequing mới và đang học tại đại học, cao đẳng hoặc trường nghề.",
      "Hoàn thành các bước BMO® yêu cầu để mở khoá phần thưởng.",
      "Nhận email trong vòng 3 tuần để chọn phần thưởng Best Buy.",
    ],
    keyBenefitsVi: [
      "Không mất monthly fee, không yêu cầu số dư tối thiểu",
      "Giao dịch debit không giới hạn",
      "Interac e-Transfer® miễn phí, không giới hạn số lần",
    ],
    url: "https://www.bmo.com/en-ca/main/personal/bank-accounts/chequing-accounts/student-banking/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fbmo-student-chequing-account&utm_source=ghe-1a",
    rebate: "$100",
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
 * điểm (miễn monthly fee, có bonus, người mới định cư, sinh viên). Về dữ liệu
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
