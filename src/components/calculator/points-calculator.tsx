"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

function parseNumber(value: string): number {
  const n = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

export function PointsCalculator() {
  const t = useTranslations("calculator");
  const [points, setPoints] = useState("60000");
  const [cashPrice, setCashPrice] = useState("35000000");
  const [taxes, setTaxes] = useState("3000000");

  const valuePerPoint = useMemo(() => {
    const p = parseNumber(points);
    const cash = parseNumber(cashPrice);
    const fees = parseNumber(taxes);
    if (p <= 0) return 0;
    return Math.max(cash - fees, 0) / p;
  }, [points, cashPrice, taxes]);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="grid gap-5">
        <Field label={t("pointsLabel")} value={points} onChange={setPoints} />
        <Field label={t("cashPriceLabel")} value={cashPrice} onChange={setCashPrice} suffix="₫" />
        <Field label={t("taxesLabel")} value={taxes} onChange={setTaxes} suffix="₫" />
      </div>

      <div className="mt-6 rounded-xl bg-secondary p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("result")}
        </p>
        <p className="mt-1 font-display text-3xl font-extrabold text-primary">
          {formatVnd(valuePerPoint)}₫
        </p>
      </div>

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
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 text-sm outline-none"
        />
        {suffix && <span className="pr-3 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}
