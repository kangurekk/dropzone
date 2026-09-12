"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

type Drop = {
  id: number;
  username: string;
  itemName: string;
  itemImage: string | null;
  itemColor: string | null;
  itemRarity: string | null;
  itemPrice: number;
  caseName: string | null;
  droppedAt: number;
};

const MAX_VISIBLE = 12;
const GLOW_MS = 1400;
const ENTER_MS = 500;

function getSourceLabel(caseName: string | null): string | null {
  if (caseName === "Plinko Session") return "Plinko";
  if (caseName === "Roulette") return "Roulette";
  if (caseName === "Rocket Crash") return "Rocket Crash";
  if (typeof caseName === "string" && caseName.startsWith("Blackjack"))
    return "Blackjack";
  return null;
}

function getSourceIcon(caseName: string | null): string | null {
  if (caseName === "Plinko Session") return "◆";
  if (caseName === "Roulette") return "🎰";
  if (caseName === "Rocket Crash") return "🚀";
  if (typeof caseName === "string" && caseName.startsWith("Blackjack"))
    return "♠";
  return null;
}

export default function LiveDropsFeed() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [glowing, setGlowing] = useState<Set<number>>(new Set());
  const [entering, setEntering] = useState<Set<number>>(new Set());
  const seenIds = useRef<Set<number>>(new Set());
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/drops?limit=12")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.drops)) {
          setDrops(d.drops);
          d.drops.forEach((x: Drop) => seenIds.current.add(x.id));
        }
      })
      .catch(() => {});

    let es: EventSource | null = null;
    function connect() {
      es = new EventSource("/api/drops/stream");

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "drop" && data.drop) {
            const drop: Drop = data.drop;
            if (seenIds.current.has(drop.id)) return;
            seenIds.current.add(drop.id);

            setEntering((s) => new Set(s).add(drop.id));
            setGlowing((s) => new Set(s).add(drop.id));
            setDrops((prev) => [drop, ...prev].slice(0, MAX_VISIBLE));

            setTimeout(() => {
              setEntering((s) => {
                const n = new Set(s);
                n.delete(drop.id);
                return n;
              });
            }, ENTER_MS);

            setTimeout(() => {
              setGlowing((s) => {
                const n = new Set(s);
                n.delete(drop.id);
                return n;
              });
            }, GLOW_MS);
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

  const HIDDEN_ON = ["/login", "/signup", "/admin"];
  const shouldHide = HIDDEN_ON.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (shouldHide) return null;

  return (
    <div className="pointer-events-none fixed bottom-0 left-[235px] right-0 z-40 h-[48px] overflow-hidden border-t border-[#1b1f2b] bg-[#08090e]/95 backdrop-blur-md">
      <div className="flex h-full items-center gap-3 px-4">
        <div className="flex shrink-0 items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#eb4b4b] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#eb4b4b]" />
          </span>
          <span className="text-[9px] font-extrabold uppercase tracking-[1.4px] text-[#eb4b4b]">
            Live drops
          </span>
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex h-full items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {drops.length === 0 ? (
              <span className="text-[10px] text-[#4f5563]">
                Waiting for drops...
              </span>
            ) : (
              drops.map((d) => {
                const sourceLabel = getSourceLabel(d.caseName);
                const sourceIcon = getSourceIcon(d.caseName);
                const isSpecial = sourceLabel !== null;

                const color = isSpecial
                  ? d.itemColor ?? "#4ade80"
                  : d.itemColor ?? "#8b5cf6";

                const isNew = glowing.has(d.id);
                const isEntering = entering.has(d.id);

                return (
                  <div
                    key={d.id}
                    className={`shrink-0 overflow-hidden ${
                      isEntering ? "live-drop-expand" : ""
                    }`}
                  >
                    <div
                      className="relative flex items-center gap-2 overflow-hidden rounded-lg border bg-gradient-to-b from-[#0f1218] to-[#0a0c11] px-2.5 py-1.5"
                      style={{
                        borderColor: isNew ? color : `${color}44`,
                        boxShadow: isNew
                          ? `inset 0 -20px 30px -20px ${color}55, 0 0 12px ${color}66`
                          : `inset 0 -20px 30px -20px ${color}55`,
                        transition:
                          "border-color 400ms ease, box-shadow 400ms ease",
                      }}
                    >
                      {isNew && (
                        <div
                          className="live-drop-glow pointer-events-none absolute inset-0 rounded-lg"
                          style={{
                            background: `radial-gradient(ellipse at center, ${color} 0%, transparent 70%)`,
                          }}
                        />
                      )}

                      {isSpecial ? (
                        <div className="relative grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#0e1017] text-[14px]">
                          {sourceIcon ?? "◆"}
                        </div>
                      ) : (
                      d.itemImage && (
                      <img
                        src={`/api/steam-image?url=${encodeURIComponent(d.itemImage)}`}
                        alt={d.itemName}
                        referrerPolicy="no-referrer"
                        className="skin-img max-h-full max-w-full shrink-0 object-contain"
                        style={{ width: 40, height: 28, padding: 2 }}
                      />
                    )
                    )}

                      <div className="relative min-w-0">
                        {isSpecial ? (
                          <>
                            <div
                              className="max-w-[120px] truncate text-[9px] font-extrabold"
                              style={{ color }}
                              title={`${sourceLabel} — ${d.itemName}`}
                            >
                              {d.itemName}
                            </div>
                            <div className="text-[8px] text-[#737887]">
                              <Link
                                href={`/u/${d.username}`}
                                className="text-[#a78bfa] hover:underline"
                              >
                                {d.username}
                              </Link>
                              {" · "}
                              <span className="font-bold uppercase tracking-[0.4px]">
                                {sourceLabel}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              className="max-w-[120px] truncate text-[9px] font-bold"
                              style={{ color }}
                              title={d.itemName}
                            >
                              {d.itemName}
                            </div>
                            <div className="text-[8px] text-[#737887]">
                              <Link
                                href={`/u/${d.username}`}
                                className="text-[#a78bfa] hover:underline"
                              >
                                {d.username}
                              </Link>
                              {" · "}
                              <span className="font-bold" style={{ color }}>
                                ${d.itemPrice.toFixed(2)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}