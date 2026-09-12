"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { avatarGradient } from "@/lib/user-colors";

type Entry = {
  username: string;
  balance?: number;
  cases_opened?: number;
  profit?: number;
  highest_balance?: number;
  avatar?: string;
  banner_color?: string;
  accent_color?: string;
};

type Tab = "balance" | "cases" | "profit" | "highest";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "balance", label: "Balance", icon: "💰" },
  { id: "cases", label: "Cases", icon: "📦" },
  { id: "profit", label: "Profit", icon: "📈" },
  { id: "highest", label: "Peak", icon: "🏆" },
];

export default function LeaderboardPage() {
  const [data, setData] = useState<Record<Tab, Entry[]>>({
    balance: [],
    cases: [],
    profit: [],
    highest: [],
  });
  const [tab, setTab] = useState<Tab>("balance");
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.balance) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUsername(d.user?.username ?? null);
        setAvatar(d.user?.avatar ?? null);
        setBalance(d.user?.balance ?? 0);
      })
      .catch(() => {});
  }, []);

  const rows = data[tab] ?? [];

  function getValue(e: Entry): string {
    if (tab === "balance") return `$${(e.balance ?? 0).toFixed(2)}`;
    if (tab === "cases") return `${e.cases_opened ?? 0} cases`;
    if (tab === "profit") {
      const p = e.profit ?? 0;
      return `${p >= 0 ? "+" : "-"}$${Math.abs(p).toFixed(2)}`;
    }
    return `$${(e.highest_balance ?? 0).toFixed(2)}`;
  }

  function getValueColor(e: Entry): string {
    if (tab === "profit") {
      return (e.profit ?? 0) >= 0 ? "#4ade80" : "#eb4b4b";
    }
    return "#a78bfa";
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="leaderboard" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[80px]">
        <Topbar
          title="Leaderboard"
          description="Top players across большой дроп."
          balance={balance}
          username={username}
          avatar={avatar}
        />

        {/* TABS */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-[12px] font-extrabold uppercase tracking-[1px] transition ${
                tab === t.id
                  ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/15 text-[#a78bfa] shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                  : "border-[#1b1f2b] bg-[#0b0d13] text-[#737887] hover:text-white"
              }`}
            >
              <span className="text-[14px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* LIST */}
        {loading ? (
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-10 text-center text-[11px] text-[#737887]">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-10 text-center text-[11px] text-[#4f5563]">
            No data yet.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((e, i) => {
              const isTop3 = i < 3;
              const rankColor =
                i === 0
                  ? "#ffd700"
                  : i === 1
                    ? "#c0c0c0"
                    : i === 2
                      ? "#cd7f32"
                      : "#4f5563";
              const initial = e.username?.[0]?.toUpperCase() ?? "?";
              const hasUpload = e.avatar?.startsWith("/uploads/");

              return (
                <Link
                  key={`${e.username}-${i}`}
                  href={`/u/${e.username}`}
                  className={`flex items-center gap-4 rounded-2xl border p-4 transition hover:border-[#8b5cf6]/40 ${
                    isTop3
                      ? "border-[#1b1f2b] bg-gradient-to-r from-[#0f1218] to-[#0b0d13]"
                      : "border-[#1b1f2b] bg-[#0b0d13]"
                  }`}
                >
                  {/* RANK */}
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[14px] font-extrabold"
                    style={{
                      background: `${rankColor}22`,
                      color: rankColor,
                      boxShadow: isTop3
                        ? `0 0 20px ${rankColor}33`
                        : undefined,
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* AVATAR */}
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg text-[14px] font-bold text-white"
                    style={{
                      background: hasUpload
                        ? "#0e1017"
                        : avatarGradient(e.banner_color, e.accent_color),
                    }}
                  >
                    {hasUpload ? (
                      <img
                        src={e.avatar!}
                        alt={e.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initial
                    )}
                  </div>

                  {/* NAME */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-white">
                      {e.username}
                    </div>
                  </div>

                  {/* VALUE */}
                  <div
                    className="shrink-0 text-[14px] font-extrabold tabular-nums"
                    style={{ color: getValueColor(e) }}
                  >
                    {getValue(e)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}