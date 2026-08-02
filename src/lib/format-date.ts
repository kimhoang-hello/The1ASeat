import { format } from "date-fns";
import { vi } from "date-fns/locale";

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "d MMM yyyy", { locale: vi });
}
