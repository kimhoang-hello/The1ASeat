import Link from "next/link";
import { t } from "@/lib/t";

const notFound = t("notFound");
const common = t("common");

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-semibold tracking-wide text-primary">{notFound("eyebrow")}</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
        {notFound("title")}
      </h1>
      <p className="mt-3 text-muted-foreground">{notFound("description")}</p>
      <Link
        href="/"
        className="mt-8 inline-block cursor-pointer rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        {common("backHome")}
      </Link>
    </section>
  );
}
