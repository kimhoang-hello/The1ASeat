import { t as translate } from "@/lib/t";

const offers = translate("offers");

/**
 * The editor's take is one plain-text field in Contentful, and the rebate
 * cards end it with a "HOT TIP: ..." sentence. Split that sentence back out so
 * it can be given its own emphasis instead of disappearing into the paragraph
 * — it is the line that earns the rebate, and it was the least visible part of
 * the box. Anything without a HOT TIP just renders as before.
 */
export function splitHotTip(editorsTake: string): { body: string; hotTip?: string } {
  const match = editorsTake.match(/\bHOT\s*TIP\s*:\s*/i);
  if (!match || match.index === undefined) return { body: editorsTake };

  const body = editorsTake.slice(0, match.index).trim();
  const hotTip = editorsTake.slice(match.index + match[0].length).trim();
  if (!body || !hotTip) return { body: editorsTake };

  return { body, hotTip };
}

export function EditorsTake({
  editorsTake,
  className = "",
  compact = false,
}: {
  editorsTake: string;
  className?: string;
  compact?: boolean;
}) {
  const { body, hotTip } = splitHotTip(editorsTake);

  return (
    <div className={`rounded-lg bg-secondary ${compact ? "p-3" : "p-5"} ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {offers("editorsTake")}
      </p>
      <p className={`leading-relaxed text-foreground/90 ${compact ? "mt-1 text-sm" : "mt-2"}`}>
        {body}
      </p>

      {hotTip && (
        <p
          className={`flex gap-2 rounded-md border-l-4 border-emerald-600 bg-emerald-50 px-3 py-2 leading-relaxed text-emerald-950 ${
            compact ? "mt-3 text-sm" : "mt-4"
          }`}
        >
          <span className="shrink-0 font-extrabold uppercase tracking-wide text-emerald-700">
            {offers("hotTip")}
          </span>
          <span>{hotTip}</span>
        </p>
      )}
    </div>
  );
}
