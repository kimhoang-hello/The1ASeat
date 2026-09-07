import { isReferralUrl } from "@/lib/affiliate-links";
import { getCreditCardOffers } from "@/lib/content";
import { amountIn, historyFor, TRACKING_SINCE, unitOf } from "@/lib/offer-history";
import { dedupeHistory, type OfferHistoryPoint } from "./offer-history.ts";
import type { CreditCardOffer } from "@/lib/content";
import { PRODUCTS } from "./data/index.ts";
import { offlineDataset } from "./data/index.ts";
import { datasetAt } from "./temporal.ts";
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
/**
 * Hỏi kho dữ liệu ở thời điểm nào.
 *
 * `asOf` BẮT BUỘC khi có `knownAt`, và điều đó được cưỡng chế bằng KIỂU DỮ
 * LIỆU chứ không bằng chú thích: `{ knownAt }` một mình là một yêu cầu nghe
 * như đang lọc mà thực ra không lọc gì — im lặng trả về cả những đính chính
 * lùi ngày, đúng thứ `knownAt` sinh ra để chặn. Bỏ `options` đi nếu muốn cả
 * lịch sử.
 */
export interface DatasetQuery {
  /** Thế giới như nó ở ngày này (trục thời gian hiệu lực). */
  asOf: string;
  /** Chỉ những bản ghi đã có trong kho tính đến ngày này (trục thời gian ghi
   *  nhận). Vắng = lấy mọi bản ghi, kể cả đính chính nhập sau. */
  knownAt?: string;
}

export interface RecommendationDataSource {
  /**
   * `asOf` (YYYY-MM-DD) trả về thế giới như nó ở ngày đó; vắng thì trả về
   * toàn bộ, cả lịch sử.
   *
   * Nằm trên INTERFACE chứ không để người gọi tự `datasetAt` sau, vì đó là
   * chỗ khác biệt giữa hai backend: bản trong repo lọc mảng, còn một bản
   * PostgreSQL sẽ đẩy nó xuống `WHERE effective_from <= $1 AND (effective_to
   * IS NULL OR effective_to >= $1)` và dùng index. Nếu hợp đồng chỉ có "trả
   * hết rồi tự lọc" thì bản PostgreSQL buộc phải nạp cả lịch sử về ứng dụng —
   * và lúc đó sửa nó là sửa cả hợp đồng.
   *
   * `knownAt` cắt theo trục thời gian thứ hai: chỉ những bản ghi đã có trong
   * kho tính đến ngày đó. Phase 4 dựng lại một lượt chạy cũ phải truyền CẢ
   * HAI, nếu không đính chính lùi ngày sẽ lọt vào lời giải thích. Có mặt trên
   * interface chứ không để người gọi tự lọc sau, cùng lý do với `asOf`.
   */
  getDataset(options?: DatasetQuery): Promise<RecommendationDataset>;
  /**
   * Lịch sử mức welcome bonus của một sản phẩm — xem `OfferHistoryPoint`.
   *
   * Nhận `productId` chứ KHÔNG nhận slug. Nhật ký gốc đánh khoá bằng slug
   * Contentful, mà slug đổi khi thẻ đổi tên — tra bằng slug thì một lần đổi
   * tên là lịch sử đứt làm đôi và nửa cũ không bao giờ tìm lại được. Tra qua
   * sản phẩm thì khoá bền, còn slug chỉ là bước dịch bên trong.
   */
  getOfferHistory(productId: string): Promise<OfferHistoryPoint[]>;
}

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
/** Ngày sớm nhất bất kỳ lịch sử nào bắt đầu. Phase 3 phải nói "từ khi theo
 *  dõi" chứ không được ngầm hứa là biết cả những gì xảy ra trước đó.
 *
 *  Ở đây chứ không ở `offer-history.ts` vì nó là một GIÁ TRỊ đọc từ file JSON,
 *  và file kia phải nạp được bằng `node --test` — xem chú thích import ở đó. */
export const OFFER_HISTORY_SINCE = TRACKING_SINCE;

export const repoDataSource: RecommendationDataSource = {
  async getOfferHistory(productId: string): Promise<OfferHistoryPoint[]> {
    const product = PRODUCTS.find((row) => row.id === productId);
    if (product === undefined) return [];
    // Gộp lịch sử dưới MỌI slug thẻ này từng mang. Nhật ký gốc đánh khoá bằng
    // slug đang dùng lúc ghi, nên sau một lần đổi tên nó nằm ở hai chỗ.
    const slugs = [...product.previousSlugs, product.slug];
    // Đưa CẢ dòng thời gian thô vào, kể cả những lần thẻ không có welcome
    // bonus — chúng là vạch ngăn giữa hai đợt offer, và chúng mang ngày. Lọc
    // chúng ra trước khi gộp sẽ nhập hai đợt 70,000 rời nhau thành một, và
    // vứt ngày của chúng đi sẽ làm `until` của đợt trước nhảy qua cả khoảng
    // trống. Xem `dedupeHistory`.
    return dedupeHistory(
      slugs
        .flatMap((slug) => historyFor(slug))
        .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
        .map((entry) => ({
        at: entry.at,
        bonus:
          entry.welcomeBonus === undefined
            ? null
            : {
                label: entry.welcomeBonus,
                amount: amountIn(entry.welcomeBonus),
                unit: unitOf(entry.welcomeBonus),
              },
        })),
    );
  },

  async getDataset(options?: DatasetQuery): Promise<RecommendationDataset> {
    const offers = await getCreditCardOffers();
    // Chỉ `products` khác bộ offline, và khác đúng một trường. Dựng lại từ bộ
    // offline thay vì liệt kê lần nữa: hai chỗ liệt kê là hai chỗ sẽ lệch khi
    // có entity thứ mười hai.
    const full = { ...offlineDataset(), products: resolveProducts(offers) };
    // Không có `options` = trả cả lịch sử. Có `options` thì `asOf` là bắt buộc
    // theo kiểu dữ liệu, nên không tồn tại nhánh "có knownAt mà không có asOf".
    return options === undefined
      ? full
      : datasetAt(full, options.asOf, { knownAt: options.knownAt });
  },
};
