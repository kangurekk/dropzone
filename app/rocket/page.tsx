"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { avatarGradient } from "@/lib/user-colors";

type Phase = "waiting" | "flying" | "crashed";

type Player = {
  userId: number;
  username: string;
  avatar: string;
  bannerColor: string;
  accentColor: string;
  bet: number;
  cashedAt: number | null;
  cashoutMultiplier: number | null;
  payout: number;
  isMe: boolean;
};

type HistoryEntry = { roundId: number; crashAt: number };

type State = {
  roundId: number;
  phase: Phase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  currentMultiplier: number;
  crashAt: number | null;
  players: Player[];
  history: HistoryEntry[];
};

function multiplierColor(m: number): string {
  if (m >= 10) return "#eb4b4b";
  if (m >= 5) return "#ffd700";
  if (m >= 3) return "#d32ce6";
  if (m >= 2) return "#8847ff";
  if (m >= 1.5) return "#4ade80";
  return "#4b69ff";
}

export default function RocketPage() {
  const [state, setState] = useState<State | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [myId, setMyId] = useState<number | null>(null);

  const [betAmount, setBetAmount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const [smoothMultiplier, setSmoothMultiplier] = useState(1);
  const rafRef = useRef<number | null>(null);

  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me");
      const d = await res.json();
      setUsername(d.user?.username ?? null);
      setAvatar(d.user?.avatar ?? null);
      setBalance(d.user?.balance ?? 0);
      setMyId(d.user?.id ?? null);
    } catch {}
  }

  useEffect(() => {
    loadMe();

    let es: EventSource | null = null;
    function connect() {
      es = new EventSource("/api/rocket/stream");
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "state") {
            setState(data.state);
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

  // Countdown for waiting phase
  useEffect(() => {
    if (!state || state.phase !== "waiting") return;
    const tick = () => {
      const secs = Math.max(
        0,
        Math.ceil((state.phaseEndsAt - Date.now()) / 1000)
      );
      setCountdown(secs);
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [state]);

  // Smooth multiplier animation between server ticks
  useEffect(() => {
    if (!state) return;
    if (state.phase === "flying") {
      const startMultiplier = smoothMultiplier;
      const serverMultiplier = state.currentMultiplier;
      const startTime = performance.now();
      const DURATION = 150;

      function tick(now: number) {
        const t = Math.min(1, (now - startTime) / DURATION);
        const value = startMultiplier + (serverMultiplier - startMultiplier) * t;
        setSmoothMultiplier(value);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    } else {
      setSmoothMultiplier(state.currentMultiplier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.currentMultiplier, state?.phase]);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  async function placeBet() {
    if (!state || state.phase !== "waiting") return;
    if (betAmount < 1 || betAmount > balance) {
      showFlash(betAmount > balance ? "Not enough balance" : "Min bet is $1");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/rocket/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: betAmount }),
      });
      const d = await res.json();
      if (!res.ok) {
        showFlash(d.error ?? "Failed");
      } else {
        setBalance(d.newBalance);
      }
    } finally {
      setBusy(false);
    }
  }

  async function cashout() {
    setBusy(true);
    try {
      const res = await fetch("/api/rocket/cashout", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        showFlash(d.error ?? "Failed");
      } else {
        setBalance(d.newBalance);
        showFlash(`Cashed out at ${d.multiplier}x for $${d.payout.toFixed(2)}!`);
      }
    } finally {
      setBusy(false);
    }
  }

  const me = state?.players.find((p) => p.isMe);
  const hasBetThisRound = !!me;
  const canBet = state?.phase === "waiting" && !hasBetThisRound && !busy;
  const canCashout = state?.phase === "flying" && me && me.cashedAt == null;

  const displayMultiplier =
    state?.phase === "crashed"
      ? state.crashAt ?? 1
      : state?.phase === "flying"
        ? smoothMultiplier
        : 1;

  const color = multiplierColor(displayMultiplier);

  // Rocket progress: how high up the screen, based on log multiplier
  const progress = Math.min(
    1,
    Math.log(Math.max(1, displayMultiplier)) / Math.log(20)
  );

  const phaseLabel =
    state?.phase === "waiting"
      ? `Starting in ${countdown}s`
      : state?.phase === "flying"
        ? "Flying"
        : `Crashed at ${state?.crashAt?.toFixed(2)}x`;

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="casino" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
        <Topbar
          title="Rocket Crash"
          description="Cash out before the rocket crashes. Global multiplayer."
          balance={balance}
          username={username}
          avatar={avatar}
        />

        {/* PHASE BAR */}
        <div
          className="mb-6 rounded-2xl border p-4"
          style={{
            borderColor:
              state?.phase === "waiting"
                ? "rgba(34,197,94,0.35)"
                : state?.phase === "flying"
                  ? "rgba(234,179,8,0.35)"
                  : "rgba(235,75,75,0.35)",
            background:
              state?.phase === "waiting"
                ? "linear-gradient(135deg, rgba(34,197,94,0.06), transparent)"
                : state?.phase === "flying"
                  ? "linear-gradient(135deg, rgba(234,179,8,0.06), transparent)"
                  : "linear-gradient(135deg, rgba(235,75,75,0.06), transparent)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-[1.6px] text-[#737887]">
                Round #{state?.roundId ?? "—"}
              </div>
              <div
                className="mt-1 text-[18px] font-bold"
                style={{
                  color:
                    state?.phase === "waiting"
                      ? "#4ade80"
                      : state?.phase === "flying"
                        ? "#eab308"
                        : "#eb4b4b",
                }}
              >
                {phaseLabel}
              </div>
            </div>
            <div className="text-right text-[11px] text-[#737887]">
              {state?.players.length ?? 0} player
              {(state?.players.length ?? 0) === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* LEFT */}
          <div className="min-w-0 space-y-6">
            {/* SKY */}
            <div
              className="relative h-[380px] overflow-hidden rounded-2xl border border-[#1b1f2b]"
              style={{
                background:
                  "linear-gradient(to top, #060810 0%, #0a0e18 50%, #12172a 100%)",
              }}
            >
              {/* GRID */}
              <div
                className="absolute inset-0 opacity-[0.15]"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
                  `,
                  backgroundSize: "40px 40px",
                }}
              />

              {/* STARS */}
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: 1 + Math.random() * 1.5,
                    height: 1 + Math.random() * 1.5,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    opacity: 0.15 + Math.random() * 0.4,
                  }}
                />
              ))}

              {/* TRAIL */}
              {state?.phase !== "waiting" && (
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 400 380"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="rocket-trail" x1="0" y1="1" x2="0" y2="0">
                      <stop
                        offset="0%"
                        stopColor={state?.phase === "crashed" ? "#eb4b4b" : color}
                        stopOpacity="0"
                      />
                      <stop
                        offset="100%"
                        stopColor={state?.phase === "crashed" ? "#eb4b4b" : color}
                        stopOpacity="0.8"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M 20 360 Q ${progress * 180} ${360 - progress * 180} ${20 + progress * 360} ${360 - progress * 330}`}
                    fill="none"
                    stroke="url(#rocket-trail)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}

              {/* ROCKET */}
              {state?.phase !== "waiting" && (
                <div
                  className="absolute text-[38px]"
                  style={{
                    left: `calc(${20 + progress * 320}px - 20px)`,
                    bottom: `calc(${progress * 300}px + 20px)`,
                    transform: `rotate(${-15 + progress * 40}deg)`,
                    filter:
                      state?.phase === "crashed"
                        ? "drop-shadow(0 0 12px #eb4b4b)"
                        : `drop-shadow(0 0 12px ${color})`,
                    opacity: state?.phase === "crashed" ? 0.3 : 1,
                    transition: "opacity 0.4s ease",
                  }}
                >
                  {state?.phase === "crashed" ? "💥" : "🚀"}
                </div>
              )}

              {/* CENTER MULTIPLIER */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className="text-[64px] font-bold tabular-nums leading-none"
                    style={{
                      color,
                      textShadow: `0 0 60px ${color}`,
                      transition: "color 300ms ease",
                    }}
                  >
                    {displayMultiplier.toFixed(2)}x
                  </div>
                  {state?.phase === "waiting" && (
                    <div className="mt-3 text-[11px] font-bold uppercase tracking-[2px] text-[#737887]">
                      Place your bets
                    </div>
                  )}
                  {state?.phase === "flying" && (
                    <div className="mt-3 animate-pulse text-[11px] font-bold uppercase tracking-[2px] text-[#eab308]">
                      Flying
                    </div>
                  )}
                  {state?.phase === "crashed" && (
                    <div className="mt-3 text-[14px] font-extrabold uppercase tracking-[2px] text-[#eb4b4b]">
                      Crashed
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* HISTORY */}
            <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-3">
              <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                Recent
              </span>
              {!state || state.history.length === 0 ? (
                <span className="text-[10px] text-[#2e3440]">—</span>
              ) : (
                state.history.slice(0, 20).map((h) => {
                  const c = multiplierColor(h.crashAt);
                  return (
                    <span
                      key={h.roundId}
                      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold tabular-nums"
                      style={{
                        color: c,
                        background: `${c}22`,
                        border: `1px solid ${c}44`,
                      }}
                    >
                      {h.crashAt.toFixed(2)}x
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-4">
            {/* CONTROLS */}
            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
              <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                {state?.phase === "waiting"
                  ? "Your bet"
                  : state?.phase === "flying"
                    ? "In-flight"
                    : "Round over"}
              </div>

              {state?.phase === "waiting" && !hasBetThisRound && (
                <>
                  <input
                    type="number"
                    min="1"
                    value={betAmount}
                    onChange={(e) =>
                      setBetAmount(
                        Math.max(1, Math.min(balance, Number(e.target.value) || 1))
                      )
                    }
                    className="h-[42px] w-full rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[13px] font-bold text-white outline-none focus:border-[#8b5cf6]"
                  />
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {[1, 5, 10, 25].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setBetAmount(n)}
                        className="rounded-lg border border-[#1b1f2b] bg-[#0e1017] py-1.5 text-[10px] font-bold text-[#737887] transition hover:text-white"
                      >
                        ${n}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={placeBet}
                    disabled={!canBet}
                    className="mt-3 h-[48px] w-full rounded-xl border border-[#22c55e]/30 bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-[12px] font-extrabold tracking-[0.5px] text-white shadow-[0_10px_30px_rgba(34,197,94,0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    BET ${betAmount}
                  </button>
                </>
              )}

              {state?.phase === "waiting" && hasBetThisRound && (
                <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/[0.08] p-3 text-center">
                  <div className="text-[11px] font-bold text-[#4ade80]">
                    Bet ${me?.bet.toFixed(2)} placed
                  </div>
                  <div className="mt-1 text-[9px] text-[#737887]">
                    Waiting for round to start...
                  </div>
                </div>
              )}

              {state?.phase === "flying" && me && me.cashedAt == null && (
                <button
                  type="button"
                  onClick={cashout}
                  disabled={busy}
                  className="h-[64px] w-full rounded-xl border border-[#22c55e]/40 bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-[16px] font-extrabold tracking-[0.5px] text-white shadow-[0_10px_30px_rgba(34,197,94,0.4)] transition hover:brightness-110 disabled:opacity-40"
                >
                  CASH OUT ${(me.bet * smoothMultiplier).toFixed(2)}
                </button>
              )}

              {state?.phase === "flying" && me && me.cashedAt != null && (
                <div className="rounded-lg border border-[#4ade80]/40 bg-[#4ade80]/[0.08] p-3 text-center">
                  <div className="text-[13px] font-extrabold text-[#4ade80]">
                    +${me.payout.toFixed(2)}
                  </div>
                  <div className="mt-1 text-[10px] text-[#737887]">
                    Cashed at {me.cashoutMultiplier?.toFixed(2)}x
                  </div>
                </div>
              )}

              {state?.phase === "flying" && !me && (
                <div className="rounded-lg border border-dashed border-[#1b1f2b] bg-[#0e1017] p-3 text-center text-[10px] text-[#4f5563]">
                  You didn't bet this round
                </div>
              )}

              {state?.phase === "crashed" && (
                <div className="rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.06] p-3 text-center">
                  <div className="text-[13px] font-extrabold text-[#eb4b4b]">
                    Crashed at {state.crashAt?.toFixed(2)}x
                  </div>
                  <div className="mt-1 text-[9px] text-[#737887]">
                    Next round in {Math.max(0, Math.ceil(((state.phaseEndsAt ?? 0) - Date.now()) / 1000))}s
                  </div>
                </div>
              )}
            </div>

            {/* PLAYERS */}
            <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                  Players
                </div>
                <div className="text-[9px] text-[#4f5563]">
                  {state?.players.length ?? 0}
                </div>
              </div>
              <div className="max-h-[400px] space-y-1.5 overflow-y-auto pr-1">
                {!state || state.players.length === 0 ? (
                  <div className="text-center text-[10px] text-[#4f5563]">
                    No bets yet
                  </div>
                ) : (
                  state.players.map((p) => {
                    const isUpload = p.avatar?.startsWith("/uploads/");
                    const initial = p.avatar && !isUpload
                      ? p.avatar
                      : p.username[0].toUpperCase();
                    return (
                      <div
                        key={p.userId}
                        className={`flex items-center gap-2 rounded-lg border p-2 ${
                          p.isMe
                            ? "border-[#8b5cf6]/40 bg-[#8b5cf6]/[0.06]"
                            : "border-[#1b1f2b] bg-[#0e1017]"
                        }`}
                      >
                        <div
                          className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md text-[11px] font-bold text-white"
                          style={{
                            background: isUpload
                              ? "#0e1017"
                              : avatarGradient(p.bannerColor, p.accentColor),
                          }}
                        >
                          {isUpload ? (
                            <img
                              src={p.avatar}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            initial
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-semibold">
                            {p.username}
                          </div>
                          <div className="text-[9px] text-[#737887]">
                            ${p.bet.toFixed(2)}
                          </div>
                        </div>
                        {p.cashedAt != null ? (
                          <div className="shrink-0 text-right">
                            <div className="text-[10px] font-bold text-[#4ade80]">
                              {p.cashoutMultiplier?.toFixed(2)}x
                            </div>
                            <div className="text-[9px] text-[#4ade80]">
                              +${p.payout.toFixed(2)}
                            </div>
                          </div>
                        ) : state.phase === "crashed" ? (
                          <div className="shrink-0 text-[10px] font-bold text-[#eb4b4b]">
                            -${p.bet.toFixed(2)}
                          </div>
                        ) : state.phase === "flying" ? (
                          <div className="shrink-0 text-[10px] text-[#eab308]">
                            ${(p.bet * smoothMultiplier).toFixed(2)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {flash && (
              <div className="rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-3 py-2 text-center text-[11px] text-[#c4b5fd]">
                {flash}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}