"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MULTIPLIERS, type Risk, type Rows } from "@/lib/plinko";

type PlinkoProps = {
  balance: number;
  onDrop: (bet: number) => void;
  onFinish: (payout: number) => void;
};

type Ball = {
  id: string;
  waypoints: { x: number; y: number }[];
  startTime: number;
  totalMs: number;
  bet: number;
  multiplier: number;
  payout: number;
  finalPos: number;
};

type HistoryEntry = {
  id: string;
  multiplier: number;
  payout: number;
  bet: number;
};

const ROW_HEIGHT = 40;
const PEG_GAP = 46;
const SLOT_HEIGHT = 44;
const TOP_PADDING = 60;
const SEGMENT_MS = 130;

const QUICK_BETS = [1, 5, 10, 25, 100];
const HISTORY_LIMIT = 20;

function multiplierColor(m: number): string {
  if (m >= 100) return "#eb4b4b";
  if (m >= 10) return "#ffd700";
  if (m >= 3) return "#d32ce6";
  if (m >= 1.5) return "#8847ff";
  if (m >= 1) return "#4ade80";
  if (m >= 0.5) return "#4b69ff";
  return "#2a3a5c";
}

export default function Plinko({ balance, onDrop, onFinish }: PlinkoProps) {
  const [bet, setBet] = useState(1);
  const [risk, setRisk] = useState<Risk>("low");
  const [rows, setRows] = useState<Rows>(12);
  const [result, setResult] = useState<HistoryEntry | null>(null);
  const [sessionProfit, setSessionProfit] = useState(0);
  const sessionProfitRef = useRef(0);
  const sessionDropsRef = useRef(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ballIds, setBallIds] = useState<string[]>([]);

  const ballsRef = useRef<Ball[]>([]);
  const ballRefs = useRef<Map<string, SVGCircleElement>>(new Map());
  const animRef = useRef<number | null>(null);

  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const slotMultipliers = MULTIPLIERS[risk][rows];
  const maxMultiplier = Math.max(...slotMultipliers);

  const boardWidth = (rows + 2) * PEG_GAP;
  const boardHeight = TOP_PADDING + rows * ROW_HEIGHT + SLOT_HEIGHT + 60;
  const centerX = boardWidth / 2;
  const topY = TOP_PADDING;

  const pegs = useMemo(() => {
    const list: { x: number; y: number }[] = [];
    for (let i = 0; i <= rows; i++) {
      for (let k = 0; k <= i; k++) {
        list.push({
          x: centerX + (k - i / 2) * PEG_GAP,
          y: topY + i * ROW_HEIGHT,
        });
      }
    }
    return list;
  }, [rows, centerX, topY]);

  const slotCenters = useMemo(() => {
    const list: number[] = [];
    for (let k = 0; k <= rows; k++) {
      list.push(centerX + (k - rows / 2) * PEG_GAP);
    }
    return list;
  }, [rows, centerX]);

  const interpolate = useCallback((ball: Ball, elapsed: number) => {
    const totalSegments = ball.waypoints.length - 1;
    if (totalSegments < 1) return ball.waypoints[0] ?? { x: 0, y: 0 };

    const segmentMs = ball.totalMs / totalSegments;
    const rawIndex = Math.floor(elapsed / segmentMs);
    const segIndex = Math.max(0, Math.min(rawIndex, totalSegments - 1));

    const segElapsed = Math.max(0, elapsed - segIndex * segmentMs);
    const t = segElapsed / segmentMs;

    const p0 = ball.waypoints[segIndex];
    const p1 = ball.waypoints[segIndex + 1];
    if (!p0 || !p1) return ball.waypoints[0] ?? { x: 0, y: 0 };

    const yEase = t * t;
    return {
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * yEase,
    };
  }, []);

  const loopRef = useRef<(now: number) => void>(() => {});

  loopRef.current = (now: number) => {
    const balls = ballsRef.current;

    if (balls.length === 0) {
      animRef.current = null;
      return;
    }

    const finished: Ball[] = [];

    for (const ball of balls) {
      const elapsed = Math.max(0, now - ball.startTime);

      if (elapsed >= ball.totalMs) {
        finished.push(ball);
        continue;
      }

      const el = ballRefs.current.get(ball.id);
      if (el) {
        const { x, y } = interpolate(ball, elapsed);
        el.setAttribute("cx", String(x));
        el.setAttribute("cy", String(y));
      }
    }

    if (finished.length > 0) {
      const finishedIds = new Set(finished.map((b) => b.id));
      ballsRef.current = balls.filter((b) => !finishedIds.has(b.id));
      setBallIds((ids) => ids.filter((id) => !finishedIds.has(id)));

      for (const ball of finished) {
        ballRefs.current.delete(ball.id);
        onFinishRef.current(ball.payout);

        const entry: HistoryEntry = {
          id: ball.id,
          multiplier: ball.multiplier,
          payout: ball.payout,
          bet: ball.bet,
        };

        setResult(entry);
        setHistory((h) => [entry, ...h].slice(0, HISTORY_LIMIT));
      }
    }

    animRef.current = requestAnimationFrame((t) => loopRef.current(t));
  };

  useEffect(() => {
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Send session summary when leaving the Plinko tab
  useEffect(() => {
    return () => {
      const profit = sessionProfitRef.current;
      const drops = sessionDropsRef.current;
      if (Math.abs(profit) >= 0.01 && drops > 0) {
        fetch("/api/plinko/session-end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profit, drops }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  async function drop() {
    if (bet <= 0 || bet > balance) return;

    // Ask server for outcome
    let serverResult: {
      slot: number;
      multiplier: number;
      payout: number;
      newBalance: number;
      bet: number;
    };

    try {
      const res = await fetch("/api/plinko/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, risk, rows }),
      });

      if (!res.ok) {
        const d = await res.json();
        console.error("[plinko] server error:", d.error);
        return;
      }

      serverResult = await res.json();
    } catch (err) {
      console.error("[plinko] network error:", err);
      return;
    }

    // Deduct on drop
    onDrop(bet);

    // Track session profit
    const dropDelta = serverResult.payout - serverResult.bet;
    setSessionProfit((p) => p + dropDelta);
    sessionProfitRef.current += dropDelta;
    sessionDropsRef.current += 1;

    const finalPos = serverResult.slot;
    const betPlaced = serverResult.bet;

    // Build a random-looking path that ends at finalPos
    const decisions: number[] = [];
    let remaining = finalPos;
    for (let i = 0; i < rows; i++) {
      const stepsLeft = rows - i;
      const mustRight = remaining === stepsLeft;
      const mustLeft = remaining === 0;
      let step: number;
      if (mustRight) step = 1;
      else if (mustLeft) step = 0;
      else step = Math.random() < 0.5 ? 1 : 0;
      decisions.push(step);
      remaining -= step;
    }

    const positions: number[] = [];
    let pos = 0;
    for (let i = 0; i < rows; i++) {
      pos += decisions[i];
      positions.push(pos);
    }

    const waypoints: { x: number; y: number }[] = [];
    waypoints.push({ x: centerX, y: topY - ROW_HEIGHT * 0.7 });
    waypoints.push({ x: centerX, y: topY });
    for (let i = 0; i < rows; i++) {
      const j = positions[i];
      waypoints.push({
        x: centerX + (j - (i + 1) / 2) * PEG_GAP,
        y: topY + (i + 1) * ROW_HEIGHT,
      });
    }
    waypoints.push({
      x: centerX + (finalPos - rows / 2) * PEG_GAP,
      y: topY + rows * ROW_HEIGHT + SLOT_HEIGHT * 0.7,
    });

    const totalMs = (waypoints.length - 1) * SEGMENT_MS;

    const ball: Ball = {
      id: `ball-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      waypoints,
      startTime: performance.now(),
      totalMs,
      bet: betPlaced,
      multiplier: serverResult.multiplier,
      payout: serverResult.payout,
      finalPos,
    };

    ballsRef.current.push(ball);
    setBallIds((ids) => [...ids, ball.id]);

    if (animRef.current === null) {
      animRef.current = requestAnimationFrame((t) => loopRef.current(t));
    }
  }

  function halfBet() {
    setBet((b) => Math.max(0.1, Math.round((b / 2) * 100) / 100));
  }

  function doubleBet() {
    setBet((b) => Math.min(balance, Math.round(b * 2 * 100) / 100));
  }

  const canDrop = bet > 0 && bet <= balance;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT: BOARD */}
        <div className="min-w-0 rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
          <svg
            viewBox={`0 0 ${boardWidth} ${boardHeight}`}
            className="mx-auto block h-auto w-full max-w-[640px]"
            style={{ overflow: "visible" }}
          >
            {slotCenters.map((cx, i) => {
              const slotWidth = PEG_GAP - 4;
              const slotX = cx - slotWidth / 2;
              const slotY = topY + rows * ROW_HEIGHT + 20;
              const m = slotMultipliers[i];
              const color = multiplierColor(m);

              return (
                <g key={i}>
                  <rect
                    x={slotX}
                    y={slotY}
                    width={slotWidth}
                    height={SLOT_HEIGHT}
                    rx={6}
                    fill={color}
                    opacity={0.18}
                    stroke={color}
                    strokeWidth={0.8}
                  />
                  <text
                    x={cx}
                    y={slotY + SLOT_HEIGHT / 2 + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill={color}
                  >
                    {m}x
                  </text>
                </g>
              );
            })}

            {pegs.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill="#a78bfa"
                opacity={0.7}
                style={{
                  filter: "drop-shadow(0 0 3px rgba(139,92,246,0.5))",
                }}
              />
            ))}

            {ballIds.map((id) => {
              const ball = ballsRef.current.find((b) => b.id === id);
              if (!ball) return null;
              const start = ball.waypoints[0];

              return (
                <circle
                  key={id}
                  ref={(el) => {
                    if (el) ballRefs.current.set(id, el);
                    else ballRefs.current.delete(id);
                  }}
                  cx={start.x}
                  cy={start.y}
                  r={7}
                  fill="#f4f5f7"
                  style={{
                    filter:
                      "drop-shadow(0 0 8px rgba(244,245,247,0.9)) drop-shadow(0 0 3px rgba(139,92,246,0.8))",
                  }}
                />
              );
            })}
          </svg>

          {/* RESULT */}
          <div className="mt-4 min-h-[90px]">
            {result ? (
              <div
                className={`flex items-center justify-center gap-5 rounded-xl border p-4 ${
                  result.payout > result.bet
                    ? "border-[#22c55e]/30 bg-[#22c55e]/[0.06]"
                    : "border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.06]"
                }`}
              >
                <div
                  className={`text-[32px] font-bold ${
                    result.payout > result.bet
                      ? "text-[#4ade80]"
                      : "text-[#eb4b4b]"
                  }`}
                >
                  {result.multiplier}x
                </div>
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#666d7c]">
                    {result.payout > result.bet ? "YOU WON" : "YOU LOST"}
                  </div>
                  <div
                    className={`mt-1 text-[16px] font-bold ${
                      result.payout > result.bet
                        ? "text-[#4ade80]"
                        : "text-[#eb4b4b]"
                    }`}
                  >
                    {result.payout > result.bet ? "+" : "-"}$
                    {Math.abs(result.payout - result.bet).toFixed(2)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#737887]">
                    Bet ${result.bet.toFixed(2)} → Payout $
                    {result.payout.toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[90px] items-center justify-center text-[10px] text-[#4f5563]">
                {balance <= 0
                  ? "No balance. Deposit to play."
                  : "Set your bet and drop"}
              </div>
            )}
          </div>

          {/* HISTORY */}
          <div className="mt-3 flex h-[30px] min-w-0 items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-[8px] font-extrabold uppercase tracking-[1px] text-[#4f5563]">
              Recent
            </span>
            {history.length === 0 ? (
              <span className="text-[9px] text-[#2e3440]">—</span>
            ) : (
              history.map((h) => {
                const color = multiplierColor(h.multiplier);
                return (
                  <span
                    key={h.id}
                    className="shrink-0 rounded-md px-2 py-1 text-[9px] font-bold"
                    style={{
                      color: h.payout > h.bet ? "#4ade80" : color,
                      backgroundColor:
                        h.payout > h.bet ? "#4ade8022" : `${color}22`,
                      border: `1px solid ${
                        h.payout > h.bet ? "#4ade8044" : `${color}44`
                      }`,
                    }}
                  >
                    {h.multiplier}x
                  </span>
                );
              })
            )}
          </div>

          {/* DROP */}
          <button
            type="button"
            onClick={drop}
            disabled={!canDrop}
            className="mx-auto mt-3 block h-[52px] w-full max-w-[340px] rounded-xl border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] text-[12px] font-extrabold tracking-[0.5px] text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {balance <= 0
              ? "NO BALANCE"
              : bet > balance
                ? "NOT ENOUGH"
                : `DROP FOR $${bet.toFixed(2)}`}
          </button>

          <div className="mt-1.5 text-center text-[9px] text-[#4f5563]">
            Tip: click multiple times to drop several balls at once
          </div>
        </div>

        {/* RIGHT: CONTROLS */}
        <div className="flex flex-col gap-4">
          {/* BET */}
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
              Bet amount
            </div>

            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#4f5563]">
                  $
                </span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={bet || ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setBet(isFinite(v) && v >= 0 ? v : 0);
                  }}
                  className="h-[46px] w-full rounded-xl border border-[#1b1f2b] bg-[#0e1017] pl-7 pr-3 text-[13px] font-bold text-white outline-none focus:border-[#8b5cf6]"
                />
              </div>
              <button
                type="button"
                onClick={halfBet}
                disabled={bet <= 0.1}
                className="w-[46px] rounded-xl border border-[#1b1f2b] bg-[#0e1017] text-[10px] font-extrabold text-[#737887] transition hover:text-white disabled:opacity-40"
              >
                ½
              </button>
              <button
                type="button"
                onClick={doubleBet}
                disabled={bet >= balance}
                className="w-[46px] rounded-xl border border-[#1b1f2b] bg-[#0e1017] text-[10px] font-extrabold text-[#737887] transition hover:text-white disabled:opacity-40"
              >
                2x
              </button>
            </div>

            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {QUICK_BETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setBet(Math.min(amount, balance))}
                  disabled={balance <= 0}
                  className="rounded-lg border border-[#1b1f2b] bg-[#0e1017] py-2 text-[10px] font-bold text-[#737887] transition hover:text-white disabled:opacity-40"
                >
                  ${amount}
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between text-[9px] text-[#4f5563]">
              <span>
                Balance:{" "}
                <span className="font-bold text-[#a78bfa]">
                  ${balance.toFixed(2)}
                </span>
              </span>
              {bet > balance && (
                <span className="font-bold text-[#eb4b4b]">
                  Not enough balance
                </span>
              )}
            </div>
          </div>

          {/* RISK */}
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
              Risk
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["low", "medium", "high"] as Risk[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRisk(r)}
                  className={`rounded-lg border py-2.5 text-[11px] font-bold uppercase transition ${
                    risk === r
                      ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/15 text-[#a78bfa]"
                      : "border-[#1b1f2b] bg-[#0e1017] text-[#737887] hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* ROWS */}
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
              Rows
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([8, 12, 16] as Rows[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRows(r)}
                  className={`rounded-lg border py-2.5 text-[11px] font-bold transition ${
                    rows === r
                      ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/15 text-[#a78bfa]"
                      : "border-[#1b1f2b] bg-[#0e1017] text-[#737887] hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* SUMMARY */}
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
              Summary
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#737887]">Bet</span>
                <span className="font-bold">${bet.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737887]">Max win</span>
                <span className="font-bold text-[#ffd700]">
                  ${(bet * maxMultiplier).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737887]">Top multiplier</span>
                <span className="font-bold text-[#a78bfa]">
                  {maxMultiplier}x
                </span>
              </div>

              {/* SESSION PROFIT */}
              <div className="mt-3 border-t border-[#1b1f2b] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
                    Session
                  </span>
                  <span
                    className="text-[14px] font-extrabold tabular-nums"
                    style={{
                      color:
                        sessionProfit > 0
                          ? "#4ade80"
                          : sessionProfit < 0
                            ? "#eb4b4b"
                            : "#737887",
                    }}
                  >
                    {sessionProfit >= 0 ? "+" : "-"}$
                    {Math.abs(sessionProfit).toFixed(2)}
                  </span>
                </div>
                {history.length > 0 && (
                  <div className="mt-1 text-[9px] text-[#4f5563]">
                    {history.length} drop
                    {history.length === 1 ? "" : "s"} this session
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}