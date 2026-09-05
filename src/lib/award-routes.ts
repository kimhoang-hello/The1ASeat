import {
  CABINS,
  DESTINATIONS,
  ORIGINS,
  PROGRAMS,
  quoteRoute,
  type Airport,
  type Cabin,
  type Quote,
} from "./award-charts";

/**
 * Mười hai chặng Canada → Việt Nam, mỗi chặng một trang riêng.
 *
 * Vì sao chúng tồn tại: Award Flight Finder có sẵn số điểm thật cho 112 chặng,
 * nhưng cả công cụ sống ở ĐÚNG MỘT URL và cây con của nó render ở client (nó
 * đọc `useSearchParams`). Với người đọc thì tốt; với Google thì toàn bộ dữ
 * liệu đó không tồn tại. Đo 02/09/2026: "Canada đi Việt Nam" là truy vấn được
 * dùng nhiều nhất trên chính công cụ đó (68 lượt xem) mà không có một trang
 * nào đứng sau nó.
 *
 * Vì sao chỉ mười hai, không phải 112: 112 trang sinh ra từ cùng một khuôn,
 * khác nhau mỗi con số, là doorway page — Google phạt đúng loại đó. Mỗi trang
 * ở đây mang một đoạn viết tay nói điều mà bảng không nói được, nên số trang
 * bị chặn bởi số đoạn viết thật. Bốn thành phố là bốn nơi GA4 đo thấy độc giả
 * đang ngồi (Toronto, Mississauga, Vancouver, Montréal, Calgary), ba điểm đến
 * là ba sân bay Việt Nam mà công cụ có dữ liệu.
 */

/**
 * Tên thành phố dùng cho URL và tiêu đề. CỐ Ý không lấy từ `AIRPORTS[].city`.
 *
 * Hai lý do, cả hai đều đã suýt vấp ở chỗ khác trong repo này:
 *
 *  - **URL là hợp đồng vĩnh viễn.** `AIRPORTS[].city` là chuỗi hiển thị của
 *    công cụ; ai đó rút gọn "TP. Hồ Chí Minh" thành "TP.HCM" là bốn URL đã
 *    được index đổi theo, im lặng, và không có gì đỏ.
 *  - **Người đọc gõ "Sài Gòn".** Trang này tồn tại để đón đúng truy vấn tiếng
 *    Việt đó. Công cụ vẫn in tên hành chính, và mã sân bay (SGN) đứng cạnh ở
 *    cả hai chỗ nên không ai lạc giữa hai cách gọi.
 */
const CITY_LABELS: Record<string, { name: string; slug: string; aliases?: string }> = {
  YYZ: { name: "Toronto", slug: "toronto" },
  YVR: { name: "Vancouver", slug: "vancouver" },
  YUL: { name: "Montréal", slug: "montreal" },
  YYC: { name: "Calgary", slug: "calgary" },
  SGN: { name: "Sài Gòn", slug: "sai-gon", aliases: "Saigon TPHCM Hồ Chí Minh Ho Chi Minh City" },
  HAN: { name: "Hà Nội", slug: "ha-noi", aliases: "Hanoi" },
  DAD: { name: "Đà Nẵng", slug: "da-nang", aliases: "Danang Da Nang" },
};

/**
 * Cách gọi khác mà người đọc gõ vào ô tìm kiếm nhưng KHÔNG có trong tên chặng.
 *
 * Chỉ những cách viết mà phép so không tự bắc cầu được. `slugifyVi` bỏ dấu ở
 * cả hai vế nên "Montréal" đã tự khớp với "montreal", nhưng nó cũng biến
 * "Hà Nội" thành hai chữ `ha-noi`, mà "hanoi" viết liền thì không nằm trong đó
 * — nên "Hanoi" phải ghi ra. Cùng lý do với "Saigon" và "Danang".
 *
 * Mã sân bay không nằm ở đây: chúng đã có sẵn trên `route.origin.code` /
 * `route.destination.code`, xem `routeSearchKeywords`.
 */

export const VIETNAM_ROUTES_BASE = "/bay-ve-viet-nam";

export type VietnamRoute = {
  slug: string;
  origin: Airport;
  destination: Airport;
  /** Nhãn dùng trong tiêu đề và câu chữ — xem `CITY_LABELS`. */
  originName: string;
  destinationName: string;
  /**
   * Đoạn viết tay cho riêng chặng này: thứ cái bảng bên dưới không nói được.
   *
   * LUẬT: **không được chứa con số điểm.** Bảng ngay trên đoạn này tính số
   * từ `quoteRoute()` lúc render, nên một con số gõ tay ở đây sẽ trôi lặng
   * đúng vào ngày chương trình devalue — cùng kiểu hỏng mà
   * `audit:rebate-prose` đã phải sinh ra để canh bên tài khoản ngân hàng.
   * `assertNoPointsInProse()` bên dưới canh luật này, và `audit:awards` gọi nó.
   *
   * Việc của đoạn này là phần bảng KHÔNG làm được: vì sao chỉ chương trình đó
   * bay được chặng này, vì sao Đà Nẵng chỉ còn một lựa chọn, vì sao Calgary
   * đắt hơn Vancouver trên cùng những chuyến bay đó.
   */
  bodyVi: string[];
};

const airport = (list: Airport[], code: string): Airport => {
  const found = list.find((a) => a.code === code);
  if (!found) throw new Error(`award-routes: không có sân bay ${code}`);
  return found;
};

function route(originCode: string, destinationCode: string, bodyVi: string[]): VietnamRoute {
  const origin = CITY_LABELS[originCode];
  const destination = CITY_LABELS[destinationCode];
  return {
    slug: `${origin.slug}-${destination.slug}`,
    origin: airport(ORIGINS, originCode),
    destination: airport(DESTINATIONS, destinationCode),
    originName: origin.name,
    destinationName: destination.name,
    bodyVi,
  };
}

/** Ba câu dùng lại ở cả bốn chặng đi Đà Nẵng: lý do giống hệt nhau ở cả bốn,
 *  và viết khác đi bốn lần chỉ để trông khác nhau là đúng thứ doorway page hay
 *  làm. Phần riêng của từng chặng nằm ở các đoạn sau nó. */
const DA_NANG_NETWORK =
  "Đà Nẵng là điểm đến hẹp nhất trong ba sân bay Việt Nam mà công cụ có dữ liệu. " +
  "Cathay Pacific® đã bỏ chặng Hong Kong – Đà Nẵng và Qatar Airways® không bay Doha – Đà Nẵng, " +
  "nên American Airlines® AAdvantage®, Asia Miles® và cả hai chương trình Avios® không còn " +
  "một đường bay nào tới đây. Đó không phải \"chưa công bố giá\" — là không có chuyến, và bảng " +
  "bên dưới nói rõ hai chuyện đó khác nhau.";

const DA_NANG_REMAINING =
  "Còn lại hai hướng. Star Alliance™ đi qua Seoul với Asiana Airlines® hoặc qua Đài Bắc với " +
  "EVA Air® — đó là hướng Aeroplan® tra được giá trước. SkyTeam đi qua Paris hoặc Amsterdam rồi " +
  "nối tiếp bằng Vietnam Airlines®: đường bay có thật, phần \"Đường bay có thật\" bên dưới liệt " +
  "kê đủ, nhưng Flying Blue® định giá hoàn toàn động nên không con số nào tra trước được.";

const PREMIUM_GAP =
  "Không có Premium Economy trên trang này, và đó không phải chỗ thiếu dữ liệu: bảng partner của " +
  "Aeroplan® chỉ in ba hạng Economy, Business và First. Premium Economy chỉ tồn tại ở cột giá động " +
  "của Air Canada®, mà cột đó không áp cho chuyến bay của partner.";

/** Cảnh báo dùng lại ở ba chặng mà AAdvantage® đứng đầu bảng. CỐ Ý không ghi
 *  tỷ lệ chuyển ra đây: tỷ lệ nằm ở cột "Chuyển từ" trong bảng, lấy thẳng từ
 *  `transfer-partners.ts`, nên chép nó vào chữ là tạo ra một con số thứ hai
 *  trôi được. */
const AADVANTAGE_CATCH =
  "Con số thấp nhất trên bảng thuộc về American Airlines® AAdvantage®, và đây đúng chỗ cần đọc kỹ. " +
  "AAdvantage® tính theo vùng chứ không theo quãng đường, nên nó ra cùng một giá cho mọi điểm đến ở " +
  "Đông Nam Á. Nhưng đường duy nhất để một người ở Canada có AAdvantage® là chuyển từ RBC Avion®, " +
  "chỉ bậc Avion® Elite mới chuyển được, và tỷ lệ không phải một đổi một — cột \"Chuyển từ\" trong " +
  "bảng ghi tỷ lệ thật. Nhân tỷ lệ đó vào thì con số rẻ nhất trên bảng không còn là con số rẻ nhất " +
  "trong ví bạn.";

export const VIETNAM_ROUTES: VietnamRoute[] = [
  route("YYZ", "SGN", [
    "Từ Toronto, đây là chặng có nhiều lựa chọn nhất trong cả mười hai trang này: Cathay Pacific® bay thẳng Toronto – Hong Kong rồi nối tiếp về Tân Sơn Nhất, Qatar Airways® bay thẳng Toronto – Doha, EVA Air® đi qua Đài Bắc, và Air China® qua Bắc Kinh. Bốn hub, bốn liên minh khác nhau — nên bốn trong sáu chương trình đều báo được giá.",
    AADVANTAGE_CATCH,
    "Aeroplan® đi hướng ngược lại: giá cao hơn trên bảng, nhưng chuyển một đổi một từ Amex Membership Rewards® trong khoảng ba mươi phút, và surcharge của Aeroplan® trên chặng partner thuộc loại thấp. Với phần lớn người đọc site này, đó mới là đường thật sự đi được.",
    "Asia Miles® của Cathay Pacific® nằm giữa hai nhóm trên. Chương trình này đã rút bảng giá xuống khỏi trang chính thức của mình từ lâu; số trong bảng dưới đây dựng lại từ ba nguồn độc lập cùng khớp nhau, và mỗi hàng đều ghi rõ mức độ tin cậy của chương trình đó.",
  ]),

  route("YYZ", "HAN", [
    "Toronto về Hà Nội đi qua đúng những hub như chặng về Sài Gòn — Hong Kong với Cathay Pacific®, Doha với Qatar Airways®, Đài Bắc với EVA Air®, Bắc Kinh với Air China® — và các bảng giá đều xếp Hà Nội cùng một vùng, cùng một bậc quãng đường với Sài Gòn. Nên nếu bạn đang phân vân giữa hai thành phố, số điểm không phải thứ để chọn giữa chúng.",
    "Một khác biệt có thật: Air France® bay tới Tân Sơn Nhất nhưng không bay tới Nội Bài. Đường SkyTeam về Hà Nội vì thế phải nối tiếp bằng Vietnam Airlines® từ Paris hoặc Amsterdam. Điều đó không đổi con số trong bảng — Flying Blue® định giá hoàn toàn động, không có bảng nào để tra trước — nhưng nó đổi chuyện bạn đi tìm chỗ trống ở đâu.",
    AADVANTAGE_CATCH,
  ]),

  route("YYZ", "DAD", [
    DA_NANG_NETWORK,
    DA_NANG_REMAINING,
    "Từ Toronto, hai hành trình Aeroplan® là Toronto – Đài Bắc – Đà Nẵng, EVA Air® bay cả hai chặng; và Toronto – Seoul – Đà Nẵng, trong đó chặng cuối cần Asiana Airlines® còn chặng đầu là Air Canada®, vì Asiana đã rút hẳn khỏi Canada.",
    PREMIUM_GAP,
    "Nếu ngày bay linh động, đáng so thêm phương án bay về Sài Gòn hoặc Hà Nội rồi mua vé nội địa Việt Nam bằng tiền — vé nội địa rẻ, và bảng ở trang chặng Sài Gòn có bốn chương trình cạnh tranh nhau thay vì một.",
  ]),

  route("YVR", "SGN", [
    "Vancouver là điểm xuất phát rẻ nhất Canada để về Việt Nam bằng điểm, và lý do là hình học chứ không phải khuyến mãi. Vancouver – Hong Kong – Tân Sơn Nhất vừa đủ nằm dưới mốc chia bậc mà cả bảng của Aeroplan® lẫn bảng của Asia Miles® dùng; cùng những chuyến bay ấy khởi hành từ Toronto thì vượt mốc và nhảy lên bậc trên. Cột quãng đường trong phần \"Đường bay có thật\" bên dưới cho thấy chênh lệch.",
    "Asia Miles® của Cathay Pacific® vì thế cho con số thấp nhất ở hạng Economy trong cả mười hai trang này. Cathay bay cả hai chặng bằng máy bay của chính mình qua Hong Kong, nên đây là bảng giá dành cho chuyến bay nội bộ của họ — bảng partner đắt hơn.",
    "Vancouver cũng là cửa ngõ duy nhất của ANA® ở Canada, nên đường qua Tokyo mở ra ở đây mà không có ở Toronto hay Montréal. Cộng thêm EVA Air® qua Đài Bắc và Air China® qua Bắc Kinh, Aeroplan® có sáu hành trình khác nhau cho chặng này — tất cả cùng một giá, vì bảng của Aeroplan® tính theo quãng đường chứ không theo hãng.",
    "Ngược lại, Qatar Airways® không bay từ Vancouver. Muốn đi qua Doha thì phải bay ngược về Montréal trước, và quãng đường đó đẩy hành trình lên mức dài nhất trong bảng — vẫn tính được, nhưng không còn là lựa chọn hợp lý.",
  ]),

  route("YVR", "HAN", [
    "Cũng như chặng Vancouver – Sài Gòn, chặng này nằm gọn dưới mốc chia bậc mà Aeroplan® và Asia Miles® dùng — nên nó ăn bậc rẻ, trong khi cùng hành trình ấy xuất phát từ Toronto thì không. Đây là lợi thế lớn nhất của người đọc ở Vancouver, và nó có thật trên mọi hạng ghế.",
    "Cathay Pacific® bay Hong Kong – Nội Bài, nên Asia Miles® báo giá được. ANA® nối Tokyo – Hà Nội và Vancouver là cửa ngõ duy nhất của ANA® ở Canada. EVA Air® đi qua Đài Bắc, Air China® qua Bắc Kinh, Asiana Airlines® qua Seoul với chặng đầu bay Air Canada®.",
    "American Airlines® AAdvantage® vẫn ra con số thấp nhất ở hạng Business vì nó tính theo vùng và không quan tâm bạn khởi hành từ đâu. Nhưng lợi thế quãng đường của Vancouver chỉ có tác dụng với hai chương trình tính theo dặm — và đường tới AAdvantage® từ Canada chỉ có một, qua RBC Avion® Elite, ở tỷ lệ ghi trong cột \"Chuyển từ\". Đó là chỗ đáng so kỹ trước khi chuyển điểm đi đâu.",
  ]),

  route("YVR", "DAD", [
    DA_NANG_NETWORK,
    DA_NANG_REMAINING,
    "Từ Vancouver, hai hành trình Aeroplan® là Vancouver – Đài Bắc – Đà Nẵng do EVA Air® bay cả hai chặng, và Vancouver – Seoul – Đà Nẵng với Air Canada® ở chặng đầu rồi Asiana Airlines® nối tiếp. Cả hai đều nằm dưới mốc chia bậc của Aeroplan®, nên đây là con số rẻ nhất để về Đà Nẵng bằng điểm từ bất cứ đâu ở Canada.",
    PREMIUM_GAP,
    "Vì chỉ có một chương trình tra được giá, chỗ để xoay không nằm ở việc chọn chương trình mà ở việc chọn ngày. Aeroplan® giữ giá cố định cho chuyến bay của partner, nên chỗ trống mới là thứ quyết định — không phải giá.",
  ]),

  route("YUL", "SGN", [
    "Montréal có một thứ Toronto cũng có và Vancouver thì không: chuyến bay thẳng của Qatar Airways® tới Doha. Đó là đường ngắn nhất từ Québec về Việt Nam trên một hãng duy nhất, và nó mở ra hai chương trình cùng lúc — AAdvantage® tính theo vùng, và Privilege Club của chính Qatar.",
    "Đổi lại, Cathay Pacific® không bay từ Montréal. Asia Miles® vẫn có đúng một hành trình, nhưng phải bay Air Canada® tới Toronto trước — mà bảng của Asia Miles® ngừng áp dụng ngay khi vé có chặng nội địa Canada trong đó. Ô đó để trống vì lý do ấy, không phải vì thiếu chuyến bay.",
    "Chuyện tương tự với Aeroplan®: cả sáu hành trình của nó đều mở đầu bằng một chặng Air Canada® tới Toronto hoặc Vancouver. Aeroplan® là chương trình duy nhất tính chặng nội địa đó chung vào một vé award, nên nó vẫn báo được giá — nhưng quãng đường cộng thêm đẩy hành trình lên bậc trên, và đó là lý do Montréal đắt hơn Vancouver dù cùng bay những chiếc máy bay ấy ở chặng dài.",
    "Air France® thì bay thẳng Montréal – Paris – Tân Sơn Nhất, không cần chặng nội địa nào. Đường đó có thật và bảng liệt kê đủ, nhưng Flying Blue® định giá hoàn toàn động nên không tra trước được.",
    AADVANTAGE_CATCH,
  ]),

  route("YUL", "HAN", [
    "Chuyến bay thẳng Montréal – Doha của Qatar Airways® nối tiếp được tới Nội Bài, nên từ Québec đây là hành trình ít chặng nhất về Hà Nội. AAdvantage® định giá nó theo vùng, còn Privilege Club của Qatar có một mức cố định riêng cho đường qua Doha.",
    "Cathay Pacific® không bay từ Montréal, nên hành trình Asia Miles® duy nhất phải qua Toronto bằng Air Canada® — và bảng của Asia Miles® ngừng áp dụng khi vé có chặng nội địa Canada. Khác hẳn cùng chặng khởi hành từ Toronto hay Vancouver, nơi Asia Miles® là một trong những lựa chọn rẻ nhất.",
    "Air France® bay từ Montréal nhưng không tới Nội Bài, nên đường SkyTeam về Hà Nội cần Vietnam Airlines® nối tiếp từ Paris hoặc Amsterdam. Flying Blue® định giá động hoàn toàn, không có bảng nào tra trước được — trang nói thẳng điều đó thay vì đoán một con số.",
    "Aeroplan® có nhiều hành trình nhất, nhưng tất cả đều bay Air Canada® tới Toronto hoặc Vancouver trước, và quãng đường cộng thêm đó đẩy chặng lên bậc giá trên.",
  ]),

  route("YUL", "DAD", [
    DA_NANG_NETWORK,
    DA_NANG_REMAINING,
    "Từ Montréal, hai hành trình Aeroplan® đều phải bay Air Canada® tới Toronto trước rồi mới nối tiếp qua Seoul hoặc Đài Bắc. Đó là chỗ quan trọng: một hành trình có chặng nội địa Canada chỉ được Aeroplan® tính chung thành một vé award. Các chương trình khác coi chặng nội địa đó là vé riêng hoặc tính lại giá — nên kể cả khi chúng có đường bay, không con số nào ở đây trung thực được cho chúng.",
    "Hướng SkyTeam thì ngược lại: Air France® và KLM® đều bay thẳng từ Montréal, không cần chặng nội địa nào, rồi Vietnam Airlines® nối tiếp về Đà Nẵng. Chỉ có điều Flying Blue® không công bố bảng giá nào.",
    PREMIUM_GAP,
  ]),

  route("YYC", "SGN", [
    "Calgary không có chuyến bay thẳng nào tới châu Á. Mọi hành trình tra được giá trên trang này đều bắt đầu bằng một chặng Air Canada® tới Vancouver — hoặc tới Montréal nếu đi đường Doha — và chính chi tiết đó quyết định trang này trông khác hẳn ba thành phố kia. Ngoại lệ duy nhất là KLM®, hãng bay thẳng Calgary – Amsterdam; nhưng Flying Blue® định giá động nên đường đó cũng không tra trước được.",
    "Chỉ Aeroplan® tính một hành trình có chặng nội địa Canada thành một vé award duy nhất. AAdvantage®, Asia Miles® và hai chương trình Avios® đều coi chặng Calgary – Vancouver là vé riêng hoặc tính lại giá, nên không có con số nào ở đây đáng tin cho chúng — và trang để trống thay vì đưa ra một con số nghe hợp lý mà sai.",
    "Cái giá của chặng nối đó đo được: cộng quãng đường Calgary – Vancouver vào là hành trình vượt mốc chia bậc của Aeroplan® và nhảy lên bậc trên. Cùng những chuyến bay xuyên Thái Bình Dương ấy, khởi hành từ Vancouver thì nằm ở bậc dưới.",
    "Nếu bạn ở Calgary và ngày bay linh động, có một cách đáng cân nhắc: mua riêng vé Calgary – Vancouver bằng tiền rồi đổi điểm cho phần còn lại từ Vancouver. Cách đó mở lại cả bốn chương trình đang bị khoá ở đây, nhưng đổi lại bạn tự chịu rủi ro trễ chuyến giữa hai vé rời — không có bảo vệ nối chuyến nào giữa chúng.",
  ]),

  route("YYC", "HAN", [
    "Từ Calgary, Hà Nội rẻ hơn Sài Gòn — và không phải vì khuyến mãi. Hành trình Calgary – Vancouver – hub – Nội Bài vừa đủ nằm dưới mốc chia bậc mà bảng của Aeroplan® dùng, còn cùng hành trình ấy về Tân Sơn Nhất thì vượt mốc. Chênh lệch giữa hai bậc lớn hơn giá một chuyến bay nội địa Việt Nam rất nhiều.",
    "Như mọi chặng khởi hành từ Calgary: mọi hành trình tra được giá đều mở đầu bằng một chặng Air Canada® tới Vancouver, và chỉ Aeroplan® tính chặng nội địa đó chung vào một vé award. Bốn chương trình còn lại để trống không phải vì thiếu chuyến bay mà vì bảng giá của chúng ngừng áp dụng ngay khi có chặng nội địa trong vé.",
    "Sáu hành trình Aeroplan® cho chặng này đi qua Bắc Kinh, Seoul, Thượng Hải, Tokyo Haneda, Tokyo Narita và Đài Bắc. Tất cả cùng một giá, vì bảng tính theo quãng đường chứ không theo hãng — nên hãy chọn theo chỗ trống và theo hãng bạn muốn bay, đừng chọn theo giá.",
  ]),

  route("YYC", "DAD", [
    DA_NANG_NETWORK,
    DA_NANG_REMAINING,
    "Cộng thêm đặc điểm của Calgary — không có chuyến bay thẳng nào tới châu Á — thì hướng Aeroplan® chỉ còn hai hành trình, cả hai đều mở đầu bằng một chặng Air Canada® tới Vancouver rồi nối tiếp qua Seoul hoặc Đài Bắc. Hướng SkyTeam thì KLM® bay thẳng Calgary – Amsterdam rồi Vietnam Airlines® về Đà Nẵng, không cần chặng nội địa nào — nhưng vẫn không có giá tra trước.",
    "Điểm sáng là quãng đường: hành trình Aeroplan® từ Calgary về Đà Nẵng nằm dưới mốc chia bậc, nên nó ăn bậc rẻ — ngang với chặng Calgary – Hà Nội và rẻ hơn chặng Calgary – Sài Gòn.",
    PREMIUM_GAP,
  ]),
];

export const vietnamRoutePath = (slug: string) => `${VIETNAM_ROUTES_BASE}/${slug}`;

export const vietnamRouteBySlug = (slug: string) =>
  VIETNAM_ROUTES.find((r) => r.slug === slug);

/** Nhãn hiển thị của một chặng: "Toronto → Sài Gòn". */
export const routeLabel = (r: VietnamRoute) => `${r.originName} → ${r.destinationName}`;

/**
 * Chuỗi để ô tìm kiếm khớp một chặng: mã sân bay hai đầu và những cách gọi
 * khác của hai thành phố. Chỉ khớp, không hiện ra — xem `SearchItem.keywords`.
 *
 * Tên thành phố và tên chặng đã nằm trong tiêu đề của mục tìm kiếm, còn "bay
 * về Việt Nam" nằm ở `meta`, nên chỗ này chỉ chứa phần hai nơi đó không có:
 * gõ "YYZ SGN" hay "sai gon" là ra đúng trang chặng.
 */
export function routeSearchKeywords(r: VietnamRoute): string {
  const aliases = (code: string) => CITY_LABELS[code]?.aliases ?? "";
  return [
    r.origin.code,
    r.destination.code,
    aliases(r.origin.code),
    aliases(r.destination.code),
    "vé máy bay đổi điểm",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Giá rẻ nhất của mỗi hạng ghế, dùng cho ô số liệu đầu trang và cho trang
 *  tổng. `null` khi không chương trình nào báo giá được hạng đó — chuyện có
 *  thật ở cả bốn chặng đi Đà Nẵng và mọi chặng từ Calgary. */
export type CheapestByCabin = {
  cabin: Cabin;
  labelKey: string;
  points: number | null;
  startingAt: boolean;
  programName: string | null;
  programLogo: string | null;
  /**
   * Tên LOẠI ĐIỂM, không phải tên chương trình: "Aeroplan®" chứ không phải
   * "Air Canada® Aeroplan®".
   *
   * Con số đứng một mình không nói nó là điểm của ai — 37,500 AAdvantage® và
   * 37,500 Aeroplan® không đổi được cho nhau, mà bảng thì xếp chúng cùng một
   * cột. Dùng `currency` chứ không dùng `name` vì đây đúng là đơn vị của con
   * số ngay trên nó, và vì `name` dài gấp đôi — trong một ô bảng bốn cột trên
   * điện thoại thì đó là khác biệt giữa đọc được và không.
   */
  programCurrency: string | null;
};

export function cheapestByCabin(route: VietnamRoute): CheapestByCabin[] {
  return CABINS.map(({ id, labelKey }) => {
    const best = quoteRoute(route.origin, route.destination, id).find((q) => q.points !== null);
    return {
      cabin: id,
      labelKey,
      points: best?.points ?? null,
      startingAt: best?.startingAt ?? false,
      programName: best?.program.name ?? null,
      programLogo: best?.program.logo ?? null,
      programCurrency: best?.program.currency ?? null,
    };
  });
}

/** Bảng đầy đủ của một chặng: mỗi chương trình một hàng, mỗi hạng ghế một cột.
 *  Hành trình lấy từ hạng có nhiều lựa chọn nhất — chúng giống nhau giữa các
 *  hạng, chỉ con số đổi, nên liệt kê ba lần là ba lần cùng một danh sách. */
export type ProgramRow = {
  quote: Quote;
  prices: { cabin: Cabin; labelKey: string; points: number | null; startingAt: boolean }[];
};

export function programRows(route: VietnamRoute): ProgramRow[] {
  const byCabin = CABINS.map(({ id, labelKey }) => ({
    id,
    labelKey,
    quotes: quoteRoute(route.origin, route.destination, id),
  }));

  return PROGRAMS.map((program) => {
    const cells = byCabin.map(({ id, labelKey, quotes }) => {
      const q = quotes.find((entry) => entry.program.id === program.id)!;
      return { cabin: id, labelKey, points: q.points, startingAt: q.startingAt, quote: q };
    });

    // Hạng có nhiều hành trình nhất là hạng đầy đủ nhất. Ở phần lớn chặng cả
    // ba bằng nhau; chỗ khác nhau là khi một hạng không có giá thì `options`
    // vẫn còn nguyên, nên lấy `max` là an toàn ở mọi chặng.
    const richest = cells.reduce((best, cell) =>
      cell.quote.options.length > best.quote.options.length ? cell : best
    );

    return {
      quote: richest.quote,
      prices: cells.map(({ cabin, labelKey, points, startingAt }) => ({
        cabin,
        labelKey,
        points,
        startingAt,
      })),
    };
  }).sort((a, b) => {
    // Chương trình báo được giá lên trước, rồi tới rẻ nhất — cùng luật xếp với
    // `quoteRoute`, nhưng ở đây phải quyết trên cả ba hạng cùng lúc.
    const cheapest = (row: ProgramRow) => {
      const nums = row.prices.map((p) => p.points).filter((p): p is number => p !== null);
      return nums.length ? Math.min(...nums) : Infinity;
    };
    return cheapest(a) - cheapest(b);
  });
}

/**
 * Không đoạn viết tay nào được chứa con số điểm.
 *
 * Ném lỗi chứ không cảnh báo, và `audit:awards` gọi hàm này — cùng lý do
 * `assertNoBankSlugClash()` chạy trong `generateStaticParams`: một con số gõ
 * tay lệch với bảng ngay bên trên nó là kiểu sai không ai phát hiện bằng mắt,
 * và trên một trang award chart thì số cũ là kiểu hỏng đáng sợ nhất.
 *
 * Bắt MỌI nhóm số có dấu phẩy ngăn nghìn, không chỉ số điểm. Bản đầu chỉ bắt
 * năm chữ số trở lên và cố ý cho tỷ lệ chuyển (`1,000:700`) đi qua — nhưng
 * vòng review chỉ ra rằng cách đó vừa lọt (`9,000` điểm) vừa bỏ sót đúng loại
 * số đáng lo nhất: mốc chia bậc quãng đường (`7,500` dặm) cũng là một con số
 * của bảng giá, và nó đổi mỗi lần chương trình sửa chart. Tỷ lệ chuyển cũng
 * đổi. Nên luật giờ đơn giản và chặt: đoạn văn không mang con số nào cả, mọi
 * con số đều đọc từ bảng ngay bên trên nó.
 */
export function assertNoPointsInProse(): void {
  const offenders: string[] = [];
  for (const r of VIETNAM_ROUTES) {
    for (const paragraph of r.bodyVi) {
      const hit = paragraph.match(/\d{1,3}(?:,\d{3})+/);
      if (hit) offenders.push(`${r.slug}: "${hit[0]}"`);
    }
  }
  if (offenders.length) {
    throw new Error(
      `award-routes: đoạn viết tay chứa số điểm, sẽ trôi khi bảng đổi:\n  ${offenders.join("\n  ")}`
    );
  }
}

/**
 * Ngày kiểm tra CŨ NHẤT trong sáu chương trình, không phải mới nhất.
 *
 * Cùng lý do đã ghi ở `award-chart-finder.tsx`: ngày mới nhất chỉ đúng cho một
 * dòng trong bảng, còn ngày cũ nhất đúng cho mọi dòng. Trên một trang award
 * chart thì tuyên bố dữ liệu tươi hơn thực tế là kiểu sai nguy hiểm nhất.
 *
 * Ở đây chứ không chép lại lần nữa trong trang: hai chỗ hiển thị cùng một con
 * số thì phải lấy từ cùng một hàm.
 */
export function awardDataVerifiedOn(): string {
  return PROGRAMS.map((p) => p.verifiedOn).sort()[0];
}
