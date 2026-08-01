"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { PaperPlaneTilt, CheckCircle } from "@phosphor-icons/react";

export function NewsletterForm({
  variant = "light",
  id,
}: {
  variant?: "light" | "dark";
  id?: string;
}) {
  const t = useTranslations("hero");
  const [status, setStatus] = useState<"idle" | "submitted">("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: wire up to a real email provider (Mailchimp / ConvertKit / Resend audience, etc.)
    setStatus("submitted");
  }

  if (status === "submitted") {
    return (
      <div
        id={id}
        className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${
          variant === "dark"
            ? "bg-white/10 text-white"
            : "bg-secondary text-foreground"
        }`}
      >
        <CheckCircle size={18} weight="fill" className="text-emerald-500 shrink-0" />
        {variant === "dark" ? "Đã đăng ký!" : "Đã đăng ký!"}
      </div>
    );
  }

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
    >
      <label htmlFor={`${id}-email`} className="sr-only">
        Email
      </label>
      <input
        id={`${id}-email`}
        type="email"
        required
        placeholder={t("emailPlaceholder")}
        className={`w-full rounded-full border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary ${
          variant === "dark"
            ? "border-white/20 bg-white/5 text-white placeholder:text-white/40"
            : "border-border bg-white text-foreground placeholder:text-muted-foreground"
        }`}
      />
      <button
        type="submit"
        className={`flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-3 text-sm font-semibold transition-colors ${
          variant === "dark"
            ? "bg-white text-navy-ink hover:bg-white/90"
            : "bg-primary text-primary-foreground hover:bg-primary-hover"
        }`}
      >
        {t("subscribe")}
        <PaperPlaneTilt size={16} weight="bold" />
      </button>
    </form>
  );
}
