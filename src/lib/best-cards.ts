import { assertNoSlugClash } from "./compare";
import type { CreditCardOffer } from "./content/types";
import { formatDate, hasExpired } from "./format-date";

/**
 * "Các thẻ tốt nhất" — bốn trang biên tập nằm dưới `/credit-cards`.
 *
 * VÌ SAO NẰM TRONG REPO CHỨ KHÔNG NẰM TRONG CONTENTFUL: mỗi mục là một đoạn
 * viết tay *nói về những thẻ khác*, tức nó phụ thuộc vào dữ liệu của 10 entry
 * khác. Contentful giữ được chữ nhưng không giữ được mối nối đó: đổi slug một
 * thẻ, unpublish nó, hay hạ welcome bonus xuống thì bài viết vẫn nằm nguyên,
 * không có gì đỏ. Ở đây thì `assertBestCardPicksExist()` chạy lúc `next build`
 * nên slug hỏng làm deploy đỏ ngay, còn `npm run audit:best-cards` đối chiếu
 * từng CON SỐ trong đoạn văn với chính entry Contentful mà nó đang nói tới.
 * Cùng cách chia vai như `award-routes.ts`: dữ liệu và đoạn viết tay ở trong
 * repo, số liệu sống lấy lúc render.
 *
 * LUẬT VIẾT PROSE:
 *
 *  - **Đừng gõ ngày tháng.** Dùng `{expiresAt}` — nó được thay bằng ngày hết
 *    hạn thật của thẻ lúc render. Một ngày gõ tay sẽ trôi lặng vào đúng hôm
 *    ngân hàng gia hạn offer, và không audit nào ở đây bắt được ngày. Câu chứa
 *    token phải ĐỨNG RIÊNG: khi thẻ không còn ngày còn hiệu lực, cả câu bị bỏ
 *    đi (xem `resolveProse`), nên đừng gói thông tin nào khác vào câu đó.
 *  - **Con số thì gõ được, nhưng phải khớp Contentful.** `audit:best-cards`
 *    quét mọi số dạng `$X` hoặc `X,XXX` trong đoạn văn và đòi nó phải xuất
 *    hiện ở đâu đó trong chính entry của thẻ (welcome bonus, annual fee,
 *    rebate, headline, editor's take, key benefits). Con số KHÔNG có trong
 *    Contentful — ví dụ giá trị quy đổi tự tính — phải khai ở `otherFiguresVi`
 *    kèm lý do, nếu không audit đỏ.
 *  - **Tiêu đề mỗi thẻ không gõ tay tên thẻ.** Tên lấy từ Contentful, và ở mục
 *    `bonusInHeading` thì con số welcome bonus cũng lấy từ đó — nên tiêu đề
 *    không bao giờ lệch được.
 */

export const BEST_CARDS_BASE = "/credit-cards/tot-nhat";

/** Đoạn đường dẫn mà không thẻ nào được phép mang làm slug — cùng luật với
 *  `RESERVED_SLUG` của trang so sánh: Next ưu tiên đoạn tĩnh, nên một thẻ
 *  mang slug này sẽ mất trang chi tiết trong im lặng. */
export const BEST_CARDS_RESERVED_SLUG = BEST_CARDS_BASE.slice("/credit-cards/".length);

export function bestCardsPath(slug: string): string {
  return `${BEST_CARDS_BASE}/${slug}`;
}

/** Cùng câu chữ và cùng vai với `slugClashMessage()` của trang so sánh — job
 *  `check-rebates` in nó ra khi phát hiện va chạm trên bản đang publish. */
export function bestCardsSlugClashMessage(): string {
  return (
    `Có thẻ mang slug "${BEST_CARDS_RESERVED_SLUG}", trùng đoạn tĩnh của trang Các thẻ tốt nhất — ` +
    `Next phục vụ trang đó và trang chi tiết của thẻ này không vào được. Đổi slug trong Contentful.`
  );
}

export interface BestCardPick {
  /** Slug thẻ chính trên Contentful. Tên, ảnh, phí, bonus, nút apply đều lấy từ đây. */
  slug: string;
  /**
   * Thẻ thứ hai của cùng một offer — RBC® Avion® Visa Infinite và Visa
   * Platinum có chung welcome bonus, CIBC® Aventura® cũng vậy. Đứng chung một
   * mục vì đoạn văn nói về cả hai; hai mục riêng sẽ chép lại cùng một đoạn.
   */
  alsoSlug?: string;
  /** Vai trò trong mục ("Thẻ tốt nhất để tích travel points"). Bỏ trống ở mục
   *  dùng `bonusInHeading`. */
  roleVi?: string;
  /** Ghi đè tên hiển thị khi hai thẻ ghép lại quá dài. Bỏ trống thì ghép tên
   *  thật của các thẻ bằng " / ". */
  headingVi?: string;
  /** Đoạn viết tay. `{expiresAt}` được thay bằng ngày hết hạn thật của thẻ. */
  bodyVi: string[];
  bestForVi: string;
  /**
   * Con số trong `bodyVi` KHÔNG có trong Contentful, kèm lý do. Xem luật ở
   * đầu file — mọi con số khác đều bị `audit:best-cards` đối chiếu.
   */
  otherFiguresVi?: Record<string, string>;
  /**
   * Con số mà đoạn văn khẳng định đúng cho CẢ HAI thẻ của pick ghép.
   *
   * Mặc định, một con số chỉ cần khớp MỘT thẻ trong pick là đủ — và phải như
   * vậy, vì chính những đoạn này còn đem hai thẻ ra so với nhau ("bản Gold chỉ
   * đòi thu nhập hộ gia đình $15,000, trong khi bản Infinite yêu cầu $60,000"):
   * hai con số đó, theo định nghĩa, mỗi con thuộc về một thẻ.
   *
   * Nhưng câu "cả hai thẻ này đều đang có welcome bonus lên đến 70,000 điểm
   * Avion®" thì lại là một lời hứa về cả hai, và nó hỏng đúng vào ngày ngân
   * hàng chỉ hạ MỘT bản xuống — ca đáng canh nhất của một pick ghép, mà phép
   * so "một thẻ là đủ" không thấy. Khai ở đây thì `audit:best-cards` đòi con
   * số phải có mặt ở mọi thẻ trong pick.
   */
  sharedFiguresVi?: string[];
}

export interface BestCardsCategory {
  slug: string;
  /** Tiêu đề trang (h1). */
  titleVi: string;
  /** Nhãn ngắn cho lưới trang tổng, menu và khối "đi tiếp". */
  navTitleVi: string;
  /** Một dòng dưới nhãn ngắn — cũng là `<meta name="description">`. */
  metaDescriptionVi: string;
  subtitleVi: string;
  introVi: string[];
  /** Tiêu đề mỗi thẻ là "tên – welcome bonus" thay vì "vai trò: tên". */
  bonusInHeading?: boolean;
  picks: BestCardPick[];
  closingHeadingVi: string;
  closingVi: string[];
  /** Chữ người đọc gõ vào ô tìm kiếm nhưng không có trong tiêu đề. */
  keywordsVi: string;
}

export const BEST_CARDS_CATEGORIES: BestCardsCategory[] = [
  {
    slug: "offers",
    titleVi: "Thẻ có offers tốt nhất Canada",
    navTitleVi: "Thẻ có offers tốt nhất",
    metaDescriptionVi:
      "Năm welcome offer đáng chú ý nhất tại Canada lúc này, kèm số điểm, mức chi tiêu tối thiểu và annual fee của từng thẻ.",
    subtitleVi:
      "Welcome bonus thay đổi liên tục. Đây là những offer mình thấy đáng chú ý nhất ở thời điểm hiện tại.",
    introVi: [
      "Welcome bonus thay đổi liên tục, và một offer lớn chưa chắc đã là một offer tốt. Mỗi khi cân nhắc một offer, mình thường nhìn vào ba thứ: số điểm thực sự nhận được, số tiền phải chi để lấy đủ bonus và annual fee phải trả. Quan trọng hơn nữa là số điểm đó có thực sự hữu ích cho mục tiêu travel của bạn hay không.",
      "Dưới đây là những credit card offers mình thấy đáng chú ý nhất tại Canada ở thời điểm hiện tại.",
    ],
    bonusInHeading: true,
    picks: [
      {
        slug: "rbc-avion-visa-infinite",
        alsoSlug: "rbc-avion-visa-platinum",
        headingVi: "RBC® Avion® Visa Infinite / Visa Platinum",
        bodyVi: [
          "Đây là một trong những offer mình thích nhất hiện tại nếu mục tiêu là tích một loại transferable point. Cả RBC® Avion® Visa Infinite và Visa Platinum đều đang có welcome bonus lên đến 70,000 điểm Avion®: 35,000 điểm khi được approved thẻ, thêm 20,000 điểm sau khi chi $5,000 trong 6 tháng đầu và 15,000 điểm khi gia hạn sang năm thứ hai. Annual fee của cả hai thẻ này đều là $120.",
          "Điểm mình thích ở Avion® không phải việc dùng chúng để book travel trực tiếp với RBC® mà là khả năng transfer sang các airline programs. Avion® có thể chuyển sang British Airways® Avios® và Cathay Pacific® Asia Miles®, và đôi khi RBC® còn có transfer bonus sang các programs này lên đến 30%. Nếu biết mình đang tích điểm cho chuyến đi nào và có thể chuyển sang program nào, 70,000 điểm Avion® có thể có giá trị hơn khá nhiều so với việc nhìn chúng như một travel credit thông thường.",
          "Thẻ Visa Infinite có thêm 1.25X cho travel nhưng yêu cầu thu nhập tối thiểu $60,000 đối với cá nhân hoặc $100,000 cho hộ gia đình. Nếu không đạt yêu cầu này, thẻ Visa Platinum cho cùng welcome bonus và không có minimum income requirement.",
        ],
        bestForVi:
          "Người muốn tích transferable points và đặc biệt quan tâm đến Avios® hoặc Asia Miles®.",
        // "Cả … đều đang có welcome bonus lên đến 70,000" và "Annual fee của
        // cả hai thẻ này đều là $120" — hai lời hứa về cả hai bản.
        sharedFiguresVi: ["70,000", "$120"],
      },
      {
        slug: "amex-marriott-bonvoy",
        bodyVi: [
          "American Express® Marriott Bonvoy® hiện có welcome bonus lên đến 110,000 điểm Bonvoy®, annual fee $120. Offer kết thúc ngày {expiresAt}.",
          "Mình không xem điểm Bonvoy® có giá trị ngang Aeroplan® hay Amex® MR, nhưng 110,000 điểm vẫn là một lượng points rất đáng kể nếu bạn thường ở tại các khách sạn của Marriott Bonvoy®. Quan trọng hơn, thẻ còn tặng một Free Night Award trị giá 35,000 điểm Bonvoy® mỗi năm sau anniversary và 15 Elite Night Credits.",
          "Đây cũng là một trong số ít thẻ mình thấy có lý do khá rõ ràng để giữ lâu dài: nếu bạn sử dụng được Free Night Award hàng năm với giá trị cao hơn $120 annual fee thì bài toán giữ thẻ tương đối đơn giản.",
        ],
        bestForVi:
          "Người thường ở tại các khách sạn của Marriott Bonvoy® hoặc đang tích điểm Bonvoy® cho một redemption cụ thể.",
        otherFiguresVi: {
          "35,000":
            "Giá trị quy đổi của Free Night Award — mức trần điểm của phiếu, không phải con số nằm trong entry Contentful của thẻ.",
        },
      },
      {
        slug: "td-first-class-travel-visa-infinite",
        bodyVi: [
          "Offer hiện tại lên đến 160,000 điểm TD Rewards: 20,000 điểm sau giao dịch đầu tiên và 140,000 điểm sau khi chi $7,500 trong 180 ngày đầu. Annual fee $139 được miễn năm đầu.",
          "160,000 điểm TD Rewards tương đương khoảng $800 travel khi redeem qua Expedia® For TD. Thẻ còn có $100 TD Travel Credit, 4 lượt airport lounge mỗi năm và Birthday Bonus lên đến 10,000 điểm.",
          "Điểm cần hiểu trước khi apply là TD Rewards không phải transferable points. Bạn không thể chuyển chúng sang Aeroplan® rồi dùng để săn Business Class. Đây là một currency tương đối đơn giản: book travel rồi dùng points để giảm chi phí.",
        ],
        bestForVi:
          "Người muốn travel rewards dễ sử dụng và không muốn học cách transfer points sang airline programs.",
      },
      {
        slug: "cibc-aventura-visa-infinite",
        alsoSlug: "cibc-aventura-gold-visa",
        headingVi: "CIBC® Aventura® Visa Infinite* / Gold Visa*",
        bodyVi: [
          "Hai thẻ hiện có welcome bonus 60,000 điểm Aventura® và miễn annual fee $139 năm đầu. Ngoài bonus, bạn còn có 4 lượt airport lounge và rebate phí NEXUS™.",
          "Điều thú vị là thẻ Gold cho cùng welcome bonus nhưng chỉ yêu cầu thu nhập hộ gia đình $15,000, trong khi thẻ Visa Infinite yêu cầu $60,000 cá nhân hoặc $100,000 hộ gia đình. Nếu chỉ quan tâm đến welcome bonus, thẻ Gold vì vậy có thể là lựa chọn dễ tiếp cận hơn.",
          "Điểm Aventura® không phải là transferable points như Amex® MR hay RBC® Avion® vì không transfer được sang các airline partners, nhưng đây lại là một offer khá dễ hiểu đối với người không muốn bước quá sâu vào Miles & Points.",
        ],
        bestForVi:
          "Người muốn một travel card tương đối đơn giản, có lounge và annual fee năm đầu được miễn.",
        // "Hai thẻ hiện có welcome bonus 60,000 điểm Aventura® và miễn annual
        // fee $139 năm đầu" — nói về cả hai bản. Ngược lại, $15,000 và $60,000
        // trong cùng đoạn là điều kiện thu nhập RIÊNG của từng bản.
        sharedFiguresVi: ["60,000", "$139"],
      },
      {
        slug: "scotiabank-gold-amex",
        bodyVi: [
          "Welcome bonus hiện tại lên đến 50,000 điểm Scene+™. Nhưng lý do mình đưa Scotiabank® Gold American Express® vào danh sách không chỉ nằm ở bonus.",
          "Thẻ kiếm 6X điểm Scene+™ tại một số supermarket thuộc hệ thống Sobeys, 5X cho dining và entertainment, đồng thời không có foreign transaction fee. Điểm Scene+™ có fixed value 1 cent/point nên không có những redemption Business Class 5–10 cent/point như Aeroplan®, nhưng bù lại cực kỳ dễ sử dụng.",
        ],
        bestForVi:
          "Người muốn một thẻ vừa có welcome bonus tốt vừa có khả năng earn points mạnh cho chi tiêu hàng ngày.",
      },
    ],
    closingHeadingVi: "Nếu chỉ chọn một offer?",
    closingVi: [
      "Không có một offer tốt nhất cho tất cả mọi người. Nếu mình ưu tiên transferable points, RBC® Avion® 70,000 điểm là offer mình sẽ nhìn đầu tiên. Nếu thường ở khách sạn của Marriott Bonvoy®, 110,000 điểm Bonvoy® đang rất đáng chú ý. Nếu muốn một chương trình đơn giản hơn, TD First Class Travel® hoặc CIBC® Aventura® sẽ dễ sử dụng hơn.",
      "Đừng apply chỉ vì thấy một con số welcome bonus lớn. Trước tiên hãy xem minimum spend, annual fee và quan trọng nhất là bạn định dùng số points đó vào việc gì.",
    ],
    keywordsVi: "welcome bonus offer tốt nhất khuyến mãi thẻ đang có ưu đãi lớn nhất",
  },
  {
    slug: "travel",
    titleVi: "Thẻ travel tốt nhất Canada",
    navTitleVi: "Thẻ travel tốt nhất",
    metaDescriptionVi:
      "Sáu thẻ travel Canada chia theo mục đích: tích transferable points, airline points, no FX fee, lounge, khách sạn và cashback.",
    subtitleVi:
      "Không có một thẻ travel tốt nhất cho tất cả mọi người — chỉ có thẻ tốt nhất cho từng mục đích sử dụng.",
    introVi: [
      "“Best travel credit card” là một khái niệm khá rộng. Có người muốn tích points để đổi Business Class, có người chỉ muốn airport lounge, có người cần một thẻ không có foreign transaction fee, còn người khác đơn giản chỉ là muốn cashback.",
      "Vì vậy mình không nghĩ có một travel card tốt nhất Canada, thay vào đó mình sẽ chọn tuỳ theo mục đích sử dụng thẻ.",
    ],
    picks: [
      {
        slug: "amex-cobalt",
        roleVi: "Thẻ tốt nhất để tích travel points",
        bodyVi: [
          "Nếu xét khả năng biến chi tiêu hàng ngày thành travel points, Cobalt® vẫn là một trong những lựa chọn mình thích nhất.",
          "Thẻ earn 5 điểm Membership Rewards®/$1 cho grocery, restaurant và food delivery đủ điều kiện tại Canada, 3X streaming, 2X gas và transit. Điểm MR có thể transfer 1:1 sang Aeroplan®, Avios® và Flying Blue®, ngoài ra còn có nhiều transfer partners khác.",
          "Điểm quan trọng ở đây là flexibility. Thay vì quyết định ngay từ đầu rằng mình muốn Aeroplan®, bạn có thể giữ MR rồi chỉ transfer khi đã tìm được award availability.",
          "Welcome bonus hiện không quá hấp dẫn, nên mình xem Cobalt® là thẻ để giữ và sử dụng lâu dài chứ không phải thẻ để mở chỉ vì bonus.",
        ],
        bestForVi: "Everyday spending + airline points.",
      },
      {
        slug: "rbc-avion-visa-infinite",
        roleVi: "Thẻ tốt nhất cho airline points",
        bodyVi: [
          "RBC® Avion® Visa Infinite đang có welcome bonus lên đến 70,000 điểm Avion® và annual fee $120.",
          "Điểm Avion® có thể transfer sang British Airways® Avios® và Cathay Pacific® Asia Miles®, hai chương trình mình sử dụng khá nhiều khi tìm vé đi châu Á. RBC® cũng thường xuyên có transfer bonus, đặc biệt sang Avios® lên đến 30%.",
          "Nếu Amex® MR là transferable currency mình ưu tiên đầu tiên, Avion® là một currency rất tốt để có thêm trong portfolio. Có nhiều point currencies đồng nghĩa với việc khi một chương trình không có award availability, bạn vẫn còn những lựa chọn khác.",
        ],
        bestForVi: "Người muốn diversify airline points.",
      },
      {
        slug: "td-first-class-travel-visa-infinite",
        roleVi: "Thẻ travel đơn giản nhất",
        bodyVi: [
          "Không phải ai cũng muốn tìm award availability hay muốn tìm hiểu về transfer partners.",
          "TD First Class Travel® giải quyết bài toán đó theo cách đơn giản hơn: earn điểm TD Rewards rồi dùng points cho travel, đặc biệt qua Expedia® For TD. Offer hiện tại lên đến 160,000 điểm TD Rewards, tương đương khoảng $800 travel khi redeem qua Expedia® For TD, cùng annual fee năm đầu được miễn.",
          "Bạn không có cơ hội đổi 70,000 points lấy Business Class trị giá vài nghìn đô như với Aeroplan®, nhưng cũng không phải mất thời gian săn award availability.",
        ],
        bestForVi: "Người muốn travel rewards đơn giản.",
        otherFiguresVi: {
          "70,000":
            "Con số ví dụ cho một redemption Aeroplan®, không phải welcome bonus của thẻ này — thẻ này không có mức 70,000 nào cả.",
        },
      },
      {
        slug: "scotiabank-passport-visa-infinite",
        roleVi: "Thẻ tốt nhất với no FX fee & lounge",
        bodyVi: [
          "Nếu thường xuyên đi nước ngoài, đây là một trong những thẻ travel thực dụng nhất. Scotiabank® Passport® Visa Infinite+ không tính foreign transaction fee và có 6 lượt airport lounge miễn phí mỗi năm. Welcome bonus hiện lên đến 35,000 điểm Scene+™ và annual fee $150.",
          "Điểm Scene+™ có fixed value 1 cent/point, nên 35,000 điểm về cơ bản tương đương $350 nếu sử dụng đúng cách. Không có upside lớn như Aeroplan®, nhưng rất dễ dùng.",
          "Điểm mình thích nhất vẫn là no FX fee. Phần lớn credit card Canada thu khoảng 2.5% foreign transaction fee, nên nếu mỗi năm bạn chi vài nghìn đô ở nước ngoài, khoản tiết kiệm này bắt đầu đáng kể.",
        ],
        bestForVi: "Người hay đi du lịch và muốn lounge + no FX fee.",
        otherFiguresVi: {
          $350: "Giá trị quy đổi tự tính: 35,000 điểm Scene+™ × 1 cent/point. Không phải con số ngân hàng công bố.",
        },
      },
      {
        slug: "amex-marriott-bonvoy",
        roleVi: "Thẻ khách sạn tốt nhất",
        bodyVi: [
          "Nếu thường xuyên ở Marriott Bonvoy®, thẻ Bonvoy® có một lợi thế mà rất ít travel card khác có: Free Night Award mỗi anniversary.",
          "Annual fee $120 và mỗi năm bạn nhận một Free Night Award trị giá 35,000 điểm Bonvoy®. Nếu redeem tại một khách sạn có cash rate cao hơn annual fee, riêng benefit này đã có thể justify việc giữ thẻ.",
          "Thẻ còn cấp 15 Elite Night Credits mỗi năm, hữu ích nếu đang chase Marriott Bonvoy® Platinum hoặc Titanium. Với 15 Elite Night thì bạn được tự động nhận Silver Elite Status với Marriott Bonvoy®.",
        ],
        bestForVi: "Những ai thích ở tại các khách sạn của Marriott Bonvoy®.",
        otherFiguresVi: {
          "35,000":
            "Giá trị quy đổi của Free Night Award — mức trần điểm của phiếu, không phải con số nằm trong entry Contentful của thẻ.",
        },
      },
      {
        slug: "wealthsimple-visa-infinite-privilege",
        roleVi: "Thẻ travel cashback dễ dùng nhất",
        bodyVi: [
          "Không phải travel rewards lúc nào cũng phải là points. Wealthsimple® Visa Infinite Privilege hoàn 2% trên mọi chi tiêu, không giới hạn, không tính foreign transaction fee và có 6 lượt DragonPass mỗi năm. Phí là $20/tháng nhưng được miễn nếu đáp ứng một số điều kiện của Wealthsimple®.",
          "Nếu bạn không muốn quan tâm category multiplier, transfer partner hay award chart, đây là một cách tiếp cận rất khác: cứ lấy 2% cashback và đi du lịch bằng tiền.",
        ],
        bestForVi: "Người muốn simplicity hơn là tối đa hóa Miles & Points.",
      },
    ],
    closingHeadingVi: "Nếu mình phải build một travel card setup thì sao?",
    closingVi: [
      "Mình sẽ không cố tìm một thẻ làm tất cả mọi thứ. Một setup hợp lý hơn có thể là Cobalt® để earn phần lớn transferable points, thêm một Visa hoặc Mastercard® cho những nơi không nhận Amex®, rồi chọn card thứ ba dựa trên benefit mình thực sự cần như lounge, no FX hoặc Air Canada® benefits.",
      "Miles & Points hiệu quả nhất khi mỗi thẻ có một nhiệm vụ rõ ràng, thay vì cố tìm một “best card” cho tất cả mọi người, đơn giản vậy thôi.",
    ],
    keywordsVi: "thẻ du lịch travel card tốt nhất lounge không phí ngoại tệ no fx",
  },
  {
    slug: "aeroplan",
    titleVi: "Thẻ Aeroplan® tốt nhất Canada",
    navTitleVi: "Thẻ Aeroplan® tốt nhất",
    metaDescriptionVi:
      "Bốn cách tích Aeroplan® bằng credit card ở Canada: thẻ cân bằng, thẻ premium có lounge, thẻ no-fee và thẻ earn nhanh nhất.",
    subtitleVi:
      "Mở thẻ Aeroplan® trực tiếp, hay tích Membership Rewards® rồi transfer sang? Cả hai đường đều có chỗ đứng.",
    introVi: [
      "Nếu mục tiêu chính của bạn là Aeroplan®, có hai cách để tích điểm bằng credit card: mở thẻ Aeroplan® trực tiếp hoặc dùng thẻ tích transferable points như American Express® Membership Rewards® rồi transfer sang Aeroplan®.",
      "Mình thực ra thích cách thứ hai hơn cho phần lớn chi tiêu hàng ngày, vì giữ points flexible cho đến khi cần redeem thường tốt hơn việc khóa toàn bộ points vào một chương trình. Nhưng Aeroplan® credit card lại có những quyền lợi với Air Canada® mà Amex® MR không thể thay thế được, đặc biệt là free checked bag, lounge access và một số benefit liên quan đến Aeroplan® status.",
    ],
    picks: [
      {
        slug: "td-aeroplan-visa-infinite",
        roleVi: "Thẻ tốt nhất",
        bodyVi: [
          "Nếu muốn một thẻ Aeroplan® tương đối cân bằng, đây là lựa chọn mình thích nhất cho phần lớn người dùng.",
          "Welcome bonus hiện tại lên đến 50,000 điểm Aeroplan® và annual fee $139 được miễn năm đầu. Thẻ earn 1.5 điểm Aeroplan®/$1 cho grocery, gas, EV charging và Air Canada®, cùng 1 điểm/$1 cho các chi tiêu khác.",
          "Quan trọng hơn là free first checked bag cho chủ thẻ và tối đa 8 người đi cùng trên cùng reservation. Chỉ cần gia đình bay Air Canada® vài lần một năm, benefit này đã có thể bù một phần đáng kể annual fee.",
        ],
        bestForVi:
          "Người bay Air Canada® vài lần mỗi năm và muốn một Aeroplan® card để giữ lâu dài.",
      },
      {
        slug: "amex-aeroplan-reserve",
        roleVi: "Thẻ Premium tốt nhất",
        bodyVi: [
          "Nếu Air Canada® là hãng bạn bay thường xuyên và lounge access quan trọng, Aeroplan® Reserve nằm ở một tier hoàn toàn khác.",
          "Welcome bonus hiện tại lên đến 85,000 điểm Aeroplan®. Thẻ earn 3X Aeroplan® trên Air Canada® và Air Canada Vacations®, 2X cho dining và food delivery tại Canada cùng chi tiêu tại khách sạn Hyatt®, 1.25X cho mọi chi tiêu khác, đồng thời có Maple Leaf Lounge® access, Priority Pass, hạng World of Hyatt® Discoverist và các quyền lợi priority airport.",
          "Đổi lại, annual fee là $599.",
          "Đây không phải thẻ mình khuyên mở chỉ để lấy points. Giá trị của nó nằm ở việc bạn thực sự sử dụng Air Canada® benefits nhiều lần trong năm. Nếu một năm chỉ bay Air Canada® một hai chuyến, rất khó justify $599 chỉ bằng lounge access.",
        ],
        bestForVi:
          "Người bay Air Canada® nhiều lần trong năm và cần checked bags cũng như lounge access.",
      },
      {
        slug: "cibc-aeroplan-visa",
        roleVi: "Thẻ No-Fee tốt nhất",
        bodyVi: [
          "Không có annual fee, welcome bonus lên đến 10,000 điểm Aeroplan® và chỉ yêu cầu thu nhập hộ gia đình $15,000.",
          "Tuy nhiên, đánh đổi lại là earn rate không đặc biệt cao: 1 điểm Aeroplan®/$1 cho grocery, gas, EV charging và Air Canada®, 1 điểm/$1.50 cho phần lớn chi tiêu còn lại. Nhưng đây không phải lý do mình chọn thẻ này.",
          "Điểm mạnh của nó đơn giản là bạn có thể giữ một Aeroplan® credit card mà không phải trả annual fee. Khi còn giữ thẻ, điểm Aeroplan® cũng không hết hạn.",
        ],
        bestForVi: "Người muốn một Aeroplan® card lâu dài với chi phí $0.",
      },
      {
        slug: "amex-cobalt",
        roleVi: "Thẻ tốt nhất cho chi tiêu hàng ngày",
        bodyVi: [
          "Cobalt® không phải Aeroplan® credit card, nhưng nếu câu hỏi thực sự là “thẻ nào giúp mình kiếm điểm Aeroplan® nhanh nhất từ chi tiêu hàng ngày?”, mình sẽ không bỏ nó khỏi danh sách.",
          "Cobalt® earn 5 điểm Membership Rewards®/$1 cho grocery, restaurant và food delivery đủ điều kiện tại Canada, và MR transfer sang Aeroplan® theo tỷ lệ 1:1. Nói cách khác, $1 grocery có thể trở thành 5 điểm Aeroplan®.",
          "Đây là lý do Cobalt® từ lâu vẫn là một trong những thẻ mình thích nhất tại Canada. Bạn không buộc phải transfer sang Aeroplan® ngay; MR vẫn có thể chuyển sang Avios® và nhiều chương trình khác. Khi tìm được redemption phù hợp mới transfer.",
          "Điểm yếu là welcome bonus hiện tại chỉ 15,000 điểm MR và annual fee đã lên $15.99/tháng, nên đây không phải thẻ để chase welcome bonus. Đây là thẻ để earn.",
        ],
        bestForVi:
          "Người có nhiều grocery và dining spend, muốn tích Aeroplan® lâu dài nhưng vẫn giữ points linh hoạt.",
      },
    ],
    closingHeadingVi: "Vậy nên chọn thẻ nào?",
    closingVi: [
      "Nếu mới bắt đầu và muốn một Aeroplan® card đúng nghĩa, mình nghiêng về TD® Aeroplan® Visa Infinite*. Nếu bay Air Canada® rất thường xuyên và sử dụng được lounge cùng priority benefits, hãy nhìn lên Aeroplan® Reserve. Nếu chỉ cần một Aeroplan® card miễn phí để giữ lâu dài, CIBC® Aeroplan® Visa* hợp lý hơn.",
      "Còn nếu mục tiêu chính là kiếm thật nhiều điểm Aeroplan® từ chi tiêu hàng ngày, Cobalt® mới là thẻ mình sẽ nhìn đầu tiên.",
      "Một portfolio Aeroplan® tốt vì vậy không nhất thiết chỉ có Aeroplan® cards. Với mình, kết hợp một thẻ earn MR tốt và một Aeroplan® card có airline benefits thường hợp lý hơn.",
    ],
    keywordsVi: "aeroplan air canada thẻ hàng không tích dặm bay checked bag",
  },
  {
    slug: "nguoi-moi",
    titleVi: "Thẻ tốt nhất cho người mới ở Canada",
    navTitleVi: "Thẻ cho người mới tốt nhất",
    metaDescriptionVi:
      "Thẻ đầu tiên nên dễ hiểu chứ không nhất thiết phải có welcome bonus lớn nhất. Bốn lựa chọn tuỳ theo điểm xuất phát.",
    subtitleVi:
      "Thẻ đầu tiên nên giúp bạn hiểu cách points hoạt động, không phải để chase con số bonus lớn nhất.",
    introVi: [
      "Nếu mới bắt đầu Miles & Points, mình không nghĩ mục tiêu nên là tìm thẻ có welcome bonus lớn nhất. Thẻ đầu tiên nên giúp bạn hiểu ba thứ: points kiếm như thế nào, points dùng như thế nào và bạn có thực sự thích chơi Miles & Points hay không.",
      "Quan trọng hơn, đừng mở nhiều thẻ cùng lúc chỉ vì thấy người khác làm vậy. Credit history quan trọng hơn bất kỳ welcome bonus nào.",
      "Do đó, dưới đây là những lựa chọn mình thấy dễ hiểu nhất tùy vào điểm xuất phát.",
    ],
    picks: [
      {
        slug: "amex-cobalt",
        roleVi: "Thẻ tốt nhất cho người mới",
        bodyVi: [
          "Cobalt® là một trong những thẻ dễ giúp bạn hiểu tại sao transferable points có giá trị. Bạn kiếm điểm Membership Rewards® thay vì bị khóa ngay vào Aeroplan® hay một airline program cụ thể. MR có thể chuyển sang Aeroplan® 1:1, nhưng bạn không cần transfer cho đến khi thực sự muốn book.",
          "Thẻ earn 5X ở grocery, restaurant và food delivery đủ điều kiện tại Canada. Đây cũng là những category mà nhiều người chi tiêu thường xuyên, nên bạn có thể thấy points tăng khá nhanh mà không cần thay đổi quá nhiều thói quen trong chi tiêu.",
          "Điểm trừ là annual fee $15.99/tháng và Amex® không được chấp nhận ở mọi nơi.",
        ],
        bestForVi: "Người muốn thực sự bắt đầu học Miles & Points.",
      },
      {
        slug: "cibc-aventura-gold-visa",
        roleVi: "Thẻ travel tốt nhất cho người mới",
        bodyVi: [
          "Nếu bạn chưa muốn bước vào transferable points và award availability, Aventura® Gold là một thẻ đơn giản hơn nhiều.",
          "Welcome bonus hiện tại lên đến 60,000 điểm Aventura®, annual fee $139 được miễn năm đầu và chỉ yêu cầu thu nhập hộ gia đình $15,000. Thẻ còn có 4 lượt airport lounge và rebate phí NEXUS™.",
          "Điểm Aventura® không có upside lớn như Aeroplan®, nhưng cũng vì vậy mà dễ hiểu hơn. Bạn không cần biết EVA Air® release award seat lúc nào hay Avios® transfer bonus bao nhiêu phần trăm mới dùng được points.",
        ],
        bestForVi: "Người muốn travel rewards nhưng chưa muốn học quá nhiều thứ cùng lúc.",
      },
      {
        slug: "cibc-aeroplan-visa",
        roleVi: "Thẻ No-Fee Aeroplan® Card",
        bodyVi: [
          "Nếu muốn bắt đầu với Aeroplan® nhưng không muốn trả annual fee, đây chính là thẻ bạn cần.",
          "Thẻ không có annual fee, yêu cầu thu nhập hộ gia đình $15,000 và welcome bonus hiện lên đến 10,000 điểm Aeroplan®.",
          "Earn rate không mạnh, vì vậy mình không xem đây là thẻ tối ưu để bỏ toàn bộ spending vào. Nhưng nó cho phép bạn bắt đầu làm quen với Aeroplan® mà không phải cân nhắc xem annual fee có đáng hay không.",
        ],
        bestForVi: "Người muốn thử Aeroplan® với chi phí thấp nhất.",
      },
      {
        slug: "scotiabank-scene-plus-visa-students",
        roleVi: "Thẻ tốt nhất cho Students",
        bodyVi: [
          "Nếu đang là student và mục tiêu đầu tiên là build credit history, một thẻ đơn giản và không annual fee thường quan trọng hơn việc tối ưu Miles & Points.",
          "Scotiabank® Scene+™ Visa* Card for Students không có annual fee, không yêu cầu minimum income và hiện có welcome bonus lên đến 5,000 điểm Scene+™.",
          "Điểm Scene+™ cũng rất dễ hiểu: về cơ bản 1 point có giá trị khoảng 1 cent khi redeem đúng cách. Bạn không cần học transfer partners hay award charts.",
        ],
        bestForVi: "Sinh viên đang mở credit card đầu tiên.",
      },
    ],
    closingHeadingVi: "Thẻ đầu tiên của bạn không cần phải hoàn hảo",
    closingVi: [
      "Nếu bạn mới sang Canada và chưa có credit history, trong trường hợp này, priority đầu tiên nên là build credit history đúng cách. Miles & Points có thể đến sau khi bạn đã hiểu được cơ bản về credit card.",
      "Một lỗi mình thấy khá phổ biến khi mới bắt đầu là cố tối ưu mọi thứ ngay lập tức: thẻ nào earn nhiều nhất, welcome bonus nào lớn nhất, transfer partner nào tốt nhất. Không cần.",
      "Nếu chọn Cobalt®, hãy học cách Membership Rewards® hoạt động. Nếu chọn Aeroplan® card, hãy hiểu cách Aeroplan® redemption hoạt động. Nếu chọn Scene+™ hay Aventura®, hãy học cách earn và redeem points trước.",
      "Sau vài tháng, khi hiểu mình thường chi tiêu ở đâu và muốn dùng points để làm gì, việc chọn thẻ thứ hai sẽ dễ hơn rất nhiều.",
      "Miles & Points không khó vì có quá nhiều thẻ. Nó khó khi bạn mở thẻ trước rồi mới bắt đầu nghĩ xem số points đó dùng để làm gì.",
    ],
    keywordsVi: "người mới newcomer sinh viên student thẻ đầu tiên mới sang canada build credit",
  },
];

export function bestCardsCategoryBySlug(slug: string): BestCardsCategory | undefined {
  return BEST_CARDS_CATEGORIES.find((category) => category.slug === slug);
}

/** Mọi slug thẻ mà mục này nhắc tới, theo thứ tự xuất hiện, không trùng. */
export function pickSlugs(category: BestCardsCategory): string[] {
  const out: string[] = [];
  for (const pick of category.picks) {
    for (const slug of [pick.slug, pick.alsoSlug]) {
      if (slug && !out.includes(slug)) out.push(slug);
    }
  }
  return out;
}

/**
 * Các thẻ của một pick, theo thứ tự `slug` rồi `alsoSlug` — hoặc mảng RỖNG nếu
 * thiếu bất kỳ thẻ nào.
 *
 * TẤT CẢ hoặc KHÔNG GÌ CẢ, cố ý. Một pick ghép hai thẻ có đoạn văn nói "cả hai
 * thẻ này đều đang có welcome bonus lên đến 70,000 điểm Avion®"; nếu bản
 * Infinite bị unpublish tay giữa hai lượt revalidate mà bản Platinum còn, cách
 * "bỏ qua thẻ thiếu" sẽ vẽ ra một mục nói về hai thẻ nhưng chỉ hiện một —
 * người đọc không có cách nào biết mình đang thiếu nửa nào. Bỏ hẳn mục thì
 * trang ngắn đi một khúc, mà mọi chữ còn lại vẫn đúng.
 *
 * `assertBestCardPicksExist` vẫn là cửa canh chính và nó chạy lúc build; đây
 * là lưới thứ hai cho khoảng thời gian giữa một lần unpublish và lần deploy
 * kế tiếp.
 */
export function pickOffers(pick: BestCardPick, offers: CreditCardOffer[]): CreditCardOffer[] {
  const slugs = [pick.slug, pick.alsoSlug].filter((slug): slug is string => Boolean(slug));
  const cards = slugs
    .map((slug) => offers.find((offer) => offer.slug === slug))
    .filter((offer): offer is CreditCardOffer => Boolean(offer));

  return cards.length === slugs.length ? cards : [];
}

/**
 * Tiêu đề của một mục thẻ, dựng từ dữ liệu sống.
 *
 * Tên thẻ và con số welcome bonus KHÔNG bao giờ gõ tay ở đây — chúng là hai
 * thứ đổi thường xuyên nhất, và một tiêu đề lệch là thứ người đọc nhìn thấy
 * đầu tiên. `headingVi` chỉ ghi đè phần TÊN, không ghi đè con số.
 */
export function pickHeading(
  pick: BestCardPick,
  cards: CreditCardOffer[],
  bonusInHeading: boolean,
): string {
  const names = pick.headingVi ?? cards.map((card) => card.name).join(" / ");
  if (pick.roleVi) return `${pick.roleVi}: ${names}`;
  const bonus = bonusInHeading ? cards[0]?.welcomeBonus : undefined;
  return bonus ? `${names} – ${bonus}` : names;
}

/** Thay `{expiresAt}` bằng ngày hết hạn thật của thẻ. */
const EXPIRES_TOKEN = "{expiresAt}";

/**
 * Đổ số liệu sống vào một đoạn viết tay.
 *
 * Chỉ có đúng một token, và nó tồn tại vì NGÀY là thứ duy nhất mà
 * `audit:best-cards` không kiểm được (nó chỉ quét số dạng `$X` và `X,XXX`).
 * Một ngày gõ tay sẽ trôi lặng đúng vào hôm ngân hàng gia hạn offer.
 *
 * KHÔNG có ngày dùng được thì bỏ CẢ CÂU chứa token, không phải chỉ token và
 * cũng không phải chỉ mệnh đề. Bản đầu cắt mệnh đề bằng regex dừng ở dấu phẩy,
 * mà dấu phẩy còn là dấu phân cách hàng nghìn: với câu "offer 110,000 điểm kết
 * thúc ngày {expiresAt}." nó cắt từ dấu phẩy trong "110,000" và để lại
 * "offer 110." trên trang. Bỏ cả câu thì không có ca nào vỡ được, đổi lại là
 * một luật cho người viết: **câu chứa `{expiresAt}` phải đứng riêng**, đừng
 * gói thông tin nào khác vào đó.
 *
 * "Không có ngày dùng được" gồm cả NGÀY ĐÃ QUA, không chỉ ngày vắng mặt. Job
 * `expire-offers` cố ý GIỮ `expiresAt` khi lượt viết lại copy hỏng (xem
 * AGENTS.md), nên một ngày chết vẫn nằm trong dữ liệu; `CardBadges` đã giấu nó
 * đi từ lâu, và nếu đoạn văn ngay bên dưới vẫn in "offer kết thúc ngày
 * 31/08/2026" thì hai chỗ trên cùng một màn hình nói hai điều khác nhau.
 */
export function resolveProse(paragraph: string, card: CreditCardOffer | undefined): string {
  if (!paragraph.includes(EXPIRES_TOKEN)) return paragraph;

  const live = card?.expiresAt && !hasExpired(card.expiresAt) ? card.expiresAt : undefined;
  if (live) return paragraph.replaceAll(EXPIRES_TOKEN, formatDate(live));

  // Cắt từ dấu chấm CUỐI CÙNG đứng trước token, không tách câu bằng regex.
  //
  // Bản trước `split(/(?<=\.)\s+/)` rồi bỏ mảnh chứa token. Nó đúng với nội
  // dung hiện có nhưng vỡ với chữ viết tắt: "Áp dụng tại TP. Hồ Chí Minh, offer
  // kết thúc {expiresAt}." bị tách ngay sau "TP." nên phần bỏ đi chỉ là nửa
  // sau, để lại "Áp dụng tại TP." trên trang. Không có cách tách câu nào đáng
  // tin cho tiếng Việt có viết tắt, nên đừng tách: `assertExpiryTokenIsLast`
  // ép token phải nằm ở câu CUỐI đoạn, và ở đó chỉ cần cắt tại dấu chấm cuối
  // cùng trước nó — phép cắt không còn phải hiểu câu là gì.
  const cut = paragraph.lastIndexOf(".", paragraph.indexOf(EXPIRES_TOKEN));
  return cut < 0 ? "" : paragraph.slice(0, cut + 1).trim();
}

/**
 * Câu chứa `{expiresAt}` phải là câu CUỐI của đoạn — cửa canh cho luật mà
 * `resolveProse` dựa vào. Chạy lúc `next build` qua `assertBestCardPicksExist`,
 * nên vi phạm làm deploy đỏ chứ không trôi ra production thành câu cụt.
 */
function assertExpiryTokenIsLast(): void {
  for (const category of BEST_CARDS_CATEGORIES) {
    for (const pick of category.picks) {
      for (const paragraph of pick.bodyVi) {
        const at = paragraph.indexOf(EXPIRES_TOKEN);
        if (at < 0) continue;
        // Sau token chỉ được còn đúng phần đuôi của chính câu đó: không có dấu
        // chấm nào nữa trừ dấu kết câu ở ngay cuối đoạn.
        const after = paragraph.slice(at + EXPIRES_TOKEN.length);
        if (after.trim() !== "." && !/^[^.]*\.$/.test(after.trim())) {
          throw new Error(
            `best-cards: ${category.slug} → ${pick.slug}: câu chứa {expiresAt} phải là câu CUỐI ` +
              `của đoạn (xem resolveProse) — "${paragraph.slice(Math.max(0, at - 40), at + 60)}"`,
          );
        }
      }
    }
  }
}

/**
 * Cửa canh chạy lúc `next build` — cùng chỗ đặt và cùng lý do với
 * `assertNoSlugClash` của trang so sánh và `assertNoPointsInProse` của các
 * trang chặng: slug hỏng phải làm deploy đỏ, chứ không phải làm một mục biên
 * tập lặng lẽ biến mất trên production.
 */
export function assertBestCardPicksExist(offers: CreditCardOffer[]): void {
  assertExpiryTokenIsLast();

  const known = new Set(offers.map((offer) => offer.slug));
  const missing: string[] = [];

  for (const category of BEST_CARDS_CATEGORIES) {
    for (const slug of pickSlugs(category)) {
      if (!known.has(slug)) missing.push(`${category.slug} → ${slug}`);
    }
  }

  if (missing.length) {
    throw new Error(
      `best-cards: không tìm thấy thẻ trên Contentful cho ${missing.length} mục — ${missing.join(", ")}`,
    );
  }

  assertNoSlugClash(offers, BEST_CARDS_RESERVED_SLUG, bestCardsSlugClashMessage());
}

/**
 * Mọi con số "biết drift" trong một chuỗi: tiền (`$139`, `$15.99`) và số có
 * dấu phân cách hàng nghìn (`70,000`).
 *
 * CỐ Ý KHÔNG bắt số nguyên nhỏ trần ("4 lượt lounge", "15 Elite Night", "2%").
 * Chúng là quyền lợi ổn định của thẻ và bắt chúng thì mỗi đoạn văn sẽ đẻ ra
 * mươi khai báo vô nghĩa — mà một audit kêu vì mọi thứ thì chẳng mấy chốc
 * không ai đọc nữa. Ba thứ đổi thật là welcome bonus, annual fee và rebate,
 * và cả ba đều mang một trong hai hình dạng trên.
 */
const FIGURE_RE = /\$\d+(?:,\d{3})*(?:\.\d+)?|\d{1,3}(?:,\d{3})+/g;

/**
 * `$1` một mình là MẪU SỐ của tỷ lệ tích điểm ("5 điểm Membership Rewards®/$1",
 * "1 điểm/$1.50"), không phải một con số đổi theo offer — không ngân hàng nào
 * đổi "trên mỗi đô la" thành cái khác. Bắt nó chỉ tạo ra một khai báo bắt buộc
 * trong mọi đoạn văn nói về earn rate, và một audit đòi khai báo cho hằng số
 * thì chẳng mấy chốc người ta khai bừa cho xong.
 *
 * HẸP ĐÚNG MỘT CHUỖI: `$2`, `$5`… vẫn bị bắt, vì chúng có thể là credit hay
 * phí thật. `$1.50` cũng vẫn bị bắt và vẫn đối chiếu được — nội dung thẻ
 * CIBC® Aeroplan® Visa* có sẵn câu "1 điểm cho mỗi $1.50 chi tiêu khác".
 */
const PER_DOLLAR = "$1";

export function figuresIn(text: string): string[] {
  return [...text.matchAll(FIGURE_RE)]
    .map((match) => match[0])
    .filter((figure) => figure !== PER_DOLLAR);
}

/**
 * `haystack` có chứa ĐÚNG con số này không — không phải "có chứa chuỗi này".
 *
 * `String.includes` một mình là một lỗ hổng thật, không phải giả định: "70,000"
 * nằm gọn trong "170,000", "$120" nằm gọn trong "$1200" và trong "$120,000".
 * Nghĩa là một đoạn văn viết sai con số vẫn báo xanh chỉ vì con số đúng ở
 * Contentful dài hơn nó — đúng loại im lặng mà audit này sinh ra để chặn.
 *
 * Chữ `$` đứng trước cũng làm hỏng phép so: "70,000 điểm" và "$70,000" là hai
 * điều khác hẳn nhau, nên một con số trần KHÔNG được khớp vào một con số tiền.
 */
export function containsFigure(haystack: string, figure: string): boolean {
  for (let from = 0; ; ) {
    const at = haystack.indexOf(figure, from);
    if (at < 0) return false;

    // Lùi qua khoảng trắng trước khi xét: "$ 70,000" có dấu cách giữa `$` và
    // số, nên chỉ nhìn đúng một ký tự liền trước thì con số TRẦN "70,000" vẫn
    // khớp vào một con số TIỀN — phá đúng cái bất biến hàm này dựng ra.
    const head = haystack.slice(0, at).replace(/\s+$/, "");
    const before = head.slice(-1);
    const after = haystack.slice(at + figure.length);
    // Bên trái: không dính chữ số, dấu phân cách hay dấu tiền.
    // Bên phải: không dính chữ số, và không dính "phần đuôi" của một con số
    // dài hơn (",000" hay ".50").
    if (!/[\d,.$]/.test(before) && !/^\d|^[.,]\d/.test(after)) return true;

    from = at + 1;
  }
}

/**
 * Những field của một entry mà `audit:best-cards` cần — không hơn.
 *
 * Kiểu riêng chứ không phải `CreditCardOffer`: script đọc CDA bằng `fetch`
 * trần (không đi qua `lib/content`, module đó kéo theo `next/cache` nên không
 * chạy ngoài Next), và ép một object thiếu nửa số field thành `CreditCardOffer`
 * là tự tay tắt TypeScript đúng chỗ nó đang canh giúp. Khai đúng thứ mình dùng
 * thì `CreditCardOffer` thật vẫn gán vào được, mà object dựng tay thì không
 * thể thiếu field nào trong im lặng.
 */
export type OfferFacts = Pick<
  CreditCardOffer,
  "slug" | "name" | "welcomeBonus" | "annualFee" | "rebate" | "headline" | "editorsTake" | "keyBenefits"
>;

/**
 * Ba field ĐỔI THEO OFFER, tách riêng khỏi `offerHaystack`.
 *
 * `sharedFiguresVi` khẳng định "cả hai thẻ đều có con số này", và thứ nó thật
 * sự canh là ngày ngân hàng hạ MỘT trong hai bản. So với cả `offerHaystack`
 * thì một con số cũ còn sót trong headline hay key benefit của thẻ vừa bị hạ
 * cũng đủ giữ audit xanh — tức là canh trượt đúng ca sinh ra nó.
 */
export function volatileHaystack(offer: OfferFacts): string {
  return [offer.welcomeBonus ?? "", offer.annualFee, offer.rebate ?? ""].join(" · ");
}

/** Toàn bộ chữ của một entry mà một con số trong prose có thể đối chiếu vào. */
export function offerHaystack(offer: OfferFacts): string {
  return [
    offer.name,
    offer.welcomeBonus ?? "",
    offer.annualFee,
    offer.rebate ?? "",
    offer.headline,
    offer.editorsTake,
    ...offer.keyBenefits,
  ].join(" · ");
}

/**
 * Những chữ trong `headingVi` mà một cái tên thẻ sống phải có.
 *
 * `headingVi` là chỗ DUY NHẤT trên bốn trang còn gõ tay tên thẻ — nó tồn tại vì
 * ghép trọn hai tên đầy đủ ra một tiêu đề dài gấp đôi ("CIBC® Aventura® Visa
 * Infinite* Card / CIBC® Aventura® Gold Visa* Card"). Đổi lại, ngân hàng đổi
 * tên thẻ trong Contentful thì tiêu đề ở đây trôi mà không có gì đỏ. Phép kiểm
 * này lấp đúng chỗ đó: mọi từ có nghĩa trong tiêu đề phải xuất hiện trong tên
 * thật của một trong các thẻ của mục.
 *
 * Bỏ ký hiệu ®/™/* và dấu gạch chéo trước khi so — chúng là trang trí, không
 * phải tên; và bỏ từ dưới 3 ký tự để "/" hay "of" không thành điều kiện.
 */
export function headingWords(heading: string): string[] {
  return heading
    .replace(/[®™*/–—]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

/**
 * Các mục "tốt nhất" mà một thẻ có mặt — chiều ngược của `pickSlugs`.
 *
 * Trang chi tiết thẻ dùng nó để trỏ ngược lên. Không có nó thì bốn trang này
 * chỉ có đúng hai cửa vào (menu và trang tổng), trong khi chúng nói về những
 * thẻ đã có sẵn trang riêng — đúng loại lỗ hổng mà `audit:links` sinh ra để
 * bắt (xem `siblingCardsInProgram`).
 */
export function categoriesFeaturing(slug: string): BestCardsCategory[] {
  return BEST_CARDS_CATEGORIES.filter((category) => pickSlugs(category).includes(slug));
}

/**
 * Mọi chỗ bốn trang này nói lệch với dữ liệu thẻ đang publish.
 *
 * Hàm THUẦN, và cố ý sống ở đây chứ không sống trong script: nó có hai người
 * gọi. `npm run audit:best-cards` là bản chạy tay, cho lúc đang ngồi sửa nội
 * dung; còn `/api/check-rebates` gọi nó hai lượt mỗi ngày trên server, và đó
 * mới là thứ biến phép so này thành báo động dai. Runner của GitHub Actions
 * không có token Contentful — chỉ server có — nên một workflow riêng chạy
 * script sẽ không đọc được gì; cùng lý do đã ghi trong `check-rebates.yml`.
 *
 * Không có nó, một welcome bonus đổi lúc 3 giờ sáng sẽ được ISR cập nhật ở
 * phần số liệu sống trong vòng một phút, còn câu văn ngay bên dưới nói con số
 * cũ thì nằm đó tới chừng nào có người tình cờ chạy audit tay.
 */
export function bestCardsProseDrift(offers: OfferFacts[]): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const bySlug = new Map(offers.map((offer) => [offer.slug, offer]));

  /** Con số phải có mặt trong entry của một thẻ — hoặc của MỌI thẻ, nếu người
   *  viết đã khai nó ở `sharedFiguresVi`. Xem chú thích của field đó. */
  function checkProse(
    where: string,
    paragraphs: string[],
    cards: OfferFacts[],
    declared: Record<string, string> | undefined,
    shared: string[] = [],
  ): Set<string> {
    const haystacks = cards.map(offerHaystack);
    // Con số khai ở `sharedFiguresVi` so với BA FIELD hay đổi, không so với cả
    // entry — xem `volatileHaystack`.
    const volatile_ = cards.map(volatileHaystack);
    const used = new Set<string>();

    for (const paragraph of paragraphs) {
      for (const figure of figuresIn(paragraph)) {
        const everywhere = shared.includes(figure);
        const ok = everywhere
          ? volatile_.every((hay) => containsFigure(hay, figure))
          : haystacks.some((hay) => containsFigure(hay, figure));
        if (ok) continue;
        if (!everywhere && declared && figure in declared) {
          used.add(figure);
          continue;
        }
        const which = everywhere ? "MỌI thẻ (khai ở sharedFiguresVi)" : "thẻ nào";
        const at = paragraph.indexOf(figure);
        const snippet = paragraph
          .slice(Math.max(0, at - 35), at + figure.length + 35)
          .trim();
        errors.push(
          `${where}: con số ${figure} không có trong Contentful của ${which} — ` +
            `${cards.map((card) => card.slug).join(", ")} — “…${snippet}…”`,
        );
      }
    }

    return used;
  }

  for (const category of BEST_CARDS_CATEGORIES) {
    const label = `tot-nhat/${category.slug}`;

    for (const slug of pickSlugs(category)) {
      if (!bySlug.has(slug)) {
        errors.push(`${label}: không tìm thấy thẻ "${slug}" trong số thẻ đang publish`);
      }
    }

    const categoryCards = pickSlugs(category)
      .map((slug) => bySlug.get(slug))
      .filter((card): card is OfferFacts => Boolean(card));

    // Đoạn mở đầu và đoạn kết nói về cả mục, nên một thẻ khớp là đủ.
    checkProse(`${label} (mở đầu)`, category.introVi, categoryCards, undefined);
    checkProse(`${label} (kết)`, category.closingVi, categoryCards, undefined);

    for (const pick of category.picks) {
      const slugs = [pick.slug, pick.alsoSlug].filter((slug): slug is string => Boolean(slug));
      const cards = slugs
        .map((slug) => bySlug.get(slug))
        .filter((card): card is OfferFacts => Boolean(card));
      // Thiếu thẻ đã báo ở vòng trên.
      if (cards.length !== slugs.length) continue;

      // `headingVi` là chỗ duy nhất còn gõ tay tên thẻ — xem `headingWords`.
      if (pick.headingVi) {
        const names = cards.map((card) => card.name).join(" ");
        const stray = headingWords(pick.headingVi).filter((word) => !names.includes(word));
        if (stray.length) {
          errors.push(
            `${label} → ${pick.slug}: headingVi có chữ không còn trong tên thẻ trên ` +
              `Contentful (${stray.join(", ")}) — tên hiện tại là “${names}”`,
          );
        }
      }

      const used = checkProse(
        `${label} → ${pick.slug}`,
        [...pick.bodyVi, pick.bestForVi],
        cards,
        pick.otherFiguresVi,
        pick.sharedFiguresVi,
      );

      const proseText = [...pick.bodyVi, pick.bestForVi].join(" ");
      for (const figure of pick.sharedFiguresVi ?? []) {
        if (!proseText.includes(figure)) {
          warnings.push(
            `${label} → ${pick.slug}: khai sharedFiguresVi "${figure}" nhưng con số đó ` +
              `không còn trong đoạn văn — xoá khai báo đi`,
          );
        }
      }

      for (const figure of Object.keys(pick.otherFiguresVi ?? {})) {
        if (!used.has(figure)) {
          warnings.push(
            `${label} → ${pick.slug}: khai otherFiguresVi["${figure}"] nhưng con số đó không ` +
              `còn trong đoạn văn (hoặc nay đã khớp Contentful) — xoá khai báo đi`,
          );
        }
      }
    }
  }

  return { errors, warnings };
}
