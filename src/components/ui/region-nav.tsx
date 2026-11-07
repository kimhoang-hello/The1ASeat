import { ArrowDown } from "@phosphor-icons/react/ssr";
import { Flag } from "@/components/ui/flag";

/**
 * Bộ chọn Canada / Mỹ ở đầu trang và tiêu đề của từng mục — dùng chung cho
 * `/transfer-partners` và `/transfer-bonuses`, để hai trang tách hai nước theo
 * cùng một cách.
 *
 * Link neo xuống mục, không phải tab: cả hai mục nằm sẵn trong HTML — không cần
 * JS, Google đọc được hết, nút Back đưa người đọc về đây. Cùng lý do với bộ
 * chọn của Refundable Hotel Trick.
 */
export function RegionJump({
  href,
  country,
  title,
  description,
}: {
  href: string;
  country: "ca" | "us";
  title: string;
  description: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        className="flex h-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary sm:p-5"
      >
        <span>
          <span className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Flag country={country} />
            {title}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
        </span>
        <ArrowDown size={18} weight="bold" className="shrink-0 text-primary" aria-hidden />
      </a>
    </li>
  );
}

export function RegionHeading({
  id,
  country,
  children,
}: {
  id: string;
  country: "ca" | "us";
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="flex items-center gap-3 font-display text-2xl font-bold text-foreground">
      <Flag country={country} />
      {children}
    </h2>
  );
}
