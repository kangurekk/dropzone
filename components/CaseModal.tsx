"use client";

import { useEffect, useRef, useState } from "react";
import type { CaseData, CaseReward } from "@/lib/cases";
import { getItemById } from "@/lib/items";
import type { Item } from "@/lib/types";
import type { NewInventoryItem } from "@/lib/inventory";

type CaseModalProps = {
  caseData: CaseData | null;
  open: boolean;
  onClose: () => void;
  onReveal: (item: NewInventoryItem) => void;
};

const REEL_LENGTH = 40;
const TARGET_INDEX = 30;
const ANIMATION_MS = 4400;
const GAP = 12;

function pickWeightedReward(rewards: CaseReward[]): CaseReward | null {
  const total = rewards.reduce((sum, r) => sum + r.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const r of rewards) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return rewards[rewards.length - 1] ?? null;
}

function makeReel(items: Item[], winner?: Item): Item[] {
  if (items.length === 0) return [];
  const seq: Item[] = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    if (i === TARGET_INDEX && winner) {
      seq.push(winner);
    } else {
      seq.push(items[Math.floor(Math.random() * items.length)]!);
    }
  }
  return seq;
}

export default function CaseModal({
  caseData,
  open,
  onClose,
  onReveal,
}: CaseModalProps) {
  const [revealing, setRevealing] = useState(false);
  const [revealedItemId, setRevealedItemId] = useState<string | null>(null);
  const [revealedPrice, setRevealedPrice] = useState<number | null>(null);
  const [reelOffset, setReelOffset] = useState(0);
  const [reelItems, setReelItems] = useState<Item[]>([]);
  const [spinKey, setSpinKey] = useState(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setRevealing(false);
      setRevealedItemId(null);
      setRevealedPrice(null);
      setReelOffset(0);
      setReelItems([]);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !revealing) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, revealing, onClose]);

  const validRewards: { reward: CaseReward; item: Item }[] =
    open && caseData
      ? caseData.rewards
          .map((reward) => {
            const item = getItemById(reward.itemId);
            return item ? { reward, item } : null;
          })
          .filter((x): x is { reward: CaseReward; item: Item } => x !== null)
      : [];

  const items = validRewards.map((x) => x.item);

  useEffect(() => {
    if (!open || !caseData) return;
    if (items.length === 0) return;
    setReelItems(makeReel(items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, caseData?.id]);

  if (!open || !caseData) return null;

  if (validRewards.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
        <div className="relative z-10 w-full max-w-[500px] rounded-2xl border border-[#252a38] bg-[#0d1017] p-6 text-center shadow-[0_35px_100px_rgba(0,0,0,0.7)]">
          <div className="text-[10px] font-extrabold uppercase tracking-[1.5px] text-[#a78bfa]">
            ERROR
          </div>
          <h2 className="mt-2 text-[18px] font-bold">No items available</h2>
          <p className="mt-2 text-[10px] text-[#666d7c]">
            This case currently has no valid items.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 h-10 rounded-lg bg-[#181c26] px-5 text-[10px] font-bold text-white transition hover:bg-[#222733]"
          >
            CLOSE
          </button>
        </div>
      </div>
    );
  }

  const revealedItem = revealedItemId ? getItemById(revealedItemId) : null;

  function reveal() {
    if (revealing || validRewards.length === 0) return;

    // 1. Weighted pick of the winner
    const winnerReward = pickWeightedReward(validRewards.map((x) => x.reward));
    if (!winnerReward) return;
    const winner = getItemById(winnerReward.itemId);
    if (!winner) return;

    // 2. Reset reel to start position and regenerate with winner at TARGET_INDEX.
    //    spinKey forces a remount so the browser starts from offset 0 with no
    //    transition before we animate to the target offset.
    setRevealing(true);
    setRevealedItemId(null);
    setRevealedPrice(null);
    setReelOffset(0);
    setReelItems(makeReel(items, winner));
    setSpinKey((k) => k + 1);

    // 3. Two RAFs so the new reel paints at offset 0 before we set target offset.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const wrapper = wrapperRef.current;
        const winningItem = itemRef.current;
        if (!wrapper || !winningItem) {
          setRevealing(false);
          return;
        }

        const wrapperWidth = wrapper.getBoundingClientRect().width;
        const itemWidth = winningItem.getBoundingClientRect().width;

        // Winner's left edge distance from the track's start (left: 0)
        const winnerX = TARGET_INDEX * (itemWidth + GAP) + itemWidth / 2;

        // Shift the track so the winner sits at the wrapper's center
        const targetOffset = wrapperWidth / 2 - winnerX;

        setReelOffset(targetOffset);
      });
    });

    // 4. When the animation ends, reveal and hand off to inventory
    timeoutRef.current = window.setTimeout(() => {
      setRevealedItemId(winner.id);
      setRevealedPrice(winnerReward.price ?? 0);
      setRevealing(false);
      onReveal({
        id: winner.id,
        name: winner.name,
        image: winner.image,
        color: winner.color,
        rarity: winner.rarity,
        price: winnerReward.price ?? 0,
      });
      timeoutRef.current = null;
    }, ANIMATION_MS);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !revealing) onClose();
      }}
    >
      {/* BACKDROP */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* MODAL */}
      <div className="relative z-10 w-full max-w-[760px] overflow-hidden rounded-2xl border border-[#252a38] bg-gradient-to-br from-[#11141d] via-[#0d1017] to-[#090b10] p-6 shadow-[0_35px_100px_rgba(0,0,0,0.7)]">
        {/* TOP GLOW */}
        <div
          className="pointer-events-none absolute left-1/2 top-[-100px] h-[240px] w-[240px] -translate-x-1/2 rounded-full blur-[80px]"
          style={{ background: caseData.glow, opacity: 0.18 }}
        />

        {/* CLOSE */}
        <button
          type="button"
          onClick={onClose}
          disabled={revealing}
          aria-label="Close"
          className="absolute right-4 top-4 z-30 grid h-8 w-8 place-items-center rounded-lg border border-[#252a38] bg-[#11141b] text-xl leading-none text-[#747987] transition hover:bg-[#181b25] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          ×
        </button>

        {/* HEADER */}
        <div className="relative text-center">
          <span className="text-[8px] font-extrabold uppercase tracking-[1.8px] text-[#a78bfa]">
            ITEM REVEAL
          </span>
          <h2 className="mt-2 text-[21px] font-bold tracking-[-0.4px] text-white">
            {caseData.name}
          </h2>
          <p className="mt-1 text-[10px] text-[#666d7c]">
            Reveal an item from this case.
          </p>
        </div>

        {/* REEL */}
        <div
          ref={wrapperRef}
          className="relative mt-7 h-[190px] overflow-hidden rounded-xl border border-[#1d222d] bg-[#080a10]"
        >
          {/* FADES */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-28 bg-gradient-to-r from-[#080a10] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-28 bg-gradient-to-l from-[#080a10] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-[#080a10] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-gradient-to-t from-[#080a10] to-transparent" />

          {/* CENTER MARKER */}
          <div
            className={`pointer-events-none absolute bottom-0 left-1/2 top-0 z-30 w-[2px] -translate-x-1/2 ${
                revealing ? "animate-pulse" : ""
            }`}
            style={{
              background: `linear-gradient(to bottom, transparent, ${caseData.glow}, transparent)`,
              boxShadow: `0 0 24px ${caseData.glow}`,
            }}
          />

          {/* TRACK */}
          <div
            key={spinKey}
            className="absolute flex items-center gap-3 will-change-transform"
            style={{
              top: "50%",
              left: 0,
              transform: `translate(${reelOffset}px, -50%)`,
              transition: revealing
                ? `transform ${ANIMATION_MS}ms cubic-bezier(.08,.72,.12,1)`
                : "none",
            }}
          >
                        {reelItems.map((item, index) => {
                            const isTarget = index === TARGET_INDEX;
                            const rewardForItem = validRewards.find(
                                (vr) => vr.item.id === item.id
                            );
                            const displayPrice =
                                rewardForItem?.reward.price ?? item.price ?? 0;
                            const color = item.color ?? "#8b5cf6";

                            return (
                                <div
                                key={`${item.id}-${index}`}
                                ref={isTarget ? itemRef : undefined}
                                className="relative flex h-[145px] w-[145px] shrink-0 flex-col items-center justify-end overflow-hidden rounded-xl border bg-gradient-to-b from-[#11141c] to-[#0b0d13]"
                                style={{
                                    borderColor: `${color}40`,
                                    boxShadow: `inset 0 -40px 60px -20px ${color}33`,
                                }}
                                >
                                {/* rarity glow at top */}
                                <div
                                    className="pointer-events-none absolute inset-x-0 top-0 h-16"
                                    style={{
                                    background: `radial-gradient(ellipse at top, ${color}33, transparent 70%)`,
                                    }}
                                />

                                {/* IMAGE */}
                                <div className="flex flex-1 items-center justify-center px-2">
                                    {item.image ? (
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="max-h-[80px] max-w-full object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.55)]"
                                        draggable={false}
                                    />
                                    ) : (
                                    <div
                                        className="grid h-16 w-16 place-items-center rounded-xl text-3xl"
                                        style={{ color }}
                                    >
                                        ◆
                                    </div>
                                    )}
                                </div>

                                {/* BOTTOM BAR */}
                                <div
                                    className="relative w-full px-2 pb-2 pt-1.5 text-center"
                                    style={{
                                    background: `linear-gradient(to top, ${color}22, transparent)`,
                                    }}
                                >
                                    <div className="truncate text-[8px] font-bold" style={{ color }}>
                                    {item.name}
                                    </div>
                                    <div className="mt-0.5 text-[7px] text-[#737887]">
                                    ${displayPrice.toFixed(2)}
                                    </div>
                                </div>
                                </div>
                            );
                            })}
          </div>
        </div>

          {/* RESULT */}
        <div className="mt-4 min-h-[100px]">
          {revealedItem ? (
            <div
              className="relative flex items-center justify-center gap-5 overflow-hidden rounded-xl border p-5"
              style={{
                borderColor: `${revealedItem.color ?? "#8b5cf6"}40`,
                background: `radial-gradient(circle at center, ${revealedItem.color ?? "#8b5cf6"}15, transparent 70%), #0b0d13`,
                boxShadow: `0 0 40px ${revealedItem.color ?? "#8b5cf6"}22`,
              }}
            >
              <div
                className="grid h-20 w-20 shrink-0 place-items-center rounded-xl"
                style={{
                  background: `radial-gradient(circle, ${revealedItem.color ?? "#8b5cf6"}22, transparent 70%)`,
                  boxShadow: `0 0 50px ${revealedItem.color ?? "#8b5cf6"}44`,
                }}
              >
                {revealedItem.image ? (
                  <img
                    src={revealedItem.image}
                    alt={revealedItem.name}
                    className="max-h-full max-w-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                  />
                ) : (
                  <div
                    className="text-4xl"
                    style={{ color: revealedItem.color ?? "#a78bfa" }}
                  >
                    ◆
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-[7px] font-extrabold uppercase tracking-[1.4px] text-[#666d7c]">
                  YOU UNBOXED
                </div>

                <div
                  className="mt-1.5 truncate text-[16px] font-bold"
                  style={{ color: revealedItem.color ?? "#ffffff" }}
                >
                  {revealedItem.name}
                </div>

                <div className="mt-1 flex items-center gap-2">
                  {revealedItem.rarity && (
                    <span
                      className="rounded px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.6px]"
                      style={{
                        color: revealedItem.color ?? "#a78bfa",
                        background: `${revealedItem.color ?? "#8b5cf6"}22`,
                      }}
                    >
                      {revealedItem.rarity}
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-[#a78bfa]">
                    ${(revealedPrice ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[100px] items-center justify-center text-[10px] text-[#4f5563]">
              {revealing ? "Rolling..." : "Ready to reveal"}
            </div>
          )}
        </div>

        {/* ACTION */}
        <button
          type="button"
          onClick={reveal}
          disabled={revealing}
          className="relative mt-3 h-[46px] w-full rounded-xl border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] text-[10px] font-extrabold tracking-[0.5px] text-white shadow-[0_10px_30px_rgba(109,63,224,0.22)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-110 hover:shadow-[0_12px_35px_rgba(109,63,224,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {revealing
            ? "REVEALING..."
            : revealedItem
              ? "REVEAL AGAIN"
              : "REVEAL ITEM"}
        </button>
      </div>
    </div>
  );
}