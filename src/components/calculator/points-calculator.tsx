"use client";

import { useMemo, useState } from "react";
import { t as translate } from "@/lib/t";
import { POINTS_PROGRAMS } from "@/lib/points-programs";

const t = translate("calculator");

/**
 * Giữ lại dấu trừ ở đầu chuỗi. Bản cũ lọc `[^0-9.]` nên "-100" thành "100":
 * số âm lặng lẽ đổi dấu, và câu chặn `p <= 0` bên dưới không bao giờ thấy được
 * số âm nào cả — gõ "-100 point" ra kết quả y hệt gõ "100 point". Giờ số âm đi
 * đúng qua chỗ chặn đó và ra 0, tức là "không tính được", đúng như khi bỏ trống.
 *
 * Phần còn lại vẫn lọc: người đọc dán "3,500" hay "60,000 điểm" vào ô này là
 * chuyện thường, và bỏ dấu phẩy ngăn nghìn là đúng ý họ.
 */
function parseNumber(value: string): number {
  const negative = value.trimStart().startsWith("-");
  const n = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

function formatCents(valuePerPointInDollars: number): string {
  return (valuePerPointInDollars * 100).toFixed(1);
}

export function PointsCalculator() {
  const [programId, setProgramId] = useState("");
  const [points, setPoints] = useState("60000");
  const [cashPrice, setCashPrice] = useState("3500");
  const [taxes, setTaxes] = useState("300");

  const valuePerPoint = useMemo(() => {
    const p = parseNumber(points);
    const cash = parseNumber(cashPrice);
    const fees = parseNumber(taxes);
    if (p <= 0) return 0;
    return Math.max(cash - fees, 0) / p;
  }, [points, cashPrice, taxes]);

  const selectedProgram = POINTS_PROGRAMS.find((p) => p.id === programId);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8">
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
          {formatCents(valuePerPoint)}¢
        </p>
      </div>

      {selectedProgram && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t("benchmark", { program: selectedProgram.name, value: selectedProgram.centsPerPoint })}
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("resultHint")}</p>
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
