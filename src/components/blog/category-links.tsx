import Link from "next/link";
import { categoryPath, type BlogCategory } from "@/lib/blog-categories";
import { t } from "@/lib/t";

const seo = t("seo");

/**
 * Links out to every category archive. Present on /blog and on each archive so
 * the hub pages are reachable from more than just the sitemap.
 */
export function CategoryLinks({
  categories,
  activeSlug,
  className = "",
}: {
  categories: BlogCategory[];
  activeSlug?: string;
  className?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label={seo("categoriesLabel")} className={className}>
      <ul className="flex flex-wrap items-center gap-2">
        <li className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {seo("categoriesLabel")}
        </li>
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={categoryPath(category.slug)}
              aria-current={category.slug === activeSlug ? "page" : undefined}
              className={`inline-block rounded-full border px-3 py-1 text-sm transition-colors ${
                category.slug === activeSlug
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border text-foreground/70 hover:border-primary hover:text-primary"
              }`}
            >
              {category.name}
              <span className="ml-1 text-xs text-muted-foreground">{category.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
