import messages from "../../messages/vi.json";

type Messages = typeof messages;
type Namespace = keyof Messages;

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    str
  );
}

/** Vietnamese-only stand-in for next-intl's useTranslations/getTranslations. */
export function t<N extends Namespace>(namespace: N) {
  const ns = messages[namespace] as Record<string, string>;
  return (key: string, vars?: Record<string, string | number>): string => {
    const raw = ns[key];
    if (raw === undefined) return key;
    return interpolate(raw, vars);
  };
}
