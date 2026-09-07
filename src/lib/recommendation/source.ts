import { isReferralUrl } from "@/lib/affiliate-links";
import { getCreditCardOffers } from "@/lib/content";
import { amountIn, historyFor, TRACKING_SINCE } from "@/lib/offer-history";
import type { CreditCardOffer } from "@/lib/content";
import { PRODUCTS } from "./data/index.ts";
import { offlineDataset } from "./data/index.ts";
import type { Product, RecommendationDataset } from "./types.ts";

/**
 * Cửa DUY NHẤT engine đọc dữ liệu.
 *
 * Tồn tại vì Phase 2 chắc chắn phải có database thật — hồ sơ người dùng, thẻ
 * đang giữ, số dư điểm không thể nằm trong git. Khi đó đổi implementation ở
 * đây, engine không đụng một dòng. Giữ interface hẹp là cách duy nhất lời hứa
 * đó còn giá trị: mỗi hàm thêm vào là một hàm backend mới phải làm được.
 *
 * `getDataset` là async dù bộ seed nằm sẵn trong bộ nhớ — vì `affiliateAvailable`
 * đọc từ Contentful, và vì backend nào sau này cũng sẽ async.
 */
export interface RecommendationDataSource {
  getDataset(): Promise<RecommendationDataset>;
  /** Lịch sử mức welcome bonus của một sản phẩm — xem `OfferHistoryPoint`. */
  getOfferHistory(productSlug: string): Promise<OfferHistoryPoint[]>;
}

/**
 * Một lần mức welcome bonus của thẻ này đổi.
 *
 * Đây là primitive cho §12 (percentile lịch sử của offer) và là nửa còn thiếu
 * của §11: "70,000 điểm" một mình không nói được gì, vì câu hỏi quyết định có
 * nên mở thẻ NGAY hay chờ là "70,000 là mức cao hay mức thường của thẻ này".
 *
 * Nguồn là `data/offer-history.json`, do `.github/workflows/offer-history.yml`
 * ghi mỗi ngày và CHỈ ghi thêm khi số đổi — nên nó là nhật ký thay đổi, không
 * phải bản chép hằng ngày. Nó nối được với kho này vì cả hai đánh khoá bằng
 * ĐÚNG slug Contentful.
 *
 * `amount` có thể `undefined`: nhãn cashback ("Hoàn tiền 15%") không rút ra
 * được một con số so sánh được với số điểm. Phase 3 phải bỏ qua những điểm đó
 * chứ không được coi là 0 — xem `unitOf` trong `lib/offer-history.ts`, vốn tồn
 * tại đúng vì so 15 với 250 rồi tuyên bố "từng lên tới $250" là một câu về
 * tiền, nói sai thì người đọc mở nhầm thẻ.
 */
export interface OfferHistoryPoint {
  /** `YYYY-MM-DD`. */
  at: string;
  /** Nhãn đúng như nó từng hiện trên site. */
  label: string;
  amount: number | undefined;
}

/** Ngày sớm nhất bất kỳ lịch sử nào bắt đầu. Phase 3 phải nói "từ khi theo
 *  dõi" chứ không được ngầm hứa là biết cả những gì xảy ra trước đó. */
export const OFFER_HISTORY_SINCE = TRACKING_SINCE;

/**
 * `affiliateAvailable` được TÍNH, không được khai.
 *
 * `isReferralUrl` chính là hàm quyết định link apply có mang `rel="sponsored"`
 * hay không trên trang thẻ. Dùng lại đúng nó ở đây nghĩa là engine và trang
 * web không thể bất đồng về việc một link có hoa hồng — và Rule 7 ("affiliate
 * không bao giờ ảnh hưởng thứ hạng") trở thành thứ kiểm chứng được thay vì
 * một lời hứa.
 *
 * Thẻ không tìm thấy trên Contentful → `false`. Đoán "có hoa hồng" khi không
 * biết là hướng sai duy nhất không sửa được sau đó: nó bật nút affiliate lên
 * cho một link không có thật.
 */
function resolveProducts(offers: CreditCardOffer[]): Product[] {
  const applyUrlBySlug = new Map(offers.map((offer) => [offer.slug, offer.applyUrl]));
  return PRODUCTS.map((seed) => {
    const applyUrl = applyUrlBySlug.get(seed.slug);
    return {
      ...seed,
      affiliateAvailable: applyUrl ? isReferralUrl(applyUrl) : false,
    };
  });
}

/**
 * Bộ dữ liệu nằm trong repo, nối với Contentful bằng slug.
 *
 * Không cache riêng: `getCreditCardOffers` đã đi qua lớp `unstable_cache`
 * chung của `lib/content` (60 giây, tag `contentful`, webhook publish làm mới
 * ngay). Bọc thêm một lớp nữa ở đây chỉ tạo ra một bản sao hết hạn theo lịch
 * khác — tức là hai câu trả lời khác nhau cho cùng một câu hỏi, tuỳ ai hỏi.
 */
export const repoDataSource: RecommendationDataSource = {
  async getOfferHistory(productSlug: string): Promise<OfferHistoryPoint[]> {
    return historyFor(productSlug)
      .filter((entry) => entry.welcomeBonus !== undefined)
      .map((entry) => ({
        at: entry.at,
        label: entry.welcomeBonus!,
        amount: amountIn(entry.welcomeBonus),
      }));
  },

  async getDataset(): Promise<RecommendationDataset> {
    const offers = await getCreditCardOffers();
    // Chỉ `products` khác bộ offline, và khác đúng một trường. Dựng lại từ bộ
    // offline thay vì liệt kê lần nữa: hai chỗ liệt kê là hai chỗ sẽ lệch khi
    // có entity thứ mười hai.
    return { ...offlineDataset(), products: resolveProducts(offers) };
  },
};
