"use client";

import { useMemo, useState } from "react";
import { t as translate } from "@/lib/t";
import { POINTS_PROGRAMS, type PointsProgram } from "@/lib/points-programs";
import { creditCardsPath } from "@/lib/card-points-programs";
import { NextSteps, StepLink } from "@/components/ui/next-steps";

const t = translate("calculator");
const next = translate("nextSteps");

/**
 * Giữ lại dấu trừ ở đầu chuỗi. Bản cũ lọc `[^0-9.]` nên "-100" thành "100":
 * số âm lặng lẽ đổi dấu, và câu chặn `p <= 0` bên dưới không bao giờ thấy được
 * số âm nào cả — gõ "-100 point" ra kết quả y hệt gõ "100 point". Giờ số âm đi
 * đúng qua chỗ chặn đó và ra 0, tức là "không tính được", đúng như khi bỏ trống.
 *
 * Phần còn lại vẫn lọc: người đọc dán "3,500" hay "60,000 điểm" vào ô này là
 * chuyện thường, và bỏ dấu phẩy ngăn nghìn là đúng ý họ.
 */
/** "60.000" là sáu mươi nghìn theo cách viết quen thuộc ở Việt Nam, không phải
 *  sáu mươi. Chỉ nhận dạng khi các dấu chấm chia chuỗi thành đúng từng nhóm ba
 *  chữ số — "3.5" vẫn là ba phẩy năm, vì không ai viết giá $3.50 thành "3.500". */
const VI_THOUSANDS = /^\d{1,3}(\.\d{3})+$/;

/**
 * Vế đối xứng của `VI_THOUSANDS`, cho DẤU PHẨY.
 *
 * Site viết số theo quy ước Anh — "110,000" là một trăm mười nghìn — nên dấu
 * phẩy được bỏ đi để đọc số. Nhưng "bỏ MỌI dấu phẩy" thì "3,5" (ba phẩy năm,
 * cách viết mặc định của người Việt) thành 35: sai đúng mười lần, và in ra
 * "35.0¢" trông hoàn chỉnh y như một kết quả đúng. Đo trên trình duyệt
 * 31/08/2026: `100 điểm / $3,5` ra 35.0¢ thay vì 3.5¢.
 *
 * Chỗ này đã có luật cho dấu chấm ("60.000" = sáu mươi nghìn) nhưng chưa có
 * luật cho dấu phẩy, nên hai cách viết Việt Nam được đối xử khác nhau mà
 * không vì lý do gì.
 *
 * Cách phân biệt: dấu phẩy ngăn nghìn LUÔN chia số thành từng nhóm ba chữ số.
 * "110,000" và "1,000,000" khớp mẫu này; "3,5" và "12,45" thì không — chúng
 * chỉ có thể là dấu thập phân.
 *
 * PHẦN THẬP PHÂN NẰM TRONG MẪU, không phải kiểm riêng. Bản đầu của bản vá này
 * viết `^\d{1,3}(,\d{3})+$` rồi coi mọi thứ còn lại có dấu phẩy là số kiểu
 * Việt Nam — và thế là "1,234.56", cách viết Anh hoàn toàn bình thường có CẢ
 * nhóm nghìn LẪN phần thập phân, rơi thẳng vào `null`. Trước bản vá nó đọc
 * đúng thành 1234.56. Codex bắt được ở vòng phản biện; đã tái hiện.
 *
 * NHÓM ĐẦU KHÔNG ĐƯỢC BẮT ĐẦU BẰNG 0. Không ai viết "0,001" để nói số 1, nên
 * chuỗi đó không phải số nhóm nghìn kiểu Anh — mà bản trước lại khớp nó (`0` +
 * `,001`) và đọc thành 1. Loại số 0 ở đầu ra thì nó rơi xuống hết các nhánh và
 * thành `null`, tức "không đọc được": câu trả lời đúng cho một chuỗi mà cả hai
 * cách hiểu đều không hợp lý.
 */
const EN_THOUSANDS = /^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/;

/**
 * Cách viết Việt Nam ĐẦY ĐỦ: dấu chấm ngăn nghìn VÀ dấu phẩy thập phân —
 * "1.234,56", "60.000,5".
 *
 * Thiếu nhánh này thì hai quy ước bị đối xử lệch nhau: bản Anh có cả nhóm
 * nghìn lẫn phần lẻ ("1,234.56") thì đọc được, còn bản Việt tương đương thì
 * không. Trước mọi bản vá, "1.234,56" ra 1.23456 — một con số bịa hoàn toàn,
 * in ra trông vẫn bình thường.
 */
const VN_FULL = /^\d{1,3}(\.\d{3})+,\d{1,2}$/;

/**
 * Dấu phẩy thập phân kiểu Việt Nam, KHÔNG kèm nhóm nghìn: "3,5", "12,45".
 *
 * Giới hạn 1–2 chữ số sau dấu phẩy là cố ý — đó là hình dạng của tiền.
 * "1234,567" không phải nhóm nghìn hợp lệ (nhóm đầu phải ≤3 chữ số) mà cũng
 * không giống phần lẻ của một khoản tiền, nên trả `null`. Đúng luật của cả
 * hàm này: `null` nghĩa là "không đọc được", và im lặng đoán bừa một con số
 * tiền mới là thứ phải tránh.
 */
const VI_DECIMAL = /^\d+,\d{1,2}$/;

/**
 * `null` là "không đọc được", khác với 0. Ô trống vẫn là 0 — bỏ trống ô thuế
 * nghĩa là không có thuế, đó là ý người dùng. Nhưng gõ "abc" mà trả 0 thì máy
 * lặng lẽ tính như thể thuế bằng 0 và in ra 5.8¢: một con số trông hoàn toàn
 * bình thường, dựng trên một ô người dùng biết là mình gõ sai.
 */
/**
 * Những chữ người ta hay gõ kèm con số. Chỉ đúng những chữ này được phép bỏ đi
 * trong im lặng.
 *
 * Bản cũ lọc thẳng `[^0-9.]`, tức là bỏ MỌI ký tự lạ. Hai ca hỏng thật ra từ
 * đó: `1e6` biến thành `16` (bỏ chữ "e", dính hai chữ số lại), nên gõ một
 * triệu điểm ra `20,000.0¢` thay vì `0.3¢`; và `$-3500` mất dấu trừ vì
 * `startsWith("-")` chỉ nhìn ký tự đầu, ra `+3500`. Cả hai đều in ra một con số
 * trông hoàn chỉnh, không có dấu hiệu nào cho biết máy đã đọc khác điều người
 * ta gõ.
 */
const DECORATION = /^(?:\$|₫|đ|cad|usd|điểm|diem|points?|pts?|miles?|dặm)+$/i;

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return 0;

  // Thứ còn lại sau khi bỏ chữ số và các ký tự ngăn cách phải là chữ trang trí
  // quen thuộc — không thì coi như không đọc được, y như gõ "abc".
  const leftover = trimmed.replace(/[0-9.,\-\s\u00a0]/g, "");
  if (leftover !== "" && !DECORATION.test(leftover)) return null;

  const normalized = trimmed.replace(/[^0-9.,\-]/g, "");
  // Dấu trừ chỉ được đứng trước mọi chữ số. "3-500" hay "3500-" là gõ nhầm,
  // không phải số âm.
  if (!/^-?[\d.,]+$/.test(normalized)) return null;

  const negative = normalized.startsWith("-");
  let digits = negative ? normalized.slice(1) : normalized;

  // Dấu phẩy: bỏ đi CHỈ KHI nó thật sự ngăn nghìn. Không khớp mẫu ba chữ số
  // thì nó là dấu thập phân kiểu Việt Nam — đổi thành dấu chấm rồi để phần
  // kiểm bên dưới xử lý như mọi số thập phân khác. Còn lại (nhiều dấu phẩy
  // đặt lung tung, "1,2,3") là gõ nhầm, và `null` ở đây nghĩa là "không đọc
  // được" chứ không phải một con số bịa ra — đúng luật của cả hàm này.
  if (EN_THOUSANDS.test(digits)) {
    digits = digits.replace(/,/g, "");
  } else if (VN_FULL.test(digits)) {
    digits = digits.replace(/\./g, "").replace(",", ".");
  } else if (digits.includes(",")) {
    if (!VI_DECIMAL.test(digits)) return null;
    digits = digits.replace(",", ".");
  }

  if (VI_THOUSANDS.test(digits)) digits = digits.replace(/\./g, "");

  // Tới đây chỉ còn chữ số và tối đa một dấu chấm thập phân. "3.5.7" rơi ở đây.
  if (!/^\d+(\.\d+)?$/.test(digits)) return null;

  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** `null` khi con số không in ra được. Chốt `Number.isFinite` phải nằm SAU
 *  phép nhân, không chỉ sau phép chia ở `valuePerPoint`: `1e308` là hữu hạn và
 *  qua được chốt trên, nhưng `1e308 * 100` là `Infinity` và ô kết quả in
 *  "Infinity¢" — đúng loại "con số trông như đã tính xong" mà cả hàm này lẫn
 *  `parseNumber` sinh ra để chặn. Kiểm ở đây vì đây là chỗ cuối cùng con số
 *  còn là số trước khi thành chữ. */
function formatCents(valuePerPointInDollars: number): string | null {
  const cents = valuePerPointInDollars * 100;
  if (!Number.isFinite(cents)) return null;
  return cents.toFixed(1);
}

/**
 * Người dùng vừa biết điểm của mình đáng bao nhiêu tiền, và trước khối này
 * trang calculator không có một đường nội bộ nào — câu hỏi ngay sau đó ("thẻ
 * nào tích loại điểm này", "bay được đâu") site trả lời được nhưng không có
 * đường dẫn tới.
 *
 * Chưa chọn chương trình thì khối vẫn hiện, chỉ là bản chung: ô chương trình
 * vốn ghi rõ "(tuỳ chọn)" nên bỏ trống là chuyện thường, không phải lý do để
 * trang quay lại thành ngõ cụt.
 *
 * Award Flight Finder KHÔNG nhận tham số chương trình — nó chỉ đọc
 * `origin`/`destination`/`cabin` rồi báo giá tất cả chương trình cùng lúc. Nên
 * link ở đây là đường trần, không phải `?program=`: một tham số bịa ra sẽ bị
 * bỏ qua trong im lặng và người đọc tưởng mình đã lọc sẵn.
 */
function CalculatorNextSteps({
  program,
  cardProgramIds,
}: {
  program?: PointsProgram;
  cardProgramIds: string[];
}) {
  // Lọc theo hệ điểm chỉ khi hệ đó có thẻ thật. Hiện `amex-mr` KHÔNG có thẻ nào
  // (thẻ Amex® trên site đều tích Aeroplan®/Bonvoy®), nên chọn hệ Membership
  // Rewards sẽ rơi về link chung thay vì một bộ lọc trả về nguyên 23 thẻ.
  //
  // Tên hệ ở đây cố ý viết trần, không kèm ký hiệu thương hiệu. audit:trademarks
  // học thương hiệu theo từng DÒNG: một ký hiệu bị xuống dòng, tách khỏi tên
  // đứng trước nó, sẽ dạy checker rằng chữ còn lại mới là thương hiệu. Bản đầu
  // của comment này để chữ Rewards đứng đầu dòng ngay trước ký hiệu, và checker
  // học đúng chữ đó thành thương hiệu rồi báo lỗi ở 8 chỗ hoàn toàn đúng — tên
  // chương trình của TD và của WestJet, cùng một dòng rule trong lib.
  const canFilter = program !== undefined && cardProgramIds.includes(program.cardProgramId);

  return (
    <NextSteps title={next("title")} compact className="mt-8">
      {canFilter ? (
        <StepLink
          href={creditCardsPath({ points: program!.cardProgramId })}
          label={next("cardsForProgramLabel", { program: program!.name })}
          description={next("cardsForProgramDescription")}
        />
      ) : (
        <StepLink
          href="/credit-cards"
          label={next("cardsLabel")}
          description={next("cardsDescription")}
        />
      )}

      {/* Chương trình có bảng giá trong Award Flight Finder thì câu hỏi kế tiếp
          là "bay được đâu"; chương trình chỉ chuyển sang chỗ khác (Amex® MR,
          Avion®) thì câu hỏi đúng là "chuyển đi đâu được". */}
      {program && !program.awardProgramId ? (
        <StepLink
          href="/transfer-partners"
          label={next("transferLabel")}
          description={next("transferDescription")}
        />
      ) : (
        <StepLink
          href="/award-flight-finder"
          label={next("awardLabel")}
          description={next("awardDescription")}
        />
      )}

      <StepLink
        href="/transfer-bonuses"
        label={next("bonusesLabel")}
        description={next("bonusesDescription")}
      />
    </NextSteps>
  );
}

export function PointsCalculator({ cardProgramIds }: { cardProgramIds: string[] }) {
  const [programId, setProgramId] = useState("");
  const [points, setPoints] = useState("60000");
  const [cashPrice, setCashPrice] = useState("3500");
  const [taxes, setTaxes] = useState("300");

  /**
   * `null` nghĩa là không tính được, khác hẳn với 0. Trước đây mọi trạng thái
   * không hợp lệ đều ra "0.0¢" — một con số trông như đã tính xong.
   *
   * Số âm ở hai ô tiền cũng bị chặn ở đây. Trước đó chỉ ô điểm được chặn, nên
   * gõ thuế "-300" cho `3500 - (-300)` và ra 6.3¢ thay vì 5.3¢: một con số cao
   * hơn sự thật, trông hoàn toàn bình thường.
   */
  const valuePerPoint = useMemo(() => {
    const p = parseNumber(points);
    const cash = parseNumber(cashPrice);
    const fees = parseNumber(taxes);
    if (p === null || cash === null || fees === null) return null;
    if (p <= 0 || cash < 0 || fees < 0) return null;
    const value = Math.max(cash - fees, 0) / p;
    // `p > 0` chưa đủ: `p` nhỏ tới mức dưới ngưỡng biểu diễn của số thực làm
    // phép chia tràn thành `Infinity`, và ô kết quả in ra "Infinity¢" — đúng
    // loại "con số trông như đã tính xong" mà `null` ở trên sinh ra để chặn.
    // Cùng luật với `parseNumber`: không tính được thì nói không tính được.
    if (!Number.isFinite(value)) return null;
    return value;
  }, [points, cashPrice, taxes]);

  const cents = valuePerPoint === null ? null : formatCents(valuePerPoint);

  const selectedProgram = POINTS_PROGRAMS.find((p) => p.id === programId);

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="grid gap-5">
          <label className="block">
            <span className="text-sm font-medium text-foreground/80">{t("programLabel")}</span>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="mt-1.5 w-full cursor-pointer rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t("programPlaceholder")}</option>
              {POINTS_PROGRAMS.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>

          <Field label={t("pointsLabel")} value={points} onChange={setPoints} />
          <Field label={t("cashPriceLabel")} value={cashPrice} onChange={setCashPrice} suffix="$" />
          <Field label={t("taxesLabel")} value={taxes} onChange={setTaxes} suffix="$" />
        </div>

        <div className="mt-6 rounded-xl bg-secondary p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("result")}
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold text-primary">
            {/* `cents` là null ở HAI ca khác nhau — không tính được, và tính
                được nhưng không in ra được (tràn số ở phép nhân trong
                `formatCents`). Cả hai đều phải ra cùng một dòng "không tính
                được"; ghép chuỗi thẳng ở đây sẽ in ra "null¢", mà `tsc` không
                bắt vì template literal nhận cả `null`. */}
            {cents === null ? t("resultUnavailable") : `${cents}¢`}
          </p>
        </div>

        {selectedProgram && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t("benchmark", { program: selectedProgram.name, value: selectedProgram.centsPerPoint })}
          </p>
        )}

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("resultHint")}</p>
      </div>

      <CalculatorNextSteps program={selectedProgram} cardProgramIds={cardProgramIds} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <div className="mt-1.5 flex items-center overflow-hidden rounded-lg border border-border bg-white focus-within:ring-2 focus-within:ring-primary">
        {suffix && <span className="pl-3 text-sm text-muted-foreground">{suffix}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 text-sm outline-none"
        />
      </div>
    </label>
  );
}
