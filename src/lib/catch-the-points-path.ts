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
 * File tĩnh của game (`games/catch-the-points/web/`, phục vụ bởi route
 * `app/games/catch-the-points/[...path]`).
 *
 * PHẢI có đuôi `index.html`: route đó chỉ phục vụ đúng từng file, không có
 * kiểu "thư mục có index" — `/games/catch-the-points/` là 404. Và vì mọi đường
 * dẫn bên trong game đều là tương đối, thiếu đuôi file là asset đi lạc lên một
 * cấp.
 */
export const CATCH_THE_POINTS_GAME_SRC = "/games/catch-the-points/index.html";
