// Ghế 1A's own rough benchmark valuations (CAD cents per point), shown next
// to the user's calculated value for comparison. Update as programs change.
//
// `cardProgramId` và `awardProgramId` là cầu nối sang hai danh sách chương
// trình KHÁC trong repo, và chúng không dùng chung id:
//
//   - `card-points-programs.ts` (bộ lọc `?points=` ở /credit-cards) gọi RBC
//     Avion là `avion`, còn file này gọi là `rbc-avion`.
//   - `award-charts.ts` (Award Flight Finder) chỉ có chương trình hàng không
//     mà nó thật sự có bảng giá, nên Amex MR và RBC Avion không nằm trong đó.
//
// Nối thẳng `/credit-cards?points=${program.id}` từ calculator vì thế sẽ âm
// thầm hỏng cho Avion: `/credit-cards` cố ý cho `?points=` lạ rơi về danh sách
// KHÔNG lọc (xem credit-cards/page.tsx) nên không có lỗi nào nổ ra — người đọc
// chỉ nhận sai kết quả. Khai báo tường minh ở đây để chỗ nối không phải đoán,
// và `null` là câu trả lời hợp lệ chứ không phải thiếu sót.
export const POINTS_PROGRAMS = [
  {
    id: "amex-mr",
    name: "Amex Membership Rewards®",
    centsPerPoint: 1.8,
    cardProgramId: "amex-mr",
    awardProgramId: null,
  },
  {
    id: "rbc-avion",
    name: "RBC Avion®",
    centsPerPoint: 1.6,
    cardProgramId: "avion",
    awardProgramId: null,
  },
  {
    id: "aeroplan",
    name: "Air Canada Aeroplan®",
    centsPerPoint: 1.9,
    cardProgramId: "aeroplan",
    awardProgramId: "aeroplan",
  },
] as const;

export type PointsProgram = (typeof POINTS_PROGRAMS)[number];
export type PointsProgramId = PointsProgram["id"];
