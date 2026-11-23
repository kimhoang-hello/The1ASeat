import assert from "node:assert/strict";
import test from "node:test";

import { categorizeVideo, isShortsEntry } from "./video-category.ts";

// Tiêu đề thật của kênh. Ba ca đầu đều chứa chuỗi "suite" mà là video bay —
// ca đầu tiên là lỗi thật ngày 01/11/2026 (xem chú thích trong video-category.ts).
const FLIGHTS = [
  "I Flew ANA's Incredible First Class THE Suite | Tokyo to Chicago",
  "13 Hours Flying Japan Airlines' NEW First Class Suite A350-1000 | Tokyo to New York",
  "I Flew Qatar Airways Qsuite - Is It Really Worth the Hype?",
  "Is Japan Airlines Business Class Sky Suite Still Good?",
  "Best Bulkhead Seat Ever? Air France Business Class Review",
  "Why Everyone’s Obsessed with ANA’s Business Class ‘THE ROOM’? Here’s What It’s Really Like",
];

const HOTELS = [
  "They Upgraded Me to a Premium Corner Suite with Spectacular Bay Views | The Ritz-Carlton Fukuoka",
  "The Park Hyatt Tokyo Is Back — Here’s the NEW King Suite Deluxe",
  "I Stayed at Hotel Sosei Sapporo for Just $78! | Full Hotel Review",
  "The Hyatt Hotel Everyone Should Book in Osaka | Caption Namba Review",
  "Inside Kimpton Da An Taipei | Is This the Best Boutique Hotel in Taiwan?",
  // Hai tiêu đề giả do Codex nêu: chữ "flying"/"flight" không biến video khách sạn thành video bay.
  "Flying Blue hotel booking with miles",
  "Best Hotel for Flight Attendants",
];

test("video bay vào Đánh giá, kể cả khi tiêu đề có chữ suite", () => {
  for (const title of FLIGHTS) {
    assert.deepEqual(categorizeVideo(title), { categoryVi: "Đánh giá", categoryEn: "Review", icon: "airplane" }, title);
  }
});

test("video khách sạn vẫn vào Khách sạn", () => {
  for (const title of HOTELS) {
    assert.deepEqual(categorizeVideo(title), { categoryVi: "Khách sạn", categoryEn: "Hotel", icon: "building" }, title);
  }
});

test("isShortsEntry đọc link alternate, không đọc phần mô tả (Codex 23/11/2026)", () => {
  const entry = (href: string, description: string) =>
    `<id>yt:video:abc</id><yt:videoId>abc</yt:videoId><title>t</title>` +
    `<link rel="alternate" href="${href}"/><published>2026-11-22T15:00:09+00:00</published>` +
    `<media:group><media:description>${description}</media:description></media:group>`;

  assert.equal(isShortsEntry(entry("https://www.youtube.com/shorts/abc", "")), true);
  assert.equal(isShortsEntry(entry("https://www.youtube.com/watch?v=abc", "")), false);
  // Video thường có mô tả trỏ sang một Short: vẫn là video thường.
  assert.equal(
    isShortsEntry(entry("https://www.youtube.com/watch?v=abc", "Xem bản ngắn: https://www.youtube.com/shorts/xyz")),
    false,
  );
  // Thứ tự thuộc tính không quan trọng; link khác rel bị bỏ qua.
  assert.equal(
    isShortsEntry(`<link href="https://www.youtube.com/channel/x" rel="self"/><link href="https://www.youtube.com/shorts/abc" rel="alternate"/>`),
    true,
  );
});
