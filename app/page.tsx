"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import CaseCard from "@/components/CaseCard";
import Upgrader from "@/components/Upgrader";
import Plinko from "@/components/Plinko";
import DepositModal from "@/components/DepositModal";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import LiveDropsFeed from "@/components/LiveDropsFeed";
import { CASES } from "@/lib/cases";
import type { InventoryItem } from "@/lib/inventory";

const pages = {
  cases: {
    title: "Cases",
    description: "Open cases and discover your next drop.",
  },
  upgrade: {
    title: "Upgrader",
    description: "Upgrade your collection.",
  },
  plinko: {
    title: "Plinko",
    description: "Drop the ball, multiply your skins.",
  },
  inventory: {
    title: "Inventory",
    description: "Your collected items.",
  },
};

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as keyof typeof pages) ?? "cases";
  const [activePage, setActivePage] = useState<keyof typeof pages>(
    initialTab in pages ? initialTab : "cases"
  );
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarFocalX, setAvatarFocalX] = useState(50);
  const [avatarFocalY, setAvatarFocalY] = useState(50);
  const [avatarZoom, setAvatarZoom] = useState(1);

  const [bannerColor, setBannerColor] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUsername(d.user?.username ?? null);
        setAvatar(d.user?.avatar ?? null);
        setAvatarFocalX(d.user?.avatarFocalX ?? 50);
        setAvatarFocalY(d.user?.avatarFocalY ?? 50);
        setAvatarZoom(d.user?.avatarZoom ?? 1);
        setBalance(d.user?.balance ?? 0);
        setBannerColor(d.user?.bannerColor ?? null);
        setAccentColor(d.user?.accentColor ?? null);
      })
      .catch(() => {
        setUsername(null);
        setAvatar(null);
      });

    fetch("/api/inventory")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setInventory(d.items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab") as keyof typeof pages | null;
    if (tab && tab in pages) setActivePage(tab);
    else if (!tab) setActivePage("cases");
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const currentPage = pages[activePage];

  async function applyBalanceDelta(delta: number) {
    setBalance((b) => Math.max(0, b + delta));
    try {
      const res = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      const d = await res.json();
      if (typeof d.balance === "number") setBalance(d.balance);
    } catch {}
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  function openCase(caseData: (typeof CASES)[number]) {
    if (balance < caseData.price) {
      showToast(
        `Not enough balance. Need $${caseData.price.toFixed(2)} to open.`
      );
      return;
    }
    router.push(`/case/${caseData.id}`);
  }

  async function sellItem(uid: string) {
    const item = inventory.find((i) => i.uid === uid);
    if (!item) return;

    const res = await fetch(`/api/inventory/${uid}`, { method: "DELETE" });
    if (!res.ok) return;

    const gained = item.price ?? 0;
    setInventory((cur) => cur.filter((i) => i.uid !== uid));
    await applyBalanceDelta(gained);
    showToast(`Sold "${item.name}" for $${gained.toFixed(2)}`);
  }

  async function sellAll() {
    if (inventory.length === 0) return;

    const total = inventory.reduce((sum, i) => sum + (i.price ?? 0), 0);

    for (const item of inventory) {
      await fetch(`/api/inventory/${item.uid}`, { method: "DELETE" });
    }

    setInventory([]);
    await applyBalanceDelta(total);
    showToast(
      `Sold ${inventory.length} item${inventory.length === 1 ? "" : "s"} for $${total.toFixed(2)}`
    );
  }

  function handleDeposit(amount: number) {
    setBalance((prev) => prev + amount);
    showToast(`Added $${amount.toFixed(2)} to your balance`);
  }

  // When on plinko tab, highlight "casino" in sidebar (plinko is a sub-game of casino)
  const sidebarActive = activePage === "plinko" ? "casino" : activePage;

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar
        active={sidebarActive}
        onNavigate={(page) => {
          if (page === "profile" || page === "settings") return;
          setActivePage(page as keyof typeof pages);
        }}
      />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
        <Topbar
          title={currentPage.title}
          description={currentPage.description}
          balance={balance}
          username={username}
          avatar={avatar}
          avatarFocalX={avatarFocalX}
          avatarFocalY={avatarFocalY}
          avatarZoom={avatarZoom}
          onDeposit={() => setDepositOpen(true)}
        />

        {activePage === "cases" && (
          <CasesPlaceholder balance={balance} onOpenCase={openCase} />
        )}

        {activePage === "upgrade" && (
          <Upgrader
            inventory={inventory}
            onWin={(newItem) => {
              setInventory((current) => [newItem, ...current]);
            }}
            onLose={(uid) => {
              setInventory((current) => current.filter((i) => i.uid !== uid));
            }}
            onServerResult={() => {}}
          />
        )}

        {activePage === "plinko" && (
          <Plinko
            balance={balance}
            onDrop={(bet) => {
              setBalance((b) => Math.max(0, b - bet));
            }}
            onFinish={(payout) => {
              setBalance((b) => b + payout);
            }}
          />
        )}

        {activePage === "inventory" && (
          <InventoryPlaceholder
            inventory={inventory}
            onSell={sellItem}
            onSellAll={sellAll}
          />
        )}

        <DepositModal
          open={depositOpen}
          onClose={() => setDepositOpen(false)}
          onDeposit={handleDeposit}
        />

        <LiveDropsFeed />

        {toast && (
          <div className="pointer-events-none fixed bottom-6 right-6 z-[200] max-w-[360px] rounded-xl border border-[#8b5cf6]/40 bg-[#0e1017]/95 px-4 py-3 text-[11px] font-semibold text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-md">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}

/* =========================================================
   CASES
========================================================= */

function CasesPlaceholder({
  onOpenCase,
  balance,
}: {
  onOpenCase: (caseData: (typeof CASES)[number]) => void;
  balance: number;
}) {
  return (
    <section>
      <div className="mb-7 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-bold tracking-[-0.4px]">Cases</h2>
            <span className="rounded-md border border-[#252a36] bg-[#0f1219] px-2 py-1 text-[7px] font-bold uppercase tracking-[0.8px] text-[#626978]">
              {CASES.length} available
            </span>
          </div>
          <p className="mt-[6px] text-[10px] text-[#666d7c]">
            Open a case and discover your next item.
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <div className="text-[7px] font-extrabold uppercase tracking-[1px] text-[#4f5563]">
            YOUR BALANCE
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#a78bfa]">
            ${balance.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {CASES.map((caseData) => {
          const canAfford = balance >= caseData.price;
          return (
            <div key={caseData.id} className={canAfford ? "" : "opacity-60"}>
              <CaseCard
                name={caseData.name}
                description={caseData.description}
                price={caseData.price}
                icon={caseData.icon}
                glow={caseData.glow}
                onOpen={() => onOpenCase(caseData)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* =========================================================
   INVENTORY
========================================================= */

function InventoryPlaceholder({
  inventory,
  onSell,
  onSellAll,
}: {
  inventory: InventoryItem[];
  onSell: (uid: string) => void;
  onSellAll: () => void;
}) {
  const totalValue = inventory.reduce(
    (sum, item) => sum + (item.price ?? 0),
    0
  );

  return (
    <section>
      <div className="mb-7 flex items-end justify-between">
        <div>
          <h2 className="text-[18px] font-bold tracking-[-0.4px]">Inventory</h2>
          <p className="mt-[6px] text-[10px] text-[#666d7c]">
            Your collected items.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 py-2">
            <div className="text-[7px] font-extrabold tracking-[1px] text-[#4f5563]">
              ITEMS
            </div>
            <div className="mt-1 text-[11px] font-bold">{inventory.length}</div>
          </div>
          <div className="rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 py-2">
            <div className="text-[7px] font-extrabold tracking-[1px] text-[#4f5563]">
              VALUE
            </div>
            <div className="mt-1 text-[11px] font-bold text-[#a78bfa]">
              ${totalValue.toFixed(2)}
            </div>
          </div>

          {inventory.length > 0 && (
            <button
              type="button"
              onClick={onSellAll}
              className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/[0.08] px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.6px] text-[#4ade80] transition hover:bg-[#22c55e]/[0.15]"
            >
              Sell all
            </button>
          )}
        </div>
      </div>

      {inventory.length === 0 ? (
        <div className="flex min-h-[170px] items-center justify-center rounded-xl border border-dashed border-[#1b1f2b] bg-[#0e1017]">
          <span className="text-[11px] text-[#4f5563]">
            Your inventory is empty.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {inventory.map((item) => (
            <div
              key={item.uid}
              className="group relative overflow-hidden rounded-xl border border-[#1b1f2b] bg-[#0b0d13] p-3 transition hover:border-[#8b5cf6]/30"
            >
              <div
                className="grid h-[140px] place-items-center rounded-lg"
                style={{
                  background: `radial-gradient(circle, ${
                    item.color ?? "#8b5cf6"
                  }22 0%, transparent 65%)`,
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
                    className="text-5xl"
                    style={{
                      color: item.color ?? "#a78bfa",
                      textShadow: `0 0 30px ${item.color ?? "#8b5cf6"}`,
                    }}
                  >
                    ◆
                  </div>
                )}
              </div>

              <div className="mt-3 truncate text-[11px] font-bold">
                {item.name}
              </div>

              <div className="mt-1 text-[9px] text-[#737887]">
                ${(item.price ?? 0).toFixed(2)}
              </div>

              <button
                type="button"
                onClick={() => onSell(item.uid)}
                className="mt-2 h-[30px] w-full rounded-lg border border-[#22c55e]/25 bg-[#22c55e]/[0.06] text-[9px] font-extrabold uppercase tracking-[0.6px] text-[#4ade80] transition hover:bg-[#22c55e]/[0.15]"
              >
                Sell for ${(item.price ?? 0).toFixed(2)}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}