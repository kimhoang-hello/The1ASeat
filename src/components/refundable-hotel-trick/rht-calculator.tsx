"use client";

import { useState } from "react";
import { t as translate } from "@/lib/t";
import { parseNumber } from "@/lib/parse-number";
import { cashOutCents, dollarRateLabel, formatDollars, formatPoints } from "@/lib/cash-out";

const t = translate("rht");

export interface RhtCalculatorProgram {
  id: string;
  label: string;
  pointsName: string;
  centsPerPoint: number;
  /** Kênh redeem mà tỷ lệ chỉ đúng khi đi qua (TD®: "qua Expedia® For TD"). */
  rateChannel?: string;
}

/**
 * Calculator của trang RHT: chọn chương trình, gõ số points, đọc ra số tiền.
 *
 * Chương trình nhận từ server qua props thay vì import `refundable-hotel-trick.ts`
 * — module đó mang cả nội dung bốn workflow, không cần nằm trong bundle trình
 * duyệt chỉ để lấy ba tỷ lệ.
 *
 * Chọn chương trình bằng radio thật, vẽ thành nút tròn: bàn phím, screen
 * reader và vùng chạm 44px đều có sẵn, không phải dựng lại một tablist.
 */
export function RhtCalculator({ programs }: { programs: RhtCalculatorProgram[] }) {
  const [programId, setProgramId] = useState(programs[0].id);
  const [points, setPoints] = useState("100,000");

  const program = programs.find((p) => p.id === programId) ?? programs[0];
  const parsed = parseNumber(points);
  // `null` (gõ sai), 0 (bỏ trống) và số âm đều ra cùng một dòng nhắc — không bao
  // giờ in "$0" như thể đã tính xong.
  const valid = parsed !== null && parsed > 0;
  const totalCents = valid ? cashOutCents(parsed, program.centsPerPoint) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <fieldset>
        <legend className="text-sm font-medium text-foreground/80">{t("calcProgram")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {programs.map((option) => (
            <label
              key={option.id}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-primary has-focus-visible:ring-offset-2"
            >
              <input
                type="radio"
                name="rht-program"
                value={option.id}
                checked={option.id === programId}
                onChange={() => setProgramId(option.id)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-foreground/80">{t("calcPoints")}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          placeholder="100,000"
          className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      <output aria-live="polite" className="mt-6 block border-t border-border pt-5 text-center">
        {totalCents === null ? (
          <span className="block py-3 text-base text-muted-foreground">{t("calcEmpty")}</span>
        ) : (
          <>
            <span className="block text-base font-semibold text-foreground">
              {formatPoints(parsed!)} {program.pointsName}
            </span>
            <span className="mt-1 block font-display text-4xl font-bold text-primary">
              = {formatDollars(totalCents)}
            </span>
          </>
        )}
        {/* Kênh đi kèm tỷ lệ, cùng câu với thẻ workflow ở trên (04/10/2026, Codex
            bắt): 0.5¢ của TD® chỉ đúng qua Expedia® For TD, nên in tỷ lệ trần
            ở đây là nói giá trị điểm cao hơn thật ở mọi kênh khác. */}
        <span className="mt-2 block text-sm text-muted-foreground">
          {program.rateChannel
            ? t("rateChannel", {
                channel: program.rateChannel,
                rate: dollarRateLabel(program.centsPerPoint),
              })
            : t("rate", { rate: dollarRateLabel(program.centsPerPoint) })}
        </span>
      </output>
    </div>
  );
}
