/**
 * Đường dẫn của trang game và của file tĩnh nó nhúng.
 *
 * Tách ra một file riêng, KHÔNG để trong component của trang: header là Client
 * Component nằm ở layout gốc, nên bất cứ thứ gì nó import cũng đi vào bundle
 * của cả 101 trang. Cùng lý do với `bank-compare-path.ts`.
 */

/** Trang trong site, có header/footer và SEO như mọi trang khác. */
export const CATCH_THE_POINTS_PATH = "/catch-the-points";

/**
 * File tĩnh của game trong `public/`.
 *
 * PHẢI có đuôi `index.html`: Next không phục vụ file trong `public/` theo kiểu
 * "thư mục có index" — `/games/catch-the-points/` sẽ là 404. Và vì mọi đường
 * dẫn bên trong game đều là tương đối, thiếu đuôi file là asset đi lạc lên một
 * cấp.
 */
export const CATCH_THE_POINTS_GAME_SRC = "/games/catch-the-points/index.html";
