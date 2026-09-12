"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ITEMS } from "@/lib/items";
import type { InventoryItem } from "@/lib/inventory";
import csfloatPrices from "@/lib/csfloat-prices.json";
import { MULTIPLIERS, type Multiplier } from "@/lib/upgrader";

const CSFLOAT = csfloatPrices as Record<string, number>;

type PricedItem = {
  id: string;
  name: string;
  image?: string;
  color?: string;
  rarity?: string;
  price: number;
};

function baseNameOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\u2605/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CSFLOAT_BASE: Record<string, number> = (() => {
  const idx: Record<string, number> = {};
  for (const [name, price] of Object.entries(CSFLOAT)) {
    if (typeof price !== "number" || price <= 0) continue;
    const base = baseNameOf(name);
    if (idx[base] == null || price < idx[base]) idx[base] = price;
  }
  return idx;
})();

const PRICED_CATALOG: PricedItem[] = (() => {
  const out: PricedItem[] = [];
  for (const item of ITEMS) {
    let price = CSFLOAT[item.name];
    if (typeof price !== "number" || price <= 0) {
      price = CSFLOAT_BASE[baseNameOf(item.name)];
    }
    if (typeof price !== "number" || price <= 0) continue;
    out.push({
      id: item.id,
      name: item.name,
      image: item.image,
      color: item.color,
      rarity: item.rarity,
      price,
    });
  }
  return out;
})();

const SORTED_CATALOG = [...PRICED_CATALOG].sort((a, b) => a.price - b.price);

console.log(`[Upgrader] ${PRICED_CATALOG.length} priced items available`);

type UpgraderProps = {
  inventory: InventoryItem[];
  onWin: (item: InventoryItem) => void;
  onLose: (uid: string) => void;
  onServerResult: (newBalance: number) => void;
};

const SPIN_DURATION = 3200;
const ARROW_START_ANGLE = 0;

function oddsToDegrees(odds: number): number {
  return (odds / 100) * 360;
}

export default function Upgrader({
  inventory,
  onWin,
  onLose,
  onServerResult,
}: UpgraderProps) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<Multiplier>(1.5);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [arrowAngle, setArrowAngle] = useState(ARROW_START_ANGLE);
  const [chosenTargetId, setChosenTargetId] = useState<string | null>(null);
  const [spinKey, setSpinKey] = useState(0);

  const timeoutRef = useRef<number | null>(null);

  const selectedItem = useMemo(
    () => inventory.find((i) => i.uid === selectedUid) ?? null,
    [inventory, selectedUid]
  );

  const currentMult = MULTIPLIERS.find((m) => m.value === multiplier)!;
  const odds = currentMult.odds;
  const greenDegrees = oddsToDegrees(odds);

  const targetValue = selectedItem?.price
    ? selectedItem.price * multiplier
    : 0;

  const eligibleItems: PricedItem[] = useMemo(() => {
    if (targetValue <= 0) return [];
    return SORTED_CATALOG.filter((x) => x.price >= targetValue);
  }, [targetValue]);

  const targetItem: InventoryItem | null = useMemo(() => {
    if (eligibleItems.length === 0) return null;

    let chosen: PricedItem | undefined;
    if (chosenTargetId) {
      chosen = eligibleItems.find((x) => x.id === chosenTargetId);
    }
    if (!chosen) chosen = eligibleItems[0];

    return {
      uid: `target-${chosen.id}`,
      id: chosen.id,
      name: chosen.name,
      image: chosen.image,
      color: chosen.color,
      rarity: chosen.rarity,
      price: chosen.price,
      droppedAt: Date.now(),
    };
  }, [eligibleItems, chosenTargetId]);

  useEffect(() => {
    if (!chosenTargetId) return;
    const stillEligible = eligibleItems.some((x) => x.id === chosenTargetId);
    if (!stillEligible) setChosenTargetId(null);
  }, [eligibleItems, chosenTargetId]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function spin() {
    if (spinning || !selectedItem || !targetItem) return;

    setSpinning(true);
    setResult(null);

    // Call API FIRST — we need to know win/lose for the animation
    let serverResult: {
      win: boolean;
      wonItem?: InventoryItem;
      stakedUid: string;
      newBalance?: number;
    };

    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryId: selectedItem.uid,
          targetItemId: targetItem.id,
          targetPrice: targetItem.price,
          multiplier,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        console.error("[upgrade] server error:", d.error);
        setSpinning(false);
        return;
      }

      serverResult = await res.json();
    } catch (err) {
      console.error("[upgrade] network error:", err);
      setSpinning(false);
      return;
    }

    const win = serverResult.win;

    // Animate arrow to green (win) or red (lose) zone
    let targetAngle: number;
    if (win) {
      const padding = Math.min(greenDegrees * 0.15, 10);
      const range = Math.max(greenDegrees - padding * 2, 1);
      targetAngle = ARROW_START_ANGLE + padding + Math.random() * range;
    } else {
      const redStart = ARROW_START_ANGLE + greenDegrees + 5;
      const redRange = Math.max(360 - greenDegrees - 10, 1);
      targetAngle = redStart + Math.random() * redRange;
    }

    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const finalAngle = targetAngle + fullSpins * 360;

    // Remount arrow at 0° (no transition), then animate to target
    setArrowAngle(0);
    setSpinKey((k) => k + 1);

    // Two RAFs so the browser paints 0° first
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setArrowAngle(finalAngle);
      });
    });

    timeoutRef.current = window.setTimeout(() => {
      setSpinning(false);
      setResult(win ? "win" : "lose");

      // Always remove the staked item from local state first
      onLose(serverResult.stakedUid);

      // If won, add the new item AND record drop after animation completes
      if (win && serverResult.wonItem) {
        onWin(serverResult.wonItem);

        // Record drop AFTER animation finishes
        fetch("/api/drops/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemName: serverResult.wonItem.name,
            itemImage: serverResult.wonItem.image,
            itemColor: serverResult.wonItem.color,
            itemRarity: serverResult.wonItem.rarity,
            itemPrice: serverResult.wonItem.price,
            caseName: `Upgrade ${multiplier}x`,
            caseId: null,
          }),
        }).catch(() => {});
      }

      // Reset selection so user must pick again
      setSelectedUid(null);
      setChosenTargetId(null);

      timeoutRef.current = null;
    }, SPIN_DURATION);
  }

  function reset() {
    setResult(null);
    setArrowAngle(ARROW_START_ANGLE);
    setSelectedUid(null);
    setChosenTargetId(null);
  }

  const R_RING = 82;
  const RING_WIDTH = 26;
  const R_OUTER = 100;

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* LEFT: WHEEL + RESULT */}
        <div className="flex min-w-0 flex-col rounded-2xl border border-[#1b1f2b] bg-gradient-to-b from-[#0b0d13] to-[#080a10] p-6">
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="relative h-[420px] w-[420px]">
              <div
                className="pointer-events-none absolute inset-0 rounded-full blur-[60px]"
                style={{
                  background:
                    result === "lose"
                      ? "radial-gradient(circle, rgba(235,75,75,0.35) 0%, transparent 65%)"
                      : result === "win"
                        ? "radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 65%)"
                        : spinning
                          ? "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 65%)"
                          : "radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 65%)",
                }}
              />

              <svg
                viewBox="0 0 240 240"
                className="absolute inset-0 h-full w-full"
                style={{ overflow: "visible" }}
              >
                <defs>
                  <linearGradient id="red-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a1a1a" />
                    <stop offset="50%" stopColor="#3a1515" />
                    <stop offset="100%" stopColor="#2a1010" />
                  </linearGradient>
                  <linearGradient id="green-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="50%" stopColor="#16a34a" />
                    <stop offset="100%" stopColor="#15803d" />
                  </linearGradient>
                  <filter
                    id="green-glow"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <radialGradient id="inner-shadow">
                    <stop offset="60%" stopColor="transparent" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
                  </radialGradient>
                </defs>

                <circle
                  cx="120"
                  cy="120"
                  r={R_RING}
                  fill="none"
                  stroke="#0d1017"
                  strokeWidth={RING_WIDTH + 4}
                />
                <circle
                  cx="120"
                  cy="120"
                  r={R_RING}
                  fill="none"
                  stroke="url(#red-grad)"
                  strokeWidth={RING_WIDTH}
                />
                <circle
                  cx="120"
                  cy="120"
                  r={R_RING}
                  fill="none"
                  stroke="url(#green-grad)"
                  strokeWidth={RING_WIDTH}
                  strokeDasharray={`${
                    (greenDegrees / 360) * (2 * Math.PI * R_RING)
                  } ${2 * Math.PI * R_RING}`}
                  transform="rotate(-90 120 120)"
                  style={{ filter: "url(#green-glow)" }}
                />
                <circle
                  cx="120"
                  cy="120"
                  r={R_OUTER}
                  fill="none"
                  stroke="#1b1f2b"
                  strokeWidth="1"
                />
                <circle
                  cx="120"
                  cy="120"
                  r={R_OUTER - 2}
                  fill="none"
                  stroke="rgba(139,92,246,0.15)"
                  strokeWidth="0.5"
                />
                <circle
                  cx="120"
                  cy="120"
                  r={R_RING - RING_WIDTH / 2 - 2}
                  fill="none"
                  stroke="#1b1f2b"
                  strokeWidth="0.8"
                />

                {Array.from({ length: 60 }).map((_, i) => {
                  const angle = (i / 60) * 360;
                  const rad = (angle - 90) * (Math.PI / 180);
                  const rInner = R_RING - RING_WIDTH / 2 + 2;
                  const rOuter = R_RING + RING_WIDTH / 2 - 2;
                  const x1 = 120 + Math.cos(rad) * rInner;
                  const y1 = 120 + Math.sin(rad) * rInner;
                  const x2 = 120 + Math.cos(rad) * rOuter;
                  const y2 = 120 + Math.sin(rad) * rOuter;
                  const inGreen = angle <= greenDegrees && angle >= 0;
                  const isMajor = i % 5 === 0;
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={
                        inGreen
                          ? "rgba(255,255,255,0.35)"
                          : "rgba(255,255,255,0.08)"
                      }
                      strokeWidth={isMajor ? "1" : "0.5"}
                    />
                  );
                })}

                <circle
                  cx="120"
                  cy="120"
                  r={R_RING - RING_WIDTH / 2 - 3}
                  fill="url(#inner-shadow)"
                />
              </svg>

              <div
                key={spinKey}
                className="pointer-events-none absolute inset-0"
                style={{
                  transform: `rotate(${arrowAngle}deg)`,
                  transition: spinning
                    ? `transform ${SPIN_DURATION}ms cubic-bezier(.15,.7,.15,1)`
                    : "none",
                }}
              >
                <div
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{
                    top: 18,
                    width: 0,
                    height: 0,
                    borderLeft: "10px solid transparent",
                    borderRight: "10px solid transparent",
                    borderTop: "22px solid #a78bfa",
                    filter:
                      "drop-shadow(0 0 6px rgba(139,92,246,1)) drop-shadow(0 0 12px rgba(139,92,246,0.6))",
                  }}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{
                    top: 20,
                    width: 0,
                    height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: "14px solid #c4b5fd",
                  }}
                />
              </div>

              <div className="absolute left-1/2 top-1/2 flex h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[#1b1f2b] bg-gradient-to-b from-[#0f1218] to-[#0a0c11] shadow-[inset_0_2px_12px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.15)]">
                <div
                  className="pointer-events-none absolute inset-2 rounded-full opacity-40"
                  style={{
                    background:
                      result === "lose"
                        ? "radial-gradient(circle, rgba(235,75,75,0.3) 0%, transparent 70%)"
                        : result === "win"
                          ? "radial-gradient(circle, rgba(34,197,94,0.3) 0%, transparent 70%)"
                          : "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)",
                  }}
                />

                <div className="relative text-[10px] font-extrabold uppercase tracking-[2px] text-[#4f5563]">
                  Chance
                </div>
                <div
                  className="relative mt-1 text-[44px] font-bold leading-none tabular-nums"
                  style={{
                    color:
                      result === "lose"
                        ? "#eb4b4b"
                        : result === "win"
                          ? "#4ade80"
                          : "#a78bfa",
                    textShadow:
                      result === "lose"
                        ? "0 0 24px rgba(235,75,75,0.6)"
                        : result === "win"
                          ? "0 0 24px rgba(34,197,94,0.6)"
                          : "0 0 24px rgba(139,92,246,0.5)",
                    transition: "color 0.3s ease, text-shadow 0.3s ease",
                  }}
                >
                  {odds}%
                </div>
                <div className="relative mt-1 text-[9px] font-bold uppercase tracking-[1.4px] text-[#4f5563]">
                  {currentMult.label} multiplier
                </div>
              </div>
            </div>

            <div className="mt-6 h-[74px] w-full max-w-[480px]">
              {result === "win" && targetItem ? (
                <div className="flex h-full items-center justify-center gap-4 rounded-xl border border-[#22c55e]/40 bg-gradient-to-br from-[#22c55e]/[0.08] to-transparent px-5">
                  {targetItem.image && (
                    <img
                      src={targetItem.image}
                      alt={targetItem.name}
                      className="skin-img h-12 w-16 object-contain"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4ade80]">
                      You won
                    </div>
                    <div className="truncate text-[13px] font-bold text-white">
                      {targetItem.name}
                    </div>
                    <div className="text-[11px] font-bold text-[#4ade80]">
                      ${targetItem.price.toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : result === "lose" ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-[#eb4b4b]/40 bg-gradient-to-br from-[#eb4b4b]/[0.08] to-transparent px-5 text-center">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#eb4b4b]">
                      Upgrade failed
                    </div>
                    <div className="mt-1 text-[11px] text-[#737887]">
                      Your item was consumed
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] text-[#4f5563]">
                  {spinning ? (
                    <span className="animate-pulse">Spinning...</span>
                  ) : (
                    "Pick an item and a multiplier"
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={result ? reset : spin}
            disabled={spinning || !selectedItem || !targetItem}
            className="mt-5 h-[56px] w-full rounded-xl border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] text-[13px] font-extrabold tracking-[0.5px] text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {spinning ? "SPINNING..." : result ? "UPGRADE AGAIN" : "UPGRADE"}
          </button>
        </div>

        {/* RIGHT: CONTROLS */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
              Multiplier
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MULTIPLIERS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setMultiplier(m.value);
                    setResult(null);
                    setChosenTargetId(null);
                  }}
                  disabled={spinning}
                  className={`rounded-lg border py-2.5 text-[11px] font-bold transition ${
                    multiplier === m.value
                      ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/15 text-[#a78bfa]"
                      : "border-[#1b1f2b] bg-[#0e1017] text-[#737887] hover:text-white"
                  } disabled:opacity-40`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
              Your item
            </div>

            {selectedItem ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.06] p-3">
                {selectedItem.image && (
                  <img
                    src={selectedItem.image}
                    alt={selectedItem.name}
                    className="skin-img h-10 w-14 object-contain"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-bold">
                    {selectedItem.name}
                  </div>
                  <div className="text-[10px] text-[#a78bfa]">
                    ${selectedItem.price.toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUid(null);
                    setChosenTargetId(null);
                  }}
                  disabled={spinning}
                  className="text-[#4f5563] hover:text-white disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#1b1f2b] bg-[#0e1017] p-3 text-center text-[10px] text-[#4f5563]">
                Select from inventory below
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
                You receive
              </div>
              {eligibleItems.length > 0 && (
                <div className="text-[9px] text-[#4f5563]">
                  {eligibleItems.length} options
                </div>
              )}
            </div>

            {!selectedItem || eligibleItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#1b1f2b] bg-[#0e1017] p-3 text-center text-[10px] text-[#4f5563]">
                {selectedItem ? "No items in this range" : "Pick an item first"}
              </div>
            ) : (
              <>
                <div className="mb-2 rounded-lg border border-[#8b5cf6]/20 bg-[#8b5cf6]/[0.04] px-2.5 py-1.5 text-[9px] text-[#a78bfa]">
                  Min:{" "}
                  <span className="font-bold">${targetValue.toFixed(2)}</span>
                </div>
                <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
                  {eligibleItems.slice(0, 100).map((item) => {
                    const isChosen = targetItem?.id === item.id;
                    const color = item.color ?? "#8b5cf6";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setChosenTargetId(item.id);
                          setResult(null);
                        }}
                        disabled={spinning}
                        className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left transition ${
                          isChosen
                            ? "border-[#22c55e]/50 bg-[#22c55e]/[0.08]"
                            : "border-[#1b1f2b] bg-[#0e1017] hover:border-[#8b5cf6]/40"
                        } disabled:opacity-40`}
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="skin-img h-8 w-11 shrink-0 object-contain"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            className="truncate text-[10px] font-semibold"
                            style={{ color: isChosen ? "#4ade80" : color }}
                          >
                            {item.name}
                          </div>
                          <div className="text-[9px] text-[#737887]">
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                        {isChosen && (
                          <div className="shrink-0 rounded-md bg-[#22c55e] px-1.5 py-0.5 text-[7px] font-extrabold uppercase text-[#0b0d13]">
                            Target
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
            <div className="mb-3 text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#4f5563]">
              Inventory ({inventory.length})
            </div>

            {inventory.length === 0 ? (
              <div className="text-center text-[10px] text-[#4f5563]">
                Inventory is empty.
              </div>
            ) : (
              <div className="max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
                {inventory.map((item) => (
                  <button
                    key={item.uid}
                    type="button"
                    onClick={() => {
                      setSelectedUid(item.uid);
                      setChosenTargetId(null);
                      setResult(null);
                    }}
                    disabled={spinning}
                    className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left transition ${
                      selectedUid === item.uid
                        ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/10"
                        : "border-[#1b1f2b] bg-[#0e1017] hover:bg-white/[0.02]"
                    } disabled:opacity-40`}
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="skin-img h-8 w-11 shrink-0 object-contain"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10px] font-semibold">
                        {item.name}
                      </div>
                      <div className="text-[9px] text-[#737887]">
                        ${item.price.toFixed(2)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}