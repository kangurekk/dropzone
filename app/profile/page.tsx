"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AvatarImage from "@/components/AvatarImage";
import DepositModal from "@/components/DepositModal";

type Stats = {
  username: string;
  balance: number;
  highestBalance: number;
  casesOpened: number;
  totalWagered: number;
  totalWon: number;
  memberSince: number;
  avatar: string;
  avatarFocalX: number;
  avatarFocalY: number;
  avatarZoom: number;
  bannerColor: string;
  accentColor: string;
  bio: string;
  mostOpenedCase: { name: string; count: number } | null;
  topSkin: { name: string; price: number; pulledAt: number } | null;
};

export default function ProfilePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const avatarFocalX = stats?.avatarFocalX ?? 50;
  const avatarFocalY = stats?.avatarFocalY ?? 50;
  const avatarZoom = stats?.avatarZoom ?? 1;

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setStats(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDeposit(amount: number) {
    if (!stats) return;
    setStats({ ...stats, balance: stats.balance + amount });
  }

  const initial = stats?.username?.[0]?.toUpperCase() ?? "?";
  const avatar = stats?.avatar ?? initial;
  const bannerColor = stats?.bannerColor ?? "#8b5cf6";
  const accentColor = stats?.accentColor ?? "#a78bfa";
  const netProfit = stats ? stats.totalWon - stats.totalWagered : 0;

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="profile" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[60px]">
        <Topbar
          title="Profile"
          description="Your stats and account overview."
          balance={stats?.balance ?? 0}
          username={stats?.username ?? null}
          avatar={avatar}
          avatarFocalX={avatarFocalX}
          avatarFocalY={avatarFocalY}
          avatarZoom={avatarZoom}
          onDeposit={() => setDepositOpen(true)}
          profileHref="/"
          profileActive={false}
        />

        {loading ? (
          <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-10 text-center text-[11px] text-[#737887]">
            Loading stats...
          </div>
        ) : !stats ? (
          <div className="rounded-2xl border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.06] p-6 text-center text-[11px] text-[#eb4b4b]">
            Could not load stats.
          </div>
        ) : (
          <>
            {/* HERO */}
            <div
              className="relative overflow-hidden rounded-2xl border border-[#1b1f2b] p-6"
              style={{
                background: `radial-gradient(circle at 20% 0%, ${bannerColor}33 0%, transparent 60%), linear-gradient(160deg, #11141d, #090b10)`,
              }}
            >
              <div
                className="pointer-events-none absolute left-1/4 top-[-100px] h-[200px] w-[200px] -translate-x-1/2 rounded-full blur-[80px]"
                style={{ background: bannerColor, opacity: 0.25 }}
              />

              <div className="relative flex items-center gap-5">
                <div
                  className="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-2xl text-[36px] font-bold text-white"
                  style={{
                    background: avatar.startsWith("/uploads/")
                      ? "#0e1017"
                      : `linear-gradient(135deg, ${bannerColor}, ${accentColor})`,
                    boxShadow: `0 0 40px ${bannerColor}55`,
                  }}
                >
                  {avatar.startsWith("/uploads/") ? (
                    <AvatarImage
                      src={avatar}
                      alt={stats.username}
                      focalX={avatarFocalX}
                      focalY={avatarFocalY}
                      zoom={avatarZoom}
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">{avatar}</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2
                    className="truncate text-[22px] font-bold tracking-[-0.5px]"
                    style={{ color: accentColor }}
                  >
                    {stats.username}
                  </h2>
                  <p className="mt-1 text-[11px] text-[#737887]">
                    Member since{" "}
                    {new Date(stats.memberSince).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>

                  {stats.bio && (
                    <p className="mt-2 max-w-[500px] text-[11px] text-[#737887]">
                      {stats.bio}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-md border border-[#252a36] bg-[#0f1219] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.8px] text-[#737887]">
                      {stats.casesOpened} cases opened
                    </span>
                    <span
                      className={`rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.8px] ${
                        netProfit >= 0
                          ? "border-[#22c55e]/30 bg-[#22c55e]/[0.08] text-[#4ade80]"
                          : "border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] text-[#eb4b4b]"
                      }`}
                    >
                      {netProfit >= 0 ? "+" : "-"}$
                      {Math.abs(netProfit).toFixed(2)} net
                    </span>
                  </div>

                  <Link
                    href="/settings"
                    className="mt-3 inline-flex h-[32px] items-center rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[10px] font-extrabold text-[#737887] transition hover:border-[#8b5cf6]/30 hover:text-white"
                  >
                    Edit profile
                  </Link>
                </div>
              </div>
            </div>

            {/* OVERVIEW */}
            <h2 className="mb-3 mt-8 text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#626978]">
              Overview
            </h2>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="Cases opened"
                value={stats.casesOpened.toString()}
              />
              <StatCard
                label="Current balance"
                value={`$${stats.balance.toFixed(2)}`}
                color="#a78bfa"
              />
              <StatCard
                label="Highest balance"
                value={`$${stats.highestBalance.toFixed(2)}`}
                color="#4ade80"
              />
              <StatCard
                label="Net profit"
                value={`${netProfit >= 0 ? "+" : "-"}$${Math.abs(
                  netProfit
                ).toFixed(2)}`}
                color={netProfit >= 0 ? "#4ade80" : "#eb4b4b"}
              />
            </div>

            {/* HIGHLIGHTS */}
            <h2 className="mb-3 mt-8 text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#626978]">
              Highlights
            </h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <BigCard
                label="Most opened case"
                title={stats.mostOpenedCase?.name ?? "—"}
                sub={
                  stats.mostOpenedCase
                    ? `Opened ${stats.mostOpenedCase.count} time${
                        stats.mostOpenedCase.count === 1 ? "" : "s"
                      }`
                    : "No cases opened yet"
                }
                color="#a78bfa"
              />

              <BigCard
                label="Best pull"
                title={stats.topSkin?.name ?? "—"}
                sub={
                  stats.topSkin
                    ? `$${stats.topSkin.price.toFixed(2)} on ${new Date(
                        stats.topSkin.pulledAt
                      ).toLocaleDateString()}`
                    : "No pulls yet"
                }
                color="#ffd700"
              />
            </div>

            {/* SPENDING */}
            <h2 className="mb-3 mt-8 text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#626978]">
              Spending
            </h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <StatCard
                label="Total wagered"
                value={`$${stats.totalWagered.toFixed(2)}`}
                color="#eb4b4b"
              />
              <StatCard
                label="Total won"
                value={`$${stats.totalWon.toFixed(2)}`}
                color="#4ade80"
              />
            </div>
          </>
        )}

        <DepositModal
          open={depositOpen}
          onClose={() => setDepositOpen(false)}
          onDeposit={handleDeposit}
        />
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
      <div className="text-[8px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
        {label}
      </div>
      <div
        className="mt-2 truncate text-[18px] font-bold text-white"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function BigCard({
  label,
  title,
  sub,
  color,
}: {
  label: string;
  title: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-5">
      <div className="text-[8px] font-extrabold uppercase tracking-[1.2px] text-[#4f5563]">
        {label}
      </div>
      <div
        className="mt-2 truncate text-[16px] font-bold"
        style={{ color: color ?? "#ffffff" }}
      >
        {title}
      </div>
      <div className="mt-1 text-[10px] text-[#737887]">{sub}</div>
    </div>
  );
}