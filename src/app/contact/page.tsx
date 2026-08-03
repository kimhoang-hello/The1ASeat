import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "@/components/contact/contact-form";
import { t } from "@/lib/t";

const contact = t("contactPage");

export const metadata: Metadata = { title: contact("title") };

export default function ContactPage() {
  return (
    <>
      <PageHeader eyebrow={contact("eyebrow")} title={contact("title")} subtitle={contact("subtitle")} />

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-8">
          <ContactForm />
        </div>
      </section>
    </>
  );
}
