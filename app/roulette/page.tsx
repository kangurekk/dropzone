"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

type Phase = "betting" | "spinning" | "result";

type Bet = {
  username: string;
  type: string;
  number?: number;
  amount: number;
};

type State = {
  roundId: number;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  winningNumber: number | null;
  bets: Bet[];
};

// Physical wheel order (counter-clockwise from 0)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30,
  8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
];

const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const SEGMENT_ANGLE = 360 / 37;
const SPINNING_MS = 7000;

function numColor(n: number): string {
  if (n === 0) return "#22c55e";
  return RED.has(n) ? "#eb4b4b" : "#1a1e29";
}

/* =========================================================
   WHEEL
========================================================= */

function Wheel({
  rotation,
  spinning,
  durationMs,
}: {
  rotation: number;
  spinning: boolean;
  durationMs: number;
}) {
  const r = 100;
  const textR = 76;

  return (
    <div className="relative h-[440px] w-[440px]">
      {/* POINTER */}
      <div
        className="absolute left-1/2 top-[-4px] z-30 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderTop: "24px solid #fbbf24",
          filter:
            "drop-shadow(0 0 12px rgba(251,191,36,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))",
        }}
      />

      {/* AMBIENT GLOW */}
      <div
        className="pointer-events-none absolute inset-[-30px] rounded-full"
        style={{
          background:
            spinning || rotation !== 0
              ? "radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 65%)"
              : "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 65%)",
          transition: "background 500ms ease",
          filter: "blur(20px)",
        }}
      />

      {/* OUTER METALLIC RING */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, #3a2f1a 0%, #fbbf24 12%, #7a5f1f 25%, #fbbf24 38%, #3a2f1a 50%, #fbbf24 62%, #7a5f1f 75%, #fbbf24 88%, #3a2f1a 100%)",
          boxShadow:
            "0 0 60px rgba(139,92,246,0.3), inset 0 0 20px rgba(0,0,0,0.9), 0 20px 50px rgba(0,0,0,0.6)",
        }}
      />

      {/* INNER DARK RING */}
      <div className="absolute inset-[14px] rounded-full bg-[#08090e]" />

      {/* INNER SHADOW */}
      <div
        className="absolute inset-[18px] rounded-full"
        style={{
          boxShadow:
            "inset 0 8px 24px rgba(0,0,0,0.9), inset 0 -4px 12px rgba(255,255,255,0.03)",
        }}
      />

      {/* SPINNING WHEEL */}
      <div
        className="absolute inset-[22px]"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? `transform ${durationMs}ms cubic-bezier(0.15, 0.7, 0.15, 1)`
            : "none",
          willChange: "transform",
        }}
      >
        <svg viewBox="-110 -110 220 220" className="h-full w-full">
          <defs>
            <radialGradient id="wheel-shade">
              <stop offset="65%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
            </radialGradient>
            <radialGradient id="red-grad" cx="50%" cy="50%" r="80%">
              <stop offset="0%" stopColor="#e02929" />
              <stop offset="100%" stopColor="#a01c1c" />
            </radialGradient>
            <radialGradient id="black-grad" cx="50%" cy="50%" r="80%">
              <stop offset="0%" stopColor="#1e222c" />
              <stop offset="100%" stopColor="#0a0b0f" />
            </radialGradient>
            <radialGradient id="green-grad" cx="50%" cy="50%" r="80%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </radialGradient>
          </defs>

          {WHEEL_ORDER.map((num, i) => {
            const startAngle = i * SEGMENT_ANGLE - 90 - SEGMENT_ANGLE / 2;
            const endAngle = startAngle + SEGMENT_ANGLE;
            const isRed = RED.has(num);
            const fill =
              num === 0
                ? "url(#green-grad)"
                : isRed
                  ? "url(#red-grad)"
                  : "url(#black-grad)";

            const x1 = Math.cos((startAngle * Math.PI) / 180) * r;
            const y1 = Math.sin((startAngle * Math.PI) / 180) * r;
            const x2 = Math.cos((endAngle * Math.PI) / 180) * r;
            const y2 = Math.sin((endAngle * Math.PI) / 180) * r;
            const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;

            const path = `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            const midAngle = (startAngle + endAngle) / 2;
            const tx = Math.cos((midAngle * Math.PI) / 180) * textR;
            const ty = Math.sin((midAngle * Math.PI) / 180) * textR;

            return (
              <g key={`${num}-${i}`}>
                <path
                  d={path}
                  fill={fill}
                  stroke="#fbbf24"
                  strokeWidth="0.5"
                  strokeOpacity="0.35"
                />
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8.5"
                  fontWeight="800"
                  fill="#ffffff"
                  transform={`rotate(${midAngle + 90} ${tx} ${ty})`}
                  style={{
                    textShadow: "0 0 4px rgba(0,0,0,1)",
                    pointerEvents: "none",
                    letterSpacing: "-0.2px",
                  }}
                >
                  {num}
                </text>
              </g>
            );
          })}

          {/* INNER SHADOW OVERLAY */}
          <circle cx="0" cy="0" r={r} fill="url(#wheel-shade)" />
        </svg>
      </div>

      {/* CENTER HUB */}
      <div className="absolute left-1/2 top-1/2 z-10 grid h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#fbbf24]/30 bg-gradient-to-b from-[#0f1218] to-[#0a0c11] shadow-[inset_0_2px_12px_rgba(0,0,0,0.6),0_0_40px_rgba(251,191,36,0.15)]">
        <div className="text-center">
          <div className="text-[9px] font-extrabold uppercase tracking-[2.5px] text-[#fbbf24]">
            большой
            <span className="text-[#a78bfa]">дроп</span>
          </div>
          <div className="mt-1 text-[8px] font-bold uppercase tracking-[2px] text-[#4f5563]">
            Roulette
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function RoulettePage() {
  const [state, setState] = useState<State | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);

  const [betAmount, setBetAmount] = useState(5);
  const [placedOn, setPlacedOn] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [showNumber, setShowNumber] = useState(false);

  const lastPaidRound = useRef<number>(0);
  const lastPhase = useRef<string>("");
  const lastRoundId = useRef<number>(0);

  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me");
      const d = await res.json();
      setUsername(d.user?.username ?? null);
      setAvatar(d.user?.avatar ?? null);
      setBalance(d.user?.balance ?? 0);
    } catch {}
  }

  useEffect(() => {
    loadMe();

    let es: EventSource | null = null;
    function connect() {
      es = new EventSource("/api/roulette/stream");

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "state") {
            setState(data.state);

            // Payout once per round
            if (
              data.state.phase === "result" &&
              data.state.roundId !== lastPaidRound.current
            ) {
              lastPaidRound.current = data.state.roundId;
              fetch("/api/roulette/payout", { method: "POST" })
                .then((r) => r.json())
                .then((d) => {
                  if (d.winners?.length > 0) loadMe();
                })
                .catch(() => {});
            }
          }
        } catch {}
      };

      es.onerror = () => {
        es?.close();
        es = null;
        setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      es?.close();
    };
  }, []);

  // Handle phase transitions
  useEffect(() => {
    if (!state) return;

    const prevPhase = lastPhase.current;
    const prevRound = lastRoundId.current;

    // Entering spinning phase — start wheel
    if (state.phase === "spinning" && prevPhase !== "spinning") {
      const winning = state.winningNumber ?? 0;
      const idx = WHEEL_ORDER.indexOf(winning);
      const spins = 6 + Math.floor(Math.random() * 3);
      // Target: bring segment idx to top (12 o'clock)
      const targetAngle = spins * 360 - idx * SEGMENT_ANGLE;
      const offset = (Math.random() - 0.5) * (SEGMENT_ANGLE * 0.6);
      const finalRotation = targetAngle + offset;

      // Reset rotation instantly, then start spin
      setWheelSpinning(false);
      setShowNumber(false);
      setWheelRotation(0);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWheelSpinning(true);
          setWheelRotation(finalRotation);
        });
      });
    }

    // Entering result phase — wheel stops, delay then show number
    if (state.phase === "result" && prevPhase !== "result") {
      setWheelSpinning(false);
      // Small delay before showing number for drama
      setTimeout(() => setShowNumber(true), 800);
    }

    // New round — reset everything
    if (state.roundId !== prevRound) {
      setWheelSpinning(false);
      setWheelRotation(0);
      setShowNumber(false);
    }

    lastPhase.current = state.phase;
    lastRoundId.current = state.roundId;
  }, [state]);

  // Countdown ticker
  useEffect(() => {
    if (!state) return;
    const tick = () => {
      const secs = Math.max(
        0,
        Math.ceil((state.phaseEndsAt - Date.now()) / 1000)
      );
      setCountdown(secs);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [state]);

  async function placeBet(type: string, number?: number) {
    if (state?.phase !== "betting") {
      setFlash("Betting is closed");
      setTimeout(() => setFlash(null), 2000);
      return;
    }

    if (betAmount < 1 || betAmount > balance) {
      setFlash(
        betAmount > balance ? "Not enough balance" : "Minimum bet is $1"
      );
      setTimeout(() => setFlash(null), 2000);
      return;
    }

    const res = await fetch("/api/roulette/bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, number, amount: betAmount }),
    });
    const d = await res.json();

    if (!res.ok) {
      setFlash(d.error ?? "Bet failed");
      setTimeout(() => setFlash(null), 2000);
      return;
    }

    setBalance(d.newBalance);
    const label = number != null ? `#${number}` : type;
    setPlacedOn(label);
    setTimeout(() => setPlacedOn(null), 1500);
  }

  const phaseLabel =
    state?.phase === "betting"
      ? "Place your bets"
      : state?.phase === "spinning"
        ? "No more bets"
        : "Result";

  const totalBets =
    state?.bets.reduce((sum, b) => sum + b.amount, 0) ?? 0;

  const winning = state?.winningNumber ?? null;
  const showWinning =
    state?.phase === "result" && winning != null && showNumber;

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="casino" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
        <Topbar
          title="Roulette"
          description="Global roulette — new round every 40 seconds."
          balance={balance}
          username={username}
          avatar={avatar}
        />

        {/* PHASE BAR */}
        <div
          className="mb-6 rounded-2xl border p-5"
          style={{
            borderColor:
              state?.phase === "betting"
                ? "rgba(34,197,94,0.35)"
                : state?.phase === "spinning"
                  ? "rgba(234,179,8,0.35)"
                  : "rgba(139,92,246,0.35)",
            background:
              state?.phase === "betting"
                ? "linear-gradient(135deg, rgba(34,197,94,0.06), transparent)"
                : state?.phase === "spinning"
                  ? "linear-gradient(135deg, rgba(234,179,8,0.06), transparent)"
                  : "linear-gradient(135deg, rgba(139,92,246,0.06), transparent)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-[1.6px] text-[#737887]">
                Round #{state?.roundId ?? "—"}
              </div>
              <div
                className="mt-1 text-[20px] font-bold"
                style={{
                  color:
                    state?.phase === "betting"
                      ? "#4ade80"
                      : state?.phase === "spinning"
                        ? "#eab308"
                        : "#a78bfa",
                }}
              >
                {phaseLabel}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-extrabold uppercase tracking-[1.6px] text-[#737887]">
                {state?.phase === "betting" ? "Closes in" : "Next phase"}
              </div>
              <div
                className="mt-1 text-[32px] font-bold tabular-nums"
                style={{
                  color:
                    countdown <= 5
                      ? "#eb4b4b"
                      : countdown <= 10
                        ? "#eab308"
                        : "#ffffff",
                  transition: "color 300ms ease",
                }}
              >
                {countdown}s
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT */}
          <div className="min-w-0 space-y-6">
            {/* WHEEL */}
            <div className="relative rounded-2xl border border-[#1b1f2b] bg-gradient-to-b from-[#0b0d13] to-[#080a10] p-6">
              <div className="flex flex-col items-center">
                <Wheel
                  rotation={wheelRotation}
                  spinning={wheelSpinning}
                  durationMs={SPINNING_MS}
                />

                {/* RESULT OVERLAY */}
                <div className="mt-6 h-[80px] w-full">
                  {showWinning ? (
                    <div className="flex h-full flex-col items-center justify-center">
                      <div className="text-[10px] font-extrabold uppercase tracking-[2px] text-[#737887]">
                        Winning number
                      </div>
                      <div
                        className="mt-2 grid h-[70px] w-[70px] place-items-center rounded-full text-[36px] font-bold text-white"
                        style={{
                          background: numColor(winning),
                          boxShadow: `0 0 40px ${numColor(winning)}88`,
                        }}
                      >
                        {winning}
                      </div>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-[#737887]">
                      {state?.phase === "betting" && null}
                      {state?.phase === "spinning" && (
                        <span className="animate-pulse text-[#eab308]">
                          Spinning...
                        </span>
                      )}
                      {state?.phase === "result" && !showNumber && (
                        <span className="animate-pulse text-[#a78bfa]">
                          Revealing...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BOARD */}
            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
              <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                Board
              </div>

              <div className="flex gap-1">
                {/* ZERO COLUMN */}
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={state?.phase !== "betting"}
                    onClick={() => placeBet("number", 0)}
                    className="h-full min-h-[186px] w-[52px] rounded-md border border-[#22c55e]/40 bg-[#22c55e]/[0.08] text-[20px] font-bold text-[#4ade80] transition hover:bg-[#22c55e]/[0.2] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    0
                  </button>
                </div>

                {/* 36 NUMBERS — 12 rows × 3 columns */}
                <div className="grid flex-1 grid-cols-3 gap-1">
                  {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
                    const isRed = RED.has(n);
                    const row = Math.ceil(n / 3);
                    const col = ((n - 1) % 3) + 1;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={state?.phase !== "betting"}
                        onClick={() => placeBet("number", n)}
                        className="h-[44px] rounded-md border text-[14px] font-bold transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          gridRow: row,
                          gridColumn: col,
                          background: isRed
                            ? "rgba(235,75,75,0.15)"
                            : "rgba(26,30,41,0.6)",
                          borderColor: isRed
                            ? "rgba(235,75,75,0.4)"
                            : "rgba(26,30,41,0.9)",
                          color: isRed ? "#ff9b9b" : "#e5e7eb",
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DOZENS */}
              <div className="mt-2 grid grid-cols-3 gap-1">
                <OutsideBtn
                  label="1st 12"
                  disabled={state?.phase !== "betting"}
                  onClick={() => placeBet("dozen1")}
                />
                <OutsideBtn
                  label="2nd 12"
                  disabled={state?.phase !== "betting"}
                  onClick={() => placeBet("dozen2")}
                />
                <OutsideBtn
                  label="3rd 12"
                  disabled={state?.phase !== "betting"}
                  onClick={() => placeBet("dozen3")}
                />
              </div>

              {/* OUTSIDE */}
              <div className="mt-1 grid grid-cols-6 gap-1">
                <OutsideBtn
                  label="1–18"
                  disabled={state?.phase !== "betting"}
                  onClick={() => placeBet("low")}
                />
                <OutsideBtn
                  label="Even"
                  disabled={state?.phase !== "betting"}
                  onClick={() => placeBet("even")}
                />
                <OutsideBtn
                  label="Red"
                  color="#eb4b4b"
                  disabled={state?.phase !== "betting"}
                  onClick={() => placeBet("red")}
                />
                <OutsideBtn
                  label="Black"
                  color="#6b7280"
                  disabled={state?.phase !== "betting"}
                  onClick={() => placeBet("black")}
                />
                <OutsideBtn
                  label="Odd"
                  disabled={state?.phase !== "betting"}
                  onClick={() => placeBet("odd")}
                />
                <OutsideBtn
                  label="19–36"
                  disabled={state?.phase !== "betting"}
                  onClick={() => placeBet("high")}
                />
              </div>

              {flash && (
                <div className="mt-3 rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-3 py-2 text-center text-[11px] text-[#eb4b4b]">
                  {flash}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
              <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                Bet amount
              </div>
              <input
                type="number"
                min="1"
                value={betAmount}
                onChange={(e) =>
                  setBetAmount(
                    Math.max(1, Math.min(balance, Number(e.target.value) || 1))
                  )
                }
                disabled={state?.phase !== "betting"}
                className="h-[42px] w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[13px] font-bold text-white outline-none focus:border-[#8b5cf6] disabled:opacity-40"
              />
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {[1, 5, 10, 25].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBetAmount(n)}
                    disabled={state?.phase !== "betting"}
                    className="rounded-lg border border-[#1b1f2b] bg-[#0e1017] py-1.5 text-[10px] font-bold text-[#737887] transition hover:text-white disabled:opacity-40"
                  >
                    ${n}
                  </button>
                ))}
              </div>
              {placedOn && (
                <div className="mt-3 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/[0.08] px-3 py-2 text-center text-[10px] font-bold text-[#4ade80]">
                  Bet ${betAmount} on {placedOn}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                  Bets this round
                </div>
                <div className="text-[9px] text-[#4f5563]">
                  ${totalBets.toFixed(2)}
                </div>
              </div>
              <div className="max-h-[400px] space-y-1.5 overflow-y-auto pr-1">
                {!state || state.bets.length === 0 ? (
                  <div className="text-center text-[10px] text-[#4f5563]">
                    No bets yet
                  </div>
                ) : (
                  state.bets.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-2.5 py-1.5"
                    >
                      <div className="truncate text-[10px] font-semibold text-[#a78bfa]">
                        {b.username}
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-2">
                        <span className="text-[9px] text-[#737887]">
                          {b.number != null ? `#${b.number}` : b.type}
                        </span>
                        <span className="text-[10px] font-bold text-[#4ade80]">
                          ${b.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function OutsideBtn({
  label,
  color,
  disabled,
  onClick,
}: {
  label: string;
  color?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-[40px] rounded-md border text-[11px] font-bold uppercase tracking-[0.6px] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: color ? `${color}22` : "#0e1017",
        borderColor: color ? `${color}55` : "#1b1f2b",
        color: color ?? "#a78bfa",
      }}
    >
      {label}
    </button>
  );
}