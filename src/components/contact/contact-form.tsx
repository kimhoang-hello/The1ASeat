"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PaperPlaneTilt, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { NextSteps, StepLink } from "@/components/ui/next-steps";
import { t as translate } from "@/lib/t";

const t = translate("contactPage");
const next = translate("nextSteps");

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(t("subjectGeneral"));
  const [message, setMessage] = useState("");
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
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, subject, message }),
      });
      if (!res.ok) throw new Error("contact failed");
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  if (status === "submitted") {
    return (
      <>
        <div
          ref={doneRef}
          role="status"
          tabIndex={-1}
          className="flex items-center gap-2 rounded-xl bg-secondary px-5 py-4 text-sm font-medium text-foreground outline-none"
        >
          <CheckCircle size={20} weight="fill" className="shrink-0 text-emerald-500" />
          {t("sent")}
        </div>

        {/* Gửi xong là lúc cụt nhất của cả trang: form biến mất, còn lại đúng
            một dòng chữ. Khối này nằm NGOÀI vùng `role="status"` để screen
            reader chỉ đọc lên lời xác nhận, không đọc kèm ba cái link. */}
        <NextSteps title={t("sentNextTitle")} headingLevel="h3" className="mt-6">
          <StepLink
            href="/blog"
            label={next("blogLabel")}
            description={next("blogDescription")}
          />
          <StepLink
            href="/credit-cards"
            label={next("cardsLabel")}
            description={next("cardsDescription")}
          />
        </NextSteps>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-foreground/80">
            {t("firstName")} <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground/80">
            {t("lastName")} <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-foreground/80">
          {t("email")} <span className="text-destructive">*</span>
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground/80">
          {t("subject")} <span className="text-destructive">*</span>
        </span>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={`${inputClass} cursor-pointer`}
        >
          <option value={t("subjectGeneral")}>{t("subjectGeneral")}</option>
          <option value={t("subjectPartnership")}>{t("subjectPartnership")}</option>
          <option value={t("subjectFeedback")}>{t("subjectFeedback")}</option>
          <option value={t("subjectOther")}>{t("subjectOther")}</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground/80">
          {t("message")} <span className="text-destructive">*</span>
        </span>
        <textarea
          required
          rows={7}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${inputClass} resize-y`}
        />
      </label>

      <div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "submitting" ? (
            <CircleNotch size={16} weight="bold" className="animate-spin" />
          ) : (
            <>
              {t("send")}
              <PaperPlaneTilt size={16} weight="bold" />
            </>
          )}
        </button>
        {status === "error" && (
          <p role="status" className="mt-2 text-xs text-destructive">
            {t("error")}
          </p>
        )}
      </div>
    </form>
  );
}
