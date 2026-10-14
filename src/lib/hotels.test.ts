import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ALL_HOTELS,
  HOTEL_PARTNERS,
  HOTEL_SEARCH_WIDGET,
  enabledAffiliateLinks,
  getFeaturedHotels,
  getHotels,
  hotelBySlug,
  hotelForPost,
  hotelLocationLabel,
  plainName,
  type Hotel,
} from "./hotels.ts";
import {
  EMPTY_SELECTION,
  FILTER_ALL,
  activeFilterCount,
  facetCounts,
  matchesSelection,
  type HotelFilterValues,
} from "./hotel-filters.ts";
import { isReferralUrl } from "./affiliate-links.ts";
import { getYouTubeVideoId } from "./video-embed.ts";
import { getUsCreditCards } from "./us-credit-cards.ts";

const PUBLIC_DIR = fileURLToPath(new URL("../../public", import.meta.url));

/** Mọi chuỗi người đọc thấy trên trang một khách sạn. */
function visibleStrings(hotel: Hotel): string[] {
  return [
    hotel.name,
    hotel.city,
    hotel.brand,
    hotel.location,
    hotel.roomTypeReviewed ?? "",
    hotel.booked ?? "",
    hotel.seoTitle ?? "",
    hotel.seoDescription ?? "",
    ...hotel.description,
    ...hotel.amenities,
    ...hotel.highlights,
    ...hotel.notes,
    ...(hotel.relatedLinks ?? []).flatMap((link) => [link.label, link.description ?? ""]),
  ];
}

/** Bề ngang × chiều cao thật của một file JPEG, đọc từ marker SOF. */
function jpegSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error(`${path}: không phải JPEG hợp lệ`);
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    // SOF0..SOF15, trừ DHT (C4), JPG (C8), DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error(`${path}: không tìm thấy kích thước`);
}

test("id và slug không trùng, slug là chữ thường + gạch ngang", () => {
  const ids = ALL_HOTELS.map((hotel) => hotel.id);
  const slugs = ALL_HOTELS.map((hotel) => hotel.slug);
  assert.equal(new Set(ids).size, ids.length, "id trùng");
  assert.equal(new Set(slugs).size, slugs.length, "slug trùng");
  for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, slug);
});

// Trang công bố phải có giá trị THẬT ngoài cái nút đặt phòng — nếu không nó là
// đúng loại "thin affiliate page" mà spec cấm. Thiếu nội dung thì để nháp.
test("khách sạn đã publish có đủ nội dung kiểm chứng", () => {
  for (const hotel of getHotels()) {
    const where = hotel.slug;
    assert.ok(hotel.description.length >= 1, `${where}: thiếu đoạn giới thiệu`);
    assert.ok(hotel.coverImage, `${where}: thiếu ảnh bìa`);
    assert.ok(hotel.coverImage.alt.trim().length > 0, `${where}: ảnh bìa thiếu alt`);
    assert.ok(hotel.reviewSlug || hotel.youtubeUrl, `${where}: không có review chữ lẫn video`);
    assert.ok(hotel.highlights.length >= 1, `${where}: thiếu điểm nổi bật`);
    assert.ok(hotel.location.trim(), `${where}: thiếu vị trí`);
    for (const image of hotel.galleryImages) {
      assert.ok(image.alt.trim(), `${where}: ảnh ${image.src} thiếu alt`);
      assert.match(image.src, /^https:\/\/images\.ctfassets\.net\//, `${where}: ảnh gallery phải từ Contentful`);
    }
  }
});

// `next/image` lấy tỷ lệ khung từ `width`/`height` khai báo; khai sai là ảnh
// méo hoặc trang nhảy khi ảnh tải xong.
test("ảnh bìa trong repo tồn tại và đúng kích thước khai báo", () => {
  for (const hotel of getHotels()) {
    const cover = hotel.coverImage!;
    if (!cover.src.startsWith("/")) continue;
    const file = `${PUBLIC_DIR}${cover.src}`;
    assert.ok(existsSync(file), `${hotel.slug}: không có file ${cover.src}`);
    assert.deepEqual(jpegSize(file), { width: cover.width, height: cover.height }, `${hotel.slug}: kích thước`);
    // Ảnh không phải Ghế 1A chụp thì phải nói nguồn, để người đọc không nhầm.
    assert.ok(cover.credit, `${hotel.slug}: ảnh trong repo là ảnh chính thức, phải có credit`);
  }
});

// Link có hoa hồng mà không mang `rel="sponsored"` vừa là công bố thiếu, vừa
// không được `AffiliateClickTracker` nhận ra. Thêm đối tác mới mà quên thêm
// host vào `REFERRAL_SOURCES` là test này đỏ.
test("mọi link affiliate đang bật đều được nhận là link có hoa hồng", () => {
  for (const hotel of ALL_HOTELS) {
    for (const link of hotel.affiliateLinks) {
      assert.ok(HOTEL_PARTNERS[link.partner], `${hotel.slug}: đối tác lạ ${link.partner}`);
      assert.match(link.url, /^https:\/\//, `${hotel.slug}: link phải là https`);
      if (link.enabled) assert.ok(isReferralUrl(link.url), `${hotel.slug}: ${link.url} không nằm trong REFERRAL_SOURCES`);
    }
  }
});

test("link đặt trực tiếp là https và KHÔNG phải link affiliate", () => {
  for (const hotel of getHotels()) {
    if (!hotel.directBookingUrl) continue;
    assert.match(hotel.directBookingUrl, /^https:\/\//, hotel.slug);
    assert.equal(isReferralUrl(hotel.directBookingUrl), false, `${hotel.slug}: link trực tiếp mang hoa hồng?`);
  }
});

test("video là link YouTube đọc được id", () => {
  for (const hotel of ALL_HOTELS) {
    if (hotel.youtubeUrl) assert.ok(getYouTubeVideoId(hotel.youtubeUrl), `${hotel.slug}: ${hotel.youtubeUrl}`);
  }
});

test("thứ tự 'Ghế 1A chọn' không trùng", () => {
  const ranks = getHotels().flatMap((hotel) => (hotel.featured === undefined ? [] : [hotel.featured]));
  assert.equal(new Set(ranks).size, ranks.length);
  const featured = getFeaturedHotels().map((hotel) => hotel.featured!);
  assert.deepEqual(featured, [...featured].sort((a, b) => a - b));
});

// Cùng ngưỡng với phần còn lại của site: Google cắt tiêu đề ~60 ký tự, mô tả
// ~160 (`META_DESCRIPTION_MAX`).
test("tiêu đề và mô tả tìm kiếm vừa ngưỡng", () => {
  for (const hotel of getHotels()) {
    assert.ok(hotel.seoTitle && hotel.seoTitle.length <= 60, `${hotel.slug}: seoTitle ${hotel.seoTitle?.length}`);
    assert.ok(
      hotel.seoDescription && hotel.seoDescription.length >= 70 && hotel.seoDescription.length <= 160,
      `${hotel.slug}: seoDescription ${hotel.seoDescription?.length}`,
    );
  }
});

// Quy ước số của site: dấu phẩy ngăn nghìn (`40,000`). Năm (4 chữ số) thì được.
test("số từ năm chữ số trở lên phải có dấu phẩy ngăn nghìn", () => {
  for (const hotel of ALL_HOTELS) {
    for (const text of visibleStrings(hotel)) {
      assert.doesNotMatch(text, /\d{5,}/, `${hotel.slug}: "${text}"`);
      assert.doesNotMatch(text, /\d\.\d{3}\b/, `${hotel.slug}: dấu chấm ngăn nghìn trong "${text}"`);
    }
  }
});

// `$` trần trên site là CAD. Số tiền đô Mỹ phải ghi `$X USD`, không `US$`.
test("không có US$ — tiền đô Mỹ viết $X USD", () => {
  for (const hotel of ALL_HOTELS) {
    for (const text of visibleStrings(hotel)) assert.doesNotMatch(text, /US\$/, `${hotel.slug}: "${text}"`);
  }
});

test("nháp không lọt ra ngoài", () => {
  const drafts = ALL_HOTELS.filter((hotel) => !hotel.published);
  assert.ok(drafts.length > 0, "dữ liệu mẫu phải có ít nhất một nháp để test này có nghĩa");
  for (const draft of drafts) {
    assert.equal(hotelBySlug(draft.slug), undefined);
    assert.ok(!getHotels().includes(draft));
    assert.ok(!getFeaturedHotels().includes(draft));
  }
});

test("link đi tiếp trỏ tới thẻ Mỹ có thật", () => {
  const usSlugs = new Set(getUsCreditCards().map((card) => card.slug));
  for (const hotel of getHotels()) {
    for (const link of hotel.relatedLinks ?? []) {
      const match = link.href.match(/^\/us-credit-cards\/([a-z0-9-]+)$/);
      if (match) assert.ok(usSlugs.has(match[1]), `${hotel.slug}: ${link.href}`);
      else assert.match(link.href, /^\//, `${hotel.slug}: link đi tiếp phải là link nội bộ`);
    }
  }
});

// Widget mặc định tắt. Bật thì script phải từ chính đối tác — một `src`
// gõ nhầm sang host khác là chạy script lạ trên mọi lượt xem trang.
test("widget tìm kiếm: tắt, hoặc script https từ chính đối tác", () => {
  const config = HOTEL_SEARCH_WIDGET;
  if (!config.enabled) return;
  const url = new URL(config.scriptSrc);
  assert.equal(url.protocol, "https:");
  assert.match(url.hostname, /(^|\.)(expediagroup|expedia)\.com$/);
});

test("bài review/video tìm được trang khách sạn của nó", () => {
  assert.equal(hotelForPost({ slug: "park-hyatt-kyoto-review-park-suite-garden-view" })?.slug, "park-hyatt-kyoto");
  assert.equal(
    hotelForPost({ slug: "bat-ky", videoUrl: "https://youtu.be/lfockzqToYA" })?.slug,
    "park-hyatt-tokyo",
  );
  assert.equal(hotelForPost({ slug: "bai-khac", videoUrl: "https://www.youtube.com/watch?v=xxxxxxxxxxx" }), undefined);
});

test("helper", () => {
  const parkHyattKyoto = hotelBySlug("park-hyatt-kyoto")!;
  assert.equal(hotelLocationLabel(parkHyattKyoto), "Kyoto, Nhật Bản");
  assert.equal(hotelLocationLabel({ city: "Hong Kong", country: "HK" }), "Hong Kong");
  assert.equal(plainName("Park Hyatt® Kyoto"), "Park Hyatt Kyoto");
  assert.equal(plainName("tên® khách™ sạn"), "tên khách sạn");
  assert.equal(enabledAffiliateLinks(parkHyattKyoto).length, 1);
});

// ——— Bộ lọc ———

const ITEMS: HotelFilterValues[] = [
  { destination: "Tokyo", chain: "hyatt", category: "luxury" },
  { destination: "Tokyo", chain: "marriott", category: "upscale" },
  { destination: "Kyoto", chain: "hyatt", category: "luxury" },
  { destination: "Kyoto", chain: "marriott", category: "luxury" },
];

test("lọc: mặc định khớp tất cả, mỗi nhóm là AND", () => {
  assert.ok(ITEMS.every((item) => matchesSelection(item, EMPTY_SELECTION)));
  const kyotoHyatt = { ...EMPTY_SELECTION, destination: "Kyoto", chain: "hyatt" };
  assert.equal(ITEMS.filter((item) => matchesSelection(item, kyotoHyatt)).length, 1);
  assert.equal(activeFilterCount(kyotoHyatt), 2);
  assert.equal(activeFilterCount(EMPTY_SELECTION), 0);
});

test("lọc: số đếm của một nhóm tính trong phạm vi các nhóm khác", () => {
  const tokyo = { ...EMPTY_SELECTION, destination: "Tokyo" };
  const chains = facetCounts(ITEMS, tokyo, "chain");
  assert.deepEqual(Object.fromEntries(chains), { hyatt: 1, marriott: 1 });
  // Chính nhóm đang chọn thì không bị nó tự lọc: vẫn thấy Kyoto để đổi sang.
  const destinations = facetCounts(ITEMS, tokyo, "destination");
  assert.deepEqual(Object.fromEntries(destinations), { Tokyo: 2, Kyoto: 2 });
  assert.equal(FILTER_ALL, "all");
});
