import type { InventoryItem } from "@/lib/inventory";

type ItemCardProps = {
  item: InventoryItem;
};

export default function ItemCard({ item }: ItemCardProps) {
  return (
    <article className="group overflow-hidden rounded-xl border border-[#1b1f2b] bg-gradient-to-br from-white/[0.025] to-white/[0.008] p-3 transition duration-200 hover:-translate-y-1 hover:border-[#8b5cf6]/30">
      <div
        className="grid h-[150px] place-items-center rounded-lg"
        style={{
          background: `radial-gradient(circle, ${item.color ?? "#8b5cf6"}20 0%, transparent 65%)`,
          backgroundColor: "#0b0d14",
        }}
      >
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <div
            className="text-5xl transition duration-200 group-hover:scale-110"
            style={{
              color: item.color ?? "#a78bfa",
              textShadow: `0 0 30px ${item.color ?? "#8b5cf6"}`,
            }}
          >
            ◆
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="truncate text-[11px] font-bold text-[#dddfe5]">
          {item.name}
        </div>

        {item.rarity && (
          <div className="mt-1 text-[9px] text-[#737887]">{item.rarity}</div>
        )}

        <div className="mt-2 flex items-center justify-between">
          {item.rarity && (
            <span
              className="rounded px-2 py-1 text-[7px] font-extrabold uppercase tracking-[0.8px]"
              style={{
                color: item.color ?? "#a78bfa",
                backgroundColor: `${item.color ?? "#8b5cf6"}18`,
              }}
            >
              {item.rarity}
            </span>
          )}
          <span className="text-[9px] font-bold text-[#8e93a2]">
            ${(item.price ?? 0).toFixed(2)}
          </span>
        </div>
      </div>
    </article>
  );
}