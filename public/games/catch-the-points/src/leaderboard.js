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
/** Đọc thì bỏ cuộc sớm — mất dòng kỷ lục không sao. */
const READ_TIMEOUT_MS = 8000;
/**
 * Ghi thì chờ lâu hơn hẳn — nhưng con số này KHÔNG phải thứ giữ cho đúng.
 *
 * Một lượt ghi ở server là ba việc nối nhau: đọc Contentful, tạo entry, publish
 * entry — cộng lại tối đa còn dài hơn 25 giây. Trình duyệt bỏ cuộc KHÔNG dừng
 * được server, nên có kéo timeout tới đâu thì vẫn còn khe: người chơi thấy
 * "Chưa lưu được" trong khi kỷ lục vừa ghi xong sau đó, bấm thử lại thì nhận
 * 409 và bị báo "có người khác vượt lên" — mà người đó chính là họ.
 *
 * Nên chỗ thật sự giữ cho đúng là `confirmLanded()` bên dưới: hỏng đường nào
 * cũng đi hỏi lại bảng kỷ lục xem điểm mình có nằm đó không, rồi mới kết luận.
 */
const WRITE_TIMEOUT_MS = 25000;

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

  async function call(init, timeout) {
    return fetcher(ENDPOINT, { ...init, signal: AbortSignal.timeout(timeout) });
  }

  const api = {
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
        const res = await call({ method: "GET", cache: "no-store" }, READ_TIMEOUT_MS);
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

      /**
       * Hỏi lại bảng kỷ lục xem lượt ghi vừa rồi có tới nơi không.
       *
       * Dùng khi client bỏ cuộc giữa chừng hoặc mạng đứt: server có thể đã ghi
       * xong sau lưng. Nếu kỷ lục hiện tại đúng bằng điểm vừa gửi thì lượt ghi
       * đã thành công, đừng báo hỏng và đừng bắt người chơi gửi lại — gửi lại
       * là tạo thêm một dòng trùng.
       */
      async function confirmLanded() {
        await api.refresh();
        if (api.record === null) return "unknown";
        if (api.record.score === score) return "landed";
        // Điểm mình gửi có thể đã tới nơi rồi bị người khác vượt qua ngay sau
        // đó — khi ấy nói đúng chuyện đó, đừng đổ cho mạng.
        return api.record.score > score ? "beaten" : "unknown";
      }

      try {
        const res = await call(
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, score, name }),
          },
          WRITE_TIMEOUT_MS,
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          record = parseRecord(data.record) ?? record;
          return { ok: true, record };
        }
        // 409: trong lúc người này gõ tên thì đã có người khác vượt lên.
        if (res.status === 409) {
          record = parseRecord(data.record) ?? record;
          return { ok: false, reason: data.message || String(res.status), record };
        }
        // CHỈ 502 ("write_failed"), không phải mọi 5xx: server trả 502 đúng
        // khi `createGameRecord` (create + publish, hai lượt gọi Contentful
        // nối tiếp) ném — lúc đó có thể server đã ghi xong rồi mới mất
        // response trên đường về, cùng sự mập mờ như khi `fetch` tự ném ở
        // nhánh `catch` dưới đây. 503 ("unverifiable") thì KHÁC HẲN: nó xảy ra
        // ở `readGameRecord()`, TRƯỚC khi có bất kỳ lượt ghi nào — xác nhận ở
        // đây là vô nghĩa, và nếu đúng lúc đó có người khác vừa lập cùng một
        // điểm số thì `confirmLanded` so trùng điểm sẽ báo NHẦM là lượt của
        // mình đã thành công. 4xx (bad_round/bad_score/bad_name/rate_limited)
        // cũng không: bị từ chối trước khi chạm Contentful.
        if (res.status === 502) {
          const outcome = await confirmLanded();
          if (outcome === "landed") return { ok: true, record };
          if (outcome === "beaten") return { ok: false, reason: "not_a_record", record };
        }
        return { ok: false, reason: data.message || String(res.status), record };
      } catch {
        const outcome = await confirmLanded();
        if (outcome === "landed") return { ok: true, record };
        if (outcome === "beaten") return { ok: false, reason: "not_a_record", record };
        return { ok: false, reason: "network" };
      }
    },
  };
  return api;
}
