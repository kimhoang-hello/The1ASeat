import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // English is temporarily disabled — add "en" back here to re-enable it.
  locales: ["vi"],
  defaultLocale: "vi",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
