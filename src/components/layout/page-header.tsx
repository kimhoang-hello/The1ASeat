export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-border bg-secondary px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-wide text-primary">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
