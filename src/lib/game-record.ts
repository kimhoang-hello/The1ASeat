import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { cmaClient, cmaInit, LOCALE } from "@/lib/contentful-cma";

/**
 * Kỷ lục chung của mini-game Catch The Points.
 *
 * MỖI LẦN có người phá kỷ lục là MỘT entry mới trong Contentful, không phải
 * ghi đè một entry duy nhất. Nhờ vậy tác giả có nguyên cuốn sổ để xem, và xoá
 * một dòng bịa thì kỷ lục trước đó tự sống lại — không phải gõ tay lại con số
 * cũ. Game luôn đọc dòng có `score` cao nhất.
 */
export const GAME_RECORD_TYPE = "gameHighScore";

export interface GameRecord {
  name: string;
  score: number;
  setAt: string;
}

/** Trần điểm mà server chịu nhận. */
export const MAX_ACCEPTED_SCORE = 500_000;
/** Tên dài nhất — trùng validation của field trong Contentful. */
export const MAX_NAME_LENGTH = 24;

/**
 * Một lượt chơi dài 45 giây, và game tự dừng đồng hồ khi người chơi chuyển
 * tab, nên đồng hồ treo tường LUÔN dài hơn 45 giây. 40 giây là mức sàn có
 * chừa sai số làm tròn; dưới mức đó thì chắc chắn không phải một lượt chơi
 * thật. Trần 30 phút để một token cũ không nằm chờ mãi.
 */
const MIN_ROUND_MS = 40_000;
const MAX_ROUND_MS = 30 * 60_000;

/**
 * Khoá ký token, dẫn xuất từ token Contentful thay vì đòi thêm một biến môi
 * trường nữa.
 *
 * Băm một chiều, nên khoá này lộ cũng không suy ngược ra token Contentful. Đổi
 * token Contentful thì các token đang phát dở mất hiệu lực — người chơi lúc đó
 * chỉ cần chơi lại một lượt, không hỏng gì. `GAME_RECORD_SECRET` vẫn được ưu
 * tiên nếu ai đó muốn tách bạch hẳn.
 */
function signingKey(): string | null {
  const explicit = process.env.GAME_RECORD_SECRET;
  if (explicit) return explicit;
  const contentful = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!contentful) return null;
  return createHash("sha256").update(`catch-the-points|${contentful}`).digest("hex");
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * Token phát lúc bắt đầu lượt chơi. Chỉ mang mốc thời gian, và KHÔNG lưu ở
 * đâu cả — không có bảng nonce, không có session. Nó chặn đúng một thứ: gửi
 * điểm mà chưa từng ngồi chơi hết 45 giây.
 *
 * Dùng lại được token cũ trong 30 phút, và đó là chấp nhận được: gửi lại vẫn
 * phải vượt kỷ lục hiện tại mới ghi được gì. Chống tới mức này là đủ cho một
 * game chạy hoàn toàn trong trình duyệt — điểm do máy người chơi tính, nên
 * không có cách nào chặn tuyệt đối; tuyến phòng thủ cuối là tác giả xoá dòng
 * bịa trong Contentful.
 */
export function issueRoundToken(now = Date.now()): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload = String(now);
  return `${payload}.${sign(payload, key)}`;
}

export function roundTokenAgeMs(token: unknown, now = Date.now()): number | null {
  const key = signingKey();
  if (!key || typeof token !== "string") return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;

  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(mac);
  // So sánh theo thời gian hằng định; độ dài lệch thì `timingSafeEqual` ném.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const issuedAt = Number(payload);
  if (!Number.isFinite(issuedAt)) return null;
  return now - issuedAt;
}

/** Token hợp lệ VÀ lượt chơi kéo dài đúng như một lượt thật. */
export function isPlausibleRound(token: unknown, now = Date.now()): boolean {
  const age = roundTokenAgeMs(token, now);
  return age !== null && age >= MIN_ROUND_MS && age <= MAX_ROUND_MS;
}

/**
 * Tên người chơi sau khi dọn.
 *
 * Trả `null` nếu không còn gì để hiển thị. Cắt ký tự điều khiển (kể cả ký tự
 * vô hình dùng để giả mạo khoảng trắng), gộp khoảng trắng, chặn thứ trông như
 * đường link — bảng kỷ lục là chỗ dễ bị dùng làm bảng quảng cáo.
 */
export function cleanPlayerName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .replace(/[\p{C}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  if (!cleaned) return null;
  if (/https?:\/\/|www\.|\.(com|net|org|vn|io|co)\b/i.test(cleaned)) return null;
  return cleaned;
}

export function isAcceptableScore(score: unknown): score is number {
  return (
    typeof score === "number" &&
    Number.isInteger(score) &&
    score > 0 &&
    score <= MAX_ACCEPTED_SCORE
  );
}

/** Tag cache để xoá đúng bản ghi này sau khi có kỷ lục mới. */
export const GAME_RECORD_TAG = "game-record";

/**
 * Kỷ lục hiện tại, đọc qua CDA (bản đã publish) chứ không qua CMA.
 *
 * `fetch` gốc của Next nên cache được thật — khác với SDK Contentful vốn chạy
 * trên axios và Next không thấy (xem `lib/content`). Một phút là đủ tươi cho
 * một bảng kỷ lục, và lượt ghi tự xoá tag nên người vừa lập kỷ lục thấy ngay.
 */
export async function fetchGameRecord(): Promise<GameRecord | null> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;
  if (!spaceId || !accessToken) return null;

  const url =
    `https://cdn.contentful.com/spaces/${spaceId}/environments/master/entries` +
    `?content_type=${GAME_RECORD_TYPE}&order=-fields.score&limit=1&access_token=${accessToken}`;

  const res = await fetch(url, {
    next: { revalidate: 60, tags: [GAME_RECORD_TAG] },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    items?: { fields?: { playerName?: string; score?: number; setAt?: string } }[];
  };
  const fields = data.items?.[0]?.fields;
  if (!fields || typeof fields.score !== "number" || typeof fields.playerName !== "string") {
    return null;
  }
  return {
    name: fields.playerName,
    score: fields.score,
    setAt: typeof fields.setAt === "string" ? fields.setAt : new Date().toISOString(),
  };
}

/** Ghi một kỷ lục mới và publish để CDA nhìn thấy. */
export async function createGameRecord(record: GameRecord): Promise<void> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!spaceId || !managementToken) throw new Error("Contentful management not configured");

  const client = cmaClient(spaceId, managementToken);
  const created = await fetch(
    `${client.base}/entries`,
    cmaInit({
      method: "POST",
      headers: {
        ...client.headers,
        "X-Contentful-Content-Type": GAME_RECORD_TYPE,
        "Content-Type": "application/vnd.contentful.management.v1+json",
      },
      body: JSON.stringify({
        fields: {
          playerName: { [LOCALE]: record.name },
          score: { [LOCALE]: record.score },
          setAt: { [LOCALE]: record.setAt },
        },
      }),
    }),
  );
  if (!created.ok) {
    throw new Error(`Create failed: ${created.status} ${await created.text()}`);
  }

  // Draft thì CDA không thấy, và bảng kỷ lục sẽ đứng yên một cách khó hiểu.
  const entry = (await created.json()) as { sys: { id: string; version: number } };
  const published = await fetch(
    `${client.base}/entries/${entry.sys.id}/published`,
    cmaInit({
      method: "PUT",
      headers: {
        ...client.headers,
        "X-Contentful-Version": String(entry.sys.version),
        "X-Contentful-Content-Type": GAME_RECORD_TYPE,
      },
    }),
  );
  if (!published.ok) {
    throw new Error(`Publish failed: ${published.status} ${await published.text()}`);
  }
}
