/**
 * Kiểm bản dựng của Claude và ghép nó thành câu — chạy TRƯỚC khi một chữ nào
 * tới trang.
 *
 * Claude trả về CẤU TRÚC, không trả về chữ:
 *
 *   { sentences: [{ lead: "why_card", facts: ["reason_1", "strength_1"] }, …] }
 *
 * `lead` là một khoá trong `LEADS` (danh sách câu dẫn đóng), `facts` là id dữ
 * kiện trong payload. Chữ trên trang = câu dẫn + các mệnh đề viết sẵn của
 * `explain-payload.ts`, ghép bằng code. Nên những điều §28 cấm không cần một
 * luật riêng để chặn — chúng KHÔNG CÓ CÁCH NÀO để viết ra:
 *
 *  - đổi khuyến nghị, nhắc thẻ khác: không mệnh đề nào mang tên thẻ khác;
 *  - bịa điều kiện, chỗ trống vé thưởng, hứa duyệt, số liệu: không có chữ tự do;
 *  - biến ước lượng thành dữ kiện: nhãn do code tính từ dữ kiện, và mệnh đề ước
 *    lượng tự mang chữ "ước lượng";
 *  - nói ngược cảnh báo: cảnh báo in bằng bảng tra, Claude không chạm tới.
 *
 * Phần còn lại Claude quyết định được — và là lý do nó có mặt — là CHỌN dữ kiện
 * nào đáng nói với mục tiêu này, GOM chúng thành câu và SẮP thứ tự. Cửa kiểm
 * dưới đây canh chuyện đó đúng hình dạng — id có thật, câu dẫn hợp với loại
 * hành động, vai của dữ kiện hợp với câu dẫn, không lặp, câu dẫn đúng thứ tự —
 * và canh luôn những gì im lặng cũng làm sai được: mọi lý do của engine phải
 * có mặt và mở đầu đoạn, chi phí không được hiện thiếu dữ kiện bonus bị chặn.
 *
 * Lịch sử: hai bản đầu cho Claude viết tự do rồi kiểm chữ (cụm từ cấm, rồi "mọi
 * âm tiết phải có trong dữ kiện"). Codex vòng 1 và 2 viết được câu qua cả hai:
 * "Welcome bonus sẽ được cộng vào tài khoản", "Phí thường niên: $3,000; mốc chi:
 * $120" (đổi chỗ hai số thật), "Bạn sẽ nhận được welcome bonus; ngân hàng không
 * từ chối". Kiểm CHỮ không chứng minh được NGHĨA — nên bỏ chữ tự do.
 */

import type { ExplanationFact, ExplanationPayload, FactBasis, FactRole } from "./explain-payload.ts";

/**
 * Câu dẫn: chữ hiện ra, loại hành động được dùng, và vai của dữ kiện nó giới thiệu.
 *
 * Câu dẫn KHÔNG khẳng định nhân quả ("vì", "lý do"). Mã "ủng hộ" của engine là
 * điều nó đã cân nhắc, không phải lúc nào cũng là nguyên nhân: một thẻ vẫn được
 * gợi ý khi mang `POINTS_ALREADY_SUFFICIENT`, và "Lý do mình gợi ý thẻ này: số
 * điểm đã đủ" là đảo nghĩa (Codex vòng 3). Trang Phase 5 cũng chỉ liệt kê chúng
 * dưới tên thẻ — lớp LLM không được nói mạnh hơn bảng tra.
 */
export const LEADS = {
  why_card: { text: "Những điểm mình cân nhắc cho thẻ này:", action: "open_card", roles: ["reason"] },
  why_wait: { text: "Những điểm mình cân nhắc:", action: "no_new_card", roles: ["reason"] },
  also: { text: "Thêm nữa:", action: null, roles: ["reason"] },
  cost: { text: "Về offer và chi phí:", action: "open_card", roles: ["offer"] },
  trip: { text: "Về chuyến bay:", action: null, roles: ["trip"] },
  context: { text: "Để bạn nắm rõ:", action: null, roles: ["context"] },
} as const satisfies Record<
  string,
  { text: string; action: ExplanationPayload["action"]["kind"] | null; roles: readonly FactRole[] }
>;

export type LeadKey = keyof typeof LEADS;

export const LEAD_KEYS = Object.keys(LEADS) as LeadKey[];

export interface ExplanationSentence {
  lead: LeadKey;
  facts: string[];
}

export interface ExplanationDraft {
  sentences: ExplanationSentence[];
}

/** Một câu đã ghép, sẵn để hiện. */
export interface RenderedSentence {
  text: string;
  basis: FactBasis;
}

export type CheckResult = { ok: true; draft: ExplanationDraft } | { ok: false; problems: string[] };

export const MIN_SENTENCES = 1;
export const MAX_SENTENCES = 4;
export const MAX_FACTS_PER_SENTENCE = 3;

const BASIS_RANK: Record<FactBasis, number> = { verified: 0, editorial: 1, estimate: 2 };

/**
 * Hình dạng của thứ Claude trả về — kiểm lại dù đã có JSON schema: schema chặn
 * lúc sinh, còn hàm này nhận cả bản đọc lại từ kho. Trường thừa (một `text` tự
 * viết chẳng hạn) bị BỎ, không bao giờ tới trang.
 */
export function asDraft(value: unknown): ExplanationDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const sentences = (value as { sentences?: unknown }).sentences;
  if (!Array.isArray(sentences)) return null;
  const rows: ExplanationSentence[] = [];
  for (const row of sentences) {
    if (typeof row !== "object" || row === null) return null;
    const { lead, facts } = row as Record<string, unknown>;
    if (typeof lead !== "string" || !Object.hasOwn(LEADS, lead)) return null;
    if (!Array.isArray(facts) || !facts.every((id) => typeof id === "string")) return null;
    rows.push({ lead: lead as LeadKey, facts: facts as string[] });
  }
  return { sentences: rows };
}

export function checkExplanation(payload: ExplanationPayload, raw: unknown): CheckResult {
  const draft = asDraft(raw);
  if (draft === null) {
    return { ok: false, problems: [`không đúng hình dạng { sentences: [{ lead: ${LEAD_KEYS.join(" | ")}, facts: [id] }] }`] };
  }

  const problems: string[] = [];
  const count = draft.sentences.length;
  if (count < MIN_SENTENCES || count > MAX_SENTENCES) {
    problems.push(`có ${count} câu, cần ${MIN_SENTENCES}–${MAX_SENTENCES}`);
  }

  const byId = new Map(payload.facts.map((fact) => [fact.id, fact]));
  const used = new Set<string>();
  let whySeen = false;

  draft.sentences.forEach((sentence, index) => {
    const label = `câu ${index + 1}`;
    const lead = LEADS[sentence.lead];
    if (lead.action !== null && lead.action !== payload.action.kind) {
      problems.push(`${label}: câu dẫn "${sentence.lead}" không dùng cho hành động ${payload.action.kind}`);
    }
    // Thứ tự câu dẫn. "Thêm nữa:" mở đầu đoạn văn, hay hai câu "Những điểm mình
    // cân nhắc" liền nhau, đọc như có một đoạn bị cắt mất.
    if (sentence.lead === "why_card" || sentence.lead === "why_wait") {
      if (whySeen) problems.push(`${label}: câu dẫn "${sentence.lead}" chỉ dùng một lần`);
      whySeen = true;
    }
    if (sentence.lead === "also" && !whySeen) {
      problems.push(`${label}: "also" phải đứng sau câu dẫn lý do`);
    }
    if (sentence.facts.length === 0 || sentence.facts.length > MAX_FACTS_PER_SENTENCE) {
      problems.push(`${label}: có ${sentence.facts.length} dữ kiện, cần 1–${MAX_FACTS_PER_SENTENCE}`);
    }
    for (const id of sentence.facts) {
      const fact = byId.get(id);
      if (fact === undefined) {
        problems.push(`${label}: dữ kiện không có: ${id}`);
        continue;
      }
      if (!(lead.roles as readonly FactRole[]).includes(fact.role)) {
        problems.push(`${label}: dữ kiện ${id} (${fact.role}) không đi được sau câu dẫn "${sentence.lead}"`);
      }
      // Một dữ kiện nói hai lần là một đoạn văn độn chữ — và là dấu hiệu mô
      // hình không làm đúng việc chọn lọc.
      if (used.has(id)) problems.push(`${label}: dữ kiện ${id} đã dùng ở câu trước`);
      used.add(id);
    }
  });

  // Lý do của engine KHÔNG được lọc bớt. Bản dựng thay chỗ khối "vì sao hợp"
  // của bảng tra, nên bỏ một lý do là xoá nó khỏi trang — mô hình chỉ còn giữ
  // chi phí hay hướng đi, và người đọc mất phần giải thích engine đã đưa ra
  // (rà đối kháng 17/09/2026). Mô hình quyết định THỨ TỰ và CÁCH GOM, không
  // quyết định lý do nào được nói.
  const reasons = payload.facts.filter((fact) => fact.role === "reason");
  const missingReasons = reasons.filter((fact) => !used.has(fact.id)).map((fact) => fact.id);
  if (missingReasons.length > 0) problems.push(`bỏ sót lý do của engine: ${missingReasons.join(", ")}`);
  const first = draft.sentences[0]?.lead;
  if (reasons.length > 0 && first !== undefined && first !== "why_card" && first !== "why_wait") {
    problems.push(`câu đầu phải là câu dẫn lý do, đang là "${first}"`);
  }

  // Nói chi phí mà không nói bonus bị chặn là nửa sự thật: "Về offer và chi
  // phí: phí thường niên là $799" cho một người không nhận được welcome bonus.
  const offerShown = payload.facts.some((fact) => fact.role === "offer" && used.has(fact.id));
  if (offerShown && byId.has("bonus_blocked") && !used.has("bonus_blocked")) {
    problems.push("nói về offer và chi phí mà bỏ dữ kiện bonus_blocked");
  }
  // Cùng lý do, nửa còn lại: nói con số bonus mà giấu việc chưa chắc nhận được.
  if (used.has("bonus") && byId.has("bonus_uncertain") && !used.has("bonus_uncertain")) {
    problems.push("nói con số welcome bonus mà bỏ dữ kiện bonus_uncertain");
  }

  return problems.length === 0 ? { ok: true, draft } : { ok: false, problems };
}

/**
 * Bản đã qua cửa kiểm → câu hiện trên trang. Hàm thuần: cùng payload và cùng
 * bản dựng thì cùng chữ, nên bản lưu trong kho dựng lại đúng câu người đọc thấy.
 *
 * Ném khi bản dựng chưa qua `checkExplanation` — gọi sai thứ tự là lỗi lập
 * trình, không phải một nhánh để trang xử lý.
 */
export function renderExplanation(payload: ExplanationPayload, draft: ExplanationDraft): RenderedSentence[] {
  const byId = new Map(payload.facts.map((fact) => [fact.id, fact]));
  return draft.sentences.map((sentence) => {
    const facts = sentence.facts.map((id) => {
      const fact = byId.get(id);
      if (fact === undefined) throw new Error(`renderExplanation: dữ kiện ${id} không có — chưa qua cửa kiểm`);
      return fact;
    });
    return { text: `${LEADS[sentence.lead].text} ${joinClauses(facts)}.`, basis: weakestBasis(facts) };
  });
}

/**
 * Nhãn của câu = nhãn YẾU NHẤT trong các dữ kiện nó ghép (verified < editorial
 * < estimate). Do code tính, không do mô hình khai.
 */
export function weakestBasis(facts: readonly ExplanationFact[]): FactBasis {
  return facts.reduce<FactBasis>(
    (acc, fact) => (BASIS_RANK[fact.basis] > BASIS_RANK[acc] ? fact.basis : acc),
    "verified",
  );
}

/**
 * Nối mệnh đề. Mệnh đề nào đã có dấu phẩy thì nối bằng chấm phẩy — "và" giữa
 * hai mệnh đề nhiều vế đọc ra một câu không biết vế nào đi với vế nào.
 */
function joinClauses(facts: readonly ExplanationFact[]): string {
  const clauses = facts.map((fact) => fact.text);
  if (clauses.length === 1) return clauses[0];
  if (clauses.some((clause) => clause.includes(","))) return clauses.join("; ");
  return `${clauses.slice(0, -1).join(", ")} và ${clauses.at(-1)}`;
}
