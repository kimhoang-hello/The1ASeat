/**
 * Mục Khách sạn (`/hotels`): những khách sạn Ghế 1A đã ở thật, mỗi khách sạn
 * một trang, kèm link đặt phòng affiliate.
 *
 * VÌ SAO DỮ LIỆU NẰM TRONG REPO, KHÔNG PHẢI CONTENTFUL: cùng lý do với thẻ Mỹ
 * (`us-credit-cards.ts`) và mười hai trang chặng bay. Tạo một content type mới
 * qua Management API bị chặn ở tầng quyền (xem CONTENTFUL.md), còn dựng tay
 * hơn hai mươi trường trong giao diện Contentful là việc dễ sai nhất có thể
 * giao cho tác giả. Ở đây mỗi khách sạn là một khối có kiểu, có test canh
 * (`hotels.test.ts`), và thêm một khách sạn là thêm một khối — không đổi
 * component nào.
 *
 * NHỮNG GÌ VẪN Ở CONTENTFUL: bài review và bài video. Trang khách sạn chỉ giữ
 * `reviewSlug` và `youtubeUrl`, rồi đọc tiêu đề, ảnh và ngày của bài lúc
 * render — bài đổi tiêu đề hay bị unpublish thì trang khách sạn tự theo, không
 * có bản chép nào đứng lại để lệch.
 *
 * LUẬT NỘI DUNG — lý do mục này tồn tại là để đáng tin hơn một trang OTA:
 *  - Mọi câu trong `description`, `highlights`, `notes`, `booked`… phải truy
 *    được về một nguồn của chính tác giả: bài review, phụ đề cháy trong video
 *    (`research/video-captions/`), hoặc mô tả YouTube do tác giả viết. Không
 *    bịa trải nghiệm, không bịa số.
 *  - Số điểm là số ĐÃ TRẢ lúc đặt, không phải giá hiện tại — trang luôn in kèm
 *    một câu nói rõ điều đó. Không bao giờ in giá phòng, phòng trống hay điểm
 *    đánh giá dạng sao.
 *  - Link affiliate dán NGUYÊN VĂN từ công cụ của đối tác (Expedia® Travel
 *    Creator → "Create link"), không tự thêm hay sửa tham số. Test đòi mọi
 *    link đang bật phải được `isReferralUrl` nhận ra, để nó luôn mang
 *    `rel="sponsored"`.
 *  - Khách sạn chưa có nội dung kiểm chứng thì `published: false` — trang 404,
 *    không vào danh sách, không vào sitemap.
 *
 * ẢNH BÌA: ảnh chính thức của khách sạn (website của chính chuỗi khách sạn),
 * tác giả chốt 14/10/2026; muốn dùng ảnh tự chụp thì thay `coverImage` sau. Ảnh
 * nằm ở `public/images/hotels/`, mang `credit` để người đọc không nhầm đó là
 * ảnh của Ghế 1A. `galleryImages` là ảnh tự chụp trong bài review (Contentful),
 * không mang `credit`.
 *
 * File này phải import được trần trong `node --test`: không alias `@/`, không
 * import JSON, đường dẫn import mang đuôi `.ts`.
 */

import { getYouTubeVideoId } from "./video-embed.ts";

export const HOTELS_BASE = "/hotels";

export function hotelPath(slug: string): string {
  return `${HOTELS_BASE}/${slug}`;
}

export type HotelChainId = "hyatt" | "marriott" | "accor" | "ihg";
export type HotelCategoryId = "luxury" | "boutique" | "lifestyle" | "upscale";
export type HotelCountryId = "JP" | "HK" | "TW" | "KR" | "FR" | "NL" | "DE" | "CA";
export type HotelPartnerId = "expedia" | "agoda" | "booking";

/** Chuỗi khách sạn: nhãn bộ lọc, chương trình thành viên, và bài "Everything
 *  about…" của site nói về chương trình đó (nếu có). */
export const HOTEL_CHAINS: Record<HotelChainId, { label: string; program: string; programPostSlug?: string }> = {
  hyatt: { label: "Hyatt®", program: "World of Hyatt®", programPostSlug: "everything-about-hyatt" },
  marriott: {
    label: "Marriott®",
    program: "Marriott Bonvoy®",
    programPostSlug: "everything-about-marriott-bonvoy",
  },
  accor: { label: "Accor®", program: "Accor® ALL®" },
  ihg: { label: "IHG®", program: "IHG One Rewards®", programPostSlug: "everything-about-ihg-one-rewards" },
};

export const HOTEL_CATEGORIES: Record<HotelCategoryId, string> = {
  luxury: "Luxury",
  boutique: "Boutique",
  lifestyle: "Lifestyle",
  upscale: "Upscale",
};

export const HOTEL_COUNTRIES: Record<HotelCountryId, string> = {
  JP: "Nhật Bản",
  HK: "Hong Kong",
  TW: "Đài Loan",
  KR: "Hàn Quốc",
  FR: "Pháp",
  NL: "Hà Lan",
  DE: "Đức",
  CA: "Canada",
};

/**
 * Đối tác đặt phòng. Thêm đối tác mới: thêm một dòng ở đây VÀ thêm host link
 * affiliate của họ vào `REFERRAL_SOURCES` (`affiliate-links.ts`) — thiếu bước
 * thứ hai thì test đỏ, vì link có hoa hồng mà không mang `sponsored` là đúng
 * thứ site này không bao giờ được ship.
 */
export const HOTEL_PARTNERS: Record<HotelPartnerId, { name: string }> = {
  expedia: { name: "Expedia®" },
  agoda: { name: "Agoda®" },
  booking: { name: "Booking.com" },
};

/**
 * Ô widget tìm khách sạn CHÍNH THỨC của Expedia® trên trang `/hotels`. TẮT —
 * và để tắt cho tới khi có snippet thật từ Expedia® Travel Creator (Tools →
 * Search Widget). Không bao giờ dựng một ô tìm kiếm giả trông như của Expedia®.
 *
 * Bật: chép từ snippet chính thức đúng ba thứ — `src` của thẻ script,
 * `class` và các thuộc tính `data-*` của thẻ div — vào đây, RỒI thêm host của
 * script vào `content-security-policy.ts` (`script-src`; widget mở iframe hay
 * gọi API thì thêm cả `frame-src`/`connect-src`). Thiếu bước CSP thì widget gãy
 * im lặng trên production, chỉ một dòng lỗi trong console.
 */
export type HotelSearchWidgetConfig =
  | { enabled: false }
  | {
      enabled: true;
      scriptSrc: string;
      containerClass: string;
      dataAttributes: Record<`data-${string}`, string>;
    };

export const HOTEL_SEARCH_WIDGET: HotelSearchWidgetConfig = { enabled: false };

export interface HotelImage {
  /** `/images/hotels/…` (ảnh trong repo) hoặc URL `images.ctfassets.net`. */
  src: string;
  width: number;
  height: number;
  /** Tả ảnh, không cần lặp tên khách sạn — trang đã nói đang ở đâu. */
  alt: string;
  /** Nguồn ảnh khi KHÔNG phải ảnh Ghế 1A tự chụp. */
  credit?: string;
}

export interface HotelAffiliateLink {
  partner: HotelPartnerId;
  /** Link đúng như công cụ của đối tác tạo ra. Không sửa tham số. */
  url: string;
  /** Tắt tạm một link mà không phải xoá nó (vd. đối tác báo link hỏng). */
  enabled: boolean;
  /** Mã link phía đối tác, để đối chiếu với báo cáo hoa hồng. KHÔNG gắn vào URL. */
  trackingRef?: string;
  /** Nhãn nút riêng; bỏ trống thì dùng "Xem giá trên <đối tác>". */
  label?: string;
}

export interface HotelLink {
  href: string;
  label: string;
  description?: string;
}

export interface Hotel {
  /** Mã ổn định cho GA4 (`hotel_id`) — giữ nguyên kể cả khi đổi slug. */
  id: string;
  slug: string;
  name: string;
  /** Thành phố người đọc tìm (thẻ, tiêu đề phụ, bộ lọc). */
  city: string;
  /**
   * Địa phương hành chính THẬT khi khác `city` — chỉ cho JSON-LD `addressLocality`,
   * nơi máy đối chiếu với địa chỉ của khách sạn. Vd. Courtyard Paris Porte de
   * Versailles mang tên Paris nhưng địa chỉ ở Issy-les-Moulineaux, sát ranh Paris.
   */
  addressLocality?: string;
  country: HotelCountryId;
  /** Thương hiệu con: "Park Hyatt®", "Courtyard®"… */
  brand: string;
  chain: HotelChainId;
  category: HotelCategoryId;
  /** Đoạn giới thiệu, mỗi phần tử một đoạn. */
  description: string[];
  coverImage?: HotelImage;
  galleryImages: HotelImage[];
  /** Slug bài review chữ trên blog (Contentful). */
  reviewSlug?: string;
  /** Video review trên kênh YouTube của Ghế 1A. */
  youtubeUrl?: string;
  /** Vị trí, một dòng. */
  location: string;
  roomTypeReviewed?: string;
  /** Cách Ghế 1A đặt và đã trả bao nhiêu — số của LẦN ĐÓ, không phải giá hiện tại. */
  booked?: string;
  amenities: string[];
  /** Điều tác giả thích nhất, từ chính bài/video. */
  highlights: string[];
  /** Điều nên biết trước — mặt trái, cũng từ chính bài/video. */
  notes: string[];
  /** Có giá trị là được chọn vào khối "Ghế 1A chọn"; số nhỏ đứng trước. */
  featured?: number;
  published: boolean;
  affiliateLinks: HotelAffiliateLink[];
  /** Trang chính thức của khách sạn, để đặt trực tiếp (không có hoa hồng). */
  directBookingUrl?: string;
  /** Đường đi tiếp riêng của khách sạn này (vd. thẻ đã dùng để đặt). */
  relatedLinks?: HotelLink[];
  seoTitle?: string;
  seoDescription?: string;
}

const HYATT_CREDIT = "Ảnh: Hyatt®";
const MARRIOTT_CREDIT = "Ảnh: Marriott®";
const ACCOR_CREDIT = "Ảnh: Accor®";
const IHG_CREDIT = "Ảnh: IHG®";

/** Ảnh tự chụp trong bài review, đọc thẳng từ CDN của Contentful. */
const ctf = (path: string, width: number, height: number, alt: string): HotelImage => ({
  src: `https://images.ctfassets.net/0eel5iv903y8/${path}`,
  width,
  height,
  alt,
});

export const ALL_HOTELS: Hotel[] = [
  // ——— Tokyo ———
  {
    id: "park-hyatt-tokyo",
    slug: "park-hyatt-tokyo",
    name: "Park Hyatt® Tokyo",
    city: "Tokyo",
    country: "JP",
    brand: "Park Hyatt®",
    chain: "hyatt",
    category: "luxury",
    description: [
      "Park Hyatt® Tokyo nằm trên cao giữa Shinjuku và nổi tiếng từ bộ phim Lost in Translation. Khách sạn mở cửa trở lại vào tháng 12/2025 sau 19 tháng cải tạo, đợt lớn nhất kể từ khi khai trương năm 1994.",
      "Đây là khách sạn Category 8 của World of Hyatt®, và từ khi mở cửa lại, nhu cầu cao nên tìm được phòng bằng points ở đây không hề dễ.",
    ],
    coverImage: {
      src: "/images/hotels/park-hyatt-tokyo.jpg",
      width: 2000,
      height: 1126,
      alt: "Toà tháp của khách sạn giữa Shinjuku, nhìn từ trên cao",
      credit: HYATT_CREDIT,
    },
    galleryImages: [
      ctf("ph-tokyo-7117/640907648a03c479566ec546cdcaf33d/park-hyatt-tokyo-7117.jpg", 2400, 1800, "Khu sảnh có giếng trời và vườn tre"),
      ctf("ph-tokyo-7182/91f140a3337ad30aa929ed992aeb8a98/park-hyatt-tokyo-7182.jpg", 2400, 1800, "Phòng khách với sofa và tranh treo tường trong King Suite Deluxe"),
      ctf("ph-tokyo-7178/277fdfc2a5c7f0a0f1b067866111c432/park-hyatt-tokyo-7178.jpg", 2400, 1800, "Phòng ngủ với giường King trong King Suite Deluxe"),
      ctf("ph-tokyo-7184/c1470f2549782260cab17821433a9339/park-hyatt-tokyo-7184.jpg", 2400, 1800, "Phòng tắm ốp đá marble với bồn tắm lớn"),
      ctf("ph-tokyo-7187/30c23c284e3bae089bca24faafe02952/park-hyatt-tokyo-7187.jpg", 2400, 1800, "Hồ bơi tầng 47 về đêm"),
      ctf("ph-tokyo-7135/3408ab55325ccf7bb8f34ed96a2331ef/park-hyatt-tokyo-7135.jpg", 2400, 1800, "Nhà hàng Girandole by Alain Ducasse ở tầng 41"),
    ],
    reviewSlug: "park-hyatt-tokyo-review-king-suite-deluxe",
    youtubeUrl: "https://www.youtube.com/watch?v=lfockzqToYA",
    location: "Shinjuku, Tokyo, ở các tầng cao nhìn ra toàn thành phố",
    roomTypeReviewed: "King Suite Deluxe",
    booked: "35,000 World of Hyatt® points cho 1 đêm, cộng 1 Suite Upgrade Award để xác nhận suite ngay lúc đặt",
    amenities: [
      "Hồ bơi tầng 47 trong Club on the Park",
      "New York Bar tầng 52: live jazz, bối cảnh phim Lost in Translation",
      "Nhà hàng Girandole by Alain Ducasse ở tầng 41",
      "Amenities của Aesop",
    ],
    highlights: [
      "Suite vừa cải tạo xong: phòng khách và phòng ngủ riêng, cửa sổ lớn nhìn ra Tokyo",
      "Phòng tắm đá marble với bồn tắm lớn",
      "Dịch vụ nhất quán: gần như nhân viên nào cũng chủ động chào hỏi",
    ],
    notes: ["Từ khi mở cửa lại, phòng đổi bằng points rất khó tìm. Mình canh khá lâu mới đặt được đúng đêm cuối ở Tokyo"],
    featured: 2,
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/Qw37WT2", enabled: true, trackingRef: "Qw37WT2" },
    ],
    directBookingUrl: "https://www.hyatt.com/park-hyatt/en-US/tyoph-park-hyatt-tokyo",
    seoTitle: "Park Hyatt® Tokyo: review King Suite sau khi mở cửa lại",
    seoDescription:
      "Park Hyatt® Tokyo sau 19 tháng cải tạo: Ghế 1A ở King Suite Deluxe bằng 35,000 World of Hyatt® points + Suite Upgrade Award. Review, video và cách đặt.",
  },
  {
    id: "courtyard-tokyo-ginza",
    slug: "courtyard-tokyo-ginza",
    name: "Courtyard® Tokyo Ginza",
    city: "Tokyo",
    country: "JP",
    brand: "Courtyard®",
    chain: "marriott",
    category: "upscale",
    description: [
      "Courtyard® Tokyo Ginza nằm ngay khu Ginza, gần ga metro và các con phố mua sắm. Phòng không quá rộng nhưng ánh đèn và thiết kế tạo cảm giác rất ấm cúng, còn nhà hàng breakfast thì rộng và có cả quầy mì nấu tại chỗ.",
      "Mình được nhận phòng sớm từ khoảng 11 giờ sáng và được upgrade nhờ hạng Platinum. Upgrade miễn phí ở Tokyo khá hiếm, nên dù không phải phòng cao cấp, mình vẫn thấy đây là một điểm cộng.",
    ],
    coverImage: {
      src: "/images/hotels/courtyard-tokyo-ginza.jpg",
      width: 2000,
      height: 1124,
      alt: "Mặt tiền khách sạn trên phố Ginza",
      credit: MARRIOTT_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=RJ8_-c1odbg",
    location: "Ginza, Tokyo, gần metro và các con phố mua sắm",
    roomTypeReviewed: "King Moderate (upgrade từ King Standard)",
    // "35k": phụ đề cháy trong khung hình cuối video ("I used a 35k free night
    // certificate, plus the Bonvoy points…", thấy ở ảnh `maxres3.jpg` YouTube tự
    // sinh); file OCR ở `research/video-captions/` đọc sót con số này.
    booked: "1 free night certificate 35k cộng 15,000 Marriott Bonvoy® points cho 1 đêm",
    amenities: ["Nhà hàng breakfast buffet kiểu Âu và Á, có quầy mì", "Cà phê miễn phí cho mọi khách"],
    highlights: [
      "Hạng Platinum: được upgrade lên King Moderate và có breakfast miễn phí",
      "Giường King êm, có vòi sen rain shower",
      "Mình quay lại ở thêm một lần nữa ba tháng sau",
    ],
    notes: ["Cửa sổ nhỏ và không có view. Về view thì AC Hotel® Tokyo Ginza mình từng ở tốt hơn"],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/gfcNXld", enabled: true, trackingRef: "gfcNXld" },
    ],
    directBookingUrl: "https://www.marriott.com/en-us/hotels/tyocy-courtyard-tokyo-ginza-hotel/overview/",
    seoTitle: "Courtyard® Tokyo Ginza: review và cách đổi Marriott Bonvoy®",
    seoDescription:
      "Courtyard® Tokyo Ginza ngay trung tâm Ginza: Ghế 1A ở bằng một free night certificate 35k cộng 15,000 Marriott Bonvoy® points. Review, video và cách đặt.",
  },
  {
    id: "ac-hotel-tokyo-ginza",
    slug: "ac-hotel-tokyo-ginza",
    name: "AC Hotel® Tokyo Ginza",
    city: "Tokyo",
    country: "JP",
    brand: "AC Hotels by Marriott®",
    chain: "marriott",
    category: "lifestyle",
    description: [
      "AC Hotel® Tokyo Ginza nằm ngay trung tâm Ginza. Phòng rộng so với chuẩn khách sạn ở Nhật, thiết kế hiện đại, sạch sẽ và có cửa sổ lớn nhìn xuống phố.",
      "Mình ở đây đêm cuối của chuyến Hàn–Nhật, trước chuyến bay sáng sớm về Toronto.",
    ],
    coverImage: {
      src: "/images/hotels/ac-hotel-tokyo-ginza.jpg",
      width: 2000,
      height: 1124,
      alt: "Lối vào khách sạn ở Ginza",
      credit: MARRIOTT_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=i28H5y44uqs",
    location: "Ginza, Tokyo",
    roomTypeReviewed: "Superior Room, giường King (upgrade nhờ hạng Platinum Elite)",
    booked: "60,000 Marriott Bonvoy® points cho 1 đêm",
    amenities: ["Bar và nhà hàng ở tầng trệt", "Lớp yoga và Pilates miễn phí cho Platinum Elite trở lên"],
    highlights: [
      "Phòng sáng, sạch và rộng hơn mặt bằng chung ở Tokyo",
      "Phòng tắm chia ba khu riêng: bồn rửa, vòi sen và toilet",
      "Vị trí ngay giữa Ginza, mình sẵn sàng quay lại",
    ],
    notes: [
      "60,000 points không phải mức rẻ, dù với mình vẫn đáng",
      "Mình phải ra sân bay sớm nên chưa thử breakfast",
    ],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/KKreNdi", enabled: true, trackingRef: "KKreNdi" },
    ],
    directBookingUrl: "https://www.marriott.com/en-us/hotels/tyoar-ac-hotel-tokyo-ginza/overview/",
    seoTitle: "AC Hotel® Tokyo Ginza: review và cách đổi Marriott Bonvoy®",
    seoDescription:
      "AC Hotel® Tokyo Ginza giữa trung tâm Ginza: Ghế 1A ở Superior Room bằng 60,000 Marriott Bonvoy® points. Review, video và cách đặt phòng.",
  },

  // ——— Kyoto ———
  {
    id: "park-hyatt-kyoto",
    slug: "park-hyatt-kyoto",
    name: "Park Hyatt® Kyoto",
    city: "Kyoto",
    country: "JP",
    brand: "Park Hyatt®",
    chain: "hyatt",
    category: "luxury",
    description: [
      "Park Hyatt® Kyoto nằm ngay giữa khu phố cổ Higashiyama, cạnh hai con dốc Ninenzaka và Sannenzaka. Khách sạn chỉ có khoảng 70 phòng và được thiết kế như một khu nghỉ dưỡng nhỏ mang kiến trúc Nhật truyền thống, thay vì một toà nhà cao tầng với sảnh lớn.",
      "Với người chơi Miles & Points, đây là một trong những khách sạn World of Hyatt® khó đặt bằng points nhất: Category 8, ít phòng award, còn giá tiền mặt thì rất cao.",
    ],
    coverImage: {
      src: "/images/hotels/park-hyatt-kyoto.jpg",
      width: 2000,
      height: 1126,
      alt: "Khách sạn bên con dốc lát đá của khu Higashiyama",
      credit: HYATT_CREDIT,
    },
    galleryImages: [
      ctf("ph-kyoto-7953/01813ff140762118fcf0090cbd717cdd/park-hyatt-kyoto-7953.jpg", 1800, 2400, "Phòng khách Park Suite Garden View nhìn ra khu vườn"),
      ctf("ph-kyoto-7954/83e6fecbd938ed83ec278589aa544ec3/park-hyatt-kyoto-7954.jpg", 1800, 2400, "Phòng ngủ Park Suite Garden View với cửa kính lớn nhìn ra vườn"),
      ctf("ph-kyoto-7957/4c91ba5947971c13a7359bddc0bf508d/park-hyatt-kyoto-7957.jpg", 1800, 2400, "Phòng tắm đá marble với bồn tắm và vòi sen"),
      ctf("ph-kyoto-7995/5a5399b30428814fce2cc734a5034da8/park-hyatt-kyoto-7995.jpg", 1800, 2400, "Yasaka Pagoda lúc hoàng hôn nhìn từ terrace của khách sạn"),
      ctf("ph-kyoto-8028/9348484031d209e85175b369d6f0fe87/park-hyatt-kyoto-8028.jpg", 1800, 2400, "Không gian Kyoto Bistro với sofa và cây xanh giữa phòng"),
      ctf("ph-kyoto-8046/cd6eed9b78283405a4226cb0d2c8a9ac/park-hyatt-kyoto-8046.jpg", 1800, 2400, "Japanese breakfast tại Kyoto Bistro"),
    ],
    reviewSlug: "park-hyatt-kyoto-review-park-suite-garden-view",
    youtubeUrl: "https://www.youtube.com/watch?v=0UDgwRw4-SI",
    location: "Higashiyama, Kyoto, đi bộ được tới Ninenzaka, Sannenzaka, Yasaka Pagoda và Kiyomizu-dera",
    roomTypeReviewed: "Park Suite Garden View",
    booked:
      "40,000 World of Hyatt® points cho 1 đêm mùa hoa anh đào (trước đợt devaluation tháng 5/2026), cộng 1 Suite Upgrade Award để xác nhận suite ngay lúc đặt",
    amenities: [
      "Bath House kiểu nhà tắm Nhật, bồn nóng và lạnh cạnh nhau",
      "Bar Kohaku nhìn ra Yasaka Pagoda",
      "Kyoto Bistro: Japanese breakfast khoảng $65 một người",
      "Nhà hàng teppanyaki Yasaka",
    ],
    highlights: [
      "Suite Upgrade Award xác nhận Park Suite ngay lúc đặt, không phải chờ tới lúc check-in",
      "Yên tĩnh và riêng tư dù nằm giữa một trong những khu đông khách du lịch nhất Kyoto",
      "Nhân viên ở Kyoto Bistro rất chú ý từng chi tiết nhỏ",
    ],
    notes: [
      "Park Suite Garden View không nhìn thẳng ra Yasaka Pagoda. Muốn ngắm pagoda thì lên Bar Kohaku",
      "Phòng award rất ít: nên tìm từ nhiều tháng trước và linh hoạt ngày",
      "Một đêm là quá ngắn, lần sau mình sẽ ở ít nhất hai đêm",
    ],
    featured: 1,
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/tn6f1Pk", enabled: true, trackingRef: "tn6f1Pk" },
    ],
    directBookingUrl: "https://www.hyatt.com/park-hyatt/en-US/itmph-park-hyatt-kyoto",
    seoTitle: "Park Hyatt® Kyoto: review suite và cách đặt bằng points",
    seoDescription:
      "Park Hyatt® Kyoto giữa Higashiyama: Ghế 1A ở Park Suite Garden View bằng 40,000 World of Hyatt® points + Suite Upgrade Award. Review, video và cách đặt.",
  },
  {
    id: "ritz-carlton-kyoto",
    slug: "ritz-carlton-kyoto",
    name: "The Ritz-Carlton® Kyoto",
    city: "Kyoto",
    country: "JP",
    brand: "The Ritz-Carlton®",
    chain: "marriott",
    category: "luxury",
    description: [
      "The Ritz-Carlton® Kyoto nằm bên bờ sông Kamogawa, không xa các khu phố cổ của Kyoto. Thiết kế mang nét Nhật truyền thống, còn dịch vụ thì đúng chất Ritz-Carlton®, và đây là một trong những khách sạn Marriott Bonvoy® ở Nhật mà nhiều người mơ được ở nhất.",
      // Nguồn: mô tả YouTube do tác giả viết — "with some of the highest room
      // rates in Kyoto… redeeming Marriott Bonvoy points… may offer an
      // alternative way to experience the hotel".
      "Giá phòng ở đây thuộc hàng cao nhất Kyoto, nên dùng Marriott Bonvoy® points là một cách để trải nghiệm khách sạn mà không phải trả mức giá tiền mặt đó.",
    ],
    coverImage: {
      src: "/images/hotels/ritz-carlton-kyoto.jpg",
      width: 2000,
      height: 1126,
      alt: "Khách sạn bên bờ sông Kamogawa lúc chạng vạng",
      credit: MARRIOTT_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=JBu0n15OOA4",
    location: "Bờ sông Kamogawa, Kyoto",
    roomTypeReviewed: "Kamogawa River View, giường King (upgrade từ King City View)",
    booked: "110,000 Marriott Bonvoy® points cho 1 đêm mùa hoa anh đào, đặt trước 10 tháng",
    amenities: ["Spa và hồ bơi", "Tiệm bánh Pierre Hermé Paris", "Breakfast Nhật Bản", "Amenities của Diptyque"],
    highlights: [
      "Check-in ngay trong phòng thay vì ở quầy lễ tân",
      "Cửa sổ rất lớn nhìn ra sông Kamogawa, phòng ngập ánh sáng tự nhiên",
      "Hạng Platinum Elite được breakfast miễn phí, điều không nhiều khách sạn Ritz-Carlton® làm",
    ],
    notes: ["Số điểm khá cao. Lần sau mình sẽ cân nhắc bù thêm một chút để ở The Mitsui Kyoto"],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/4PGUTHx", enabled: true, trackingRef: "4PGUTHx" },
    ],
    directBookingUrl: "https://www.ritzcarlton.com/en/hotels/ukyrz-the-ritz-carlton-kyoto/overview/",
    seoTitle: "The Ritz-Carlton® Kyoto: review phòng nhìn ra sông Kamogawa",
    seoDescription:
      "The Ritz-Carlton® Kyoto bên sông Kamogawa: Ghế 1A ở bằng 110,000 Marriott Bonvoy® points một đêm mùa hoa anh đào. Review, video và cách đặt phòng.",
  },

  // ——— Osaka, Fukuoka, Sapporo ———
  {
    id: "caption-by-hyatt-namba-osaka",
    slug: "caption-by-hyatt-namba-osaka",
    name: "Caption by Hyatt® Namba Osaka",
    city: "Osaka",
    country: "JP",
    brand: "Caption by Hyatt®",
    chain: "hyatt",
    category: "lifestyle",
    description: [
      "Caption by Hyatt® Namba Osaka là khách sạn lifestyle của Hyatt® ngay khu Namba, cách chợ Kuromon và Dotonbori vài phút.",
      "Không khí ở đây trẻ trung, năng động, giống một quán cà phê địa phương hơn là một khách sạn. Dù là thương hiệu giá mềm, ở đây mình không có cảm giác đang ở một khách sạn budget.",
    ],
    coverImage: {
      src: "/images/hotels/caption-by-hyatt-namba-osaka.jpg",
      width: 2000,
      height: 1126,
      alt: "Lối vào khách sạn lúc chiều tối ở khu Namba",
      credit: HYATT_CREDIT,
    },
    galleryImages: [
      ctf("caption-namba-7681/b1ce7a565e72988d8203353ab16677cf/caption-by-hyatt-namba-osaka-7681.jpg", 2400, 1800, "Phòng Standard Queen với bức tranh lớn phía trên đầu giường"),
      ctf("caption-namba-7686/fb247f1342c28664b354c7c5beba9a09/caption-by-hyatt-namba-osaka-7686.jpg", 2400, 1800, "Giường Queen với hai đèn đầu giường hai bên"),
      ctf("caption-namba-7684/30b0960e0ea6ab98c2d8ac63d439e1c5/caption-by-hyatt-namba-osaka-7684.jpg", 2400, 1800, "Phòng tắm gạch men xanh lá với hoạ tiết vẽ trên tường"),
      ctf("caption-namba-7727/e631b7c1e6c8bb14666aaedd2706ec68/caption-by-hyatt-namba-osaka-7727.jpg", 2400, 1800, "Lobby với dãy đèn tròn và cửa kính lớn nhìn ra phố"),
      ctf("caption-namba-7732/0b82473de3e524303e14e414e3977bc0/caption-by-hyatt-namba-osaka-7732.jpg", 2400, 1800, "Quầy check-in ở lobby"),
      ctf("caption-namba-7736/bb6c5bcc9a15f1e57f43ad83b36122be/caption-by-hyatt-namba-osaka-7736.jpg", 2400, 1800, "Khay breakfast với sandwich, hash brown, salad và nước cam"),
    ],
    reviewSlug: "caption-by-hyatt-namba-osaka-review-standard-queen",
    youtubeUrl: "https://www.youtube.com/watch?v=-lFFlcvKwGY",
    location: "Namba, Osaka, gần chợ Kuromon và Dotonbori",
    roomTypeReviewed: "Standard Queen",
    // Số điểm do tác giả xác nhận 14/10/2026: 16k cho hai đêm. Phụ đề video ghi
    // lệch ("18k cho hai đêm" rồi "8K một đêm") — đừng sửa theo phụ đề.
    booked:
      "16,000 World of Hyatt® points cho 2 đêm vào tháng 3, đặt kèm một Guest of Honor nên có breakfast miễn phí mỗi ngày",
    amenities: ["Nước lọc ở mỗi tầng", "Máy giặt cho khách", "Fitness studio"],
    highlights: [
      "Vị trí trung tâm, đi bộ ra chợ Kuromon",
      "Phòng tắm nhỏ nhưng vòi sen rain shower mạnh",
      "Lần sau tới Osaka mình sẽ ở lại đây",
    ],
    notes: ["Giường Queen hơi nhỏ nếu bạn quen giường King", "Cửa sổ phòng không có view đáng kể"],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/j6s4T1z", enabled: true, trackingRef: "j6s4T1z" },
    ],
    directBookingUrl: "https://www.hyatt.com/caption-by-hyatt/en-US/osacp-caption-by-hyatt-namba-osaka",
    seoTitle: "Caption by Hyatt® Namba Osaka: review khách sạn ở Namba",
    seoDescription:
      "Caption by Hyatt® Namba Osaka gần chợ Kuromon và Dotonbori: Ghế 1A ở 2 đêm bằng 16,000 World of Hyatt® points kèm Guest of Honor. Review, video và cách đặt.",
  },
  {
    id: "ritz-carlton-fukuoka",
    slug: "ritz-carlton-fukuoka",
    name: "The Ritz-Carlton® Fukuoka",
    city: "Fukuoka",
    country: "JP",
    brand: "The Ritz-Carlton®",
    chain: "marriott",
    category: "luxury",
    description: [
      "The Ritz-Carlton® Fukuoka là một khách sạn Ritz-Carlton® còn khá mới, nằm trên cao nhìn ra vịnh Hakata. Phòng và suite đều rộng, thiết kế Nhật hiện đại, và Bay Bar là chỗ ngắm toàn cảnh vịnh về đêm.",
      "Giá tiền mặt lẫn mức đổi Marriott Bonvoy® points ở đây đều cao, nên quyền lợi hạng thành viên, nhất là được upgrade lên suite, có thể làm một lần ở đáng giá hơn rất nhiều.",
    ],
    coverImage: {
      src: "/images/hotels/ritz-carlton-fukuoka.jpg",
      width: 2000,
      height: 1128,
      alt: "Toà tháp khách sạn lúc hoàng hôn ở Fukuoka",
      credit: MARRIOTT_CREDIT,
    },
    galleryImages: [
      ctf("rc-fukuoka-cover/ec8e7b177b10f83410f11ef3c8ad04cf/ritz-carlton-fukuoka-8142.jpg", 2400, 1800, "Phòng khách Premium Corner Suite nhìn ra vịnh Hakata"),
      ctf("rc-fukuoka-8150/646c3d30e5c9f3f9a766067eb210a9b6/ritz-carlton-fukuoka-8150.jpg", 2400, 1800, "Phòng ngủ nhìn ra vịnh Hakata ban ngày"),
      ctf("rc-fukuoka-8153/2b947c035563f285fe111906cd3b13b7/ritz-carlton-fukuoka-8153.jpg", 2400, 1800, "Double vanity mặt đá marble nhìn ra vịnh Hakata"),
      ctf("rc-fukuoka-8181/119f33fdbb9d57db4d6dfd561d112dd8/ritz-carlton-fukuoka-8181.jpg", 2400, 1800, "Bồn tắm cạnh cửa kính nhìn ra Fukuoka về đêm"),
      ctf("rc-fukuoka-8228/60e64f85c97adabeb03bb3deb98a31cd/ritz-carlton-fukuoka-8228.jpg", 2400, 1800, "Quầy bar nhìn ra vịnh Hakata về đêm"),
      ctf("rc-fukuoka-8216/f229aad9ed71d97513e32128127a1d3d/ritz-carlton-fukuoka-8216.jpg", 2400, 1800, "Khu lounge trên tầng lễ tân"),
    ],
    reviewSlug: "ritz-carlton-fukuoka-review-premium-corner-suite-hakata-bay-view",
    youtubeUrl: "https://www.youtube.com/watch?v=x5L-YnXkY7g",
    location: "Fukuoka, nhìn ra vịnh Hakata",
    roomTypeReviewed: "Premium Corner Suite, Hakata Bay View (upgrade hai lần từ phòng thường)",
    booked: "132,000 Marriott Bonvoy® points cho 2 đêm",
    amenities: ["Bay Bar nhìn toàn cảnh vịnh Hakata", "Spa và fitness center", "Amenities của Diptyque"],
    highlights: [
      "Upgrade hai lần nhờ hạng Platinum Elite: lên King Deluxe Hakata View trước ngày đến, rồi lên Premium Corner Suite lúc check-in",
      "Suite góc rộng nhất mình từng ở, nhìn ra vịnh từ gần như mọi góc, kể cả từ bồn tắm",
      "Mình chắc chắn sẽ quay lại, vì ở Fukuoka không có nhiều khách sạn luxury tầm này",
    ],
    notes: ["Hạng Platinum Elite không được breakfast miễn phí ở đây"],
    featured: 3,
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/zk5vYJv", enabled: true, trackingRef: "zk5vYJv" },
    ],
    directBookingUrl: "https://www.ritzcarlton.com/en/hotels/fukrz-the-ritz-carlton-fukuoka/overview/",
    seoTitle: "The Ritz-Carlton® Fukuoka: review Premium Corner Suite",
    seoDescription:
      "The Ritz-Carlton® Fukuoka nhìn ra vịnh Hakata: 132,000 Marriott Bonvoy® points cho 2 đêm, được upgrade lên Premium Corner Suite. Review, video và cách đặt.",
  },
  {
    id: "hotel-sosei-sapporo",
    slug: "hotel-sosei-sapporo",
    name: "Hotel Sosei Sapporo",
    city: "Sapporo",
    country: "JP",
    brand: "MGallery®",
    chain: "accor",
    category: "boutique",
    description: [
      "Hotel Sosei Sapporo là khách sạn boutique thuộc MGallery® Collection của Accor®, thiết kế lấy cảm hứng từ truyền thống nấu bia của Sapporo.",
      "Mình ở hai đêm, đặt qua American Express® Fine Hotels + Resorts® bằng thẻ Business Platinum của Mỹ. Sau khi trừ credit $300 USD của thẻ, mình chỉ tự trả $78 USD, và booking còn kèm $100 USD credit để dùng trong khách sạn.",
    ],
    coverImage: {
      src: "/images/hotels/hotel-sosei-sapporo.jpg",
      width: 2000,
      height: 1500,
      alt: "Quầy bar và lò sưởi ở sảnh khách sạn",
      credit: ACCOR_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=R_0FuNTW-QI",
    location: "Sapporo, Hokkaido",
    roomTypeReviewed: "King Deluxe",
    booked:
      "2 đêm qua American Express® Fine Hotels + Resorts®: tự trả $78 USD sau credit $300 USD của thẻ Business Platinum, kèm $100 USD credit dùng trong khách sạn",
    amenities: ["Lounge bar", "Nhà hàng phục vụ breakfast"],
    highlights: [
      "Thiết kế boutique rất riêng, lấy cảm hứng từ lịch sử nấu bia của Sapporo",
      "Không khí ở nhà hàng breakfast làm mình nhớ tới Park Hyatt® Kyoto và The Ritz-Carlton® Kyoto",
    ],
    notes: [
      "Mức $78 USD là nhờ credit của thẻ American Express® Business Platinum Card (thẻ Mỹ). Đặt thông thường sẽ không rẻ như vậy",
    ],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/BdVZrsc", enabled: true, trackingRef: "BdVZrsc" },
    ],
    directBookingUrl: "https://all.accor.com/hotel/C082/index.en.shtml",
    relatedLinks: [
      {
        href: "/us-credit-cards/amex-business-platinum",
        label: "American Express® Business Platinum Card",
        description: "Mình dùng credit Fine Hotels + Resorts® của thẻ Mỹ này cho booking ở đây",
      },
    ],
    seoTitle: "Hotel Sosei Sapporo: review khách sạn MGallery® ở Sapporo",
    seoDescription:
      "Hotel Sosei Sapporo thuộc MGallery® của Accor®: Ghế 1A ở hai đêm, tự trả $78 USD nhờ credit American Express® Fine Hotels + Resorts®. Review, video và cách đặt.",
  },

  // ——— Hong Kong ———
  {
    id: "hyatt-regency-hong-kong-tsim-sha-tsui",
    slug: "hyatt-regency-hong-kong-tsim-sha-tsui",
    name: "Hyatt Regency® Hong Kong, Tsim Sha Tsui",
    city: "Hong Kong",
    country: "HK",
    brand: "Hyatt Regency®",
    chain: "hyatt",
    category: "upscale",
    description: [
      "Hyatt Regency® Hong Kong, Tsim Sha Tsui nằm ngay trên trung tâm thương mại K11 và cách ga MTR Tsim Sha Tsui vài bước. Về vị trí ở Kowloon thì gần như không có gì để chê.",
      "Điểm trừ là phòng đã khá cũ.",
    ],
    coverImage: {
      src: "/images/hotels/hyatt-regency-hong-kong-tsim-sha-tsui.jpg",
      width: 2000,
      height: 1126,
      alt: "Toàn cảnh Tsim Sha Tsui và cảng Victoria nhìn từ trên cao",
      credit: HYATT_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=u4yBynV9p5Y",
    location: "Tsim Sha Tsui, Kowloon, ngay trên K11 và cạnh ga MTR",
    roomTypeReviewed: "Standard King, có quyền vào Regency Club",
    booked: "51,000 World of Hyatt® points cộng 1 Club Access Award cho 3 đêm dịp giao thừa",
    amenities: ["Regency Club ở tầng cao nhất, nhìn ra thành phố", "Phòng tắm có bồn tắm"],
    highlights: ["Check-in ngay ở club lounge thay vì quầy chính", "Giường King êm, housekeeping dọn kỹ mỗi ngày"],
    notes: [
      "Phòng đã cũ và view thành phố không đẹp",
      "Đồ ăn ở club chỉ ở mức bình thường. Ở Hong Kong có quá nhiều chỗ ăn sáng địa phương ngon nên suốt chuyến này mình không ăn sáng ở club lần nào",
      "Lần sau mình có lẽ sẽ thử một khách sạn Hyatt® khác ở phía bên kia thành phố (Hyatt Centric)",
    ],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/KSs9hFj", enabled: true, trackingRef: "KSs9hFj" },
    ],
    directBookingUrl: "https://www.hyatt.com/hyatt-regency/en-US/honhr-hyatt-regency-hong-kong-tsim-sha-tsui",
    seoTitle: "Hyatt Regency® Hong Kong, Tsim Sha Tsui: review và cách đặt",
    seoDescription:
      "Hyatt Regency® Hong Kong, Tsim Sha Tsui ngay trên K11: Ghế 1A ở 3 đêm giao thừa bằng 51,000 World of Hyatt® points + Club Access Award. Review và video.",
  },

  // ——— Đài Loan ———
  // Nguồn tám khách sạn từ đây trở xuống: phụ đề cháy (`research/video-captions/`,
  // số điểm đọc lại trên chính khung hình video 14/10/2026 vì OCR làm rơi chữ) và
  // mô tả YouTube của tác giả. Chưa có bài review chữ.
  {
    id: "kimpton-da-an-taipei",
    slug: "kimpton-da-an-taipei",
    name: "Kimpton® Da An Hotel",
    city: "Taipei",
    country: "TW",
    brand: "Kimpton®",
    chain: "ihg",
    category: "boutique",
    description: [
      "Kimpton® Da An Hotel nằm giữa quận Da'an của Taipei, chỉ vài bước là tới ga MRT Zhongxiao Fuxing và một số khu mua sắm, ăn uống tốt nhất Taipei. Đây là lần đầu mình ở một khách sạn Kimpton®.",
      "Kimpton® thường được xem là thương hiệu premium, nhất là ở Bắc Mỹ, nhưng Kimpton® Da An lại cho mình cảm giác giống một khách sạn boutique hơn.",
    ],
    coverImage: {
      src: "/images/hotels/kimpton-da-an-taipei.jpg",
      width: 2000,
      height: 1334,
      alt: "Mặt tiền khách sạn ở Da'an, một người đạp xe ngang qua",
      credit: IHG_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=OhLYjX_sbgY",
    location: "Da'an, Taipei, vài bước tới ga MRT Zhongxiao Fuxing",
    roomTypeReviewed: "King Premium (upgrade từ King Standard vài tuần trước ngày đến, nhờ hạng IHG® Platinum Elite)",
    // Phụ đề ghi "I used 190,000 IHG points for a three-night stay", nhưng tác giả
    // chốt 20/10/2026 số đúng là 195K cho cả 4 đêm (đã gồm đêm thứ 4 miễn phí của
    // thẻ IHG®), khớp hai bài viết: cancel-rebook-de-tiet-kiem-hotel-points
    // (215K → 195K sau khi rebook) và nang-gia-tri-scene-plus-points-len-hon-2-cent.
    booked:
      "4 đêm dịp Giáng sinh: 195,000 IHG One Rewards® points cho cả 4 đêm, đã gồm đêm thứ 4 miễn phí nhờ quyền lợi chủ thẻ tín dụng IHG®",
    amenities: [
      "Lounge nhỏ có cà phê và snack miễn phí buổi sáng",
      "Xe đạp miễn phí, kèm mũ bảo hiểm và khoá",
      "Nhà hàng và bar The Tavernist ở tầng trên cùng, khách được giảm giá đồ uống",
      "Amenities của Atelier Bloem",
    ],
    highlights: [
      "Được upgrade lên King Premium từ vài tuần trước ngày đến. Nếu có hạng Platinum Elite trở lên, bạn nên xin upgrade sớm",
      "Phòng khá rộng, tông màu tre ấm cúng; housekeeping dọn kỹ mỗi ngày",
      "Phòng đổi bằng points dễ tìm, dù mức điểm cao",
    ],
    notes: [
      "Hai cửa sổ nhỏ thay vì một cửa sổ lớn, nên phòng thiếu ánh sáng tự nhiên",
      "Bố cục lạ: phải đi ngang khu phòng tắm mới tới phòng ngủ; bồn rửa thoát nước chậm",
      "Lần sau mình có lẽ sẽ đổi điểm ở chỗ khác. Lúc quay video, mình đang nhắm tới Park Hyatt® Taipei sắp mở cửa",
    ],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/UO67Bra", enabled: true, trackingRef: "UO67Bra" },
    ],
    directBookingUrl: "https://www.ihg.com/kimptonhotels/hotels/us/en/da-an-hotel-taipei/tpekm/hoteldetail",
    seoTitle: "Kimpton® Da An Hotel Taipei: review phòng King Premium",
    seoDescription:
      "Kimpton® Da An Hotel ở quận Da'an, Taipei: Ghế 1A ở 4 đêm Giáng sinh bằng 195,000 IHG One Rewards® points, đã gồm 1 đêm miễn phí. Review, video và cách đặt.",
  },

  // ——— Hàn Quốc ———
  {
    id: "grand-hyatt-seoul",
    slug: "grand-hyatt-seoul",
    name: "Grand Hyatt® Seoul",
    city: "Seoul",
    country: "KR",
    brand: "Grand Hyatt®",
    chain: "hyatt",
    category: "luxury",
    description: [
      "Grand Hyatt® Seoul là khách sạn Grand Hyatt® đầu tiên mình ở, ngay sau chuyến bay dài từ Toronto. Mình ở hai đêm đúng mùa hoa anh đào, và xin được một phòng nhìn thẳng ra Namsan Tower, bên dưới là những hàng cây anh đào đang nở hoa.",
      "Phòng hiện đại mà vẫn có nét Hàn Quốc, khách sạn có cả hồ bơi trong nhà lẫn ngoài trời, và breakfast ở Grand Club là bữa sáng khách sạn ngon nhất mình từng ăn tính tới lúc đó.",
    ],
    coverImage: {
      src: "/images/hotels/grand-hyatt-seoul.jpg",
      width: 2000,
      height: 1126,
      alt: "Toà khách sạn sau hàng cây mùa thu",
      credit: HYATT_CREDIT,
    },
    galleryImages: [
      ctf("gh-seoul-3028/906d6f32b678375407f46c5dd6c5a519/grand-hyatt-seoul-3028.jpg", 1800, 2400, "Namsan Tower và hàng cây anh đào nở hoa nhìn từ cửa sổ phòng"),
      ctf("gh-seoul-3025/81189899a87ee8fa20dd63575bb3f1fc/grand-hyatt-seoul-3025.jpg", 1800, 2400, "King Room với cửa kính lớn nhìn ra đồi Namsan"),
      ctf("gh-seoul-3031/cfc642b8e3944cdc1d2cfd846f623474/grand-hyatt-seoul-3031.jpg", 1800, 2400, "Giường King giữa nội thất gỗ và ánh đèn vàng ấm"),
      ctf("gh-seoul-3024/357d3a6c0c0b88dceffd29123820ca5d/grand-hyatt-seoul-3024.jpg", 1800, 2400, "Phòng tắm với bồn rửa đá và gương có đèn viền"),
      ctf("gh-seoul-3033/d5a65eff3099443bde70cbfbdffc0b9a/grand-hyatt-seoul-3033.jpg", 1800, 2400, "Hàng cây anh đào nở rộ bên bãi đậu xe của khách sạn"),
      ctf("gh-seoul-3419/4a60c929663d7e79d55cf8929e0a3170/grand-hyatt-seoul-3419.jpg", 1800, 2400, "Bảng tên Grand Club ở lối vào lounge"),
    ],
    reviewSlug: "grand-hyatt-seoul-review-king-room-namsan-tower-view",
    youtubeUrl: "https://www.youtube.com/watch?v=W5TJUqQIJI4",
    location: "Hannam-dong, Yongsan, Seoul, gần Itaewon",
    roomTypeReviewed: "King Room, view Namsan Tower (xin lúc check-in)",
    booked: "43,000 World of Hyatt® points cho 2 đêm (Category 5 lúc đặt)",
    amenities: [
      "Hồ bơi ngoài trời, bên cạnh hồ bơi trong nhà",
      "Grand Club: breakfast buffet đủ món Âu, Á và Hàn",
      "Máy Nespresso và máy nước uống trong phòng",
      "Amenities của Balmain Paris",
    ],
    highlights: [
      "Xin phòng view Namsan Tower lúc check-in và được xếp đúng, lại đúng mùa hoa anh đào nên view càng đẹp",
      "King Room tiêu chuẩn nhưng rộng, sạch, giường rất êm. Amenities Balmain Paris thơm tới mức sau chuyến đi mình còn tìm chỗ mua",
      "Booking có quyền vào Grand Club: ăn sáng ở đó có không khí như nhà hàng fine dining",
    ],
    notes: ["Khách sạn nằm trên sườn đồi Namsan, không tiện nếu bạn đi lại chủ yếu bằng subway như mình"],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/OGmHpXW", enabled: true, trackingRef: "OGmHpXW" },
    ],
    directBookingUrl: "https://www.hyatt.com/grand-hyatt/en-US/selrs-grand-hyatt-seoul",
    seoTitle: "Grand Hyatt® Seoul: review phòng view Namsan Tower",
    seoDescription:
      "Grand Hyatt® Seoul, phòng view Namsan Tower: Ghế 1A ở 2 đêm mùa hoa anh đào bằng 43,000 World of Hyatt® points, có Grand Club. Review, video và cách đặt.",
  },
  {
    id: "andaz-seoul-gangnam",
    slug: "andaz-seoul-gangnam",
    name: "Andaz® Seoul Gangnam",
    city: "Seoul",
    country: "KR",
    brand: "Andaz®",
    chain: "hyatt",
    category: "lifestyle",
    description: [
      "Andaz® Seoul Gangnam nằm ngay cạnh ga tàu điện ngầm Apgujeong, gần khu Gangnam nổi tiếng. Nội thất gây ấn tượng ngay từ lúc bước vào. Sảnh không lớn bằng Grand Hyatt® Seoul nhưng ấm cúng.",
      "Mình ở hai đêm, ngay sau hai đêm ở Grand Hyatt® Seoul. Đây là lần đầu mình ở một khách sạn Andaz®, và với vị trí cùng tiện nghi như vậy, mình thấy 20,000 points một đêm là xứng đáng.",
    ],
    coverImage: {
      src: "/images/hotels/andaz-seoul-gangnam.jpg",
      width: 2000,
      height: 1126,
      alt: "Toà khách sạn giữa khu Gangnam vào một ngày nắng",
      credit: HYATT_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=Ys0mEZRqp7o",
    location: "Gangnam-gu, Seoul, nối thẳng với ga tàu điện ngầm Apgujeong",
    roomTypeReviewed: "Standard King",
    booked: "40,000 World of Hyatt® points cho 2 đêm (Category 5 lúc đặt)",
    amenities: [
      "Snack miễn phí trong phòng, bổ sung mỗi ngày",
      "Lounge có breakfast buổi sáng giá 11,000 KRW",
      "Globalist hoặc booking Guest of Honor: breakfast miễn phí ở nhà hàng tầng 2",
      "Amenities của Christophe Laudamiel, nhà làm nước hoa người Pháp",
    ],
    highlights: [
      "Vị trí là điểm cộng lớn: ngay cạnh ga tàu điện ngầm, hợp để đi khắp Seoul",
      "Phòng sạch không chê được, sáng và ấm cúng; giường King êm",
      "Toilet tách riêng khỏi phòng tắm",
    ],
    notes: [
      "Standard King hơi nhỏ so với kỳ vọng của mình về một khách sạn Andaz®",
      "Cửa sổ gần như không có view",
    ],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/YGNsSZi", enabled: true, trackingRef: "YGNsSZi" },
    ],
    directBookingUrl: "https://www.hyatt.com/andaz/en-US/selaz-andaz-seoul-gangnam",
    seoTitle: "Andaz® Seoul Gangnam: review và cách đặt bằng points",
    seoDescription:
      "Andaz® Seoul Gangnam cạnh ga Apgujeong: Ghế 1A ở 2 đêm bằng 40,000 World of Hyatt® points, tức 20,000 points một đêm. Review, video và cách đặt phòng.",
  },

  // ——— Pháp ———
  {
    id: "hyatt-regency-paris-etoile",
    slug: "hyatt-regency-paris-etoile",
    name: "Hyatt Regency® Paris Etoile",
    city: "Paris",
    country: "FR",
    brand: "Hyatt Regency®",
    chain: "hyatt",
    category: "upscale",
    description: [
      "Hyatt Regency® Paris Etoile cách Champs-Élysées vài phút, và có những phòng nhìn thẳng ra tháp Eiffel. Mình xin phòng view tháp và được xếp đúng như vậy. Buổi tối nhìn tháp Eiffel lấp lánh từ cửa sổ phòng đẹp đến mức khó tả.",
      "Booking Guest of Honor cho mình quyền lợi Globalist, trong đó có quyền vào Regency Club ở tầng 34, nơi mình ăn sáng với view tháp Eiffel. Mình thật sự yêu khách sạn này, từ nhân viên thân thiện, phòng sạch sẽ cho tới view quá đẹp.",
    ],
    coverImage: {
      src: "/images/hotels/hyatt-regency-paris-etoile.jpg",
      width: 2000,
      height: 1126,
      alt: "Phòng ngủ với cửa sổ lớn nhìn ra tháp Eiffel",
      credit: HYATT_CREDIT,
    },
    galleryImages: [
      ctf("hr-paris-0851/b85f6a39cfa919c2bbaa3909f94fc15f/hyatt-regency-paris-etoile-0851.jpg", 1800, 2400, "Sofa cạnh cửa sổ nhìn thẳng ra tháp Eiffel"),
      ctf("hr-paris-0849/37122ba3886f52d161dbbbf8a924f36d/hyatt-regency-paris-etoile-0849.jpg", 1800, 2400, "Giường King trong phòng King Deluxe, cạnh sofa và cửa sổ nhìn ra Paris"),
      ctf("hr-paris-0604/5352a252eedbfecf41caf8dd331dfd5c/hyatt-regency-paris-etoile-0604.jpg", 1800, 2400, "Toàn cảnh Paris và tháp Eiffel nhìn từ Regency Club trên tầng 34"),
      ctf("hr-paris-0607/26e545dfaf14329cc6b71c041032cd8a/hyatt-regency-paris-etoile-0607.jpg", 1800, 2400, "Regency Club với dãy cửa kính lớn nhìn ra Paris"),
      ctf("hr-paris-0608/4d5757eeb947b94639c2e4e057b64ef2/hyatt-regency-paris-etoile-0608.jpg", 1800, 2400, "Khu ghế ngồi của Regency Club, phía sau là quầy breakfast"),
      ctf("hr-paris-0602/40690463e20251252afe9c297fc7da8d/hyatt-regency-paris-etoile-0602.jpg", 1800, 2400, "Breakfast ở Regency Club bên cửa kính nhìn ra tháp Eiffel"),
    ],
    reviewSlug: "hyatt-regency-paris-etoile-review-king-deluxe-eiffel-tower-view",
    youtubeUrl: "https://www.youtube.com/watch?v=EUZw94ZNAMg",
    location: "Quận 17, Paris, vài phút tới Champs-Élysées",
    roomTypeReviewed: "King Deluxe, view tháp Eiffel (upgrade từ Standard King lúc check-in nhờ booking Guest of Honor)",
    booked: "72,000 World of Hyatt® points cho 4 đêm, đặt trước khoảng 3 tháng, kèm Guest of Honor",
    amenities: [
      "Regency Club ở tầng 34, phục vụ breakfast buổi sáng",
      "Hộp trà và cà phê tặng khách",
      "Yêu cầu đồ dùng qua app World of Hyatt®",
      "Amenities của Pharmacopia",
    ],
    highlights: [
      "Upgrade lên King Deluxe lúc check-in, đúng phòng view tháp Eiffel như đã xin",
      "Breakfast ở Regency Club với view tháp Eiffel, nhớ thử croissant",
      "Dép đi trong phòng êm tới mức mình mang mỗi ngày",
    ],
    notes: ["Khó đặt bằng points nếu không lên kế hoạch sớm. Mình đặt trước khoảng 3 tháng và may mắn vẫn còn phòng"],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/6WLzXqh", enabled: true, trackingRef: "6WLzXqh" },
    ],
    directBookingUrl: "https://www.hyatt.com/hyatt-regency/en-US/parhr-hyatt-regency-paris-etoile",
    seoTitle: "Hyatt Regency® Paris Etoile: review phòng view tháp Eiffel",
    seoDescription:
      "Hyatt Regency® Paris Etoile gần Champs-Élysées: Ghế 1A ở 4 đêm bằng 72,000 World of Hyatt® points, phòng nhìn thẳng ra tháp Eiffel. Review, video và cách đặt.",
  },
  {
    id: "courtyard-paris-porte-de-versailles",
    slug: "courtyard-paris-porte-de-versailles",
    name: "Courtyard® Paris Porte de Versailles",
    city: "Paris",
    addressLocality: "Issy-les-Moulineaux",
    country: "FR",
    brand: "Courtyard®",
    chain: "marriott",
    category: "upscale",
    description: [
      "Courtyard® Paris Porte de Versailles là một lựa chọn Marriott Bonvoy® giá mềm ở rìa tây nam Paris: phòng hiện đại, thoải mái và sạch sẽ.",
      "Khách sạn ở Paris đắt kể cả khi đổi điểm, nên so với các khách sạn khác trong thành phố, mình thấy mức điểm ở đây khá hợp lý.",
    ],
    coverImage: {
      src: "/images/hotels/courtyard-paris-porte-de-versailles.jpg",
      width: 2000,
      height: 1124,
      alt: "Mặt tiền khách sạn lúc chạng vạng",
      credit: MARRIOTT_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=jy6s1-xlT9k",
    location: "Issy-les-Moulineaux, sát Porte de Versailles ở rìa tây nam Paris",
    booked: "35,000 Marriott Bonvoy® points cho 1 đêm",
    amenities: ["Hộp trà và cà phê miễn phí trong phòng", "Xin bộ đánh răng qua app Marriott Bonvoy® khi cần"],
    highlights: [
      "Phòng sạch, được giữ gìn tốt",
      "Phòng tắm cơ bản nhưng đủ mọi thứ cần",
      "Mức điểm hợp lý so với mặt bằng khách sạn ở Paris",
    ],
    notes: [
      "Phòng không rộng như mình mong, nhưng đủ cho một đêm",
      "Mình xin upgrade lên phòng rộng hơn bằng hạng Gold Elite nhưng khách sạn hết phòng",
    ],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/ozdfAi4", enabled: true, trackingRef: "ozdfAi4" },
    ],
    directBookingUrl: "https://www.marriott.com/en-us/hotels/parcv-courtyard-paris-porte-de-versailles/overview/",
    seoTitle: "Courtyard® Paris Porte de Versailles: review và đổi điểm",
    seoDescription:
      "Courtyard® Paris Porte de Versailles: Ghế 1A ở 1 đêm bằng 35,000 Marriott Bonvoy® points, mức hợp lý cho Paris. Review, video và cách đặt phòng.",
  },

  // ——— Hà Lan ———
  {
    id: "element-amsterdam",
    slug: "element-amsterdam",
    name: "Element® Amsterdam",
    city: "Amsterdam",
    country: "NL",
    brand: "Element®",
    chain: "marriott",
    category: "upscale",
    description: [
      "Element® Amsterdam cách trung tâm Amsterdam một chặng tram ngắn. Phòng rộng, có bếp nhỏ, và mọi khách đều được breakfast miễn phí mỗi sáng ở nhà hàng Papa's Loft House.",
      "Khách sạn sạch sẽ, có không khí ấm cúng như ở nhà, và mình chắc chắn sẽ quay lại.",
    ],
    coverImage: {
      src: "/images/hotels/element-amsterdam.jpg",
      width: 2000,
      height: 1126,
      alt: "Khu lounge với sofa dài và kệ sách",
      credit: MARRIOTT_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=AgQZ2XJ4cYM",
    location: "Phía nam Amsterdam, gần Zuidas, đi một chặng tram là vào trung tâm",
    booked: "36,000 Marriott Bonvoy® points cộng 2 free night certificate cho 3 đêm",
    amenities: [
      "Breakfast miễn phí mỗi sáng ở Papa's Loft House",
      "Bếp nhỏ trong phòng",
      "Trà và cà phê miễn phí",
      "Lounge ấm cúng để ngồi chờ nhận phòng",
    ],
    highlights: [
      "Phòng rộng, sạch, ánh đèn ấm; cửa sổ lớn đón nhiều ánh sáng tự nhiên",
      "Xin lên tầng cao hai ngày trước khi đến và được duyệt",
      "Phòng tắm sạch bong, đồ dùng được bổ sung đầy đủ suốt kỳ ở",
    ],
    notes: ["Không nằm ngay khu phố cổ: vào trung tâm phải đi một chặng tram"],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/mYjSOHq", enabled: true, trackingRef: "mYjSOHq" },
    ],
    directBookingUrl: "https://www.marriott.com/en-us/hotels/amsel-element-amsterdam/overview/",
    seoTitle: "Element® Amsterdam: review và cách đổi Marriott Bonvoy®",
    seoDescription:
      "Element® Amsterdam có bếp nhỏ và breakfast miễn phí: Ghế 1A ở 3 đêm bằng 36,000 Marriott Bonvoy® points cộng 2 free night certificate. Review và video.",
  },

  // ——— Đức ———
  {
    id: "moxy-frankfurt-city-center",
    slug: "moxy-frankfurt-city-center",
    name: "Moxy® Frankfurt City Center",
    city: "Frankfurt",
    country: "DE",
    brand: "Moxy Hotels®",
    chain: "marriott",
    category: "lifestyle",
    description: [
      "Moxy® Frankfurt City Center nằm ngay trung tâm Frankfurt, thiết kế trẻ trung và năng động. Điểm mình thích nhất là khu lounge và bar rộng, có thể ngồi chờ ở đó tới giờ nhận phòng.",
      "Phòng nhỏ nhưng sạch và ấm cúng. Mình chỉ ở một đêm nên thấy vẫn ổn. Nếu ở Frankfurt lâu hơn, mình sẽ chọn khách sạn khác.",
    ],
    coverImage: {
      src: "/images/hotels/moxy-frankfurt-city-center.jpg",
      width: 2000,
      height: 1126,
      alt: "Khu lounge và bar nhiều màu sắc ở tầng trệt",
      credit: MARRIOTT_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=9sa0ATpMLt0",
    location: "Trung tâm Frankfurt, gần ga U-Bahn Eschenheimer Tor",
    booked: "22,000 Marriott Bonvoy® points cho 1 đêm",
    amenities: ["Lounge và bar rộng, ngồi chờ được trước giờ nhận phòng", "Nước đóng hộp miễn phí trong phòng"],
    highlights: [
      "Lounge và bar đẹp nhất mình từng thấy ở một khách sạn Moxy®",
      "Phòng ở tầng trên cùng, nhỏ nhưng sạch và ấm cúng",
    ],
    notes: [
      "Phòng nhỏ, amenities phòng tắm rất cơ bản",
      "Không có trà hay cà phê miễn phí trong phòng, chỉ có nước",
    ],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/TKhSnLv", enabled: true, trackingRef: "TKhSnLv" },
    ],
    directBookingUrl: "https://www.marriott.com/en-us/hotels/fraor-moxy-frankfurt-city-center/overview/",
    seoTitle: "Moxy® Frankfurt City Center: review và cách đổi điểm",
    seoDescription:
      "Moxy® Frankfurt City Center ngay trung tâm Frankfurt, lounge và bar rất đẹp: Ghế 1A ở 1 đêm bằng 22,000 Marriott Bonvoy® points. Review, video và cách đặt.",
  },
  {
    id: "moxy-frankfurt-airport",
    slug: "moxy-frankfurt-airport",
    name: "Moxy® Frankfurt Airport",
    city: "Frankfurt",
    country: "DE",
    brand: "Moxy Hotels®",
    chain: "marriott",
    category: "lifestyle",
    description: [
      "Moxy® Frankfurt Airport cách sân bay Frankfurt vài phút, hợp cho một đêm trước chuyến bay sớm. Mình ở đây đêm cuối của chuyến châu Âu mùa thu, trước khi bay về Toronto.",
      "Dù là khách sạn sân bay, ở đây vẫn có lounge rộng để ngồi thư giãn, và trong những khách sạn sân bay mình từng ở, đây là chỗ đẹp nhất.",
    ],
    coverImage: {
      src: "/images/hotels/moxy-frankfurt-airport.jpg",
      width: 2000,
      height: 1124,
      alt: "Lối vào khách sạn với cửa xoay và bảng tên màu hồng",
      credit: MARRIOTT_CREDIT,
    },
    galleryImages: [],
    youtubeUrl: "https://www.youtube.com/watch?v=WHRcgJacDSA",
    location: "Gateway Gardens, cách sân bay Frankfurt vài phút",
    booked: "12,400 Marriott Bonvoy® points cho 1 đêm",
    amenities: ["Lounge rộng cho khách ngồi thư giãn"],
    highlights: [
      "Với hạng Gold Elite, mình xin phòng ở tầng trên cùng và khách sạn vui vẻ đáp ứng",
      "Cửa sổ lớn, một điểm cộng cho người mê máy bay như mình",
      "Vừa tiện ra sân bay, vừa có lounge để ngồi thư giãn; mình sẽ quay lại",
    ],
    notes: ["Phòng tắm nhỏ, dù rất sạch"],
    published: true,
    affiliateLinks: [
      { partner: "expedia", url: "https://expedia.com/affiliate/eD9AQL9", enabled: true, trackingRef: "eD9AQL9" },
    ],
    directBookingUrl: "https://www.marriott.com/en-us/hotels/fraox-moxy-frankfurt-airport/overview/",
    seoTitle: "Moxy® Frankfurt Airport: review khách sạn sân bay",
    seoDescription:
      "Moxy® Frankfurt Airport cách sân bay Frankfurt vài phút: Ghế 1A ở đêm cuối chuyến châu Âu bằng 12,400 Marriott Bonvoy® points. Review, video và cách đặt.",
  },

  // ——— Canada ———
  // NHÁP: chưa có bài review, video hay ảnh nào của Ghế 1A cho khách sạn này
  // (rà Contentful + kênh YouTube 14/10/2026). Giữ để có sẵn chỗ khi có nội
  // dung; `published: false` nên trang trả 404 và không vào danh sách.
  {
    id: "park-hyatt-toronto",
    slug: "park-hyatt-toronto",
    name: "Park Hyatt® Toronto",
    city: "Toronto",
    country: "CA",
    brand: "Park Hyatt®",
    chain: "hyatt",
    category: "luxury",
    description: [],
    galleryImages: [],
    location: "Toronto",
    amenities: [],
    highlights: [],
    notes: [],
    published: false,
    affiliateLinks: [],
  },
];

/** Khách sạn đang hiện trên site, theo đúng thứ tự trong file. */
export function getHotels(): Hotel[] {
  return ALL_HOTELS.filter((hotel) => hotel.published);
}

/** Khối "Ghế 1A chọn": chọn tay bằng `featured`, số nhỏ đứng trước. */
export function getFeaturedHotels(): Hotel[] {
  return getHotels()
    .filter((hotel) => hotel.featured !== undefined)
    .sort((a, b) => (a.featured ?? 0) - (b.featured ?? 0));
}

/** Chỉ khách sạn đã publish — nháp trả `undefined`, tức trang 404. */
export function hotelBySlug(slug: string): Hotel | undefined {
  return getHotels().find((hotel) => hotel.slug === slug);
}

/** Link đặt phòng affiliate đang bật, theo thứ tự khai trong dữ liệu. */
export function enabledAffiliateLinks(hotel: Hotel): HotelAffiliateLink[] {
  return hotel.affiliateLinks.filter((link) => link.enabled);
}

/** "Kyoto, Nhật Bản" — trừ khi thành phố trùng tên vùng ("Hong Kong"). */
export function hotelLocationLabel(hotel: Pick<Hotel, "city" | "country">): string {
  const country = HOTEL_COUNTRIES[hotel.country];
  return hotel.city === country ? hotel.city : `${hotel.city}, ${country}`;
}

/**
 * Khách sạn mà một bài blog nói về: bài là review chữ của nó, hoặc bài video
 * cùng video YouTube. So bằng id video chứ không bằng URL — bài video lưu
 * `watch?v=`, dữ liệu ở đây có thể là `youtu.be/`.
 */
export function hotelForPost(post: { slug: string; videoUrl?: string }): Hotel | undefined {
  const videoId = post.videoUrl ? getYouTubeVideoId(post.videoUrl) : null;
  return getHotels().find(
    (hotel) =>
      hotel.reviewSlug === post.slug ||
      (videoId !== null && hotel.youtubeUrl !== undefined && getYouTubeVideoId(hotel.youtubeUrl) === videoId),
  );
}

/** Tên không ký hiệu ®/™ — cho dữ liệu có cấu trúc, nơi máy so tên với thực thể. */
export function plainName(name: string): string {
  return name.replace(/[®™℠]/g, "").replace(/\s{2,}/g, " ").trim();
}
