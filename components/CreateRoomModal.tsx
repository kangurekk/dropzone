"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateRoomModal({ open, onClose }: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [minBet, setMinBet] = useState(1);
  const [maxBet, setMaxBet] = useState(100);
  const [isPrivate, setIsPrivate] = useState(false);
  const [fillWithBots, setFillWithBots] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/blackjack/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          maxPlayers,
          minBet,
          maxBet,
          isPrivate,
          fillWithBots,
        }),
      });

      const d = await res.json();

      if (!res.ok) {
        setError(d.error ?? "Failed to create room");
        return;
      }

      router.push(`/blackjack/rooms/${d.roomId}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-2xl border border-[#252a38] bg-gradient-to-br from-[#11141d] via-[#0d1017] to-[#090b10] p-6 shadow-[0_35px_100px_rgba(0,0,0,0.7)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border border-[#252a38] bg-[#11141b] text-xl leading-none text-[#747987] transition hover:bg-[#181b25] hover:text-white"
        >
          ×
        </button>

        <div className="mb-6">
          <h2 className="text-[20px] font-bold tracking-[-0.4px]">
            Create room
          </h2>
          <p className="mt-1 text-[10px] text-[#737887]">
            Set up your blackjack table.
          </p>
        </div>

        <div className="space-y-4">
          {/* NAME */}
          <div>
            <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
              Room name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 30))}
              placeholder="My table"
              className="h-[42px] w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[13px] text-white outline-none focus:border-[#8b5cf6]"
            />
          </div>

          {/* MAX PLAYERS */}
          <div>
            <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
              Max players
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxPlayers(n)}
                  className={`h-[38px] rounded-lg border text-[12px] font-bold transition ${
                    maxPlayers === n
                      ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/15 text-[#a78bfa]"
                      : "border-[#1b1f2b] bg-[#0e1017] text-[#737887] hover:text-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* BETS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
                Min bet
              </label>
              <input
                type="number"
                min={1}
                value={minBet}
                onChange={(e) => setMinBet(Math.max(1, Number(e.target.value)))}
                className="h-[42px] w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[13px] text-white outline-none focus:border-[#8b5cf6]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
                Max bet
              </label>
              <input
                type="number"
                min={1}
                value={maxBet}
                onChange={(e) =>
                  setMaxBet(Math.max(minBet, Number(e.target.value)))
                }
                className="h-[42px] w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[13px] text-white outline-none focus:border-[#8b5cf6]"
              />
            </div>
          </div>

          {/* TOGGLES */}
          <div className="space-y-2">
            <Toggle
              label="Private room"
              hint="Only visible via direct link"
              value={isPrivate}
              onChange={setIsPrivate}
            />
            <Toggle
              label="Fill with bots"
              hint="Auto-fill empty seats when the game starts"
              value={fillWithBots}
              onChange={setFillWithBots}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-3 py-2 text-[11px] text-[#eb4b4b]">
              {error}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={create}
          disabled={loading}
          className="mt-6 h-[48px] w-full rounded-xl border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] text-[12px] font-extrabold tracking-[0.5px] text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {loading ? "Creating..." : "CREATE ROOM"}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-lg border border-[#1b1f2b] bg-[#0e1017] p-3 text-left transition hover:border-[#8b5cf6]/30"
    >
      <div>
        <div className="text-[12px] font-semibold text-white">{label}</div>
        <div className="mt-0.5 text-[9px] text-[#737887]">{hint}</div>
      </div>
      <div
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          value ? "bg-[#8b5cf6]" : "bg-[#1b1f2b]"
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            value ? "left-[22px]" : "left-0.5"
          }`}
        />
      </div>
    </button>
  );
}