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
- Ngoài danh sách trên thì viết tiếng Việt: hạng ghế là "hạng phổ thông" / "hạng phổ thông
  đặc biệt" / "hạng thương gia" (KHÔNG phải economy/business class), "đăng ký" chứ không
  phải "register", "đánh giá" chứ không phải "review", "thẻ tín dụng" chứ không phải
  "credit card", "đặt vé" chứ không phải "booking".
- Dấu $ trần nghĩa là đô la Canada. Chỉ dùng "US$" cho số tiền đô la Mỹ thật sự.
- Giữ nguyên tiếng Anh các thuật ngữ: welcome bonus, elevated offer, annual fee, monthly fee, rebate, transfer bonus, cashback, deal, companion pass, lounge, chequing, savings, direct deposit, dynamic pricing, award chart.
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
Annual fee: ${input.annualFee}
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

  assertFiguresAreSourced(parsed, input);
  return parsed;
}

/**
 * Giá trị SỐ của một con số viết ra, hoặc `null` nếu không đọc được.
 *
 * So bằng số chứ không bằng chuỗi chữ số. Bản đầu của bản vá này dùng
 * `replace(/\D/g, "")` và mắc cả hai loại lỗi cùng lúc:
 * - **nhận nhầm**: `$1.25` và `$125` cùng ra `"125"`, nên một HOT TIP bịa
 *   "$1.25" lọt qua khi rebate thật là "$125";
 * - **từ chối oan**: nguồn ghi `$1,000.00` còn bản viết ghi `$1,000` thì ra
 *   `"100000"` với `"1000"` — hai chuỗi khác nhau cho cùng một số tiền, và
 *   `expire-offers` giữ `expiresAt` nên thẻ đó ĐỎ DAI với copy hoàn toàn đúng.
 *
 * Đọc theo quy ước Anh (phẩy ngăn nghìn, chấm thập phân) cho cả hai vế. Đó vừa
 * là quy ước của prose FinlyWealth vừa là luật viết số của site, nên một bản
 * viết ra "70.000" kiểu Việt Nam BỊ từ chối là đúng — nó sẽ hiện sai trên
 * trang.
 */
function valueOf(figure: string): number | null {
  const n = Number(figure.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Một con số viết đúng: hoặc có nhóm nghìn chuẩn ("1,000", "70,000"), hoặc
 * không có dấu phẩy nào ("1000", "70000"), kèm phần thập phân tuỳ ý.
 *
 * Mẫu cũ `\d[\d,]*` nhận mọi cách đặt dấu phẩy, nên "$1,00" đọc ra 100 và
 * khớp một con số 100 có thật trong nguồn — một chỗ bịa lọt qua vì viết sai
 * chính tả con số.
 *
 * `(?!\d|[,.]\d)` ở cuối là phần BẮT BUỘC, không phải trang trí. Thiếu nó thì
 * "$100,00" vẫn khớp được đúng đoạn đầu "100" rồi bỏ lại ",00" — và 100 thì có
 * thật trong nguồn, nên cả ba cửa đều gật đầu cho một con số viết sai. `\b`
 * không thay thế được: giữa một chữ số và một dấu phẩy VẪN là ranh giới từ.
 *
 * Chỉ chặn khi phần dư là CHỮ SỐ, hoặc là dấu phẩy/dấu chấm CÓ CHỮ SỐ theo
 * sau. Bản đầu chặn mọi dấu phẩy (`(?![\d,]|\.\d)`) và thế là hỏng cả hai
 * chiều ở đúng một câu văn bình thường như "Earn US$1,000, when you…": con số
 * đó biến mất khỏi tập nguồn (nên bản viết ghi "$1,000" bị từ chối oan), và
 * cũng biến mất khỏi tập đang kiểm (nên một "$1,000, và…" bịa ra lại lọt qua
 * cả ba cửa). Dấu phẩy ngăn nghìn luôn có chữ số theo sau; dấu phẩy câu văn
 * thì không.
 */
const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?!\d|[,.]\d)`;

/**
 * Mọi con số tiền/điểm trong một đoạn chữ. Chỉ lấy thứ đáng kiểm:
 * - số tiền có `$` đứng trước ("$150", "US$1,000.00")
 * - số từ 1000 trở lên (welcome bonus, mức chi tiêu)
 *
 * KHÔNG lấy số nhỏ trần: "6 tháng", "4 lounge", "tỷ lệ 1.25x" là câu chữ, và
 * bắt chúng phải xuất hiện trong dữ liệu nguồn tiếng Anh sẽ đỏ oan ở gần như
 * mọi lượt.
 *
 * KHÔNG BẮT ĐƯỢC, ghi ra để không ai tưởng cửa này kín: số viết bằng chữ
 * ("seventy thousand"), viết tắt ("70K", "70 nghìn"), tiền không có ký hiệu
 * ("200 CAD"), phần trăm và bội số ("15%", "5x"). Một con số năm trong nguồn
 * ("2026") cũng nằm trong tập hợp lệ nên về lý thuyết nó "cấp phép" cho
 * "$2,026". Đây là lưới bắt chuyện BỊA THÔ — đổi 70,000 thành 100,000 — chứ
 * không phải bằng chứng rằng mọi con số đều đúng.
 */
function moneyAndPointsIn(text: string): number[] {
  const found: number[] = [];

  for (const m of text.matchAll(new RegExp(`\\$\\s?(${NUMBER})`, "g"))) {
    const value = valueOf(m[1]!);
    if (value !== null) found.push(value);
  }

  for (const m of text.matchAll(new RegExp(`\\b(${NUMBER})\\b`, "g"))) {
    const value = valueOf(m[1]!);
    if (value !== null && value >= 1000) found.push(value);
  }

  return found;
}

/**
 * Mọi con số tiền/điểm trong bản viết lại phải TRUY NGƯỢC được về dữ liệu đầu
 * vào.
 *
 * VÌ SAO CẦN: `/api/expire-offers` gọi `rewriteOfferCopy` rồi ghi thẳng kết
 * quả vào Contentful và publish, không có người xem giữa hai bước. Trước
 * 01/09/2026 kiểm duy nhất là "ba trường không rỗng" — tức là một lượt sinh
 * trả về JSON hợp lệ ghi "100,000 điểm" trong khi FinlyWealth nói 70,000 sẽ
 * lên thẳng trang thẻ. Đó là tiền thật của người đọc, và `tsc`, `build`, cả
 * bốn audit đều không chạm tới đường này.
 *
 * System prompt đã dặn "CHỈ dùng số liệu có trong dữ liệu được cung cấp", nên
 * đây không phải luật mới — nó là chỗ THI HÀNH luật đã có. Một câu dặn trong
 * prompt không phải một cửa kiểm.
 *
 * Ném chứ không lọc bớt: người gọi bắt exception, ghi lý do vào `needsReview`,
 * GIỮ `expiresAt` để lượt sau thử lại, và thẻ vẫn rời tab elevated. Tức là
 * đường hỏng ở đây làm thẻ nằm lại với copy cũ — chuyện thấy được và sửa được
 * — thay vì im lặng công bố một con số bịa. Chính vì thế mỗi lần TỪ CHỐI OAN
 * là một thẻ đỏ dai, nên cửa kiểm phải rộng rãi ở chỗ còn nghi ngờ: xem danh
 * sách "KHÔNG BẮT ĐƯỢC" ở `moneyAndPointsIn`.
 */
/**
 * Số tiền viết SAI ĐỊNH DẠNG trong bản viết lại — "$1,00", "$100,00".
 *
 * Cần một cửa riêng vì `NUMBER` cố ý KHÔNG khớp những chuỗi này, nên chúng
 * không sinh ra con số nào để đem đi đối chiếu và lặng lẽ trôi qua cửa
 * "truy được về nguồn". Trước khi có lookahead chống phần dư thì chúng còn tệ
 * hơn — "$100,00" đọc thành 100 và khớp một số 100 có thật. Giờ không nhận
 * nhầm nữa, nhưng vẫn phải CHẶN: "$1,00 rebate" in trên trang là một con số
 * tiền sai, dù không ai đọc ra nó là bao nhiêu.
 *
 * Cắt dấu câu ở cuối trước khi so, để "$1,000." kết thúc một câu không bị coi
 * là viết sai.
 */
const STRICT_NUMBER = new RegExp(`^(?:${NUMBER})$`);

function malformedMoneyIn(text: string): string[] {
  const bad: string[] = [];
  // `[\d.,-]+` chứ không phải `\d[\d.,]*`: mẫu cũ đòi CHỮ SỐ ngay sau `$`, nên
  // "$-500" không khớp ở đây, cũng không khớp `moneyAndPointsIn`, và 500 thì
  // dưới ngưỡng 1,000 của nhánh số trần — một con số tiền bịa đi qua sạch cả
  // ba cửa. Bắt mọi thứ trông như tiền rồi để `STRICT_NUMBER` phán.
  for (const m of text.matchAll(/\$\s?([\d.,-]+)/g)) {
    const token = m[1]!.replace(/[.,]+$/, "");
    if (!STRICT_NUMBER.test(token)) bad.push(`$${m[1]}`);
  }
  return bad;
}

function assertFiguresAreSourced(
  copy: OfferCopy,
  input: { name: string; annualFee: string; rebate?: string; offerDetails: string },
): void {
  // Nguồn hợp lệ: prose tiếng Anh của FinlyWealth, cộng những trường mình tự
  // đưa vào prompt và vì thế bản viết lại được phép nhắc lại.
  //
  // TẬP các con số, KHÔNG phải một chuỗi chữ số ghép lại. Ghép rồi
  // `.includes()` thì "50,000 … $3,000" thành "500003000", và một con số bịa
  // như "5000" khớp được vì nó nằm vắt qua ranh giới hai số thật — cửa kiểm
  // gật đầu đúng vào ca nó sinh ra để chặn. So theo tập thì mỗi con số phải
  // khớp trọn vẹn một con số có thật.
  const sourced = new Set(
    moneyAndPointsIn([input.offerDetails, input.annualFee, input.rebate ?? "", input.name].join(" ")),
  );

  const written = [copy.headlineVi, copy.editorsTakeVi, ...copy.keyBenefitsVi].join(" ");

  const malformed = [...new Set(malformedMoneyIn(written))];
  if (malformed.length > 0) {
    throw new Error(`bản viết lại có số tiền viết sai định dạng: ${malformed.join(", ")}`);
  }

  const unsourced = [...new Set(moneyAndPointsIn(written))].filter((value) => !sourced.has(value));

  if (unsourced.length > 0) {
    throw new Error(
      `bản viết lại có con số không truy được về dữ liệu nguồn: ${unsourced.join(", ")}`,
    );
  }

  // HOT TIP phải nói ĐÚNG con số rebate được đưa vào, không phải một con số
  // khác cũng tình cờ có trong nguồn. Đây là câu duy nhất trong toàn bộ copy
  // bảo người đọc bấm vào link affiliate để lấy tiền, nên nó phải khớp tuyệt
  // đối — và cửa kiểm ở trên không bắt được chuyện lẫn giữa hai con số cùng
  // xuất hiện trong prose.
  // `[^$]{0,80}` chứ không phải `HOT TIP:` cứng: dấu câu sau "HOT TIP" mà lệch
  // (gạch ngang, dấu hai chấm toàn rộng) thì vẫn phải ĐỌC RA con số để so, chứ
  // không được rơi vào nhánh "không đọc được rồi thôi". Chặn ở 80 ký tự để nó
  // không vươn tới một dấu `$` của câu khác.
  const hotTip = copy.editorsTakeVi.match(new RegExp(`HOT TIP[^$]{0,80}\\$\\s?(${NUMBER})`, "i"))?.[1];
  const hasHotTipPhrase = /HOT TIP/i.test(copy.editorsTakeVi);
  const rebateValue = input.rebate ? valueOf(input.rebate.replace(/[^\d.,]/g, "")) : null;

  if (input.rebate) {
    // Ba cửa, và cửa giữa là cửa từng bị hở. Trước đó điều kiện so số là
    // `if (hotTip && …)`, nên một câu có chữ "HOT TIP" mà regex không đọc ra
    // số — "HOT TIP - … $150 rebate", hay câu bỏ hẳn con số — làm cả phép so
    // biến mất. Tệ hơn: con số bịa đó thường LÀ một số có thật trong nguồn
    // (annual fee $150), nên cửa tổng quát ở trên cũng gật đầu. Có rebate thì
    // câu HOT TIP phải tồn tại, phải đọc ra được số, và số đó phải đúng.
    if (!hasHotTipPhrase) {
      throw new Error(`thẻ có rebate ${input.rebate} nhưng editorsTakeVi không có câu HOT TIP`);
    }
    if (hotTip === undefined) {
      throw new Error(
        `có câu HOT TIP nhưng không đọc ra được số rebate trong đó (rebate thật: ${input.rebate})`,
      );
    }
    if (valueOf(hotTip) !== rebateValue) {
      throw new Error(`HOT TIP ghi $${hotTip} nhưng rebate thật là ${input.rebate}`);
    }
  } else if (hasHotTipPhrase) {
    // Thẻ không có rebate mà vẫn hứa tiền. Không dựa vào cửa tổng quát bắt hộ:
    // con số trong lời hứa đó có thể tình cờ trùng một số có thật trong nguồn.
    throw new Error("thẻ không có rebate nhưng editorsTakeVi vẫn hứa HOT TIP");
  }
}
