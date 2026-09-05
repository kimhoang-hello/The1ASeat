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
  const record = await fetchGameRecord();
  return NextResponse.json(
    { record, token: issueRoundToken() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Giới hạn theo IP, giữ trong bộ nhớ tiến trình.
 *
 * Cố ý KHÔNG dùng database: site chạy một tiến trình Next duy nhất (xem
 * `ecosystem.config.js`), nên một Map là đủ. Deploy lại là mất, và điều đó
 * không sao — nó chỉ chặn kiểu spam gửi liên tục, không phải một hàng rào
 * bảo mật.
 */
const submissions = new Map<string, number[]>();
const RATE_WINDOW_MS = 60 * 60_000;
const RATE_LIMIT = 8;

function rateLimited(ip: string, now: number): boolean {
  const recent = (submissions.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    submissions.set(ip, recent);
    return true;
  }
  recent.push(now);
  submissions.set(ip, recent);
  // Dọn rác để Map không phình theo số IP đã từng ghé.
  if (submissions.size > 5000) {
    for (const [key, times] of submissions) {
      if (times.every((at) => now - at >= RATE_WINDOW_MS)) submissions.delete(key);
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  const now = Date.now();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "bad_json" }, { status: 400 });
  }
  const { token, score, name } = (body ?? {}) as Record<string, unknown>;

  if (!isPlausibleRound(token, now)) {
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
  if (rateLimited(ip, now)) {
    return NextResponse.json({ message: "rate_limited" }, { status: 429 });
  }

  // Đọc lại kỷ lục ngay trước khi ghi, không tin con số client gửi kèm: hai
  // người cùng phá kỷ lục trong một phút thì người sau phải so với người
  // trước, chứ không phải với con số mà trình duyệt họ tải về lúc mới vào.
  const current = await fetchGameRecord();
  if (current && score <= current.score) {
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
  revalidateTag(GAME_RECORD_TAG, { expire: 0 });
  return NextResponse.json({ record }, { headers: { "Cache-Control": "no-store" } });
}
