import type { Locale } from "@/lib/content/types";

export function pickLocale<T>(value: Record<Locale, T>, locale: string): T {
  return value[(locale as Locale) in value ? (locale as Locale) : "vi"];
}
