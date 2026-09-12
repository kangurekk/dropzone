"use client";

import { useEffect, useState } from "react";

type DepositModalProps = {
  open: boolean;
  onClose: () => void;
  onDeposit: (amount: number) => void; // called after successful deposit
};

const PRESETS = [5, 10, 15, 20];

export default function DepositModal({
  open,
  onClose,
  onDeposit,
}: DepositModalProps) {
  const [custom, setCustom] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch remaining whenever modal opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    setCustom("");
    fetch("/api/deposit")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.remaining === "number") setRemaining(d.remaining);
        if (typeof d.limit === "number") setLimit(d.limit);
      })
      .catch(() => setRemaining(0));
  }, [open]);

  async function deposit(amount: number) {
    if (!isFinite(amount) || amount <= 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Deposit failed");
        if (typeof data.remaining === "number") setRemaining(data.remaining);
        return;
      }

      setRemaining(data.remaining);
      onDeposit(amount);
      setCustom("");
      // Don't close — let them see the updated remaining.
      // But most users will want it closed. Change to close if you prefer:
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const r = remaining ?? limit;
  const canDeposit = r > 0 && !loading;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#252a38] bg-gradient-to-br from-[#11141d] via-[#0d1017] to-[#090b10] p-6 shadow-[0_35px_100px_rgba(0,0,0,0.7)]">
        <div
          className="pointer-events-none absolute left-1/2 top-[-100px] h-[200px] w-[200px] -translate-x-1/2 rounded-full blur-[80px]"
          style={{ background: "#8b5cf6", opacity: 0.18 }}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-30 grid h-8 w-8 place-items-center rounded-lg border border-[#252a38] bg-[#11141b] text-xl leading-none text-[#747987] transition hover:bg-[#181b25] hover:text-white"
        >
          ×
        </button>

        <div className="relative text-center">
          <span className="text-[8px] font-extrabold uppercase tracking-[1.8px] text-[#a78bfa]">
            DEMO BALANCE
          </span>
          <h2 className="mt-2 text-[20px] font-bold tracking-[-0.4px] text-white">
            Add funds
          </h2>
          <p className="mt-1 text-[10px] text-[#666d7c]">
            All currency is fictional.
          </p>
        </div>

        {/* DAILY LIMIT BAR */}
        <div className="mt-6 rounded-xl border border-[#1b1f2b] bg-[#0e1017] p-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
              Daily limit
            </span>
            <span className="font-bold text-[#a78bfa]">
              ${r.toFixed(2)} / ${limit.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#181c26]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, ((limit - r) / limit) * 100)}%`,
                background:
                  r <= 0
                    ? "#eb4b4b"
                    : r <= 5
                      ? "#eab308"
                      : "linear-gradient(to right, #8b5cf6, #a78bfa)",
              }}
            />
          </div>
          <div className="mt-1.5 text-[9px] text-[#4f5563]">
            Resets on a rolling 24-hour basis.
          </div>
        </div>

        {/* PRESETS */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {PRESETS.map((amount) => {
            const disabled = !canDeposit || amount > r;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => deposit(amount)}
                disabled={disabled}
                className="h-[54px] rounded-xl border border-[#1b1f2b] bg-[#0e1017] text-[13px] font-bold text-[#e7e8ed] transition hover:-translate-y-[1px] hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0"
              >
                +${amount}
              </button>
            );
          })}
        </div>

        {/* CUSTOM */}
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            min="1"
            step="1"
            placeholder={
              r > 0 ? `Custom (max $${r.toFixed(2)})` : "Daily limit reached"
            }
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            disabled={!canDeposit}
            onKeyDown={(e) => {
              if (e.key === "Enter") deposit(parseFloat(custom));
            }}
            className="h-[46px] flex-1 rounded-xl border border-[#1b1f2b] bg-[#0e1017] px-4 text-[12px] text-white outline-none transition focus:border-[#8b5cf6] disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => deposit(parseFloat(custom))}
            disabled={
              !canDeposit ||
              !custom ||
              parseFloat(custom) <= 0 ||
              parseFloat(custom) > r
            }
            className="h-[46px] rounded-xl border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-5 text-[10px] font-extrabold tracking-[0.4px] text-white shadow-[0_10px_30px_rgba(109,63,224,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "..." : "ADD"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-3 py-2 text-center text-[11px] text-[#eb4b4b]">
            {error}
          </div>
        )}

        {r <= 0 && (
          <div className="mt-4 rounded-lg border border-[#eab308]/30 bg-[#eab308]/[0.08] px-3 py-2 text-center text-[11px] text-[#eab308]">
            You've reached the $20 daily limit. Try again in a few hours.
          </div>
        )}

        <p className="mt-4 text-center text-[9px] leading-[1.6] text-[#4f5563]">
          Fictional money for demo purposes only. Not real currency.
        </p>
      </div>
    </div>
  );
}