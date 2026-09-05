/**
 * Bảng kỷ lục chung — thứ DUY NHẤT trong game này gọi ra mạng.
 *
 * Mọi phần còn lại chạy trọn trong trình duyệt và không biết gì về server;
 * giữ nguyên như vậy, nên toàn bộ phần gọi API gom hết vào đây. Hỏng mạng,
 * hỏng endpoint, hay mở game ở một origin không có API — tất cả đều rơi về
 * `available = false` và game chạy y như trước khi có tính năng này. Một lượt
 * chơi không bao giờ được hỏng vì bảng kỷ lục.
 */
const ENDPOINT = "/api/game-record";
const TIMEOUT_MS = 8000;

function parseRecord(value) {
  if (!value || typeof value !== "object") return null;
  const { name, score, setAt } = value;
  if (typeof name !== "string" || typeof score !== "number") return null;
  return { name, score, setAt: typeof setAt === "string" ? setAt : null };
}

export function createLeaderboard(fetcher = fetch) {
  let record = null;
  let token = null;
  let available = true;

  async function call(init) {
    return fetcher(ENDPOINT, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  }

  return {
    get record() {
      return record;
    },
    /** Đã hỏi server ít nhất một lần mà không lỗi chưa. */
    get available() {
      return available;
    },
    /** Điểm này có phá được kỷ lục đang có không. */
    beats(score) {
      return available && (record === null || score > record.score);
    },
    /**
     * Lấy kỷ lục hiện tại và một token cho lượt sắp chơi.
     *
     * Gọi cả lúc mới vào lẫn lúc bắt đầu mỗi lượt: token mang mốc thời gian mà
     * server dùng để biết lượt chơi có kéo dài đúng 45 giây thật hay không, nên
     * nó phải được phát đúng lúc bấm nút chứ không phải lúc mở trang.
     */
    async refresh() {
      try {
        const res = await call({ method: "GET", cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        record = parseRecord(data.record);
        token = typeof data.token === "string" ? data.token : null;
        available = true;
      } catch {
        available = false;
      }
      return record;
    },
    /**
     * Gửi kỷ lục mới. Trả về `{ ok, record, reason }` — không bao giờ ném.
     *
     * `reason` để phần giao diện nói cho đúng: tên không hợp lệ là lỗi người
     * dùng sửa được, còn "vừa có người khác vượt qua" thì không.
     */
    async submit(name, score) {
      if (!token) return { ok: false, reason: "no_token" };
      try {
        const res = await call({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, score, name }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          record = parseRecord(data.record) ?? record;
          return { ok: true, record };
        }
        // 409: trong lúc người này gõ tên thì đã có người khác vượt lên.
        if (res.status === 409) record = parseRecord(data.record) ?? record;
        return { ok: false, reason: data.message || String(res.status), record };
      } catch {
        return { ok: false, reason: "network" };
      }
    },
  };
}
