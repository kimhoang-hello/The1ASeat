"use client";

import { useState, type FormEvent } from "react";
import { PaperPlaneTilt, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { t as translate } from "@/lib/t";

const t = translate("hero");

export function NewsletterForm({
  variant = "light",
  id,
}: {
  variant?: "light" | "dark";
  id?: string;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [email, setEmail] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  if (status === "submitted") {
    return (
      <div
        id={id}
        className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${
          variant === "dark" ? "bg-white/10 text-white" : "bg-secondary text-foreground"
        }`}
      >
        <CheckCircle size={18} weight="fill" className="text-emerald-500 shrink-0" />
        {t("subscribed")}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Email
        </label>
        <input
          id={`${id}-email`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className={`w-full rounded-full border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary ${
            variant === "dark"
              ? "border-white/20 bg-white/5 text-white placeholder:text-white/40"
              : "border-border bg-white text-foreground placeholder:text-muted-foreground"
          }`}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className={`flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
            variant === "dark"
              ? "bg-white text-navy-ink hover:bg-white/90"
              : "bg-primary text-primary-foreground hover:bg-primary-hover"
          }`}
        >
          {status === "submitting" ? (
            <CircleNotch size={16} weight="bold" className="animate-spin" />
          ) : (
            <>
              {t("subscribe")}
              <PaperPlaneTilt size={16} weight="bold" />
            </>
          )}
        </button>
      </form>
      {status === "error" && (
        <p className={`mt-2 text-xs ${variant === "dark" ? "text-red-300" : "text-destructive"}`}>
          {t("error")}
        </p>
      )}
    </div>
  );
}
