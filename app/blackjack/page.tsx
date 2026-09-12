"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import CreateRoomModal from "@/components/CreateRoomModal";
import { avatarGradient } from "@/lib/user-colors";

type RoomSummary = {
  id: string;
  name: string;
  hostName: string;
  hostAvatar: string;
  hostBannerColor: string;
  hostAccentColor: string;
  playerCount: number;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  phase: string;
  fillWithBots: boolean;
};

export default function BlackjackHubPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me");
      const d = await res.json();
      setUsername(d.user?.username ?? null);
      setAvatar(d.user?.avatar ?? null);
      setBalance(d.user?.balance ?? 0);
    } catch {}
  }

  async function loadRooms() {
    try {
      const res = await fetch("/api/blackjack/rooms");
      const d = await res.json();
      if (Array.isArray(d.rooms)) setRooms(d.rooms);
    } catch {}
  }

  useEffect(() => {
    loadMe();
    loadRooms();
    const t = setInterval(loadRooms, 4000);
    return () => clearInterval(t);
  }, []);

  async function joinRoom(id: string) {
    setJoining(id);
    try {
      const res = await fetch(`/api/blackjack/rooms/${id}/join`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error ?? "Could not join");
        return;
      }
      router.push(`/blackjack/rooms/${id}`);
    } finally {
      setJoining(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="casino" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
        <Topbar
          title="Blackjack"
          description="Play against the dealer, or join a multiplayer table."
          balance={balance}
          username={username}
          avatar={avatar}
        />

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            href="/blackjack/solo"
            className="group relative overflow-hidden rounded-2xl border border-[#1b1f2b] bg-gradient-to-br from-[#0d2416] to-[#0a150d] p-6 transition hover:-translate-y-1 hover:border-[#22c55e]/40"
          >
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full blur-[70px] opacity-20 transition group-hover:opacity-30"
              style={{ background: "#22c55e" }}
            />
            <div className="relative">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-[#22c55e]/15 text-[28px] text-[#4ade80] shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                ♠
              </div>
              <div className="mt-4 text-[18px] font-bold tracking-[-0.3px] text-white">
                Play with dealer
              </div>
              <div className="mt-2 text-[11px] text-[#737887]">
                Solo game against the house. Fast hands, no waiting.
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[1px] text-[#4ade80] transition group-hover:gap-2">
                Play now <span>→</span>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="group relative overflow-hidden rounded-2xl border border-[#1b1f2b] bg-gradient-to-br from-[#1a1030] to-[#0d0a18] p-6 text-left transition hover:-translate-y-1 hover:border-[#8b5cf6]/40"
          >
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full blur-[70px] opacity-20 transition group-hover:opacity-30"
              style={{ background: "#8b5cf6" }}
            />
            <div className="relative">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-[#8b5cf6]/15 text-[28px] text-[#a78bfa] shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                👥
              </div>
              <div className="mt-4 text-[18px] font-bold tracking-[-0.3px] text-white">
                Create room
              </div>
              <div className="mt-2 text-[11px] text-[#737887]">
                Multiplayer table for up to 6 players. Set bets and rules.
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[1px] text-[#a78bfa] transition group-hover:gap-2">
                Create <span>→</span>
              </div>
            </div>
          </button>
        </div>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-[16px] font-bold tracking-[-0.4px]">
                Active rooms
              </h2>
              <p className="mt-[5px] text-[10px] text-[#737887]">
                Join a public table.
              </p>
            </div>
            <span className="rounded-md border border-[#252a36] bg-[#0f1219] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.8px] text-[#737887]">
              {rooms.length} open
            </span>
          </div>

          {rooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#1b1f2b] bg-[#0e1017] p-10 text-center text-[11px] text-[#4f5563]">
              No active rooms. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 rounded-xl border border-[#1b1f2b] bg-[#0b0d13] p-4 transition hover:border-[#8b5cf6]/30"
                >
                  <HostAvatar
                    avatar={r.hostAvatar}
                    bannerColor={r.hostBannerColor}
                    accentColor={r.hostAccentColor}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-[14px] font-bold text-white">
                        {r.name}
                      </div>
                      {r.phase !== "lobby" && (
                        <span className="rounded-md border border-[#eab308]/40 bg-[#eab308]/[0.1] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.5px] text-[#eab308]">
                          In progress
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-[#737887]">
                      <span>
                        <span className="text-[#a78bfa]">{r.hostName}</span>
                        's table
                      </span>
                      <span>
                        {r.playerCount}/{r.maxPlayers} players
                      </span>
                      <span>
                        Bet: ${r.minBet}–${r.maxBet}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => joinRoom(r.id)}
                    disabled={
                      joining === r.id ||
                      r.playerCount >= r.maxPlayers ||
                      r.phase !== "lobby"
                    }
                    className="h-[40px] shrink-0 rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/[0.08] px-5 text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#a78bfa] transition hover:bg-[#8b5cf6]/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {joining === r.id
                      ? "..."
                      : r.phase !== "lobby"
                        ? "Playing"
                        : r.playerCount >= r.maxPlayers
                          ? "Full"
                          : "Join"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <CreateRoomModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      </main>
    </div>
  );
}

function HostAvatar({
  avatar,
  bannerColor,
  accentColor,
  size = 48,
}: {
  avatar: string;
  bannerColor: string;
  accentColor: string;
  size?: number;
}) {
  const isUpload = avatar?.startsWith("/uploads/");
  const initial = avatar && !isUpload ? avatar : "◆";

  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-lg text-[20px] font-bold text-white"
      style={{
        width: size,
        height: size,
        background: isUpload
          ? "#0e1017"
          : avatarGradient(bannerColor, accentColor),
      }}
    >
      {isUpload ? (
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}