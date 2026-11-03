import assert from "node:assert/strict";
import test from "node:test";

import { categorizeVideo } from "./video-category.ts";

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
