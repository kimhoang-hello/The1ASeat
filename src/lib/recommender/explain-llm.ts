/**
 * Phase 6 — gọi Claude viết lời giải thích, kiểm, lưu, rồi mới trả cho trang.
 *
 * Thứ tự không đổi được:
 *
 *   payload (thuần, từ ResultView) → kho đã có? → Claude → cửa kiểm → LƯU → trang
 *
 * Mọi nhánh hỏng đều trả `null`, và `null` nghĩa là trang dùng bảng tra của
 * Phase 5 — trang đó đã đủ, đã tất định, đã giải thích được. Không có nhánh nào
 * mà lỗi của LLM thành lỗi của trang: hết quota, timeout, từ chối, JSON hỏng,
 * câu bịa, database không ghi được.
 *
 * LƯU TRƯỚC KHI HIỆN, và chỉ hiện đúng bản đã lưu. Cùng lý do §20 lưu lượt
 * chạy: một khiếu nại "câu này sai" phải tra được đúng câu người đọc đã thấy,
 * không phải câu sinh lại hôm nay. Không có kho thì KHÔNG hiện câu của Claude.
 */

import Anthropic from "@anthropic-ai/sdk";

import { GHE1A_VOICE_RULES } from "../ghe1a-voice.ts";
import { fingerprint } from "../recommendation/fingerprint.ts";
import { checkExplanation, MAX_SENTENCES, type ExplanationDraft, type KnownNames } from "./explain-check.ts";
import type { ExplanationPayload } from "./explain-payload.ts";
import type { ExplanationStore, StoredExplanation } from "./explain-store.ts";

/**
 * Đổi prompt, schema hoặc luật kiểm theo cách làm câu cũ không còn đúng chuẩn
 * → tăng số này. Nó nằm trong mỗi bản ghi, như `ENGINE_VERSION` nằm trong lượt
 * chạy, để câu cũ đọc lại được đúng luật đã sinh ra nó.
 */
export const EXPLANATION_PROMPT_VERSION = "6.0.0";

export const EXPLANATION_MODEL = "claude-opus-5";

const SYSTEM = `Bạn viết lời giải thích cho công cụ gợi ý thẻ tín dụng của Ghế 1A, blog Miles & Points tiếng Việt cho người Việt tại Canada.

Công cụ đã QUYẾT ĐỊNH xong: một engine tất định đã chọn hành động chính cho người đọc. Việc của bạn chỉ là kể lại vì sao, bằng văn tự nhiên, từ đúng những dữ kiện được đưa.

Quy tắc viết:
${GHE1A_VOICE_RULES}

Điều cấm tuyệt đối:
- Không đổi, không bàn lại, không so sánh hành động chính với lựa chọn nào khác. Không nhắc tên thẻ, ngân hàng hay chương trình điểm nào không có trong dữ kiện.
- Không bịa điều kiện mở thẻ (điểm tín dụng, thu nhập, lịch sử tín dụng…).
- Không nói gì về khả năng được ngân hàng duyệt.
- Không nói về chỗ trống vé thưởng, không nói điểm "đảm bảo" hay "chắc chắn" có vé.
- Không dùng con số nào không có trong dữ kiện bạn trích; viết số bằng chữ số, đúng như trong dữ kiện.
- Không nhắc link, affiliate, hoa hồng, rebate.
- Không so sánh tuyệt đối ("tốt nhất", "cao nhất"…).
- Không nhắc lại và không nói ngược các mục trong "cautions" — trang in chúng nguyên văn ngay bên dưới lời giải thích của bạn.

Cách trả lời:
- 2 đến ${MAX_SENTENCES} câu, mỗi câu một ý, mỗi câu dưới 45 từ. Mở bằng lý do quan trọng nhất với mục tiêu của người đọc.
- Mỗi câu ghi "facts": id của MỌI dữ kiện câu đó dựa vào.
- Mỗi câu ghi "basis" theo dữ kiện yếu nhất nó trích: có dữ kiện "estimate" → "estimate"; không có estimate nhưng có "editorial" → "editorial"; chỉ toàn "verified" → "verified".
- Câu có basis "estimate" phải nói rõ bằng chữ đó là ước lượng ("ước lượng", "khoảng"…).
- Nói "mình" khi nhắc tới Ghế 1A, "bạn" khi nói với người đọc. Giọng thẳng thắn, không quảng cáo.`;

const SCHEMA = {
  type: "object",
  properties: {
    sentences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          facts: { type: "array", items: { type: "string" } },
          basis: { type: "string", enum: ["verified", "estimate", "editorial"] },
        },
        required: ["text", "facts", "basis"],
        additionalProperties: false,
      },
    },
  },
  required: ["sentences"],
  additionalProperties: false,
} as const;

/**
 * Một lần gọi mô hình: payload vào, JSON (chưa kiểm) ra. Ném khi hỏng.
 *
 * Là một hàm tiêm vào chứ không phải lời gọi SDK viết cứng, để test chạy được
 * mọi nhánh — kể cả Claude trả về câu bịa — mà không cần mạng hay API key.
 */
export type ExplanationModel = (payload: ExplanationPayload) => Promise<unknown>;

/**
 * Trang chờ lời giải thích trong `<Suspense>`: người đọc đã thấy bản bảng tra.
 * Quá mốc này thì bỏ — một lời giải thích tới sau 20 giây không ai đọc nữa.
 */
const TIMEOUT_MS = 20_000;

export function anthropicExplanationModel(client = new Anthropic()): ExplanationModel {
  return async (payload) => {
    const response = await client.beta.messages.create(
      {
        model: EXPLANATION_MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        // Việc ngắn, dữ kiện đã có sẵn: effort thấp giữ độ trễ ở mức một trang
        // web chịu được. Cửa kiểm, không phải effort, là thứ giữ câu đúng.
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        // Bị từ chối thì để API chạy lại trên mô hình dự phòng; vẫn từ chối
        // thì rơi về bảng tra như mọi lỗi khác.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      },
      { timeout: TIMEOUT_MS, maxRetries: 0 },
    );
    if (response.stop_reason === "refusal") {
      throw new Error(`từ chối: ${response.stop_details?.category ?? "không rõ"}`);
    }
    if (response.stop_reason === "max_tokens") throw new Error("hết max_tokens");
    const text = response.content.find((block) => block.type === "text")?.text;
    if (!text) throw new Error(`không có chữ (stop_reason: ${response.stop_reason})`);
    return JSON.parse(text) as unknown;
  };
}

/** Bật khi server có key, trừ khi tắt hẳn bằng `RECO_LLM_EXPLAIN=0`. */
export function explanationModelFromEnv(): ExplanationModel | null {
  if (process.env.RECO_LLM_EXPLAIN === "0" || !process.env.ANTHROPIC_API_KEY) return null;
  return anthropicExplanationModel();
}

export interface ExplainDeps {
  /** `null` = không có kho → không hiện câu của Claude (xem đầu file). */
  store: ExplanationStore | null;
  model: ExplanationModel | null;
  names: KnownNames;
  /** Cửa trần chi phí — `false` thì không gọi mô hình, không ghi gì. */
  allowCall: () => boolean;
  now: () => string;
  log?: (message: string, error?: unknown) => void;
}

export interface ShownExplanation {
  sentences: ExplanationDraft["sentences"];
  dataVerifiedAt: string | null;
}

/**
 * Lời giải thích cho HÀNH ĐỘNG CHÍNH của một lượt chạy, hoặc `null` = dùng bảng tra.
 *
 * Khoá lưu là (runId, goalIndex, dấu vân tay payload). Dấu vân tay có mặt vì
 * payload đọc welcome bonus và phí từ Contentful LÚC HIỂN THỊ (như `present.ts`):
 * cùng một lượt chạy, offer đổi trong ngày thì payload đổi, và câu cũ nhắc con
 * số cũ không được hiện cạnh con số mới.
 *
 * Bản bị cửa kiểm từ chối cũng được lưu, và KHÔNG sinh lại cho cùng khoá: một
 * payload đã làm Claude bịa một lần thì lần sau nhiều khả năng bịa tiếp, và mỗi
 * lần thử là tiền thật. Lỗi đường truyền (timeout, quota) thì không lưu — lần
 * mở trang sau thử lại, trong trần của `allowCall`.
 */
export async function explainPrimaryAction(
  input: { runId: string; goalIndex: number; payload: ExplanationPayload },
  deps: ExplainDeps,
): Promise<ShownExplanation | null> {
  const { store, model } = deps;
  const log = deps.log ?? ((message, error) => console.error(`[goi-y/explain] ${message}`, error ?? ""));
  if (store === null) return null;
  const payloadFingerprint = fingerprint(input.payload);
  const shown = (row: StoredExplanation) =>
    row.status === "shown" && row.draft !== null
      ? { sentences: row.draft.sentences, dataVerifiedAt: row.payload.dataVerifiedAt }
      : null;

  try {
    const existing = await store.get(input.runId, input.goalIndex, payloadFingerprint);
    if (existing !== null) return shown(existing);
  } catch (error) {
    log("không đọc được kho lời giải thích", error);
    return null;
  }

  if (model === null || !deps.allowCall()) return null;

  let raw: unknown;
  try {
    raw = await model(input.payload);
  } catch (error) {
    log(`mô hình hỏng cho ${input.runId}`, error);
    return null;
  }

  const checked = checkExplanation(input.payload, raw, deps.names);
  const row: StoredExplanation = {
    runId: input.runId,
    goalIndex: input.goalIndex,
    payloadFingerprint,
    status: checked.ok ? "shown" : "rejected",
    model: EXPLANATION_MODEL,
    promptVersion: EXPLANATION_PROMPT_VERSION,
    createdAt: deps.now(),
    payload: input.payload,
    draft: checked.ok ? checked.draft : null,
    raw,
    problems: checked.ok ? [] : checked.problems,
  };
  if (!checked.ok) log(`cửa kiểm từ chối lời giải thích cho ${input.runId}: ${checked.problems.join("; ")}`);

  try {
    // Hai lần mở trang cùng lúc cùng sinh: kho giữ bản ghi TRƯỚC, và cả hai
    // hiện đúng bản đó.
    return shown(await store.save(row));
  } catch (error) {
    log("không lưu được lời giải thích — không hiện", error);
    return null;
  }
}
