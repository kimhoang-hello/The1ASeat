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
 * dưới đây chỉ canh chuyện đó đúng hình dạng: id có thật, câu dẫn hợp với loại
 * hành động, vai của dữ kiện hợp với câu dẫn, không lặp.
 *
 * Lịch sử: hai bản đầu cho Claude viết tự do rồi kiểm chữ (cụm từ cấm, rồi "mọi
 * âm tiết phải có trong dữ kiện"). Codex vòng 1 và 2 viết được câu qua cả hai:
 * "Welcome bonus sẽ được cộng vào tài khoản", "Phí thường niên: $3,000; mốc chi:
 * $120" (đổi chỗ hai số thật), "Bạn sẽ nhận được welcome bonus; ngân hàng không
 * từ chối". Kiểm CHỮ không chứng minh được NGHĨA — nên bỏ chữ tự do.
 */

import type { ExplanationFact, ExplanationPayload, FactBasis, FactRole } from "./explain-payload.ts";

/** Câu dẫn: chữ hiện ra, loại hành động được dùng, và vai của dữ kiện nó giới thiệu. */
export const LEADS = {
  why_card: { text: "Lý do mình gợi ý thẻ này:", action: "open_card", roles: ["reason"] },
  why_wait: { text: "Lý do mình nghĩ bạn chưa cần mở thẻ mới:", action: "no_new_card", roles: ["reason"] },
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

  draft.sentences.forEach((sentence, index) => {
    const label = `câu ${index + 1}`;
    const lead = LEADS[sentence.lead];
    if (lead.action !== null && lead.action !== payload.action.kind) {
      problems.push(`${label}: câu dẫn "${sentence.lead}" không dùng cho hành động ${payload.action.kind}`);
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
