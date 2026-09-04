// Tài khoản ngân hàng Canada — Scotiabank®, BMO®, Wealthsimple®,
// Neo Financial™, Tangerine®, EQ Bank™, Simplii Financial™, KOHO,
// National Bank® và RBC®.
//
// BMO® từng có 9 tài khoản, bị gỡ hết ngày 16/08/2026, rồi thêm lại 4 tài
// khoản cùng ngày — đúng 4 cái tác giả có link affiliate. Số liệu viết lại từ
// đầu theo trang FinlyWealth chứ không chép lại bản cũ: bản cũ lấy số từ trang
// BMO® và đã lệch vài chỗ so với trang mà nút "Apply ngay" thật sự dẫn tới.
//
// Bốn ngân hàng online thêm vào ngày 18/08/2026, cũng đúng những tài khoản
// tác giả có link affiliate. Chúng đổi hẳn hình dạng của danh sách: trước đó
// mọi tài khoản đều là ngân hàng lớn có chi nhánh, lãi tiết kiệm cao nhất là
// 0.95%; giờ Tangerine® mở đầu bằng 4.50% khuyến mãi và Neo™/EQ Bank™ trả
// 2.75% quanh năm. Nói cách khác, thứ hạng theo lãi suất trên trang danh sách
// từ nay do nhóm này quyết định.
//
// Bốn ngân hàng nữa thêm ngày 19/08/2026 — Simplii Financial™, KOHO,
// National Bank® và RBC® — cũng đúng những tài khoản tác giả có link affiliate.
// Nhóm này kéo danh sách về phía ngược lại với nhóm ngân hàng online: RBC® mang
// vào năm tài khoản chequing của một ngân hàng lớn, trong đó ba cái không có
// welcome bonus nào đang chạy. Đổi lại, Simplii Financial™ mở đầu bảng lãi suất
// bằng 4.60% khuyến mãi, cao hơn cả Tangerine®.
//
// NGUỒN: trang sản phẩm của FinlyWealth cho từng tài khoản (chính là đích của
// `affiliateUrl` bên dưới), đọc trực tiếp ngày 2026-08-16 (Scotiabank®, BMO®),
// 2026-08-18 (Wealthsimple®, Neo Financial™, Tangerine®, EQ Bank™) và
// 2026-08-19 (bốn ngân hàng còn lại). FinlyWealth đăng bảng "Fees & limits"
// và "Interest Rates" lấy thẳng từ ngân hàng, nên số ở đây khớp với số người
// đọc sẽ thấy khi bấm nút.
//
// Một chỗ phải đi ngược quy tắc đó: widget lãi suất của FinlyWealth ghi
// Simplii Financial™ HISA là 4.50%, trong khi tiêu đề của chính trang đó, phần
// điều khoản của Simplii Financial™ in ngay bên dưới, và trang chính thức của
// Simplii Financial™ đều ghi 4.60%. Ba nguồn thắng một widget, nên ở đây là
// 4.60% — nếu sau này thấy lệch nữa thì đọc điều khoản chứ đừng đọc widget.
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
import { formatDate, hasExpired } from "./format-date";

export type BankId =
  | "scotiabank"
  | "bmo"
  | "wealthsimple"
  | "neo"
  | "tangerine"
  | "eq-bank"
  | "simplii"
  | "koho"
  | "national-bank"
  | "rbc";

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

// Logo lấy từ Wikimedia Commons, dùng để nhận diện ngân hàng trong bài so
// sánh — cùng cách trang đang dùng logo hãng bay và khách sạn ở Transfer
// Partners. Của Neo là PNG vì Commons không có bản SVG; đã cắt sát chữ trước
// khi lưu, nếu không thì phần nền trong suốt thừa ra làm wordmark Neo trông
// nhỏ hẳn so với các logo bên cạnh trong cùng một ô `object-contain`.
export const BANKS: Bank[] = [
  { id: "scotiabank", name: "Scotiabank®", logo: "/images/logos/banks/scotiabank.svg" },
  { id: "bmo", name: "BMO®", logo: "/images/logos/banks/bmo.svg" },
  { id: "wealthsimple", name: "Wealthsimple®", logo: "/images/logos/banks/wealthsimple.svg" },
  // Neo tự viết "Neo Financial™" và "Neo Money™" trên trang của họ, EQ Bank ghi
  // "™Trademark of Equitable Bank" ở chân trang — nên hai cái này là ™ chứ
  // không phải ®, đúng theo dấu mà chính chủ dùng.
  //
  // Viết "Neo Financial™" trọn trên một dòng ở mọi chỗ: audit:trademarks học
  // thương hiệu theo từng dòng, nên xuống dòng giữa hai chữ làm nó chỉ thấy
  // chữ sau, học thành một thương hiệu một chữ, rồi báo lỗi ở "My Financial
  // Progress" của BMO®.
  { id: "neo", name: "Neo Financial™", logo: "/images/logos/banks/neo.png" },
  { id: "tangerine", name: "Tangerine®", logo: "/images/logos/banks/tangerine.svg" },
  { id: "eq-bank", name: "EQ Bank™", logo: "/images/logos/banks/eq-bank.svg" },
  { id: "simplii", name: "Simplii Financial™", logo: "/images/logos/banks/simplii.svg" },
  // KOHO là ngân hàng duy nhất ở đây không mang ký hiệu nào. Đọc hết trang chủ,
  // ba trang gói và trang pháp lý của họ thì ® chỉ xuất hiện sau tên của bên
  // khác (Mastercard®, Interac®), chưa một lần nào ngay sau chữ "KOHO". Để
  // trống mới là viết đúng như chính chủ viết, cùng quy tắc đã cho
  // Neo Financial™ và EQ Bank™ dấu ™ chứ không phải ®. Đừng "sửa" thành ® nếu
  // chưa mở lại trang của họ mà xem.
  //
  // National Bank® thì ngược lại: trang của họ cũng viết trần, nhưng thẻ
  // National Bank® World Elite® Mastercard® trên site này đã mang ® từ trước,
  // nên giữ ® để cả trang nói cùng một kiểu — và để audit:trademarks không phải
  // báo lỗi ở một trong hai chỗ.
  { id: "koho", name: "KOHO", logo: "/images/logos/banks/koho.svg" },
  { id: "national-bank", name: "National Bank®", logo: "/images/logos/banks/national-bank.svg" },
  // Dùng lại đúng file logo mà bảng Transfer Partners đang dùng cho RBC® thay
  // vì chép thêm một bản vào `banks/`: cùng một thương hiệu, cùng một mark, hai
  // bản sao chỉ tạo cơ hội để chúng lệch nhau.
  { id: "rbc", name: "RBC®", logo: "/images/logos/rbc.svg" },
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
      "Tích điểm Scene+™ ngay khi quẹt thẻ debit",
      "Rebate tới $150 annual fee thẻ tín dụng Scotiabank® năm đầu",
    ],
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/preferred.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fscotiabank-preferred-package-chequing-account&utm_source=ghe-1a",
    // $100 -> $75 khi đối chiếu lại ngày 19/08/2026. Rebate tài khoản ngân hàng
    // nằm trong file này chứ không phải Contentful, nên job check-rebates theo
    // lịch (chỉ đọc creditCardOffer) không thấy và không sửa hộ — phải tự đối
    // chiếu <title> của trang đích mỗi lần đụng vào danh sách này.
    rebate: "$75",
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
      "Rebate tới $150 annual fee thẻ tín dụng mỗi năm, không chỉ năm đầu",
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
      "Tích điểm Scene+™ khi quẹt thẻ debit",
      "Rebate tới $150 annual fee thẻ tín dụng năm đầu",
    ],
    // Trang cũ (.../chequing-accounts/student-banking.html) đã 404 — Scotiabank®
    // đổi sang đường dẫn dưới đây. Kiểm lại 19/08/2026.
    url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing-accounts/preferred-student-youth-bank-account.html",
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
    // BMO® đã bỏ /en-ca/main/personal/newcomers-to-canada/ (404). Trang tài
    // khoản cho người mới định cư — chỗ nói về chính NewStart® — là link dưới
    // đây. Kiểm lại 20/08/2026.
    url: "https://www.bmo.com/en-ca/main/personal/bank-accounts/newcomers-banking/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fbmo-newstart-performance&utm_source=ghe-1a",
    rebate: "$50",
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
      "Rebate annual fee thẻ tín dụng BMO® và tỷ giá USD ưu đãi",
    ],
    // ".../premium-plan/" đã 404; BMO® rút gọn còn ".../premium/".
    url: "https://www.bmo.com/en-ca/main/personal/bank-accounts/chequing-accounts/premium/",
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
    // ".../performance-plan/" đã 404; BMO® rút gọn còn ".../performance/".
    url: "https://www.bmo.com/en-ca/main/personal/bank-accounts/chequing-accounts/performance/",
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
    // Trang cũ dưới /chequing-accounts/ đã 404; BMO® chuyển sang
    // /bank-accounts/student-banking/.
    url: "https://www.bmo.com/main/personal/bank-accounts/student-banking/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fbmo-student-chequing-account&utm_source=ghe-1a",
    rebate: "$50",
  },

  // ------------------------------------------------------- Wealthsimple
  // Wealthsimple không tách chi tiêu và tiết kiệm: cùng một tài khoản, cùng
  // một mức lãi. FinlyWealth vẫn liệt kê hai trang riêng và cả hai trang đều
  // dẫn về đúng sản phẩm đó, nên ở đây cũng là hai mục — người tìm "tài khoản
  // tiết kiệm" vẫn thấy Wealthsimple — nhưng số liệu buộc phải giống hệt
  // nhau, và chỗ nào cũng nói thẳng rằng đó là một tài khoản.
  {
    slug: "wealthsimple-chequing",
    bank: "wealthsimple",
    name: "Wealthsimple® Chequing",
    kind: "chequing",
    tags: [],
    monthlyFee: 0,
    bonusValue: 25,
    bonusLabelVi: "$25",
    bonusConditionsVi: [
      "Chỉ dành cho khách hàng mới, chưa từng có tài khoản Wealthsimple® nào.",
      "Mở tài khoản Wealthsimple® đầu tiên qua link ở trang này.",
      "Nạp tối thiểu $1 trong vòng 30 ngày.",
    ],
    interestRate: 2.25,
    regularRate: 1.25,
    promoNoteVi:
      "Lãi đi theo hạng khách hàng chứ không theo số dư: Core 1.25%, Premium 1.75%, Generation 2.25%. Core và Premium được cộng thêm 0.50% khi có direct deposit từ $2,000/tháng, nhưng trần vẫn là 2.25%.",
    keyBenefitsVi: [
      "Giao dịch debit, Interac e-Transfer® và thanh toán hoá đơn miễn phí không giới hạn",
      "Không phí ATM và không phí chuyển đổi ngoại tệ, hoàn lại cả phí ATM của bên thứ ba, không giới hạn số lần",
      "Lãi tính trên toàn bộ số dư, kể cả tiền đang chờ tiêu — không phải chuyển qua lại giữa hai tài khoản",
      "Bảo hiểm CDIC tới $1,000,000 cho khoản tiền gửi CAD đủ điều kiện",
    ],
    url: "https://www.wealthsimple.com/en-ca/product/cash",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fchequing-accounts%2Fwealthsimple-chequing&utm_source=ghe-1a",
  },
  {
    slug: "wealthsimple-savings",
    bank: "wealthsimple",
    name: "Wealthsimple® Savings",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    bonusValue: 25,
    bonusLabelVi: "$25",
    bonusConditionsVi: [
      "Chỉ dành cho khách hàng mới, chưa từng có tài khoản Wealthsimple® nào.",
      "Mở tài khoản Wealthsimple® đầu tiên qua link ở trang này.",
      "Nạp tối thiểu $1 trong vòng 30 ngày.",
    ],
    interestRate: 2.25,
    regularRate: 1.25,
    promoNoteVi:
      "Đây chính là tài khoản Wealthsimple® Chequing — Wealthsimple không có tài khoản tiết kiệm riêng, và $25 bonus chỉ tính một lần cho tài khoản đầu tiên. Lãi đi theo hạng khách hàng: Core 1.25%, Premium 1.75%, Generation 2.25%; Core và Premium cộng thêm 0.50% khi có direct deposit từ $2,000/tháng, trần vẫn 2.25%.",
    keyBenefitsVi: [
      "Không monthly fee, không yêu cầu số dư tối thiểu",
      "Rút tiền lúc nào cũng được, không có kỳ hạn báo trước",
      "Mở tới 8 tài khoản cá nhân và 8 tài khoản chung để tách mục tiêu tiết kiệm",
      "Bảo hiểm CDIC tới $1,000,000 cho khoản tiền gửi CAD đủ điều kiện",
    ],
    url: "https://www.wealthsimple.com/en-ca/product/cash",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fsavings-accounts%2Fwealthsimple-savings&utm_source=ghe-1a",
  },

  // ----------------------------------------------------------------- Neo
  {
    slug: "neo-chequing",
    bank: "neo",
    name: "Neo™ Chequing Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 0,
    bonusValue: 100,
    bonusLabelVi: "$100",
    bonusConditionsVi: [
      "Chỉ dành cho khách hàng mới của Neo Financial™, mở sản phẩm Neo™ đầu tiên.",
      "Chi tiêu tối thiểu $1,000 trong 3 tháng đầu bằng thẻ Neo Money™ hoặc bất kỳ thẻ tín dụng Neo™ nào.",
      "Mỗi người một lần, không cộng dồn với mã khuyến mãi khác.",
    ],
    interestRate: 0.1,
    promoNoteVi:
      "0.10% chỉ áp dụng cho phần số dư tới $200,000; phần vượt quá không được tính lãi. Đây là tài khoản chi tiêu — muốn lãi thì để tiền ở Neo™ Savings Account.",
    keyBenefitsVi: [
      "Không monthly fee, không yêu cầu số dư tối thiểu",
      "Giao dịch và Interac e-Transfer® không giới hạn",
      "Cashback theo bậc cho xăng và tạp hoá khi quẹt thẻ Neo Money™",
      "Rút ATM tại Canada $0, kể cả máy ngoài mạng lưới",
    ],
    url: "https://www.neofinancial.com/accounts",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fneo-chequing-account&utm_source=ghe-1a",
    rebate: "$25",
  },
  {
    slug: "neo-savings",
    bank: "neo",
    name: "Neo™ Savings Account",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    interestRate: 2.75,
    // Không đặt `regularRate`: 2.00% không phải mức sau khuyến mãi mà là bậc
    // thấp nhất của cùng một biểu lãi, và nhãn "Lãi thường" sẽ nói ngược lại.
    promoNoteVi:
      "Lãi theo bậc số dư, không phải khuyến mãi có hạn: dưới $5,000 được 2.00%, từ $5,000 được 2.50%, từ $20,000 trở lên được 2.75%. Để nhận rebate của FinlyWealth phải nạp tối thiểu $100.",
    keyBenefitsVi: [
      "Không monthly fee, không yêu cầu số dư tối thiểu",
      "Giao dịch và Interac e-Transfer® không giới hạn",
      "Lãi tăng theo số dư, không cần mã khuyến mãi hay đổi tài khoản",
      "Rút tiền lúc nào cũng được, không có kỳ hạn báo trước",
    ],
    url: "https://www.neofinancial.com/accounts",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fneo-savings-account&utm_source=ghe-1a",
    rebate: "$75",
  },

  // ----------------------------------------------------------- Tangerine
  {
    slug: "tangerine-savings",
    bank: "tangerine",
    name: "Tangerine® Savings Account",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    interestRate: 4.5,
    regularRate: 0.3,
    promoNoteVi:
      "4.50% là lãi khuyến mãi 153 ngày (khoảng 5 tháng) kể từ ngày bạn làm xong các điều kiện, chỉ tính trên phần số dư tới $1,000,000, cộng gộp mọi Eligible Savings Account cùng loại tiền tệ. Dành cho khách hàng mới mở tài khoản tiết kiệm đủ điều kiện trong vòng 60 ngày kể từ khi có Client Number; offer chạy 28/07/2026 – 30/11/2026. Hết kỳ khuyến mãi thì về mức thường 0.30%.",
    keyBenefitsVi: [
      "Không monthly fee, không yêu cầu số dư tối thiểu",
      "Giao dịch và Interac e-Transfer® không giới hạn",
      "Tách được nhiều mục tiêu tiết kiệm và hẹn chuyển tiền tự động",
      "Rút tiền lúc nào cũng được, không có kỳ hạn báo trước",
    ],
    url: "https://www.tangerine.ca/en/personal/save/savings-account",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Ftangerine-savings&utm_source=ghe-1a",
    rebate: "$75",
  },
  {
    slug: "tangerine-no-fee-chequing",
    bank: "tangerine",
    name: "Tangerine® No Fee Daily Chequing Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 0,
    bonusValue: 250,
    bonusLabelVi: "$250",
    bonusExpiresOn: "2026-10-31",
    bonusConditionsVi: [
      "Mở tài khoản No Fee Daily Chequing mới, chỉ dành cho khách hàng mới của Tangerine®.",
      "Chuyển payroll deposit về tài khoản Tangerine® và duy trì 2 tháng liên tiếp.",
      "Offer chạy 01/05/2024 – 31/10/2026.",
    ],
    interestRate: 0.1,
    regularRate: 0.01,
    promoNoteVi:
      "Bậc lãi ở đây đi ngược trực giác: 0.01% cho số dư dưới $50,000, 0.05% từ $50,000, 0.10% từ $100,000 — rồi tụt lại 0.01% từ $500,000 trở lên. Số dư của một tài khoản chi tiêu bình thường rơi vào bậc thấp nhất.",
    keyBenefitsVi: [
      "Không monthly fee, không yêu cầu số dư tối thiểu",
      "Giao dịch và Interac e-Transfer® không giới hạn, có thẻ Visa Debit",
      "Rút ATM trong mạng lưới Scotiabank® và Tangerine® miễn phí; máy khác tại Canada $1.50",
      "Phí chuyển đổi ngoại tệ 2.5%, phí NSF $10 — thấp hơn mức $45–$48 thường thấy ở ngân hàng lớn",
    ],
    url: "https://www.tangerine.ca/en/personal/spend/chequing-account",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Ftangerine-chequing&utm_source=ghe-1a",
    rebate: "$75",
  },

  // ------------------------------------------------------------- EQ Bank
  {
    slug: "eq-bank-personal-account",
    bank: "eq-bank",
    name: "EQ Bank™ Personal Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 0,
    interestRate: 2.75,
    regularRate: 1,
    promoNoteVi:
      "2.75% chỉ khi có direct deposit định kỳ từ $2,000/tháng; không có thì 1.00%. Đây không phải lãi khuyến mãi có hạn — nó giữ nguyên chừng nào direct deposit còn về.",
    keyBenefitsVi: [
      "Không monthly fee, không yêu cầu số dư tối thiểu",
      "Giao dịch, Interac e-Transfer® và thanh toán hoá đơn miễn phí không giới hạn",
      "Kèm thẻ prepaid Mastercard® hoàn 0.5% cashback, không phí chuyển đổi ngoại tệ",
      "Rút ATM tại Canada miễn phí, hoàn lại cả phí của máy bên thứ ba",
    ],
    // Trang sản phẩm đúng của tài khoản này. Link cũ (/eq-bank-account) là
    // trang giới thiệu chung, vẫn sống nhưng không phải trang nói về nó.
    url: "https://www.eqbank.ca/personal-banking/personal-account",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fchequing-accounts%2Feq-bank-personal-account&utm_source=ghe-1a",
  },
  {
    slug: "eq-bank-notice-savings",
    bank: "eq-bank",
    name: "EQ Bank™ Notice Savings Account",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    interestRate: 2.75,
    // Cũng không đặt `regularRate`: 2.35% là loại báo trước 10 ngày, một lựa
    // chọn khác chứ không phải mức tụt xuống sau khi hết khuyến mãi.
    promoNoteVi:
      "Đổi thanh khoản lấy lãi: loại báo trước 30 ngày được 2.75%, loại báo trước 10 ngày được 2.35%. Muốn rút thì phải báo trước đúng số ngày đó, nên đây không phải chỗ để tiền phòng thân cần lấy ngay.",
    keyBenefitsVi: [
      "Không monthly fee, không yêu cầu số dư tối thiểu",
      "Nạp và rút không giới hạn số lần, miễn phí — chỉ cần báo trước",
      "Đủ điều kiện bảo hiểm CDIC tới $100,000 mỗi hạng mục",
    ],
    // EQ Bank™ trả HTTP 200 kèm nội dung "404 Error" cho đường dẫn cũ
    // (/savings/notice-savings-account) — kiểu 404 mềm mà curl không bắt được.
    // Đường dẫn thật không có đoạn /savings/. Kiểm lại 20/08/2026.
    url: "https://www.eqbank.ca/personal-banking/notice-savings-account",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fsavings-accounts%2Feq-bank-notice-savings-account&utm_source=ghe-1a",
  },

  // ---------------------------------------------------- Simplii Financial
  {
    slug: "simplii-high-interest-savings",
    bank: "simplii",
    name: "Simplii Financial™ High Interest Savings Account",
    kind: "savings",
    tags: [],
    monthlyFee: 0,
    interestRate: 4.6,
    regularRate: 0.3,
    promoNoteVi:
      "4.60% là lãi khuyến mãi 153 ngày (khoảng 5 tháng) kể từ ngày mở tài khoản, chỉ tính trên phần số dư tới $200,000. Phải là khách hàng mới hoàn toàn của Simplii Financial™ và mở HISA đầu tiên trong vòng 60 ngày kể từ khi có Client Number; offer chạy 01/08/2026 – 31/10/2026. Hết kỳ khuyến mãi thì về biểu lãi thường theo bậc số dư: 0.30% dưới $50,000, 0.50% từ $50,000, 0.60% từ $100,000, 0.70% từ $500,000 và 1.00% từ $1,000,000.",
    keyBenefitsVi: [
      "Không monthly fee, không yêu cầu số dư tối thiểu",
      "Giao dịch và Interac e-Transfer® không giới hạn",
      "Rút tiền lúc nào cũng được, không có kỳ hạn báo trước",
      "Lãi tính theo ngày, trả hàng tháng",
    ],
    url: "https://www.simplii.com/en/bank-accounts/high-interest-savings.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fsimplii-high-interest-savings&utm_source=ghe-1a",
    rebate: "$30",
  },
  {
    slug: "simplii-no-fee-chequing",
    bank: "simplii",
    name: "Simplii Financial™ No Fee Chequing Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 0,
    // Bonus là $300 tiền mặt cộng một gift card Skip $50 — hai offer riêng của
    // Simplii Financial™, cùng điều kiện direct deposit và cùng ngày kết thúc.
    // `bonusValue` gộp lại chỉ để sắp xếp; nhãn mới là thứ người đọc thấy, và
    // nó nói rõ phần nào là tiền, phần nào là gift card.
    bonusValue: 350,
    bonusLabelVi: "$300 + gift card Skip $50",
    bonusExpiresOn: "2026-09-30",
    bonusConditionsVi: [
      "Chỉ dành cho khách hàng mới, chưa từng đứng tên chính bất kỳ sản phẩm Simplii Financial™ nào trước 18/06/2024.",
      "Mở No Fee Chequing Account mới trước 30/09/2026.",
      "Trong vòng 120 ngày kể từ ngày mở, set up direct deposit định kỳ tổng từ $100/tháng.",
      "Duy trì direct deposit đó đủ 3 tháng liên tiếp trong khung 120 ngày nói trên.",
      "Không áp dụng cho người cư trú tại Quebec.",
    ],
    keyBenefitsVi: [
      "Không monthly fee, không yêu cầu số dư tối thiểu",
      "Giao dịch và Interac e-Transfer® không giới hạn, có thẻ Debit Mastercard®",
      "Rút ATM trong mạng lưới miễn phí; máy khác tại Canada $1.50",
      "Phí chuyển đổi ngoại tệ 2.5%, phí NSF $10 — thấp hơn mức $45–$48 thường thấy ở ngân hàng lớn",
    ],
    url: "https://www.simplii.com/en/special-offers/no-fee-chequing-account.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fsimplii-chequing&utm_source=ghe-1a",
    rebate: "$50",
  },

  // ---------------------------------------------------------------- KOHO
  // KOHO bán ba gói của cùng một tài khoản chứ không phải ba tài khoản khác
  // nhau: trả phí tháng cao hơn thì được lãi cao hơn và cashback cao hơn, còn
  // phần chi tiêu thì gói nào cũng như nhau. Vì vậy ba mục dưới đây chỉ khác
  // nhau ở monthly fee, lãi suất và mức cashback — cố tình để giống nhau ở
  // những dòng còn lại, để đặt cạnh nhau là thấy ngay mình trả thêm tiền để
  // đổi lấy cái gì.
  //
  // Xếp vào "savings" theo đúng cách FinlyWealth phân loại cả ba (đích của
  // `affiliateUrl` nằm dưới mục savings account). Trên thực tế đây vẫn là tài
  // khoản tiêu hằng ngày có thẻ prepaid Mastercard® — `keyBenefitsVi` nói rõ
  // phần đó, thay vì tách mỗi gói thành hai mục như đã làm với Wealthsimple®.
  {
    slug: "koho-everything",
    bank: "koho",
    name: "KOHO Everything Plan",
    kind: "savings",
    tags: [],
    monthlyFee: 14.75,
    bonusValue: 100,
    bonusLabelVi: "Tối đa $100 cashback",
    bonusConditionsVi: [
      "Chỉ dành cho khách hàng mới, chưa từng có tài khoản KOHO.",
      "Đăng ký bằng promo code FW10C26 khi mở tài khoản.",
      "Nạp tiền trong vòng 30 ngày kể từ ngày mở và chi tối thiểu $20 trong 30 ngày đầu.",
      "Được 10% cashback trên chi tiêu 3 tháng đầu, tối đa $1,000 chi tiêu — tức tối đa $100.",
      "Không cộng dồn với khuyến mãi khác. Loại trừ cash advance, rút ATM, chuyển tiền, crypto, cờ bạc và gift card.",
    ],
    interestRate: 3.5,
    promoNoteVi:
      "3.50% áp dụng cho mọi mức số dư, không phải lãi khuyến mãi có hạn — nó đi kèm gói Everything và mất đi nếu bạn hạ gói. Tính ra $14.75/tháng tức $177/năm, nên phần lãi chênh so với gói Extra chỉ hoà vốn khi số dư đủ lớn.",
    keyBenefitsVi: [
      "Lãi 3.50% trên toàn bộ số dư, kể cả tiền đang chờ tiêu",
      "2% cashback cho tạp hoá, đi lại, ăn uống; tới thêm 6.5% tại một số cửa hàng",
      "Không phí chuyển đổi ngoại tệ, giao dịch và Interac e-Transfer® không giới hạn",
      "Kèm 3GB eSIM dùng ở nước ngoài, theo dõi credit score miễn phí và giảm 50% phí xây credit",
    ],
    url: "https://www.koho.ca/everything/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fsavings-accounts%2Fkoho-everything-plan&utm_source=ghe-1a",
  },
  {
    slug: "koho-extra",
    bank: "koho",
    name: "KOHO Extra Plan",
    kind: "savings",
    tags: [],
    monthlyFee: 12,
    bonusValue: 100,
    bonusLabelVi: "Tối đa $100 cashback",
    bonusConditionsVi: [
      "Chỉ dành cho khách hàng mới, chưa từng có tài khoản KOHO.",
      "Đăng ký bằng promo code FW10C26 khi mở tài khoản.",
      "Nạp tiền trong vòng 30 ngày kể từ ngày mở và chi tối thiểu $20 trong 30 ngày đầu.",
      "Được 10% cashback trên chi tiêu 3 tháng đầu, tối đa $1,000 chi tiêu — tức tối đa $100.",
      "Nạp tối thiểu $20 trong 30 ngày đầu cũng là điều kiện để nhận rebate của FinlyWealth.",
    ],
    interestRate: 2.5,
    promoNoteVi:
      "2.50% áp dụng cho mọi mức số dư và đi kèm gói Extra ($12/tháng). Chênh đúng $2.75/tháng so với gói Everything nhưng lãi thấp hơn 1.00% và cashback cơ bản thấp hơn 0.5%.",
    keyBenefitsVi: [
      "Lãi 2.50% trên toàn bộ số dư",
      "1.5% cashback cho tạp hoá, đi lại, ăn uống; tới thêm 6.5% tại một số cửa hàng",
      "Không phí chuyển đổi ngoại tệ, giao dịch và Interac e-Transfer® không giới hạn",
      "Dùng thử miễn phí 30 ngày, theo dõi credit score miễn phí và giảm 30% phí xây credit",
    ],
    url: "https://www.koho.ca/extra/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fkoho-extra-plan&utm_source=ghe-1a",
    rebate: "$100",
  },
  {
    slug: "koho-essential",
    bank: "koho",
    name: "KOHO Essential Plan",
    kind: "savings",
    tags: [],
    monthlyFee: 4,
    feeWaiverVi: "Miễn monthly fee nếu có khoản nạp định kỳ $1,000/tháng, nạp tay hay direct deposit đều được.",
    bonusValue: 100,
    bonusLabelVi: "Tối đa $100 cashback",
    bonusConditionsVi: [
      "Chỉ dành cho khách hàng mới, chưa từng có tài khoản KOHO.",
      "Đăng ký bằng promo code FW10C26 khi mở tài khoản.",
      "Nạp tiền trong vòng 30 ngày kể từ ngày mở và chi tối thiểu $20 trong 30 ngày đầu.",
      "Được 10% cashback trên chi tiêu 3 tháng đầu, tối đa $1,000 chi tiêu — tức tối đa $100.",
      "Nạp tối thiểu $20 trong 30 ngày đầu cũng là điều kiện để nhận rebate của FinlyWealth.",
    ],
    interestRate: 2,
    promoNoteVi:
      "2.00% áp dụng cho mọi mức số dư. Đây là gói duy nhất của KOHO có đường miễn phí hẳn monthly fee, nên nếu bạn vẫn nạp lương về đây thì nó là gói rẻ nhất — đổi lại lãi và cashback thấp nhất, và vẫn còn phí chuyển đổi ngoại tệ 1.5%.",
    keyBenefitsVi: [
      "Lãi 2.00% trên toàn bộ số dư",
      "1% cashback cho tạp hoá, đi lại, ăn uống; tới thêm 6.5% tại một số cửa hàng",
      "Giao dịch và Interac e-Transfer® không giới hạn, miễn phí",
      "Chuyển tiền quốc tế tới hơn 190 nước, theo dõi credit score miễn phí",
    ],
    url: "https://www.koho.ca/essential/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Frebates%2Fbank-accounts%2Fkoho-essential-plan&utm_source=ghe-1a",
    rebate: "$100",
  },

  // ------------------------------------------------------- National Bank
  {
    slug: "national-bank-newcomer",
    bank: "national-bank",
    name: "National Bank® — Bank Account for Newcomers",
    kind: "chequing",
    tags: ["newcomer"],
    monthlyFee: 15.95,
    feeWaiverVi:
      "Miễn hoàn toàn monthly fee trong năm đầu. Năm 2 và năm 3 còn $7.98 rồi $11.96 mỗi tháng, và về $0 nếu giữ số dư tối thiểu $4,500 mỗi ngày hoặc có đủ ba thứ: thẻ tín dụng Mastercard® cá nhân, bank statement điện tử, và payroll deposit hằng tháng (hoặc thanh toán ít nhất 2 hoá đơn điện tử mỗi tháng). Hết năm 4 tài khoản tự chuyển sang gói The Connected®.",
    // Đây là bốn khoản rời nhau, không phải một cục $600 cho không: chỉ khoản
    // $300 đầu là mở tài khoản, ba khoản $100 còn lại đòi thêm một sản phẩm
    // khác của National Bank. Viết tách ra vì gộp thành "tối đa $600" sẽ làm
    // con số trông dễ với hơn thực tế.
    bonusValue: 600,
    bonusLabelVi: "Tối đa $600",
    bonusConditionsVi: [
      "Từ 18 tuổi, có thường trú hoặc work/study permit còn hiệu lực, và sắp sang Canada trong 90 ngày hoặc đã ở Canada từ 5 năm trở xuống.",
      "$300 khi mở tài khoản chequing, đăng ký online banking, thực hiện 20 giao dịch đủ điều kiện và nhận 3 khoản automatic deposit từ $100 mỗi khoản.",
      "$100 nữa khi mở thẻ tín dụng Mastercard® của National Bank®, được duyệt và quẹt đủ 20 giao dịch.",
      "$100 nữa khi set up thanh toán định kỳ khoản vay mua nhà National Bank® từ chính tài khoản mới này.",
      "$100 nữa khi mở High Interest Savings Account và nạp tối thiểu $5,000.",
    ],
    keyBenefitsVi: [
      "Không cần credit history ở Canada để mở tài khoản",
      "Giao dịch online và Interac e-Transfer® trong nước không giới hạn",
      "Rút tiền và giao dịch tại quầy miễn phí năm đầu, hơn 360 chi nhánh trên toàn Canada",
      "Kèm 12 tháng tư vấn pháp lý miễn phí qua đối tác FBA Solutions",
    ],
    url: "https://www.nbc.ca/personal/accounts/newcomers.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fchequing-accounts%2Fnbc-newcomer-account&utm_source=ghe-1a",
  },

  // ----------------------------------------------------------------- RBC
  // Offer iPad chạy chung cho VIP Banking và Signature No Limit — cùng điều
  // kiện, cùng ngày kết thúc, mỗi người chỉ nhận một lần dù mở mấy tài khoản.
  // Phần thưởng là hiện vật nên `bonusValue` lấy đúng con số RBC® tự ghi trong
  // điều khoản ($499 cho Apple 11-inch iPad Wi-Fi 128GB) — cùng cách đã làm với
  // Tech Reward của BMO®. Ba tài khoản RBC® còn lại không có welcome bonus nào
  // đang chạy; để trống chứ không mượn offer của tài khoản khác.
  {
    slug: "rbc-vip-banking",
    bank: "rbc",
    name: "RBC® VIP Banking Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 30,
    feeWaiverVi:
      "Giảm còn $17.05/tháng theo Value Program khi có thẻ tín dụng cá nhân RBC® cùng tài khoản đầu tư, kèm một khoản vay mua nhà hoặc một tài khoản doanh nghiệp nhỏ. Người từ 65 tuổi được giảm còn $22.50/tháng. Không có đường về $0.",
    bonusValue: 499,
    bonusLabelVi: "iPad (RBC® ghi $499)",
    bonusExpiresOn: "2026-11-02",
    bonusConditionsVi: [
      "Mở tài khoản VIP Banking hoặc Signature No Limit Banking mới trước 02/11/2026.",
      "Làm hai trong ba việc sau trong 90 ngày: chuyển trọn payroll hoặc lương hưu về đây bằng direct deposit (không chia nhỏ); set up 2 khoản thanh toán định kỳ; hoặc thanh toán 2 hoá đơn qua RBC® Online Banking, app, ATM hay điện thoại.",
      "Phần thưởng là Apple 11-inch iPad Wi-Fi 128GB, chỉ khi còn hàng.",
      "Mỗi người một phần thưởng, dù mở bao nhiêu tài khoản.",
      "Phải giữ tài khoản và giữ nguyên các điều kiện trên tới ít nhất 02/11/2027, nếu không RBC® có quyền trừ lại $499 từ tài khoản của bạn.",
    ],
    keyBenefitsVi: [
      "Giao dịch debit và Interac e-Transfer® không giới hạn, dùng được trên toàn thế giới",
      "Rebate tới $120 annual fee thẻ tín dụng đủ điều kiện",
      "Miễn monthly fee cho tối đa 2 tài khoản CAD và 1 tài khoản USD khác",
      "Rút ATM trong mạng lưới RBC® miễn phí, bank draft $0, không yêu cầu số dư tối thiểu",
      "Tích điểm Avion® khi quẹt thẻ debit",
    ],
    url: "https://www.rbcroyalbank.com/bank-accounts/chequing-accounts/vip-banking.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fchequing-accounts%2Frbc-vip-banking&utm_source=ghe-1a",
  },
  {
    slug: "rbc-signature-no-limit",
    bank: "rbc",
    name: "RBC® Signature No Limit Banking Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 16.95,
    feeWaiverVi:
      "Giảm $6/tháng khi có thẻ tín dụng cá nhân RBC® cùng tài khoản đầu tư, và thêm $6.95/tháng nữa khi có khoản vay mua nhà hoặc tài khoản doanh nghiệp nhỏ — gộp lại còn $4/tháng. Không có đường về $0.",
    bonusValue: 499,
    bonusLabelVi: "iPad (RBC® ghi $499)",
    bonusExpiresOn: "2026-11-02",
    bonusConditionsVi: [
      "Mở tài khoản VIP Banking hoặc Signature No Limit Banking mới trước 02/11/2026.",
      "Làm hai trong ba việc sau trong 90 ngày: chuyển trọn payroll hoặc lương hưu về đây bằng direct deposit (không chia nhỏ); set up 2 khoản thanh toán định kỳ; hoặc thanh toán 2 hoá đơn qua RBC® Online Banking, app, ATM hay điện thoại.",
      "Phần thưởng là Apple 11-inch iPad Wi-Fi 128GB, chỉ khi còn hàng.",
      "Mỗi người một phần thưởng, dù mở bao nhiêu tài khoản.",
      "Phải giữ tài khoản và giữ nguyên các điều kiện trên tới ít nhất 02/11/2027, nếu không RBC® có quyền trừ lại $499 từ tài khoản của bạn.",
    ],
    keyBenefitsVi: [
      "Giao dịch debit và Interac e-Transfer® không giới hạn trong Canada",
      "Rebate tới $48 annual fee thẻ tín dụng đủ điều kiện",
      "Miễn phí 3 lần rút ATM ngoài mạng RBC® mỗi tháng, sau đó $2 mỗi lần",
      "Không yêu cầu số dư tối thiểu; không hài lòng trong 4 tháng đầu thì được hoàn monthly fee tối đa 3 tháng",
      "Tích điểm Avion® khi quẹt thẻ debit",
    ],
    url: "https://www.rbcroyalbank.com/bank-accounts/chequing-accounts/signature-no-limit-banking.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fchequing-accounts%2Frbc-signature-no-limit&utm_source=ghe-1a",
  },
  {
    slug: "rbc-advantage-students",
    bank: "rbc",
    name: "RBC® Advantage Banking Account for Students",
    kind: "chequing",
    tags: ["student"],
    monthlyFee: 0,
    feeWaiverVi:
      "Miễn monthly fee cho sinh viên toàn thời gian hoặc bất kỳ ai từ 24 tuổi trở xuống. RBC® có quyền yêu cầu giấy xác nhận đang học.",
    // AirPods 4 (model MXP63AM/A) — RBC® không ghi giá trong điều khoản, khác
    // với offer iPad. $179 ở đây là giá niêm yết của Apple Canada cho đúng model
    // đó, và chỉ dùng để xếp hạng; nhãn hiển thị không nhắc tới con số nào.
    bonusValue: 179,
    bonusLabelVi: "AirPods 4",
    bonusExpiresOn: "2026-11-02",
    bonusConditionsVi: [
      "Từ 13 tuổi trở lên và chưa từng có tài khoản cá nhân RBC® trong 3 năm trước 02/06/2026.",
      "Mở tài khoản Advantage Banking for Students đầu tiên trước 21:00 EST ngày 02/11/2026.",
      "Làm hai trong các việc sau trước 21:00 EST ngày 15/01/2027: đăng ký Interac Autodeposit và gửi/nhận 1 e-Transfer; lấy thẻ RBC® Virtual Visa Debit và quẹt ít nhất 1 lần; chuyển trọn payroll về tài khoản mới; set up 1 khoản thanh toán định kỳ; hoặc thanh toán 1 hoá đơn qua app/online banking.",
      "Phần thưởng là AirPods 4, kèm 3 tháng Apple Music cho người đăng ký mới.",
    ],
    keyBenefitsVi: [
      "Không monthly fee, giao dịch debit không giới hạn",
      "Interac e-Transfer® miễn phí không giới hạn trong Canada",
      "Rút ATM tại Canada $0, kể cả máy ngoài mạng lưới RBC®",
      "Miễn phí chuyển tiền đi Mỹ và quốc tế",
      "Tích điểm Avion® khi quẹt thẻ debit, kể cả Virtual Visa Debit",
    ],
    url: "https://www.rbcroyalbank.com/bank-accounts/students/offers/",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fchequing-accounts%2Frbc-advantage-students&utm_source=ghe-1a",
  },
  {
    slug: "rbc-advantage",
    bank: "rbc",
    name: "RBC® Advantage Banking Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 12.95,
    feeWaiverVi:
      "Về tới $0/tháng theo Value Program của RBC® khi gom đủ sản phẩm đủ điều kiện. Người từ 65 tuổi được giảm $8.95/tháng.",
    keyBenefitsVi: [
      "Giao dịch debit không giới hạn trong Canada, không yêu cầu số dư tối thiểu",
      "Interac e-Transfer® miễn phí không giới hạn",
      "Rút tiền không giới hạn ở ATM ngoài mạng RBC® trên toàn Canada",
      "Giảm 3 cent mỗi lít xăng tại Petro-Canada®, được hoàn 1 phí NSF mỗi năm",
      "Tích điểm Avion® cho chi tiêu hằng ngày",
    ],
    url: "https://www.rbcroyalbank.com/bank-accounts/chequing-accounts/advantage-banking.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fchequing-accounts%2Frbc-advantage&utm_source=ghe-1a",
  },
  {
    slug: "rbc-day-to-day",
    bank: "rbc",
    name: "RBC® Day to Day Banking Account",
    kind: "chequing",
    tags: [],
    monthlyFee: 4,
    feeWaiverVi:
      "Về $0/tháng theo Value Program của RBC®. Miễn hẳn cho người cao tuổi, người bản địa và người thụ hưởng RDSP.",
    keyBenefitsVi: [
      "12 giao dịch debit mỗi tháng, sau đó $1.25 mỗi giao dịch",
      "Interac e-Transfer® miễn phí không giới hạn, không tính vào 12 giao dịch",
      "Chuyển khoản tự phục vụ, thanh toán vé phương tiện công cộng và giao dịch Virtual Visa Debit cũng không tính vào 12 giao dịch",
      "Không yêu cầu số dư tối thiểu",
      "Tích điểm Avion® khi quẹt thẻ debit",
    ],
    url: "https://www.rbcroyalbank.com/bank-accounts/chequing-accounts/day-to-day-banking.html",
    affiliateUrl:
      "https://www.finlywealth.com/r/pYQhcEuX?url=%2Fbanking%2Fchequing-accounts%2Frbc-day-to-day&utm_source=ghe-1a",
  },
];

/** Ngày đối chiếu toàn bộ số liệu ở trên với nguồn. */
export const BANK_ACCOUNTS_VERIFIED_ON = "2026-08-19";

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
  { id: "rebate", labelKey: "sortRebate" },
  { id: "interest", labelKey: "sortInterest" },
  { id: "fee", labelKey: "sortFee" },
  { id: "az", labelKey: "sortAz" },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

/**
 * Tài khoản này có welcome bonus CÒN NHẬN ĐƯỢC không.
 *
 * `bonusLabelVi` một mình là không đủ. Bonus tài khoản ngân hàng nằm trong file
 * này chứ không nằm trong Contentful, nên không có job nào gỡ chúng khi tới hạn
 * — phải có người sửa file rồi deploy. Giữa hai lần đó, chỉ kiểm nhãn thôi thì
 * chip "Có welcome bonus" vẫn lọc ra nó, thứ tự "sắp theo bonus" vẫn xếp nó lên
 * đầu bằng $350 không còn tồn tại, và cả trang danh sách lẫn trang riêng vẫn in
 * con số đó làm số lớn nhất trên thẻ. Ngày đã qua thì nằm im trong phần điều
 * kiện thu gọn, gần như không ai mở.
 */
export function hasLiveBonus(account: BankAccount): boolean {
  if (account.bonusLabelVi === undefined) return false;
  return !(account.bonusExpiresOn && hasExpired(account.bonusExpiresOn));
}

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
      return hasLiveBonus(account);
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
 * `rebate` được lưu dưới dạng chuỗi hiển thị ("$100") chứ không phải số, vì
 * nó đi thẳng lên nhãn và vì job check-rebates của thẻ tín dụng cũng đọc ra
 * đúng dạng đó từ <title> của FinlyWealth. Muốn sắp xếp thì phải rút số ra —
 * bỏ "$" và bỏ dấu phẩy ngăn nghìn, để "$1,000" không bị cắt còn 1.
 *
 * Trả `undefined` chứ không trả 0 khi không có rebate: xem chú thích của
 * `sortAccounts` bên dưới về lý do "không có" phải khác "bằng 0".
 */
function rebateValue(account: BankAccount): number | undefined {
  if (!account.rebate) return undefined;
  const amount = Number(account.rebate.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? amount : undefined;
}

/**
 * Sắp xếp. Tài khoản không có số ở tiêu chí đang chọn (không bonus khi sắp
 * theo bonus, không công bố lãi khi sắp theo lãi, không có rebate khi sắp
 * theo rebate) bị đẩy xuống cuối thay vì coi như bằng 0 — nếu không, "không
 * công bố" sẽ nằm lẫn với "0%", hai chuyện khác hẳn nhau.
 */
export function sortAccounts(accounts: BankAccount[], sort: SortId): BankAccount[] {
  const byName = (a: BankAccount, b: BankAccount) => a.name.localeCompare(b.name, "vi");

  return [...accounts].sort((a, b) => {
    switch (sort) {
      case "bonus": {
        // Bonus đã hết hạn xếp như "không có bonus", không phải như số tiền của
        // nó — nếu không, tài khoản chết vẫn đứng đầu danh sách.
        const value = (account: BankAccount) =>
          hasLiveBonus(account) ? (account.bonusValue ?? -1) : -1;
        const diff = value(b) - value(a);
        return diff !== 0 ? diff : byName(a, b);
      }
      case "rebate": {
        const diff = (rebateValue(b) ?? -1) - (rebateValue(a) ?? -1);
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
 * `format-date.ts` đã ghi lại — và từ 20/08/2026 `format-date.ts` cắt chuỗi
 * đúng như vậy, nên chỗ này gọi thẳng sang đó thay vì giữ bản sao thứ hai của
 * cùng một phép cắt.
 */
export function formatIsoDate(iso: string): string {
  return formatDate(iso);
}
