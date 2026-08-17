/**
 * Phosphor's FacebookLogo knocks the "f" out of the disc with strokes so thin
 * that at icon sizes the glyph turns to mush and its stem bleeds past the
 * bottom edge. This is the official mark instead, whose counters survive at
 * 20-32px.
 *
 * The disc fills its whole box while Phosphor's YoutubeLogo is a short, wide
 * rounded rectangle, so a circle at the same nominal size reads as the larger
 * of the two. `size` here is the optical match, not the literal one — see the
 * call sites, which step it down.
 */
export function FacebookIcon({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
