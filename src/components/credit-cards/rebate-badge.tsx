export function RebateBadge({ amount, label }: { amount: string; label: string }) {
  return (
    <div
      className="absolute -bottom-2 right-3 py-1.5 pl-5 pr-3.5 text-xs font-bold whitespace-nowrap text-primary shadow-md"
      style={{
        background: "linear-gradient(135deg, #faf1dc, #e7d6ac)",
        clipPath: "polygon(12% 0%, 100% 0%, 100% 100%, 12% 100%, 0% 50%)",
      }}
    >
      {amount} {label}
    </div>
  );
}
