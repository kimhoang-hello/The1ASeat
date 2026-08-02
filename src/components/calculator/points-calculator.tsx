"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

function parseNumber(value: string): number {
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatCents(valuePerPointInDollars: number): string {
  return (valuePerPointInDollars * 100).toFixed(1);
}

export function PointsCalculator() {
  const t = useTranslations("calculator");
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

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="grid gap-5">
        <Field label={t("pointsLabel")} value={points} onChange={setPoints} />
        <Field label={t("cashPriceLabel")} value={cashPrice} onChange={setCashPrice} suffix="C$" />
        <Field label={t("taxesLabel")} value={taxes} onChange={setTaxes} suffix="C$" />
      </div>

      <div className="mt-6 rounded-xl bg-secondary p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("result")}
        </p>
        <p className="mt-1 font-display text-3xl font-extrabold text-primary">
          {formatCents(valuePerPoint)}¢
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
