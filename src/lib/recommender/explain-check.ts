/**
 * Cửa kiểm lời giải thích Claude viết — chạy TRƯỚC khi một chữ nào tới trang.
 *
 * Prompt dặn bảy điều cấm của §28; file này là chỗ THI HÀNH chúng. Câu nào
 * trượt một luật thì CẢ lời giải thích bị bỏ và trang dùng câu của bảng tra
 * (Phase 5). Không vá, không lọc bớt câu hỏng: một đoạn văn bị cắt mất câu giữa
 * có thể đổi nghĩa, và "rơi về bảng tra" là đường lui đã đủ tốt.
 *
 * Mỗi luật chặn một điều cấm cụ thể:
 *
 *  1. Mỗi câu trích dữ kiện CÓ THẬT (id nằm trong payload).
 *  2. Nhãn của câu = nhãn YẾU NHẤT trong các dữ kiện nó trích
 *     (verified < editorial < estimate). Câu trích một ước lượng không được
 *     tự nhận là dữ kiện đã kiểm.
 *  3. Câu mang nhãn ước lượng phải NÓI ra điều đó bằng chữ ("ước lượng",
 *     "khoảng"…) — chữ "ước lượng" phải sống sót qua LLM (bàn giao, cạm bẫy 3).
 *  4. Mọi con số trong câu phải có trong CHÍNH các dữ kiện câu đó trích — chặn
 *     số bịa, và chặn mượn số ước lượng vào một câu "đã kiểm".
 *  5. Không nhắc tên sản phẩm hay chương trình điểm nào không có trong dữ kiện
 *     — chặn "chọn thẻ khác" và chặn bịa đường chuyển điểm.
 *  6. Cụm từ cấm: hứa được duyệt, hứa chắc chắn có vé / chỗ trống, bịa điều
 *     kiện (điểm tín dụng, thu nhập tối thiểu), trấn an ngược cảnh báo, so sánh
 *     tuyệt đối, affiliate và link.
 *  7. Welcome bonus bị chặn thì không câu nào được nói người dùng nhận nó.
 *
 * KHÔNG BẮT ĐƯỢC, ghi ra để không ai tưởng cửa này kín: số viết bằng chữ ngoài
 * danh sách chặn, một câu đúng từng chữ số mà sai nghĩa ("chỉ cần chi $1,500"
 * khi mốc thật là $1,500 cho MỖI tháng), và một nhận định sai giọng nhưng không
 * chạm luật nào. Đây là lưới bắt BỊA, không phải bằng chứng câu văn đúng.
 */

import type { ExplanationPayload, FactBasis } from "./explain-payload.ts";

export interface ExplanationSentence {
  text: string;
  facts: string[];
  basis: FactBasis;
}

export interface ExplanationDraft {
  sentences: ExplanationSentence[];
}

/** Tên riêng engine biết — lấy từ bộ dữ liệu, không viết tay. */
export interface KnownNames {
  products: string[];
  programs: string[];
}

export type CheckResult = { ok: true; draft: ExplanationDraft } | { ok: false; problems: string[] };

export const MIN_SENTENCES = 1;
export const MAX_SENTENCES = 4;
const MAX_SENTENCE_LENGTH = 320;

const BASIS_RANK: Record<FactBasis, number> = { verified: 0, editorial: 1, estimate: 2 };

/** Chữ thường + NFC + gộp khoảng trắng, để so cụm từ không vấp dạng Unicode. */
function norm(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, " ");
}

/* ------------------------------------------------------------------ *
 * Con số
 * ------------------------------------------------------------------ */

/**
 * Mọi con số trong một đoạn chữ, theo GIÁ TRỊ.
 *
 * Cùng quy ước với `rewrite-offer.ts`: phẩy ngăn nghìn, chấm thập phân. Khác ở
 * chỗ ở đây lấy MỌI con số, kể cả số nhỏ ("3 tháng", "45%", "2 người") — lời
 * giải thích ngắn và dữ kiện có đủ mọi số nó cần, nên không có lý do cho số nhỏ
 * nào đứng ngoài dữ kiện.
 */
const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

export function numbersIn(text: string): number[] {
  // "Ghế 1A" là tên site, không phải một con số người đọc mang đi quyết định.
  return [...text.replace(/ghế 1a/giu, "").matchAll(NUMBER)].map((match) => Number(match[0].replace(/,/g, "")));
}

/** "60.000" kiểu Việt Nam, "60k" — hiện sai trên trang dù đúng giá trị. */
const MISFORMATTED_NUMBER = /\d\.\d{3}(?!\d)|\d\s?[kK](?![\p{L}])/u;

/* ------------------------------------------------------------------ *
 * Cụm từ cấm
 * ------------------------------------------------------------------ */

interface Ban {
  pattern: RegExp;
  why: string;
  /**
   * Cho qua khi CHÍNH cụm đó có trong một dữ kiện — ví dụ lý do
   * `FOCUS_ON_AWARD_AVAILABILITY` nói "tìm chỗ trống". Không đặt cho những điều
   * cấm tuyệt đối (hứa được duyệt): dữ kiện độ tin cậy có nhắc chữ "chấp thuận"
   * đúng để nói điều ngược lại.
   */
  allowIfInFacts?: boolean;
}

const BANS: Ban[] = [
  // §28: "Do not claim approval likelihood."
  { pattern: /được duyệt|duyệt hồ sơ|tỷ lệ duyệt|khả năng duyệt|dễ duyệt|chấp thuận|approv/u, why: "nói về khả năng được duyệt" },
  // §28: "Do not say points guarantee a trip."
  { pattern: /đảm bảo|bảo đảm|guarantee/u, why: "hứa chắc chắn" },
  { pattern: /100%/u, why: "hứa chắc chắn", allowIfInFacts: true },
  { pattern: /(?<!chưa )(?<!không )(?<!độ )(?<!mức )chắc chắn/u, why: "hứa chắc chắn" },
  // §28: "Do not invent award availability."
  { pattern: /còn ghế|còn chỗ|ghế trống|chỗ trống|còn vé|có sẵn vé|săn được vé|đặt được vé|availability/u, why: "nói về chỗ trống vé thưởng", allowIfInFacts: true },
  // §28: "Do not invent eligibility requirements."
  { pattern: /điểm tín dụng|credit score|điểm credit|thu nhập tối thiểu|yêu cầu thu nhập|lịch sử tín dụng/u, why: "nêu điều kiện mở thẻ không có trong dữ kiện", allowIfInFacts: true },
  // Trấn an ngược cảnh báo.
  { pattern: /không có rủi ro|không rủi ro|yên tâm|không cần lo|dễ dàng đạt|chắc đạt/u, why: "trấn an ngược cảnh báo" },
  // So sánh tuyệt đối — kiểm được chỉ khi so với mọi thẻ trên site (memory
  // "câu so sánh tuyệt đối"), và thứ hạng là việc của engine, không của câu văn.
  { pattern: /tốt nhất|cao nhất|hời nhất|rẻ nhất|mạnh nhất|đáng nhất|số một|nhất thị trường/u, why: "so sánh tuyệt đối" },
  // Affiliate không bao giờ vào lời giải thích (§16 Rule 7).
  { pattern: /hoa hồng|affiliate|rebate|finlywealth|referral/u, why: "nhắc affiliate" },
  { pattern: /https?:|www\.|\.com\b|\.ca\b/u, why: "chứa link" },
  // Số viết bằng chữ né được cửa kiểm số.
  { pattern: /nghìn|ngàn|triệu|mươi/u, why: "viết số bằng chữ", allowIfInFacts: true },
];

/**
 * Chữ phải có trong câu mang nhãn ước lượng. Rộng có chủ ý: mục đích là người
 * đọc thấy con số KHÔNG chắc, không phải bắt Claude dùng đúng một từ.
 */
const ESTIMATE_MARKERS = /ước lượng|ước tính|khoảng|xấp xỉ|dự kiến/u;

/** Welcome bonus bị chặn: câu nào nói người dùng nhận nó là nói ngược cảnh báo. */
const CLAIMS_BONUS = /(?<!không )(?<!không thể )(?<!chẳng )nhận (?:được |trọn |đủ )*(?:welcome bonus|bonus)/u;

/* ------------------------------------------------------------------ *
 * Tên riêng
 * ------------------------------------------------------------------ */

/**
 * Từ chung trong tên thẻ — xuất hiện trong câu văn bình thường, hoặc chung cho
 * quá nhiều thẻ để nói lên thẻ nào. Chặn chúng là từ chối oan.
 */
const COMMON_NAME_WORDS = new Set(
  [
    "card", "visa", "infinite", "privilege", "mastercard", "world", "elite", "the", "and", "for",
    "rewards", "reward", "travel", "points", "point", "cash", "back", "cashback", "plus", "premium",
    "business", "bank", "first", "class", "welcome", "bonus", "offer", "transfer", "annual", "fee",
    "miles", "mile", "high", "interest", "no", "fee", "student", "value", "select", "preferred",
    "classic", "signature", "platinum", "gold", "card®", "de", "la", "le", "of",
  ].map(norm),
);

function nameWords(name: string): string[] {
  return norm(name)
    .replace(/[®™*+]/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4 && !/^\d+$/.test(word) && !COMMON_NAME_WORDS.has(word));
}

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(text);
}

/* ------------------------------------------------------------------ *
 * Kiểm
 * ------------------------------------------------------------------ */

/**
 * Hình dạng của thứ Claude trả về — kiểm lại dù đã có JSON schema: schema chặn
 * lúc sinh, còn hàm này nhận cả bản đọc lại từ kho.
 */
export function asDraft(value: unknown): ExplanationDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const sentences = (value as { sentences?: unknown }).sentences;
  if (!Array.isArray(sentences)) return null;
  const rows: ExplanationSentence[] = [];
  for (const row of sentences) {
    if (typeof row !== "object" || row === null) return null;
    const { text, facts, basis } = row as Record<string, unknown>;
    if (typeof text !== "string" || !Array.isArray(facts) || !facts.every((id) => typeof id === "string")) return null;
    if (basis !== "verified" && basis !== "estimate" && basis !== "editorial") return null;
    rows.push({ text, facts: facts as string[], basis });
  }
  return { sentences: rows };
}

export function checkExplanation(
  payload: ExplanationPayload,
  raw: unknown,
  names: KnownNames,
): CheckResult {
  const draft = asDraft(raw);
  if (draft === null) return { ok: false, problems: ["không đúng hình dạng { sentences: [{ text, facts, basis }] }"] };

  const problems: string[] = [];
  const count = draft.sentences.length;
  if (count < MIN_SENTENCES || count > MAX_SENTENCES) {
    problems.push(`có ${count} câu, cần ${MIN_SENTENCES}–${MAX_SENTENCES}`);
  }

  const byId = new Map(payload.facts.map((fact) => [fact.id, fact]));
  const allFactText = norm([payload.action.name, ...payload.facts.map((fact) => fact.text)].join(" "));
  const nameNumbers = new Set(numbersIn(payload.action.name));

  // Từ "riêng" của mọi tên sản phẩm/chương trình, trừ những từ dữ kiện đã
  // dùng: câu văn được nhắc tên thẻ chính và chương trình có trong dữ kiện,
  // không được nhắc cái nào khác.
  const foreignWords = new Set(
    [...names.products, ...names.programs]
      .flatMap(nameWords)
      .filter((word) => !containsWord(allFactText, word)),
  );
  const blocked = payload.facts.some((fact) => fact.id === "bonus_blocked");

  draft.sentences.forEach((sentence, index) => {
    const label = `câu ${index + 1}`;
    const text = norm(sentence.text);
    if (text.trim().length === 0) {
      problems.push(`${label}: rỗng`);
      return;
    }
    if (sentence.text.length > MAX_SENTENCE_LENGTH) problems.push(`${label}: dài quá ${MAX_SENTENCE_LENGTH} ký tự`);

    // 1. Trích dữ kiện có thật.
    const cited = [...new Set(sentence.facts)];
    if (cited.length === 0) problems.push(`${label}: không trích dữ kiện nào`);
    const unknown = cited.filter((id) => !byId.has(id));
    if (unknown.length > 0) problems.push(`${label}: trích dữ kiện không có: ${unknown.join(", ")}`);
    const facts = cited.flatMap((id) => byId.get(id) ?? []);
    if (facts.length === 0) return;

    // 2. Nhãn = nhãn yếu nhất.
    const weakest = facts.reduce<FactBasis>(
      (acc, fact) => (BASIS_RANK[fact.basis] > BASIS_RANK[acc] ? fact.basis : acc),
      "verified",
    );
    if (sentence.basis !== weakest) {
      problems.push(`${label}: nhãn "${sentence.basis}" nhưng dữ kiện trích là "${weakest}"`);
    }

    // 3. Ước lượng phải nói ra.
    if (weakest === "estimate" && !ESTIMATE_MARKERS.test(text)) {
      problems.push(`${label}: dựa trên ước lượng mà không nói ra là ước lượng`);
    }

    // 4. Con số phải có trong CHÍNH dữ kiện được trích.
    const allowed = new Set([...nameNumbers, ...facts.flatMap((fact) => numbersIn(fact.text))]);
    const invented = [...new Set(numbersIn(sentence.text))].filter((value) => !allowed.has(value));
    if (invented.length > 0) problems.push(`${label}: con số không có trong dữ kiện trích: ${invented.join(", ")}`);
    if (MISFORMATTED_NUMBER.test(sentence.text)) problems.push(`${label}: số viết sai quy ước của site`);

    // 5. Tên riêng lạ.
    const foreign = [...foreignWords].filter((word) => containsWord(text, word));
    if (foreign.length > 0) problems.push(`${label}: nhắc tên không có trong dữ kiện: ${foreign.join(", ")}`);

    // 6. Cụm từ cấm.
    for (const ban of BANS) {
      const match = text.match(ban.pattern);
      if (match === null) continue;
      if (ban.allowIfInFacts && allFactText.includes(match[0])) continue;
      problems.push(`${label}: ${ban.why} ("${match[0]}")`);
    }

    // 7. Bonus bị chặn.
    if (blocked && CLAIMS_BONUS.test(text)) {
      problems.push(`${label}: nói người dùng nhận welcome bonus trong khi bonus bị chặn`);
    }
  });

  return problems.length === 0 ? { ok: true, draft } : { ok: false, problems };
}
