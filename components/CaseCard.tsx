type CaseCardProps = {
  name: string;
  description: string;
  price: number;
  icon: string;
  glow: string;
  onOpen: () => void;
  disabled?: boolean;
};

export default function CaseCard({
  name,
  description,
  price,
  icon,
  glow,
  onOpen,
  disabled = false,
}: CaseCardProps) {
  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-[#1a1e29] bg-[#0b0d13] p-3 transition-all duration-300 hover:-translate-y-1 hover:border-[#8b5cf6]/35 hover:shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
    >
      {/* TOP GLOW */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-[65px] opacity-[0.14] transition duration-300 group-hover:opacity-[0.22]"
        style={{
          background: glow,
        }}
      />

      {/* CARD SHINE */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.035] via-transparent to-transparent opacity-70" />

      {/* VISUAL */}
      <div
        className="relative flex h-[185px] items-center justify-center overflow-hidden rounded-xl border border-white/[0.045]"
        style={{
          background: `
            radial-gradient(
              circle at center,
              ${glow}28 0%,
              transparent 58%
            ),
            linear-gradient(
              145deg,
              #11141d,
              #090b11
            )
          `,
        }}
      >
        {/* GRID */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(255,255,255,0.05) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,0.05) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "28px 28px",
          }}
        />

        {/* GLOW BEHIND CASE */}
        <div
          className="absolute h-32 w-32 rounded-full blur-[35px] opacity-30"
          style={{
            background: glow,
          }}
        />

        {/* CASE */}
        <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-[22px] border border-white/[0.09] bg-gradient-to-br from-white/[0.11] to-white/[0.025] text-[48px] shadow-[0_25px_55px_rgba(0,0,0,0.5)] transition duration-300 group-hover:scale-[1.06]">
          {icon}

          <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-gradient-to-br from-white/[0.08] to-transparent" />
        </div>
      </div>

      {/* INFO */}
      <div className="relative px-1 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-bold tracking-[-0.2px] text-white">
              {name}
            </h3>

            <p className="mt-1 truncate text-[9px] text-[#666d7c]">
              {description}
            </p>
          </div>

          <span className="shrink-0 rounded-md border border-[#222733] bg-[#11141b] px-2 py-1 text-[7px] font-bold uppercase tracking-[0.8px] text-[#626978]">
            Case
          </span>
        </div>

        {/* BOTTOM */}
        <div className="mt-4 flex items-center justify-between border-t border-[#171b24] pt-3">
          <div>
            <div className="text-[7px] font-extrabold uppercase tracking-[1px] text-[#4f5563]">
              Price
            </div>

            <div className="mt-1 text-[13px] font-bold text-[#e7e8ed]">
              ${price.toFixed(2)}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpen}
            disabled={disabled}
            className="h-[34px] rounded-lg border border-[#9b7cf8]/20 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-4 text-[9px] font-extrabold tracking-[0.4px] text-white shadow-[0_8px_25px_rgba(109,63,224,0.2)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-110 hover:shadow-[0_10px_30px_rgba(109,63,224,0.3)] active:translate-y-0"
          >
            {disabled ? "LOCKED" : "OPEN"}
          </button>
        </div>
      </div>
    </article>
  );
}