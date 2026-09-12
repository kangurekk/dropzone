"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

type Game = {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: string;
  glow: string;
  tag: string;
  comingSoon?: boolean;
};

const GAMES: Game[] = [
  {
    id: "plinko",
    name: "Plinko",
    description: "Drop the ball, watch it bounce, cash out big.",
    href: "/?tab=plinko",
    icon: "◆",
    glow: "#8b5cf6",
    tag: "Ball",
  },
  {
    id: "roulette",
    name: "Roulette",
    description: "Global wheel. New round every 40 seconds.",
    href: "/roulette",
    icon: "🎰",
    glow: "#eb4b4b",
    tag: "Live",
  },
  {
    id: "blackjack",
    name: "Blackjack",
    description: "Beat the dealer. Get 21 without going over.",
    href: "/blackjack",
    icon: "♠",
    glow: "#22c55e",
    tag: "Cards",
  },
  {
    id: "rocket",
    name: "Rocket Crash",
    description: "Multiplier rises. Cash out before it crashes.",
    href: "/rocket",
    icon: "🚀",
    glow: "#eab308",
    tag: "Live",
  },
];

export default function CasinoPage() {
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);

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

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="casino" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
        <Topbar
          title="Casino"
          description="Games of chance and skill. Good luck."
          balance={balance}
          username={username}
          avatar={avatar}
        />

        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {GAMES.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </main>
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const Wrapper = game.comingSoon ? "div" : Link;
  const wrapperProps = game.comingSoon
    ? {}
    : { href: game.href };

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={`group relative overflow-hidden rounded-2xl border border-[#1a1e29] bg-[#0b0d13] p-3 transition-all duration-300 ${
        game.comingSoon
          ? "cursor-not-allowed opacity-60"
          : "hover:-translate-y-1 hover:border-[#8b5cf6]/35 hover:shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      }`}
    >
      {/* TOP GLOW */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-[65px] opacity-[0.14] transition duration-300 group-hover:opacity-[0.22]"
        style={{ background: game.glow }}
      />

      {/* CARD SHINE */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.035] via-transparent to-transparent opacity-70" />

      {/* VISUAL */}
      <div
        className="relative flex h-[200px] items-center justify-center overflow-hidden rounded-xl border border-white/[0.045]"
        style={{
          background: `
            radial-gradient(circle at center, ${game.glow}28 0%, transparent 58%),
            linear-gradient(145deg, #11141d, #090b11)
          `,
        }}
      >
        {/* GRID */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "28px 28px",
          }}
        />

        {/* GLOW BEHIND ICON */}
        <div
          className="absolute h-32 w-32 rounded-full blur-[35px] opacity-30"
          style={{ background: game.glow }}
        />

        {/* ICON */}
        <div className="relative flex h-[110px] w-[110px] items-center justify-center rounded-[24px] border border-white/[0.09] bg-gradient-to-br from-white/[0.11] to-white/[0.025] text-[54px] shadow-[0_25px_55px_rgba(0,0,0,0.5)] transition duration-300 group-hover:scale-[1.06]">
          {game.icon}
          <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-br from-white/[0.08] to-transparent" />
        </div>

        {/* TAG */}
        <div
          className="absolute right-3 top-3 rounded-md border px-2 py-1 text-[8px] font-extrabold uppercase tracking-[1px]"
          style={{
            color: game.glow,
            borderColor: `${game.glow}55`,
            background: `${game.glow}18`,
          }}
        >
          {game.tag}
        </div>
      </div>

      {/* INFO */}
      <div className="relative px-1 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold tracking-[-0.2px] text-white">
              {game.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-[10px] leading-[1.5] text-[#666d7c]">
              {game.description}
            </p>
          </div>
        </div>

        {/* BOTTOM */}
        <div className="mt-4 flex items-center justify-between border-t border-[#171b24] pt-3">
          <div className="text-[9px] font-extrabold uppercase tracking-[1px] text-[#4f5563]">
            {game.comingSoon ? "Coming soon" : "Play now"}
          </div>

          {!game.comingSoon && (
            <div
              className="rounded-lg border px-4 py-2 text-[9px] font-extrabold tracking-[0.4px] transition group-hover:-translate-y-[1px]"
              style={{
                color: "#fff",
                borderColor: `${game.glow}44`,
                background: `linear-gradient(135deg, ${game.glow}, ${game.glow}99)`,
              }}
            >
              PLAY
            </div>
          )}
        </div>
      </div>
    </Wrapper>
  );
}