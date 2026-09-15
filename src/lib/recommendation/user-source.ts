/**
 * Cửa DUY NHẤT engine đọc trạng thái người dùng — và, từ Phase 5, cửa ghi.
 *
 * Song song với `RecommendationDataSource` trong `source.ts`, và cùng một hợp
 * đồng: engine gọi qua đây, backend đổi bên dưới mà engine không đụng một dòng.
 *
 * ĐỌC VÀ GHI LÀ HAI INTERFACE. Engine chỉ cần `UserDataSource`; phần ghi
 * (`UserStateStore`) là việc của bảng câu hỏi. Tách ra để không đường nào từ
 * engine chạm được tới hàm ghi — mô hình người dùng không được mã hoá kết quả,
 * và engine không được sửa hồ sơ nó đang đọc.
 *
 * GHI CẢ TRẠNG THÁI, CÓ ĐIỀU KIỆN — không vá từng trường. Một câu trả lời được
 * áp vào trạng thái hiện có bằng code thuần ở tầng trang (kiểm được bằng test),
 * rồi thay nguyên khối nếu `version` vẫn là bản mới nhất. Vá từng trường trong
 * SQL là chia phép kiểm hợp lệ ra hai nơi; thay không điều kiện thì hai tab
 * cùng trả lời sẽ lặng lẽ xoá câu trả lời của nhau.
 *
 * Kho KHÔNG chạy `validateUserState`: phép kiểm đó đối chiếu với bộ dữ liệu
 * sản phẩm của một ngày cụ thể, và một thẻ ngừng phát hành về sau không được
 * làm hồ sơ cũ thành không đọc được. Người gọi kiểm với bộ dữ liệu hiện hành
 * TRƯỚC khi ghi; kho chỉ giữ luật của chính nó (khoá hợp lệ, đi qua JSON được).
 */

import { canonicalJson } from "./fingerprint.ts";
import { checkStoreKey } from "./store-keys.ts";
import type { UserState } from "./user-types.ts";

export interface UserDataSource {
  /** `null` = không có người dùng này. Khác với một hồ sơ trống rỗng, thứ vẫn
   *  là một người dùng có thật chỉ chưa khai gì. */
  getUserState(userId: string): Promise<UserState | null>;
}

export interface StoredUserState {
  state: UserState;
  /** Tăng 1 mỗi lần ghi; bản đầu là 1. */
  version: number;
}

export interface UserStateStore extends UserDataSource {
  getStoredUserState(userId: string): Promise<StoredUserState | null>;
  /** Tạo người dùng mới. Id đã có là LỖI — không phải một lần ghi đè. */
  createUserState(state: UserState): Promise<StoredUserState>;
  /**
   * Thay TOÀN BỘ trạng thái nếu bản đang lưu vẫn mang `expectedVersion`.
   * Không khớp → `UserStateConflictError`: người gọi đọc lại, áp lại câu trả
   * lời, ghi lại. Không có người dùng này cũng là lỗi.
   */
  replaceUserState(state: UserState, expectedVersion: number): Promise<StoredUserState>;
}

export class UserStateConflictError extends Error {
  readonly userId: string;
  readonly expectedVersion: number;
  /** `null` = không có người dùng này. */
  readonly actualVersion: number | null;

  constructor(userId: string, expectedVersion: number, actualVersion: number | null) {
    super(
      actualVersion === null
        ? `replaceUserState: không có người dùng ${userId}`
        : `replaceUserState: ${userId} đang ở version ${actualVersion}, không phải ${expectedVersion} — đọc lại rồi ghi lại`,
    );
    this.name = "UserStateConflictError";
    this.userId = userId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Chuỗi sẽ được lưu cho một trạng thái — CHUNG cho mọi backend.
 *
 * Đi qua `canonicalJson` như `executeRun` vẫn làm với đầu vào của engine: thứ
 * được lưu và thứ lượt chạy ghi vào `input_snapshot` phải là một, và `Map`/
 * `Set` nổ ở đây thay vì lặng lẽ thành `{}`.
 */
export function serializeUserState(state: UserState): { userId: string; json: string } {
  const json = canonicalJson(state);
  const userId = checkStoreKey((state as { profile?: { id?: unknown } } | null)?.profile?.id, "profile.id");
  return { userId, json };
}

export function checkExpectedVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error(`replaceUserState: expectedVersion phải là số nguyên ≥ 1 (nhận ${version})`);
  }
}

/**
 * Bản cài đặt trong bộ nhớ — dùng cho test, fixture và phát triển.
 *
 * TRẢ VỀ BẢN SAO. Một database luôn trả về bản sao, nên nếu chỗ này trả về
 * chính object gốc thì engine lỡ tay sửa `state.cards` sẽ chạy đúng ở đây và
 * hỏng khi đổi sang database thật — đúng loại khác biệt mà một interface chung
 * sinh ra để triệt tiêu.
 *
 * Trạng thái nạp sẵn giữ bằng `structuredClone` như trước (fixture HỎNG phải
 * đi tới engine nguyên dạng hỏng); trạng thái GHI qua kho thì đi qua
 * `serializeUserState` — cùng chuỗi bản MySQL lưu.
 */
export function inMemoryUserStore(states: UserState[] = []): UserStateStore {
  const byId = new Map<string, { state: UserState; version: number }>(
    states.map((state) => [state.profile.id as string, { state, version: 1 }]),
  );
  const read = (userId: string): StoredUserState | null => {
    const found = byId.get(userId);
    return found === undefined ? null : { state: structuredClone(found.state), version: found.version };
  };
  return {
    async getUserState(userId) {
      return read(userId)?.state ?? null;
    },
    async getStoredUserState(userId) {
      return read(userId);
    },
    async createUserState(state) {
      const { userId, json } = serializeUserState(state);
      if (byId.has(userId)) throw new Error(`createUserState: người dùng ${userId} đã có — không ghi đè`);
      byId.set(userId, { state: JSON.parse(json) as UserState, version: 1 });
      return read(userId)!;
    },
    async replaceUserState(state, expectedVersion) {
      checkExpectedVersion(expectedVersion);
      const { userId, json } = serializeUserState(state);
      const current = byId.get(userId);
      if (current === undefined || current.version !== expectedVersion) {
        throw new UserStateConflictError(userId, expectedVersion, current?.version ?? null);
      }
      byId.set(userId, { state: JSON.parse(json) as UserState, version: expectedVersion + 1 });
      return read(userId)!;
    },
  };
}
