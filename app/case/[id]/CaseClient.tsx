"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import DepositModal from "@/components/DepositModal";
import { CASES, RARITY_COLORS, type CaseReward } from "@/lib/cases";
import { getItemById } from "@/lib/items";
import type { Item } from "@/lib/types";
import type { InventoryItem } from "@/lib/inventory";

const REEL_LENGTH = 40;
const TARGET_INDEX = 30;
const ANIMATION_MS = 4400;
const GAP = 12;

function makeReel(items: Item[], winner?: Item): Item[] {
  if (items.length === 0) return [];
  const seq: Item[] = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    if (i === TARGET_INDEX && winner) seq.push(winner);
    else seq.push(items[Math.floor(Math.random() * items.length)]!);
  }
  return seq;
}

export default function CaseClient({ id }: { id: string }) {
  const caseData = CASES.find((c) => c.id === id) ?? null;

  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);

  const [revealing, setRevealing] = useState(false);
  const [revealedItemId, setRevealedItemId] = useState<string | null>(null);
  const [revealedPrice, setRevealedPrice] = useState<number | null>(null);
  const [reelOffset, setReelOffset] = useState(0);
  const [reelItems, setReelItems] = useState<Item[]>([]);
  const [spinKey, setSpinKey] = useState(0);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const itemRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUsername(d.user?.username ?? null);
        setAvatar(d.user?.avatar ?? null);
        setBalance(d.user?.balance ?? 0);
      })
      .catch(() => {});
  }, []);

  const validRewards: { reward: CaseReward; item: Item }[] = caseData
    ? caseData.rewards
        .map((reward) => {
          const item = getItemById(reward.itemId);
          return item ? { reward, item } : null;
        })
        .filter((x): x is { reward: CaseReward; item: Item } => x !== null)
    : [];

  const items = validRewards.map((x) => x.item);
  const totalWeight =
    validRewards.reduce((sum, vr) => sum + vr.reward.weight, 0) || 1;

  useEffect(() => {
    if (items.length === 0) return;
    setReelItems(makeReel(items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData?.id]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  async function handleDeposit(amount: number) {
    // Deposit endpoint already handles it server-side
    setBalance((b) => b + amount);
    showToast(`Added $${amount.toFixed(2)} to your balance`);
  }

  if (!caseData || validRewards.length === 0) {
    return (
      <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
        <Sidebar active="cases" />
        <main className="ml-[235px] min-h-screen px-[42px] pb-[110px]">
          <Topbar
            title="Case not found"
            description="This case doesn't exist or has no items."
            balance={balance}
            username={username}
            avatar={avatar}
          />
          <Link
            href="/"
            className="inline-flex h-[46px] items-center rounded-xl border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-6 text-[11px] font-extrabold text-white transition hover:brightness-110"
          >
            ← Back to cases
          </Link>
        </main>
      </div>
    );
  }

  const canAfford = balance >= caseData.price;
  const canReveal = !revealing && canAfford;

  async function reveal() {
    if (revealing || !caseData) return;
    if (balance < caseData.price) {
      showToast(`Not enough balance. Need $${caseData.price.toFixed(2)}.`);
      return;
    }

    setRevealing(true);
    setRevealedItemId(null);
    setRevealedPrice(null);

    // Server rolls + deducts + adds to inventory
    let result;
    try {
      const res = await fetch("/api/case/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: caseData.id }),
      });

      if (!res.ok) {
        const d = await res.json();
        showToast(d.error ?? "Failed to open case");
        setRevealing(false);
        return;
      }

      result = await res.json();
    } catch {
      showToast("Network error");
      setRevealing(false);
      return;
    }

    const winner = getItemById(result.winner.id);
    if (!winner) {
      showToast("Item not found");
      setRevealing(false);
      return;
    }

    // Animate
    setReelOffset(0);
    setReelItems(makeReel(items, winner));
    setSpinKey((k) => k + 1);

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
        const winnerX = TARGET_INDEX * (itemWidth + GAP) + itemWidth / 2;
        setReelOffset(wrapperWidth / 2 - winnerX);
      });
    });

    timeoutRef.current = window.setTimeout(() => {
      setRevealedItemId(result.winner.id);
      setRevealedPrice(result.winner.price);
      setRevealing(false);
      setBalance(result.newBalance);
      timeoutRef.current = null;
      setRevealedItemId(result.winner.id);
      setRevealedPrice(result.winner.price);
      setRevealing(false);
      setBalance(result.newBalance);

      // Record drop AFTER animation completes
      fetch("/api/drops/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: result.winner.name,
          itemImage: result.winner.image,
          itemColor: result.winner.color,
          itemRarity: result.winner.rarity,
          itemPrice: result.winner.price,
          caseName: caseData.name,
          caseId: caseData.id,
        }),
      }).catch(() => {});

      timeoutRef.current = null;
    }, ANIMATION_MS);
  }

  const revealedItem = revealedItemId ? getItemById(revealedItemId) : null;

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="cases" />
      <main className="ml-[235px] min-h-screen px-[42px] pb-[110px]">
        <Topbar
          title={caseData.name}
          description={caseData.description}
          balance={balance}
          username={username}
          avatar={avatar}
          onDeposit={() => setDepositOpen(true)}
        />

        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-[11px] font-bold text-[#737887] transition hover:text-white"
        >
          ← Back to cases
        </Link>

        {/* CASE HEADER */}
        <section className="mb-6 flex items-center gap-5 rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-5">
          <div
            className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-xl border border-white/[0.06] text-[42px]"
            style={{
              background: `radial-gradient(circle, ${caseData.glow}33 0%, transparent 70%), linear-gradient(145deg, #11141d, #090b11)`,
            }}
          >
            {caseData.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-bold tracking-[-0.4px]">
              {caseData.name}
            </h2>
            <p className="mt-1 text-[11px] text-[#737887]">
              {caseData.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-md border border-[#252a36] bg-[#0f1219] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.8px] text-[#737887]">
                {caseData.rewards.length} items inside
              </span>
              <span
                className="rounded-md border px-2 py-1 text-[10px] font-bold"
                style={{
                  borderColor: canAfford
                    ? "rgba(34,197,94,0.35)"
                    : "rgba(235,75,75,0.35)",
                  color: canAfford ? "#4ade80" : "#eb4b4b",
                  background: canAfford
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(235,75,75,0.08)",
                }}
              >
                {canAfford ? "You can afford" : "Not enough balance"} · $
                {caseData.price.toFixed(2)}
              </span>
            </div>
          </div>
        </section>

        {/* REEL */}
        <section className="rounded-2xl border border-[#1b1f2b] bg-gradient-to-br from-[#11141d] via-[#0d1017] to-[#090b10] p-6">
          <div
            ref={wrapperRef}
            className="relative h-[220px] overflow-hidden rounded-xl border border-[#1d222d] bg-[#080a10]"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-32 bg-gradient-to-r from-[#080a10] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-32 bg-gradient-to-l from-[#080a10] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-gradient-to-b from-[#080a10] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-[#080a10] to-transparent" />

            <div
              className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-30 w-[2px] -translate-x-1/2"
              style={{
                background: `linear-gradient(to bottom, transparent, ${caseData.glow}, transparent)`,
                boxShadow: `0 0 24px ${caseData.glow}`,
              }}
            />

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
                    className="relative flex h-[170px] w-[170px] shrink-0 flex-col items-center justify-end overflow-hidden rounded-xl border bg-gradient-to-b from-[#11141c] to-[#0b0d13]"
                    style={{
                      borderColor: `${color}40`,
                      boxShadow: `inset 0 -50px 60px -30px ${color}44`,
                    }}
                  >
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-20"
                      style={{
                        background: `radial-gradient(ellipse at top, ${color}33, transparent 70%)`,
                      }}
                    />
                    <div className="flex flex-1 items-center justify-center px-2">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="skin-img max-h-[95px] max-w-full object-contain"
                          draggable={false}
                        />
                      ) : (
                        <div className="text-3xl" style={{ color }}>
                          ◆
                        </div>
                      )}
                    </div>
                    <div
                      className="relative w-full px-2 pb-2 pt-1.5 text-center"
                      style={{
                        background: `linear-gradient(to top, ${color}22, transparent)`,
                      }}
                    >
                      <div
                        className="truncate text-[9px] font-bold"
                        style={{ color }}
                      >
                        {item.name}
                      </div>
                      <div className="mt-0.5 text-[8px] text-[#737887]">
                        ${displayPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RESULT */}
          <div className="mt-5 min-h-[110px]">
            {revealedItem ? (
              <div
                className="relative flex items-center justify-center gap-5 overflow-hidden rounded-xl border p-5"
                style={{
                  borderColor: `${revealedItem.color ?? "#8b5cf6"}40`,
                  background: `radial-gradient(circle at center, ${revealedItem.color ?? "#8b5cf6"}15, transparent 70%), #0b0d13`,
                }}
              >
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl">
                  {revealedItem.image ? (
                    <img
                      src={revealedItem.image}
                      alt={revealedItem.name}
                      className="skin-img max-h-full max-w-full object-contain"
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
                  <div className="text-[8px] font-extrabold uppercase tracking-[1.4px] text-[#666d7c]">
                    You unboxed
                  </div>
                  <div
                    className="mt-1.5 truncate text-[16px] font-bold"
                    style={{ color: revealedItem.color ?? "#ffffff" }}
                  >
                    {revealedItem.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[12px] font-bold text-[#a78bfa]">
                      ${(revealedPrice ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[110px] items-center justify-center text-[11px] text-[#4f5563]">
                {revealing
                  ? "Rolling..."
                  : canAfford
                    ? "Press reveal to open this case"
                    : "Deposit to open this case"}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={reveal}
            disabled={!canReveal}
            className="mt-4 h-[52px] w-full rounded-xl border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] text-[12px] font-extrabold tracking-[0.5px] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {revealing
              ? "REVEALING..."
              : !canAfford
                ? `NOT ENOUGH — NEED $${caseData.price.toFixed(2)}`
                : revealedItem
                  ? `REVEAL AGAIN — $${caseData.price.toFixed(2)}`
                  : `REVEAL — $${caseData.price.toFixed(2)}`}
          </button>
        </section>

        {/* ITEMS IN CASE */}
        <section className="mt-6 rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-6">
          <h3 className="mb-5 text-[16px] font-bold tracking-[-0.4px]">
            Items in this case
          </h3>
          {(
            [
              "exceedingly-rare",
              "covert",
              "classified",
              "restricted",
              "milspec",
            ] as const
          ).map((rarityKey) => {
            const itemsInTier = validRewards.filter(
              (vr) => vr.reward.rarity === rarityKey
            );
            if (itemsInTier.length === 0) return null;
            const tierColor =
              RARITY_COLORS[rarityKey as keyof typeof RARITY_COLORS] ??
              "#8b5cf6";
            const tierLabel = rarityKey.replace("-", " ");
            const tierWeight = itemsInTier.reduce(
              (s, vr) => s + vr.reward.weight,
              0
            );
            const tierChance = (tierWeight / totalWeight) * 100;

            return (
              <div key={rarityKey} className="mb-6 last:mb-0">
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="h-[3px] w-8 rounded-full"
                    style={{ background: tierColor }}
                  />
                  <span
                    className="text-[11px] font-extrabold uppercase tracking-[1.4px]"
                    style={{ color: tierColor }}
                  >
                    {tierLabel}
                  </span>
                  <span className="text-[10px] text-[#4f5563]">
                    {tierChance.toFixed(2)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {itemsInTier
                    .sort((a, b) => (b.reward.price ?? 0) - (a.reward.price ?? 0))
                    .map((vr) => {
                      const chance = (vr.reward.weight / totalWeight) * 100;
                      const color = vr.item.color ?? tierColor;
                      return (
                        <div
                          key={vr.item.id}
                          className="relative rounded-lg border bg-gradient-to-b from-[#11141c] to-[#0b0d13] p-2"
                          style={{ borderColor: `${color}30` }}
                        >
                          <div className="grid h-[58px] place-items-center">
                            {vr.item.image ? (
                              <img
                                src={vr.item.image}
                                alt={vr.item.name}
                                className="skin-img max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <div className="text-3xl" style={{ color }}>
                                ◆
                              </div>
                            )}
                          </div>
                          <div className="mt-2 truncate text-[9px] font-bold" style={{ color }}>
                            {vr.item.name}
                          </div>
                          <div className="mt-1 flex justify-between text-[8px]">
                            <span className="text-[#737887]">
                              ${(vr.reward.price ?? 0).toFixed(2)}
                            </span>
                            <span style={{ color }}>
                              {chance < 0.01 ? chance.toFixed(3) : chance.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </section>

        <DepositModal
          open={depositOpen}
          onClose={() => setDepositOpen(false)}
          onDeposit={handleDeposit}
        />

        {toast && (
          <div className="pointer-events-none fixed bottom-24 right-6 z-[200] rounded-xl border border-[#8b5cf6]/40 bg-[#0e1017]/95 px-4 py-3 text-[11px] font-semibold text-white">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}