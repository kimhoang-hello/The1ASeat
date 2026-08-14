// The drop-shadow lives on the wrapper so it follows the clipped ribbon
// silhouette — a box-shadow on the ribbon itself would get clipped away
// along the notched edge.
export function RebateBadge({ amount, label }: { amount: string; label: string }) {
  return (
    <div
      className="absolute -bottom-2.5 right-2"
      style={{ filter: "drop-shadow(0 2px 5px rgb(4 88 62 / 0.35))" }}
    >
      <div
        className="py-1.5 pl-5 pr-3.5 text-sm font-extrabold whitespace-nowrap text-white"
        style={{
          background: "linear-gradient(135deg, #10b981, #047857)",
          clipPath: "polygon(11% 0%, 100% 0%, 100% 100%, 11% 100%, 0% 50%)",
        }}
      >
        +{amount} {label}
      </div>
    </div>
  );
}
