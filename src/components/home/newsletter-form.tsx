"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PaperPlaneTilt, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { t as translate } from "@/lib/t";

const t = translate("hero");

/**
 * `size="hero"` is for the form that stands alone in the middle of the hero,
 * where the default width reads as a small element marooned in a lot of space.
 * The footer CTA keeps the default — it sits beside a heading in a row and
 * would crowd it at hero size.
 */
export function NewsletterForm({
  variant = "light",
  size = "default",
  id,
}: {
  variant?: "light" | "dark";
  size?: "default" | "hero";
  id?: string;
}) {
  const hero = size === "hero";
  const wrapWidth = hero ? "max-w-md sm:max-w-xl xl:max-w-2xl" : "max-w-md";
  const fieldSize = hero ? "px-5 py-3.5 text-base xl:px-6 xl:py-4 xl:text-lg" : "px-4 py-3 text-sm";
  const buttonSize = hero ? "px-6 py-3.5 text-base xl:px-8 xl:py-4 xl:text-lg" : "px-5 py-3 text-sm";
  const iconSize = hero ? 20 : 16;
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [email, setEmail] = useState("");
  const doneRef = useRef<HTMLDivElement>(null);

/**
 * Khi gửi xong, cả form lẫn cái nút người dùng vừa bấm bị thay bằng một dòng
 * chữ. Với người dùng screen reader thì phần tử đang focus biến mất giữa
 * chừng: focus rơi về `<body>`, và dòng chữ mới không được đọc lên vì nó chỉ
 * là một `<div>` thường. Họ bấm Gửi rồi không biết đã gửi được hay chưa.
 *
 * `role="status"` để nó được đọc lên, `tabIndex={-1}` + `focus()` để con trỏ
 * đi theo tới đúng chỗ nội dung vừa đổi.
 */
  useEffect(() => {
    if (status === "submitted") doneRef.current?.focus();
  }, [status]);

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
        ref={doneRef}
        role="status"
        tabIndex={-1}
        className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium outline-none ${
          variant === "dark" ? "bg-white/10 text-white" : "bg-secondary text-foreground"
        }`}
      >
        <CheckCircle size={18} weight="fill" className="text-emerald-500 shrink-0" />
        {t("subscribed")}
      </div>
    );
  }

  return (
    <div className={`w-full ${wrapWidth}`}>
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
          className={`w-full rounded-full border outline-none focus:ring-2 focus:ring-primary ${fieldSize} ${
            variant === "dark"
              ? "border-white/20 bg-white/5 text-white placeholder:text-white/40"
              : "border-border bg-white text-foreground placeholder:text-muted-foreground"
          }`}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className={`flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${buttonSize} ${
            variant === "dark"
              ? "bg-white text-navy-ink hover:bg-white/90"
              : "bg-primary text-primary-foreground hover:bg-primary-hover"
          }`}
        >
          {status === "submitting" ? (
            <CircleNotch size={iconSize} weight="bold" className="animate-spin" />
          ) : (
            <>
              {t("subscribe")}
              <PaperPlaneTilt size={iconSize} weight="bold" />
            </>
          )}
        </button>
      </form>
      {status === "error" && (
        <p
          role="status"
          className={`mt-2 text-xs ${variant === "dark" ? "text-red-300" : "text-destructive"}`}
        >
          {t("error")}
        </p>
      )}
    </div>
  );
}
