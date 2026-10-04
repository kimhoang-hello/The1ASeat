import type { CreditCardOffer } from "./content";
import { cardsInProgram } from "./card-points-programs";
import { centsLabel } from "./cash-out";

/**
 * Nội dung trang Refundable Hotel Trick (`/refundable-hotel-trick`).
 *
 * Bốn chương trình nằm ở đây dưới dạng dữ liệu, không nằm rải trong JSX: sửa
 * một bước, đổi tỷ lệ hay thêm một cảnh báo là sửa đúng một chỗ, và trang tự
 * dựng lại timeline, dòng tóm tắt, calculator lẫn bảng so sánh từ đó.
 *
 * Nguồn nội dung là spec tác giả viết ngày 04/10/2026. Luật của spec: KHÔNG
 * thêm thời gian xử lý, welcome bonus, điều kiện Product Switch, hạn điểm,
 * cách tính annual fee hay điều kiện welcome bonus sau Product Switch — chính
 * sách ngân hàng đổi liên tục, và trang này không được đoán thay ngân hàng.
 * Thêm một chi tiết kiểu đó là phải có nguồn từ tác giả.
 *
 * Tỷ lệ quy đổi chỉ khai MỘT lần (`centsPerPoint`). Ví dụ "50,000 points =
 * $500", nhãn "1 point = 1¢", cột "1¢/pt" của bảng so sánh và calculator đều
 * tính ra từ con số đó, nên đổi tỷ lệ không để lại một con số viết tay nào nói
 * ngược lại.
 */

export const RHT_PATH = "/refundable-hotel-trick";

/** Ngày cập nhật nội dung — đổi mỗi lần sửa bước hay tỷ lệ. YYYY-MM-DD. */
export const RHT_LAST_UPDATED = "2026-10-04";

/** Id khu vực "Bạn muốn cash out gì?" — đích của link "chọn chương trình khác". */
export const RHT_PICKER_ANCHOR = "chon-chuong-trinh";

/** Id khối so sánh CIBC® với Scene+™ — chỗ người đọc dễ làm sai nhất. */
export const RHT_PENDING_POSTED_ANCHOR = "cibc-hay-scene-plus";

export type RhtProgramId = "amex" | "cibc" | "scene" | "td";

/**
 * Nghĩa của từng tông màu, theo đúng ba màu trạng thái của site (DESIGN-SYSTEM
 * 3.2): `good` = đây là lúc làm / có lợi, `go` = cùng nghĩa nhưng nền đặc, cho
 * đúng bước REDEEM ở khối so sánh CIBC®/Scene+™; `bad` = quá trễ / đừng làm,
 * `wait` = chưa tới lúc, `neutral` = một bước bình thường.
 */
export type ChipTone = "neutral" | "good" | "go" | "bad" | "wait";

export interface Chip {
  label: string;
  tone?: ChipTone;
}

/** Một dòng "trạng thái → làm gì" trong khối quy tắc của CIBC® và Scene+™. */
export interface Verdict {
  state: string;
  verdict: string;
  tone: Exclude<ChipTone, "neutral" | "go">;
}

export interface RhtStep {
  title: string;
  body: string[];
  /** Chuỗi chip có mũi tên — trạng thái giao dịch, đường bấm trong app… */
  flow?: { chips: Chip[]; direction?: "row" | "column" };
  /** Đoạn chữ đứng SAU chuỗi chip. */
  bodyAfter?: string[];
  /** Hiện dòng "Rate: 1 point = 1¢" tính từ `centsPerPoint` của chương trình. */
  showRate?: boolean;
  /** Câu cảnh báo nổi bật — "Không cancel hotel ngay" và tương tự. */
  warnings?: string[];
  /** Ghi chú phụ, chữ nhỏ. */
  note?: string;
}

export interface RhtProgram {
  id: RhtProgramId;
  /** Id của section — đích của thẻ chọn chương trình ở đầu trang. */
  anchor: string;
  /** Tên trên thẻ chọn chương trình và trong bảng so sánh. */
  name: string;
  /** Tên ngắn trong bảng so sánh và ô chọn của calculator. */
  shortName: string;
  /** H2 của section. */
  heading: string;
  purpose: string;
  /** `null` = chương trình không quy đổi theo điểm (Amex® Travel Credit). */
  centsPerPoint: number | null;
  /** Đơn vị điểm trong câu kết quả của calculator: "100,000 Aventura® Points". */
  pointsName?: string;
  /** Nhãn nút chọn trong calculator. */
  calculatorLabel?: string;
  /** Kênh redeem ứng với tỷ lệ — chỉ TD® cần nói ra. */
  rateChannel?: string;
  /** Dòng thay cho tỷ lệ trên thẻ chọn khi không có tỷ lệ. */
  pickerValue?: string;
  examplePoints: number[];
  /** Quy tắc cốt lõi, đọc được trong một cái liếc: "PENDING → REDEEM". */
  rule: string[];
  keyRule: { title: string; body: string[]; verdicts?: Verdict[] };
  steps: RhtStep[];
  summary: Chip[];
  compare: { value?: string; when: string; booking: string; note?: string };
  /** Tiêu đề khối thẻ ở cuối section. */
  cardsTitle: string;
  /** Hệ điểm trong `card-points-programs.ts`; `null` = lọc riêng (Amex®). */
  cardProgramId: string | null;
  /**
   * Ngân hàng phát hành mà workflow này nói tới. Cần riêng vì cùng một hệ điểm
   * có thể nằm ở thẻ của ngân hàng khác: Tangerine® cũng tích Scene+™, nhưng
   * các bước ở đây đi qua Scotiabank® App.
   */
  cardIssuer: RegExp;
}

const FULLY_REFUNDABLE: Chip = { label: "FULLY REFUNDABLE", tone: "good" };

export const RHT_FLOW: Chip[] = [
  { label: "BOOK" },
  { label: "REDEEM" },
  { label: "WAIT" },
  { label: "CANCEL" },
  { label: "REFUND" },
];

export const RHT_PROGRAMS: RhtProgram[] = [
  {
    id: "amex",
    anchor: "amex-travel-credit",
    name: "American Express®",
    shortName: "Amex®",
    heading: "Amex® Travel Credit",
    purpose: "Cash out Annual Travel Credit",
    centsPerPoint: null,
    pickerValue: "Annual Travel Credit",
    examplePoints: [],
    rule: ["BOOK", "TRAVEL CREDIT", "CANCEL"],
    keyRule: {
      title: "Amex® = BOOK → TRAVEL CREDIT → CANCEL",
      body: [
        "Annual Travel Credit được dùng ngay lúc booking trên Amex® Travel. Chỉ cancel hotel sau khi Travel Credit đã được credit vào card.",
      ],
    },
    steps: [
      { title: "Go to Amex® Travel", body: ["Truy cập Amex® Travel và tìm hotel."] },
      {
        title: "Choose Fully Refundable",
        body: ["Chọn hotel/rate có chính sách:"],
        flow: { chips: [FULLY_REFUNDABLE] },
        bodyAfter: ["Kiểm tra cancellation deadline trước khi book."],
      },
      { title: "Book Hotel", body: ["Book hotel như bình thường."] },
      {
        title: "Apply Travel Credit",
        body: [
          "Trong Payment Method, chọn Annual Travel Credit của card.",
          "Ví dụ có thể là $100 hoặc $200 tùy card.",
        ],
        warnings: [
          "Nếu Travel Credit không xuất hiện, bạn cần kiểm tra lại card và eligibility trước khi tiếp tục.",
        ],
      },
      { title: "Complete Booking", body: ["Hoàn tất booking."] },
      {
        title: "Wait for Credit",
        body: ["Đợi Travel Credit được credit vào card."],
        warnings: ["Không cancel hotel ngay sau booking."],
      },
      {
        title: "Cancel Hotel",
        body: [
          "Sau khi Travel Credit đã được applied/confirmed và booking có thể được cancel, quay lại Amex® Travel để cancel hotel.",
        ],
      },
      { title: "Refund", body: ["Đợi hotel refund quay lại credit card."] },
    ],
    summary: [
      { label: "BOOK" },
      { label: "APPLY TRAVEL CREDIT", tone: "good" },
      { label: "WAIT" },
      { label: "CANCEL" },
      { label: "REFUND" },
    ],
    compare: { value: "Travel Credit", when: "During Booking", booking: "Amex® Travel" },
    cardsTitle: "Thẻ American Express® có Annual Travel Credit trên Ghế 1A",
    cardProgramId: null,
    cardIssuer: /american express/i,
  },
  {
    id: "cibc",
    anchor: "cibc-aventura",
    name: "CIBC® Aventura®",
    shortName: "CIBC®",
    heading: "CIBC® Aventura®",
    purpose: "Cash out Aventura® Points",
    centsPerPoint: 1,
    pointsName: "Aventura® Points",
    calculatorLabel: "CIBC® Aventura®",
    examplePoints: [50_000, 100_000],
    rule: ["PENDING", "REDEEM"],
    keyRule: {
      title: "CIBC® = PENDING → REDEEM",
      body: [
        "Redeem khi transaction vẫn còn PENDING.",
        "Nếu transaction đã Posted thì đã quá trễ cho workflow này.",
      ],
      verdicts: [
        { state: "PENDING", verdict: "REDEEM NOW", tone: "good" },
        { state: "POSTED", verdict: "TOO LATE", tone: "bad" },
      ],
    },
    steps: [
      { title: "Book Hotel", body: ["Vào Expedia® và chọn một Fully Refundable hotel."] },
      {
        title: "Pay with Aventura® Card",
        body: ["Thanh toán booking bằng CIBC® Aventura® credit card."],
      },
      {
        title: "Wait for Pending Transaction",
        body: [
          "Theo dõi CIBC® app.",
          "Khi hotel transaction xuất hiện và vẫn còn PENDING, đây là lúc redeem.",
        ],
        flow: { chips: [{ label: "PENDING" }, { label: "REDEEM", tone: "good" }] },
      },
      {
        title: "Apply Aventura® Points",
        body: ["Mở Pending transaction và apply số Aventura® points muốn redeem."],
        showRate: true,
        warnings: ["Quan trọng: không chờ transaction Posted mới redeem."],
      },
      {
        title: "Wait",
        body: [
          "Sau khi apply points, đợi hotel transaction và redemption credit được processed/posted.",
        ],
        warnings: ["Không cancel hotel ngay."],
      },
      {
        title: "Cancel Hotel",
        body: [
          "Sau khi redemption credit đã hoàn tất, cancel Fully Refundable hotel trước cancellation deadline.",
        ],
      },
      { title: "Refund", body: ["Đợi hotel refund quay lại CIBC® credit card."] },
    ],
    summary: [
      { label: "BOOK" },
      { label: "PENDING", tone: "good" },
      { label: "REDEEM", tone: "good" },
      { label: "WAIT" },
      { label: "CANCEL" },
      { label: "REFUND" },
    ],
    compare: { when: "PENDING", booking: "Expedia®" },
    cardsTitle: "Thẻ tích Aventura® trên Ghế 1A",
    cardProgramId: "aventura",
    cardIssuer: /cibc/i,
  },
  {
    id: "scene",
    anchor: "scene-plus",
    name: "Scotiabank® Scene+™",
    shortName: "Scene+™",
    heading: "Scotiabank® Scene+™",
    purpose: "Cash out Scene+™ Points",
    centsPerPoint: 1,
    pointsName: "Scene+™ Points",
    calculatorLabel: "Scene+™",
    examplePoints: [50_000, 100_000],
    rule: ["POSTED", "REDEEM"],
    keyRule: {
      title: "Scene+™ = POSTED → REDEEM",
      body: ["Scene+™ khác CIBC®: phải đợi transaction POSTED rồi mới redeem."],
      verdicts: [
        { state: "PENDING", verdict: "WAIT", tone: "wait" },
        { state: "POSTED", verdict: "REDEEM", tone: "good" },
      ],
    },
    steps: [
      {
        title: "Book Hotel",
        body: ["Book trực tiếp với Expedia® hoặc một eligible travel website."],
        warnings: ["Không sử dụng Expedia® portal bên trong Scene+™ cho workflow này."],
      },
      { title: "Choose Fully Refundable", body: ["Chọn Fully Refundable hotel/rate."] },
      {
        title: "Pay with Scotia® Card",
        body: ["Thanh toán bằng Scotia® credit card earn Scene+™."],
      },
      {
        title: "Wait for Posted",
        body: ["Đợi travel transaction chuyển từ:"],
        flow: {
          chips: [
            { label: "PENDING", tone: "wait" },
            { label: "POSTED", tone: "good" },
          ],
        },
      },
      {
        title: "Redeem Scene+™",
        body: ["Sau khi transaction Posted, vào:"],
        flow: {
          direction: "column",
          chips: [
            { label: "Scotiabank® App" },
            { label: "Credit Card" },
            { label: "Scene+™ Rewards" },
            { label: "Redeem Rewards" },
            { label: "Travel" },
            { label: "Apply Points for Travel", tone: "good" },
          ],
        },
        bodyAfter: ["Apply số Scene+™ points muốn redeem."],
        showRate: true,
      },
      {
        title: "Wait for Credit",
        body: ["Đợi Scene+™ redemption credit được posted."],
        warnings: ["Không cancel hotel khi credit vẫn chưa hoàn tất."],
      },
      {
        title: "Cancel Hotel",
        body: ["Sau khi credit posted, cancel Fully Refundable hotel."],
      },
      { title: "Refund", body: ["Đợi hotel refund quay lại Scotia® credit card."] },
    ],
    summary: [
      { label: "BOOK" },
      { label: "POSTED", tone: "good" },
      { label: "REDEEM", tone: "good" },
      { label: "WAIT" },
      { label: "CANCEL" },
      { label: "REFUND" },
    ],
    compare: { when: "POSTED", booking: "Eligible Travel Website" },
    cardsTitle: "Thẻ tích Scene+™ trên Ghế 1A",
    cardProgramId: "scene-plus",
    cardIssuer: /scotiabank/i,
  },
  {
    id: "td",
    anchor: "td-rewards",
    name: "TD Rewards®",
    shortName: "TD®",
    heading: "TD Rewards®",
    purpose: "Cash out TD Rewards® Points",
    centsPerPoint: 0.5,
    pointsName: "TD Rewards® Points",
    calculatorLabel: "TD Rewards®",
    rateChannel: "qua Expedia® For TD",
    examplePoints: [50_000, 100_000, 135_000],
    rule: ["REDEEM", "PRODUCT SWITCH", "CANCEL"],
    keyRule: {
      title: "TD® = REDEEM → PRODUCT SWITCH → CANCEL",
      body: [
        "TD® workflow khác các chương trình còn lại vì Product Switch là một bước bắt buộc của cash-out method này.",
      ],
    },
    steps: [
      {
        title: "Have TD Rewards® Points",
        body: ["Đảm bảo TD Rewards® points đã có trong account."],
      },
      {
        title: "Expedia® For TD",
        body: ["Truy cập Expedia® For TD và đăng nhập.", "Chọn Fully Refundable hotel."],
      },
      {
        title: "Book with TD Rewards®",
        body: [
          "Book hotel và sử dụng TD Rewards® points.",
          "TD® có thể charge booking vào credit card trước và sau đó apply phần tương ứng từ TD Rewards® points.",
        ],
        showRate: true,
      },
      {
        title: "Wait",
        body: ["Đợi transaction được posted/processed và TD Rewards® points đã được deducted."],
        warnings: ["Không cancel hotel ở bước này."],
      },
      {
        title: "Product Switch",
        body: [
          "Sau khi TD Rewards® redemption đã hoàn tất, liên hệ TD® để Product Switch thẻ TD Rewards® sang một TD® credit card thuộc rewards ecosystem khác. Ví dụ:",
        ],
        flow: {
          direction: "column",
          chips: [
            { label: "TD First Class Travel® Visa Infinite*" },
            { label: "PRODUCT SWITCH", tone: "good" },
            { label: "TD® Aeroplan® Visa Infinite*" },
          ],
        },
        note: "TD® Aeroplan® chỉ là một example, không phải lựa chọn bắt buộc.",
        warnings: [
          "TD Rewards® không convert thành Aeroplan® points khi Product Switch.",
          "Product Switch là một phần bắt buộc của workflow RHT này, không phải optional step.",
        ],
      },
      {
        title: "Confirm Product Switch",
        body: ["Đảm bảo Product Switch đã hoàn tất trước khi cancel hotel."],
      },
      {
        title: "Cancel Hotel",
        body: [
          "Sau khi Product Switch hoàn tất, quay lại Expedia® For TD / booking management và cancel Fully Refundable hotel.",
        ],
      },
      { title: "Refund", body: ["Đợi hotel refund quay lại credit card account."] },
    ],
    summary: [
      { label: "BOOK" },
      { label: "REDEEM", tone: "good" },
      { label: "WAIT" },
      { label: "PRODUCT SWITCH", tone: "good" },
      { label: "CANCEL", tone: "good" },
      { label: "REFUND" },
    ],
    compare: {
      when: "During Booking + Product Switch",
      booking: "Expedia® For TD",
      note: "Product Switch required before cancellation.",
    },
    cardsTitle: "Thẻ tích TD Rewards® trên Ghế 1A",
    cardProgramId: "td-rewards",
    cardIssuer: /\bTD\b/,
  },
];

/** Ba chương trình quy đổi theo điểm — những gì calculator tính được. */
export const RHT_POINTS_PROGRAMS = RHT_PROGRAMS.filter(
  (
    program,
  ): program is RhtProgram & {
    centsPerPoint: number;
    pointsName: string;
    calculatorLabel: string;
  } =>
    program.centsPerPoint !== null &&
    program.pointsName !== undefined &&
    program.calculatorLabel !== undefined,
);

/** Hai chương trình mà người đọc hay nhầm thời điểm redeem nhất. */
export const RHT_PENDING_POSTED: { program: RhtProgramId; sequence: Chip[] }[] = [
  {
    program: "cibc",
    sequence: [
      { label: "BOOK" },
      { label: "PENDING", tone: "good" },
      { label: "REDEEM", tone: "go" },
    ],
  },
  {
    program: "scene",
    sequence: [
      { label: "BOOK" },
      { label: "PENDING", tone: "wait" },
      { label: "POSTED", tone: "good" },
      { label: "REDEEM", tone: "go" },
    ],
  },
];

export function rhtProgram(id: RhtProgramId): RhtProgram {
  return RHT_PROGRAMS.find((program) => program.id === id)!;
}

/** "1¢/pt" — cột Value của bảng so sánh. */
export function valueLabel(program: RhtProgram): string {
  return program.centsPerPoint === null
    ? (program.compare.value ?? "")
    : `${centsLabel(program.centsPerPoint)}/pt`;
}

/**
 * Thẻ trên site dùng được workflow của chương trình này — suy ra từ dữ liệu
 * thẻ đang phục vụ, không chép tay danh sách slug: thẻ mới tích Aventura®
 * tự hiện ở đây, thẻ bị gỡ thì tự mất.
 *
 * Hai điều kiện: đúng ngân hàng phát hành (`cardIssuer`), và đúng hệ điểm —
 * hoặc, với Amex®, có quyền lợi travel credit trong danh sách quyền lợi. Amex®
 * không đi qua `card-points-programs.ts` vì thứ cần ở đây không phải hệ điểm
 * mà là Annual Travel Credit.
 */
export function rhtCards(program: RhtProgram, offers: CreditCardOffer[]): CreditCardOffer[] {
  const issued = offers.filter(
    (offer) => offer.country !== "US" && program.cardIssuer.test(offer.issuer),
  );
  if (program.cardProgramId !== null) return cardsInProgram(issued, program.cardProgramId);
  return issued.filter((offer) =>
    offer.keyBenefits.some((benefit) => /travel credit/i.test(benefit)),
  );
}
