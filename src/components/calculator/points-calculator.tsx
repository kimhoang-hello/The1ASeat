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
  let digits = (negative ? normalized.slice(1) : normalized).replace(/,/g, "");
  if (VI_THOUSANDS.test(digits)) digits = digits.replace(/\./g, "");

  // Tới đây chỉ còn chữ số và tối đa một dấu chấm thập phân. "3.5.7" rơi ở đây.
  if (!/^\d+(\.\d+)?$/.test(digits)) return null;

  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function formatCents(valuePerPointInDollars: number): string {
  return (valuePerPointInDollars * 100).toFixed(1);
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
  // (thẻ Amex trên site đều tích Aeroplan®/Bonvoy®), nên chọn "Amex Membership
  // Rewards®" sẽ rơi về link chung thay vì một bộ lọc trả về nguyên 23 thẻ.
  const canFilter = program !== undefined && cardProgramIds.includes(program.cardProgramId);

  return (
    <NextSteps title={next("title")} headingLevel="h3" className="mt-8">
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
          là "bay được đâu"; chương trình chỉ chuyển sang chỗ khác (Amex MR,
          Avion) thì câu hỏi đúng là "chuyển đi đâu được". */}
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
    return Math.max(cash - fees, 0) / p;
  }, [points, cashPrice, taxes]);

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
            {valuePerPoint === null ? t("resultUnavailable") : `${formatCents(valuePerPoint)}¢`}
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
