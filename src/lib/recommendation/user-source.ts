/**
 * Cửa DUY NHẤT engine đọc trạng thái người dùng.
 *
 * Song song với `RecommendationDataSource` trong `source.ts`, và cùng một hợp
 * đồng: engine gọi qua đây, backend đổi bên dưới mà engine không đụng một dòng.
 *
 * VÌ SAO CHƯA CHỌN DATABASE. Bàn giao Phase 1 (§8.1) để ngỏ câu hỏi này, và nó
 * là quyết định về hạ tầng và chi phí chứ không phải quyết định kỹ thuật thuần
 * — repo chưa có database nào, site deploy thẳng từ `main` lên Hostinger. Phần
 * việc Phase 2 thật sự phải làm là MÔ HÌNH: trạng thái người dùng biểu diễn
 * được đủ những ca khác nhau chưa. Mô hình đó không đổi theo chỗ lưu, nên nó
 * làm được ngay, và chỗ lưu quyết định sau mà không phải viết lại gì.
 *
 * VÌ SAO CHỈ CÓ ĐỌC. Phase 3 chỉ đọc. Phần ghi (tạo hồ sơ, sửa thẻ, cập nhật
 * số dư) đi liền với lựa chọn lưu trữ — transaction, migration, quyền truy cập
 * đều là câu hỏi của chỗ lưu cụ thể. Dựng sẵn một interface ghi bây giờ là
 * đoán trước hình dạng của một thứ chưa tồn tại, và Phase 1 đã ghi lại rằng
 * rủi ro lớn nhất của nó chính là một interface chưa từng chạy với backend thứ
 * hai. Thêm bề mặt chưa dùng chỉ làm rủi ro đó lớn hơn.
 */

import type { UserState } from "./user-types.ts";

export interface UserDataSource {
  /** `null` = không có người dùng này. Khác với một hồ sơ trống rỗng, thứ vẫn
   *  là một người dùng có thật chỉ chưa khai gì. */
  getUserState(userId: string): Promise<UserState | null>;
}

/**
 * Bản cài đặt trong bộ nhớ — dùng cho test, fixture và phát triển.
 *
 * TRẢ VỀ BẢN SAO. Một database luôn trả về bản sao, nên nếu chỗ này trả về
 * chính object gốc thì engine lỡ tay sửa `state.cards` sẽ chạy đúng ở đây và
 * hỏng khi đổi sang database thật — đúng loại khác biệt mà một interface chung
 * sinh ra để triệt tiêu. Đây cũng là lần đầu hợp đồng `UserDataSource` được
 * viết cho hai thế giới cùng lúc thay vì cho một.
 */
export function inMemoryUserStore(states: UserState[]): UserDataSource {
  const byId = new Map(states.map((state) => [state.profile.id as string, state]));
  return {
    async getUserState(userId: string): Promise<UserState | null> {
      const found = byId.get(userId);
      return found === undefined ? null : structuredClone(found);
    },
  };
}
