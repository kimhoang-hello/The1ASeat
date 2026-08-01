import type { ReactNode } from "react";

export function boldOccurrences(text: string, needle: string): ReactNode[] {
  if (!needle) return [text];
  const parts = text.split(needle);
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(part);
    if (i < parts.length - 1) {
      nodes.push(<strong key={`b-${i}`}>{needle}</strong>);
    }
  });
  return nodes;
}
