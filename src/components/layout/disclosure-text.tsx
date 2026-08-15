import Link from "next/link";
import { t as translate } from "@/lib/t";

const t = translate("footer");

/**
 * The affiliate disclosure, with its closing sentence carrying real links.
 *
 * That sentence tells the reader to go and read two specific pages, so it has
 * to be clickable — it sat as plain text for a while, pointing at nothing. The
 * whole thing lives here rather than in the footer so the copy on a card page
 * and the copy at the bottom of the site can never say different things.
 */
export function DisclosureText() {
  return (
    <>
      {t("disclosure")}{" "}
      {t("disclosureSee")}{" "}
      <Link href="/terms" className="underline underline-offset-2 hover:no-underline">
        {t("terms")}
      </Link>{" "}
      &amp;{" "}
      <Link href="/privacy" className="underline underline-offset-2 hover:no-underline">
        {t("privacy")}
      </Link>
      .
    </>
  );
}
