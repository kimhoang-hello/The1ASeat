/**
 * Dòng tag quyền lợi dưới một thẻ trong danh sách — dùng chung cho thẻ Mỹ
 * (tag viết tay) và thẻ Canada (tag suy từ `cardTagsFor`), để hai trang trông
 * là một site.
 */
export function CardTags({ tags, className = "" }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}
