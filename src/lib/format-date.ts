import { format } from "date-fns";
import { vi, enUS } from "date-fns/locale";

export function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  return format(d, "d MMM yyyy", { locale: locale === "vi" ? vi : enUS });
}
