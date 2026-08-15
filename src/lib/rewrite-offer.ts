import Anthropic from "@anthropic-ai/sdk";

/**
 * Rewriting a card's Vietnamese offer copy from FinlyWealth's current numbers.
 *
 * When an elevated offer expires the card keeps running on the issuer's
 * standing offer, but every figure in `headlineVi`, `keyBenefitsVi` and
 * `editorsTakeVi` still quotes the offer that ended. FinlyWealth publishes the
 * current one in English prose; turning that into the site's Vietnamese voice
 * is a translation job, so it goes through Claude rather than a template.
 *
 * The old copy is passed in as well — not to be preserved, but so the rewrite
 * inherits its voice and keeps the parts of a card that did not change.
 */

export interface OfferCopy {
  headlineVi: string;
  keyBenefitsVi: string[];
  editorsTakeVi: string;
}

export const isRewriteConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM = `Bạn viết nội dung cho Ghế 1A, blog Miles & Points tiếng Việt cho người Việt tại Canada.

Nhiệm vụ: viết lại phần giới thiệu một thẻ tín dụng theo offer hiện hành, dựa trên dữ liệu tiếng Anh được cung cấp.

Quy tắc bắt buộc:
- Viết bằng tiếng Việt, xưng hô với người đọc là "bạn".
- Số dùng dấu phẩy ngăn cách hàng nghìn kiểu tiếng Anh: 35,000 — không phải 35.000.
- Dấu $ trần nghĩa là đô la Canada. Chỉ dùng "US$" cho số tiền đô la Mỹ thật sự.
- Giữ nguyên tiếng Anh các thuật ngữ: welcome bonus, elevated offer, rebate, transfer bonus, register, companion pass, lounge.
- Giữ ký hiệu ® và ™ ở tên ngân hàng và chương trình (Scene+™, American Express®, Aeroplan®, Star Alliance™...).
- CHỈ dùng số liệu có trong dữ liệu được cung cấp. Không suy đoán, không thêm quyền lợi không được nêu.

Giọng văn: thẳng thắn, đánh giá thật. Nếu offer mới yếu hơn offer cũ thì nói rõ, và chỉ ra giá trị thật của thẻ nằm ở đâu.

Yêu cầu từng trường:
- headlineVi: MỘT câu, nêu welcome bonus hiện hành và 1–2 quyền lợi nổi bật nhất.
- keyBenefitsVi: 4–5 gạch đầu dòng. Dòng đầu là welcome bonus kèm cách đạt được (mức chi tiêu, thời hạn). Các dòng sau là tỷ lệ tích điểm, phí ngoại tệ, phòng chờ, bảo hiểm — chỉ những gì có trong dữ liệu.
- editorsTakeVi: 2–4 câu đánh giá. Nếu thẻ có rebate, kết thúc bằng đúng câu: "HOT TIP: Apply thẻ qua FinlyWealth để nhận thêm $X rebate." (X là số rebate được cho).`;

const SCHEMA = {
  type: "object",
  properties: {
    headlineVi: { type: "string", description: "Một câu giới thiệu offer hiện hành." },
    keyBenefitsVi: {
      type: "array",
      items: { type: "string" },
      description: "4–5 quyền lợi chính, dòng đầu là welcome bonus.",
    },
    editorsTakeVi: { type: "string", description: "2–4 câu đánh giá, kết bằng HOT TIP nếu có rebate." },
  },
  required: ["headlineVi", "keyBenefitsVi", "editorsTakeVi"],
  additionalProperties: false,
} as const;

export async function rewriteOfferCopy(input: {
  name: string;
  issuer: string;
  annualFee: string;
  rebate?: string;
  /** FinlyWealth's English prose about the current offer. */
  offerDetails: string;
  current: OfferCopy;
}): Promise<OfferCopy> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Thẻ: ${input.name}
Ngân hàng phát hành: ${input.issuer}
Phí thường niên: ${input.annualFee}
Rebate FinlyWealth hiện tại: ${input.rebate ?? "không có"}

--- Offer hiện hành (dữ liệu tiếng Anh từ FinlyWealth) ---
${input.offerDetails}

--- Nội dung cũ trên site (đang ghi offer ĐÃ HẾT HẠN — chỉ dùng để giữ giọng văn) ---
headlineVi: ${input.current.headlineVi}
keyBenefitsVi:
${input.current.keyBenefitsVi.map((b) => `- ${b}`).join("\n")}
editorsTakeVi: ${input.current.editorsTakeVi}

Viết lại ba trường theo offer hiện hành.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Refused: ${response.stop_details?.category ?? "unknown"}`);
  }

  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error(`No text in response (stop_reason: ${response.stop_reason})`);

  const parsed = JSON.parse(text) as OfferCopy;
  if (!parsed.headlineVi || !parsed.editorsTakeVi || !parsed.keyBenefitsVi?.length) {
    throw new Error("Rewrite came back with an empty field");
  }
  return parsed;
}
