/**
 * Phase 6 — nhờ Claude dựng lời giải thích, kiểm, lưu, rồi mới trả cho trang.
 *
 * Thứ tự không đổi được:
 *
 *   công tắc → payload (thuần) → kho đã có? → Claude → cửa kiểm → LƯU → ghép chữ → trang
 *
 * Claude không viết chữ: nó chọn, gom và sắp các dữ kiện viết sẵn — xem đầu
 * `explain-check.ts` vì sao.
 *
 * Mọi nhánh hỏng đều trả `null`, và `null` nghĩa là trang dùng bảng tra của
 * Phase 5 — trang đó đã đủ, đã tất định, đã giải thích được. Không có nhánh nào
 * mà lỗi của LLM thành lỗi của trang: tắt, hết quota, timeout, từ chối, JSON
 * hỏng, cửa kiểm, database không đọc/ghi được.
 *
 * LƯU TRƯỚC KHI HIỆN, và chỉ hiện đúng bản đã lưu. Cùng lý do §20 lưu lượt
 * chạy: một khiếu nại "câu này sai" phải tra được đúng câu người đọc đã thấy,
 * không phải câu sinh lại hôm nay. Không có kho thì KHÔNG hiện bản của Claude.
 */

import Anthropic from "@anthropic-ai/sdk";

import { fingerprint } from "../recommendation/fingerprint.ts";
import {
  checkExplanation,
  LEAD_KEYS,
  LEADS,
  MAX_FACTS_PER_SENTENCE,
  MAX_SENTENCES,
  renderExplanation,
  type RenderedSentence,
} from "./explain-check.ts";
import type { ExplanationPayload } from "./explain-payload.ts";
import type { ExplanationStore, StoredExplanation } from "./explain-store.ts";

/**
 * Đổi prompt, câu dẫn, mệnh đề hay luật kiểm → tăng số này. Nó nằm trong KHOÁ
 * của kho: bản dựng theo luật cũ không bao giờ được đọc lại dưới luật mới
 * (Codex vòng 2 — bản cũ từng được trả thẳng, bỏ qua cả cửa kiểm mới lẫn công
 * tắc tắt).
 */
export const EXPLANATION_PROMPT_VERSION = "6.2.0";

export const EXPLANATION_MODEL = "claude-opus-5";

const SYSTEM = `Bạn giúp công cụ gợi ý thẻ tín dụng của Ghế 1A (blog Miles & Points tiếng Việt cho người Việt tại Canada) trình bày lời giải thích cho người đọc.

Công cụ đã QUYẾT ĐỊNH xong: một engine tất định đã chọn hành động chính. Bạn không viết chữ nào. Bạn nhận một danh sách dữ kiện — mỗi dữ kiện là một mệnh đề tiếng Việt viết sẵn, có id, nhãn (basis) và vai (role) — và trả về cách GHÉP chúng thành 2 đến ${MAX_SENTENCES} câu:

- Mỗi câu gồm một câu dẫn ("lead") và 1 đến ${MAX_FACTS_PER_SENTENCE} id dữ kiện. Trang sẽ in: câu dẫn + các mệnh đề, đúng thứ tự bạn đưa.
- Câu dẫn có sẵn và vai dữ kiện nó nhận:
${LEAD_KEYS.map((key) => `  - "${key}": "${LEADS[key].text} …" — nhận vai ${LEADS[key].roles.join(", ")}${LEADS[key].action === null ? "" : `; chỉ dùng khi hành động là ${LEADS[key].action}`}`).join("\n")}
- Mỗi dữ kiện dùng tối đa một lần. Không cần dùng hết.

Chọn cho người đọc này: mở bằng lý do quan trọng nhất với mục tiêu của họ, gom những dữ kiện nói cùng một chuyện vào một câu, bỏ dữ kiện không thêm gì. Đọc lại các mệnh đề sẽ được ghép để câu ra tự nhiên.`;

const SCHEMA = {
  type: "object",
  properties: {
    sentences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          lead: { type: "string", enum: LEAD_KEYS },
          facts: { type: "array", items: { type: "string" } },
        },
        required: ["lead", "facts"],
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
 * mọi nhánh — kể cả mô hình trả về rác — mà không cần mạng hay API key.
 */
export type ExplanationModel = (payload: ExplanationPayload) => Promise<{
  output: unknown;
  /**
   * Mô hình ĐÃ trả lời — khác `EXPLANATION_MODEL` khi fallback phía server chạy.
   * Bản ghi phải nói đúng ai dựng câu, nhất là ở đúng ca bị từ chối (Codex vòng 1).
   */
  model: string;
}>;

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
        // Việc chọn và sắp, không phải việc viết: effort thấp giữ độ trễ ở mức
        // một trang web chịu được.
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
    return { output: JSON.parse(text) as unknown, model: response.model };
  };
}

/**
 * `null` = Phase 6 TẮT. Tắt khi server không có key, hoặc khi đặt
 * `RECO_LLM_EXPLAIN=0` — và tắt nghĩa là tắt cả bản ĐÃ LƯU (xem
 * `explainPrimaryAction`), để công tắc dùng được như một nút dừng khẩn.
 */
export function explanationModelFromEnv(): ExplanationModel | null {
  if (process.env.RECO_LLM_EXPLAIN === "0" || !process.env.ANTHROPIC_API_KEY) return null;
  return anthropicExplanationModel();
}

export interface ExplainDeps {
  /** `null` = không có kho → không hiện bản của Claude (xem đầu file). */
  store: ExplanationStore | null;
  /** `null` = Phase 6 tắt → không gọi mô hình VÀ không đọc bản đã lưu. */
  model: ExplanationModel | null;
  /** Cửa trần chi phí — `false` thì không gọi mô hình, không ghi gì. */
  allowCall: () => boolean;
  now: () => string;
  log?: (message: string, error?: unknown) => void;
}

export interface ShownExplanation {
  sentences: RenderedSentence[];
  dataVerifiedAt: string | null;
}

/**
 * Lời giải thích cho HÀNH ĐỘNG CHÍNH của một lượt chạy, hoặc `null` = dùng bảng tra.
 *
 * Khoá lưu là (runId, goalIndex, dấu vân tay payload, version prompt). Dấu vân
 * tay có mặt vì payload đọc welcome bonus và phí từ Contentful LÚC HIỂN THỊ (như
 * `present.ts`): cùng một lượt chạy, offer đổi trong ngày thì payload đổi, và
 * bản cũ nhắc con số cũ không được hiện cạnh con số mới.
 *
 * Bản đọc từ kho CŨNG đi lại qua cửa kiểm trước khi hiện: kho là dữ liệu, không
 * phải lời bảo đảm.
 *
 * Bản bị cửa kiểm từ chối cũng được lưu, và KHÔNG sinh lại cho cùng khoá: mỗi
 * lần thử là tiền thật. Lỗi đường truyền (timeout, quota) thì không lưu — lần
 * mở trang sau thử lại, trong trần của `allowCall`.
 */
export async function explainPrimaryAction(
  input: { runId: string; goalIndex: number; payload: ExplanationPayload },
  deps: ExplainDeps,
): Promise<ShownExplanation | null> {
  const { store, model } = deps;
  const log = deps.log ?? ((message, error) => console.error(`[goi-y/explain] ${message}`, error ?? ""));
  if (store === null || model === null) return null;
  const key = {
    runId: input.runId,
    goalIndex: input.goalIndex,
    payloadFingerprint: fingerprint(input.payload),
    promptVersion: EXPLANATION_PROMPT_VERSION,
  };
  const shown = (row: StoredExplanation): ShownExplanation | null => {
    if (row.status !== "shown") return null;
    const checked = checkExplanation(input.payload, row.draft);
    if (!checked.ok) {
      log(`bản đã lưu cho ${input.runId} không qua cửa kiểm hiện hành: ${checked.problems.join("; ")}`);
      return null;
    }
    return { sentences: renderExplanation(input.payload, checked.draft), dataVerifiedAt: input.payload.dataVerifiedAt };
  };

  try {
    const existing = await store.get(key);
    if (existing !== null) return shown(existing);
  } catch (error) {
    log("không đọc được kho lời giải thích", error);
    return null;
  }

  if (!deps.allowCall()) return null;

  let raw: unknown;
  let servedBy: string;
  try {
    ({ output: raw, model: servedBy } = await model(input.payload));
  } catch (error) {
    log(`mô hình hỏng cho ${input.runId}`, error);
    return null;
  }

  const checked = checkExplanation(input.payload, raw);
  const row: StoredExplanation = {
    ...key,
    status: checked.ok ? "shown" : "rejected",
    model: servedBy,
    createdAt: deps.now(),
    payload: input.payload,
    draft: checked.ok ? checked.draft : null,
    rendered: checked.ok ? renderExplanation(input.payload, checked.draft) : null,
    raw,
    problems: checked.ok ? [] : checked.problems,
  };
  if (!checked.ok) log(`cửa kiểm từ chối bản dựng cho ${input.runId}: ${checked.problems.join("; ")}`);

  try {
    // Hai lần mở trang cùng lúc cùng sinh: kho giữ bản ghi TRƯỚC, và cả hai
    // hiện đúng bản đó.
    return shown(await store.save(row));
  } catch (error) {
    log("không lưu được lời giải thích — không hiện", error);
    return null;
  }
}
