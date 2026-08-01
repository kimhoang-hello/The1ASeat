"use client";

import { useId } from "react";

/**
 * Window-seat mark: a cabin window silhouette with a paper-plane cut out of
 * it — "the view from seat 1A" doubling as the paper-plane motif used for
 * newsletter/send actions elsewhere in the UI. Single-color (currentColor)
 * so it adapts to any badge background via a mask cutout.
 */
export function LogoGlyph({ className }: { className?: string }) {
  const maskId = useId();

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <mask id={maskId} maskUnits="userSpaceOnUse">
        <rect x="3" y="2" width="18" height="20" rx="9" fill="white" />
        <path d="M16.6 7 L9 9.6 L12.6 12.6 L10.6 16.2 Z" fill="black" />
      </mask>
      <rect x="3" y="2" width="18" height="20" rx="9" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground ${className ?? "h-8 w-8"}`}
    >
      <LogoGlyph className="h-[18px] w-[18px]" />
    </span>
  );
}
