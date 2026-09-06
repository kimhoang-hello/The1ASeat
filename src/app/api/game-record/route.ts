import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import {
  GAME_RECORD_TAG,
  MAX_NAME_LENGTH,
  cleanPlayerName,
  createGameRecord,
  fetchGameRecord,
  isAcceptableScore,
  isPlausibleRound,
  issueRoundToken,
  readGameRecord,
  roundTokenExpiresAt,
} from "@/lib/game-record";

/**
 * Bảng kỷ lục của mini-game Catch The Points.
 *
 * GET  — kỷ lục hiện tại, kèm một token cho lượt chơi sắp bắt đầu.
 * POST — gửi điểm mới. Chỉ ghi khi điểm thật sự vượt kỷ lục đang có.
 *
 * ĐÂY LÀ ENDPOINT CÔNG KHAI, khác ba job có `jobAuthResponse`: bất kỳ ai chơi
 * cũng phải gọi được. Vì thế mọi thứ nhận vào đều bị coi là không đáng tin —
 * xem `lib/game-record.ts` cho từng lớp kiểm.
 */

// Không được cache: GET phát token mang mốc thời gian, mà một token đóng băng
// trong cache CDN thì mọi lượt chơi đều nhận cùng một mốc cũ.
export const dynamic = "force-dynamic";

export async function GET() {
  // Phát token TRƯỚC khi đọc Contentful, không phải sau.
  //
  // Game gọi GET ngay lúc bấm "Bắt đầu chơi", và server kiểm điểm bằng cách so
  // tuổi token với 40 giây. Nếu ký token sau khi `fetchGameRecord()` trả về,
  // mốc trong token trễ hơn lúc bấm nút đúng bằng thời gian chờ Contentful —
  // Contentful chậm 7 giây là một lượt chơi 45 giây thật bị tính thành 38 giây
  // và bị từ chối. Người chơi mất kỷ lục vì một thứ họ không gây ra.
  const token = issueRoundToken();
  const record = await fetchGameRecord();
  return NextResponse.json({ record, token }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Hai lớp hạn mức, giữ trong bộ nhớ tiến trình.
 *
 * Cố ý KHÔNG dùng database: site chạy một tiến trình Next duy nhất (xem
 * `ecosystem.config.js`), nên hai Map là đủ. Deploy lại là mất, và điều đó
 * không sao — đây là hàng rào chống spam, không phải hàng rào bảo mật.
 *
 * LỚP THEO TOKEN mới là lớp làm việc thật. Hạn mức theo IP dựa vào header do
 * proxy gắn, mà repo này KHÔNG biết proxy của Hostinger gắn gì: tin phần tử
 * đầu của `X-Forwarded-For` thì ai cũng giả được, mà tin phần tử cuối thì nếu
 * họ có hai tầng proxy, mọi người đọc sẽ dùng chung một IP và chặn nhau. Token
 * thì không giả được (có chữ ký) và mỗi lượt chơi chỉ có một, lại phải già ít
 * nhất 40 giây mới dùng được — nên giới hạn số lần ghi trên MỘT token là thứ
 * chặn thật sự, không phụ thuộc vào việc đoán đúng header.
 */
const WRITES_PER_TOKEN = 3;
/** Trần cứng cho bảng đếm token. Vượt trần thì bỏ những mục hết hạn trước, còn
 *  thiếu thì bỏ luôn mục sắp hết hạn nhất — mất vài phép đếm còn hơn để một
 *  vòng bơm token đẩy tiến trình tới hết bộ nhớ. */
const MAX_TOKEN_ENTRIES = 5000;
const tokenWrites = new Map<string, { count: number; expiresAt: number }>();

const RATE_WINDOW_MS = 60 * 60_000;
/** Rộng tay có chủ ý: nếu header IP hoá ra trỏ chung về proxy của Hostinger
 *  thì cả website dùng chung một ô đếm, và một con số chặt sẽ khoá hết người
 *  chơi thật. Lớp này chỉ để chặn vòng lặp chạy loạn. */
const WRITES_PER_IP = 60;
const ipWrites = new Map<string, number[]>();

/**
 * Địa chỉ để đếm — và một lời thú nhận về giới hạn của nó.
 *
 * Ưu tiên `x-real-ip` (proxy tự đặt, ghi đè giá trị client gửi lên), rồi tới
 * phần tử CUỐI của `X-Forwarded-For`; phần tử ĐẦU là thứ client tự khai nên
 * không bao giờ dùng. Nhưng repo này KHÔNG biết Hostinger dựng mấy tầng proxy,
 * mà không có danh sách proxy tin cậy thì KHÔNG cách nào chọn đúng hop: nhiều
 * tầng thì mọi người đọc dồn vào một ô đếm. Đó chính là lý do trần IP để rộng
 * 60 lượt/giờ và KHÔNG phải lớp chặn chính — lớp chặn chính là hạn mức theo
 * token bên dưới, thứ không phụ thuộc vào việc đoán đúng header.
 */
function clientKey(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  const hops = forwarded?.split(",").map((hop) => hop.trim()).filter(Boolean) ?? [];
  return hops.at(-1) ?? "unknown";
}

function overTokenLimit(token: string, now: number): boolean {
  // Dọn bằng phép so sánh số, không ký lại chữ ký nào — xem
  // `roundTokenExpiresAt`.
  for (const [key, entry] of tokenWrites) {
    if (entry.expiresAt <= now) tokenWrites.delete(key);
  }
  if (tokenWrites.size >= MAX_TOKEN_ENTRIES) {
    const soonestFirst = [...tokenWrites.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (const [key] of soonestFirst.slice(0, tokenWrites.size - MAX_TOKEN_ENTRIES / 2)) {
      tokenWrites.delete(key);
    }
  }
  const entry = tokenWrites.get(token);
  if (entry && entry.count >= WRITES_PER_TOKEN) return true;
  tokenWrites.set(token, {
    count: (entry?.count ?? 0) + 1,
    expiresAt: entry?.expiresAt ?? roundTokenExpiresAt(token),
  });
  return false;
}

function overIpLimit(key: string, now: number): boolean {
  const recent = (ipWrites.get(key) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= WRITES_PER_IP) {
    ipWrites.set(key, recent);
    return true;
  }
  recent.push(now);
  ipWrites.set(key, recent);
  if (ipWrites.size > 5000) {
    for (const [existing, times] of ipWrites) {
      if (times.every((at) => now - at >= RATE_WINDOW_MS)) ipWrites.delete(existing);
    }
    if (ipWrites.size > 5000) {
      const oldestFirst = [...ipWrites.entries()].sort((a, b) => (a[1].at(-1) ?? 0) - (b[1].at(-1) ?? 0));
      for (const [existing] of oldestFirst.slice(0, ipWrites.size - 2500)) ipWrites.delete(existing);
    }
  }
  return false;
}

/**
 * Điểm cao nhất tiến trình này ĐÃ TỰ TAY ghi.
 *
 * Cần thật, không phải cho chắc: publish xong thì dữ liệu mới còn mất vài giây
 * mới lan hết CDN của Contentful, mà `revalidateTag` chỉ xoá cache của Next.
 * Nên lượt ghi ngay sau đó vẫn có thể đọc được con số CŨ qua CDA và cho một
 * điểm THẤP HƠN đi qua. Site chạy một tiến trình duy nhất nên biến này bịt
 * đúng khoảng trống đó cho trường hợp thực tế: hai người phá kỷ lục cách nhau
 * vài giây.
 */
let bestWrittenHere = 0;

/**
 * Nối các lượt ghi thành một hàng, không cho chạy song song.
 *
 * "Đọc kỷ lục hiện tại rồi ghi nếu cao hơn" là hai bước, và Contentful không
 * có transaction. Hai người cùng phá kỷ lục trong cùng một giây sẽ cùng đọc
 * được con số cũ, cùng thấy mình vượt, và cùng ghi. Site chạy một tiến trình
 * duy nhất nên một promise nối đuôi là đủ để xếp hàng — không cần khoá phân
 * tán cho một mini-game.
 */
let writeQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(work, work);
  writeQueue = next.catch(() => {});
  return next;
}

export async function POST(request: NextRequest) {
  const now = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "bad_json" }, { status: 400 });
  }
  const { token, score, name } = (body ?? {}) as Record<string, unknown>;

  if (typeof token !== "string" || !isPlausibleRound(token, now)) {
    return NextResponse.json({ message: "bad_round" }, { status: 400 });
  }
  if (!isAcceptableScore(score)) {
    return NextResponse.json({ message: "bad_score" }, { status: 400 });
  }
  const playerName = cleanPlayerName(name);
  if (!playerName) {
    return NextResponse.json({ message: "bad_name", maxLength: MAX_NAME_LENGTH }, { status: 400 });
  }

  // Đếm hạn mức Ở ĐÂY, sau khi đã qua hết các cửa kiểm — không phải ngay đầu
  // hàm. Gõ sai tên hai lần rồi hết lượt gửi là một cách rất tốt để làm người
  // vừa phá kỷ lục mất luôn kỷ lục đó. Mấy lượt bị chặn vì token sai hay tên
  // sai đều rẻ (không chạm Contentful), nên không cần tính vào hạn mức.
  // IP TRƯỚC, token SAU. Đảo lại thì một IP đã bị chặn vẫn tiếp tục nhét khoá
  // mới vào bảng token ở mỗi request — bảng phình ra mà chẳng ai ghi được gì.
  // Và vì `||` ngắn mạch, xếp token trước còn làm việc spam đúng MỘT token
  // không bao giờ chạm tới hạn mức IP.
  if (overIpLimit(clientKey(request), now) || overTokenLimit(token, now)) {
    return NextResponse.json({ message: "rate_limited" }, { status: 429 });
  }

  return serialize(async () => {
    // Đọc lại kỷ lục ngay trước khi ghi, không tin con số client gửi kèm.
    // `readGameRecord` NÉM khi không hỏi được Contentful, và đó là cố ý: đọc
    // hỏng mà vẫn ghi thì đúng lúc CDA trả 503, một điểm 1.000 cũng đè lên kỷ
    // lục 100.000 đang có.
    let current: Awaited<ReturnType<typeof readGameRecord>>;
    try {
      current = await readGameRecord();
    } catch (error) {
      console.error("game-record: read failed", error);
      return NextResponse.json({ message: "unverifiable" }, { status: 503 });
    }
    // So với con số CAO NHẤT trong hai nguồn: bản CDA vừa đọc, và bản chính
    // tiến trình này vừa ghi (CDA có thể còn chậm vài giây).
    const bar = Math.max(current?.score ?? 0, bestWrittenHere);
    if (bar > 0 && score <= bar) {
      return NextResponse.json({ message: "not_a_record", record: current }, { status: 409 });
    }

    const record = { name: playerName, score, setAt: new Date(now).toISOString() };
    try {
      await createGameRecord(record);
    } catch (error) {
      console.error("game-record: create failed", error);
      return NextResponse.json({ message: "write_failed" }, { status: 502 });
    }

    // `{ expire: 0 }`, không phải `"max"`: `"max"` là stale-while-revalidate nên
    // người vào ngay sau đó vẫn thấy kỷ lục cũ. Cùng lý do đã đo và ghi ở
    // `api/revalidate/route.ts`.
    bestWrittenHere = Math.max(bestWrittenHere, score);
    revalidateTag(GAME_RECORD_TAG, { expire: 0 });
    return NextResponse.json({ record }, { headers: { "Cache-Control": "no-store" } });
  });
}
