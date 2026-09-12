"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import type { Card, PublicCard } from "@/lib/blackjack";
import { avatarGradient } from "@/lib/user-colors";

type Player = {
  userId: number;
  username: string;
  avatar: string;
  bannerColor: string;
  accentColor: string;
  seat: number;
  bet: number;
  hand: PublicCard[];
  status: string;
  doubled: boolean;
  outcome: string | null;
  payout: number;
  ready: boolean;
  isBot: boolean;
  isMe: boolean;
};

type Room = {
  id: string;
  name: string;
  hostId: number;
  hostName: string;
  isPrivate: boolean;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  fillWithBots: boolean;
  phase: string;
  phaseEndsAt: number;
  turnUserId: number | null;
  turnSeat: number | null;
  players: Player[];
  dealerHand: PublicCard[];
};

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = params?.id;

  const [room, setRoom] = useState<Room | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [myId, setMyId] = useState<number | null>(null);

  const [betAmount, setBetAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me");
      const d = await res.json();
      setUsername(d.user?.username ?? null);
      setAvatar(d.user?.avatar ?? null);
      setBalance(d.user?.balance ?? 0);
      setMyId(d.user?.id ?? null);
    } catch {}
  }

  useEffect(() => {
    loadMe();

    if (!roomId) return;

    let es: EventSource | null = null;
    function connect() {
      es = new EventSource(`/api/blackjack/rooms/${roomId}/stream`);

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "state") {
            if (!data.room) {
              router.push("/blackjack");
              return;
            }
            setRoom(data.room);
            loadMe();
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
  }, [roomId, router]);

  useEffect(() => {
    function handleBeforeUnload() {
      navigator.sendBeacon(
        `/api/blackjack/rooms/${roomId}/leave`,
        new Blob([], { type: "application/json" })
      );
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [roomId]);

  useEffect(() => {
    if (!room || room.phase === "lobby" || room.phaseEndsAt === 0) return;
    const tick = () => {
      const secs = Math.max(0, Math.ceil((room.phaseEndsAt - Date.now()) / 1000));
      setCountdown(secs);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [room]);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  async function leave() {
    if (!roomId) return;
    await fetch(`/api/blackjack/rooms/${roomId}/leave`, { method: "POST" });
    router.push("/blackjack");
  }

  async function startGame() {
    if (!roomId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/blackjack/rooms/${roomId}/start`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) showFlash(d.error ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function bet() {
    if (!roomId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/blackjack/rooms/${roomId}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: betAmount }),
      });
      const d = await res.json();
      if (!res.ok) showFlash(d.error ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function action(a: "hit" | "stand" | "double") {
    if (!roomId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/blackjack/rooms/${roomId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: a }),
      });
      const d = await res.json();
      if (!res.ok) showFlash(d.error ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function addBot() {
    if (!roomId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/blackjack/rooms/${roomId}/add-bot`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) showFlash(d.error ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeBot(seat: number) {
    if (!roomId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/blackjack/rooms/${roomId}/remove-bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seat }),
      });
      const d = await res.json();
      if (!res.ok) showFlash(d.error ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
        <Sidebar active="casino" />
        <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
          <Topbar
            title="Loading..."
            description="Joining room..."
            balance={balance}
            username={username}
            avatar={avatar}
          />
          <div className="flex min-h-[60vh] items-center justify-center text-[12px] text-[#737887]">
            Loading room...
          </div>
        </main>
      </div>
    );
  }

  const isHost = myId === room.hostId;
  const me = room.players.find((p) => p.isMe);
  const myTurn = room.turnUserId === myId && me?.status === "playing";
  const currentTurnUserId = room.turnUserId;
  const canBet = room.phase === "betting" && me && me.bet === 0 && !busy;

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f5f7]">
      <Sidebar active="casino" />

      <main className="ml-[235px] min-h-screen px-[42px] pb-[100px]">
        <Topbar
          title={room.name}
          description={`${room.players.length}/${room.maxPlayers} · Bet $${room.minBet}–$${room.maxBet}`}
          balance={balance}
          username={username}
          avatar={avatar}
        />

        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={leave}
            className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[10px] font-bold text-[#737887] transition hover:border-[#eb4b4b]/30 hover:text-[#eb4b4b]"
          >
            ← Leave
          </button>

          {room.phase !== "lobby" && (
            <div className="flex items-center gap-3">
              <div
                className="text-[11px] font-extrabold uppercase tracking-[1.6px]"
                style={{
                  color:
                    room.phase === "betting"
                      ? "#4ade80"
                      : room.phase === "playing"
                        ? "#eab308"
                        : room.phase === "result"
                          ? "#a78bfa"
                          : "#737887",
                }}
              >
                {room.phase === "betting"
                  ? "Betting"
                  : room.phase === "playing"
                    ? "Playing"
                    : room.phase === "dealer"
                      ? "Dealer"
                      : "Result"}
              </div>
              {countdown > 0 && (
                <div
                  className="text-[16px] font-bold tabular-nums"
                  style={{
                    color:
                      countdown <= 5
                        ? "#eb4b4b"
                        : countdown <= 10
                          ? "#eab308"
                          : "#fff",
                  }}
                >
                  {countdown}s
                </div>
              )}
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="rounded-2xl border border-[#1b1f2b] bg-gradient-to-b from-[#0d2416] to-[#0a150d] p-8">
          {/* DEALER */}
          <div className="mb-6 text-center">
            <div className="text-[9px] font-extrabold uppercase tracking-[1.6px] text-[#4f5563]">
              Dealer
            </div>
            <div className="mt-3 flex justify-center gap-2">
              {room.dealerHand.length === 0 ? (
                <>
                  <CardSlot />
                  <CardSlot />
                </>
              ) : (
                room.dealerHand.map((c, i) => (
                  <CardView key={i} card={c} />
                ))
              )}
            </div>
          </div>

          <div className="my-8 flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-[#1b1f2b]" />
            <div className="text-[9px] font-extrabold uppercase tracking-[2px] text-[#4f5563]">
              {room.phase === "lobby" ? "Waiting room" : "Table"}
            </div>
            <div className="h-[1px] flex-1 bg-[#1b1f2b]" />
          </div>

          {/* PLAYERS */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {Array.from({ length: room.maxPlayers }).map((_, seat) => {
              const p = room.players.find((x) => x.seat === seat);
              if (!p) {
                const canAddBot = isHost && room.phase === "lobby";
                return (
                  <button
                    key={seat}
                    type="button"
                    onClick={() => canAddBot && addBot()}
                    disabled={!canAddBot || busy}
                    className={`flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed p-3 transition ${
                      canAddBot
                        ? "cursor-pointer border-[#8b5cf6]/40 bg-[#8b5cf6]/[0.04] hover:border-[#8b5cf6]/70 hover:bg-[#8b5cf6]/[0.08]"
                        : "cursor-default border-[#1b1f2b] bg-[#0a150d]/60"
                    }`}
                  >
                    <div
                      className={`grid h-10 w-10 place-items-center rounded-full border text-[20px] ${
                        canAddBot
                          ? "border-[#8b5cf6]/50 text-[#a78bfa]"
                          : "border-[#1b1f2b] text-[#4f5563]"
                      }`}
                    >
                      +
                    </div>
                    <div
                      className={`mt-2 text-[9px] font-bold uppercase tracking-[0.5px] ${
                        canAddBot ? "text-[#a78bfa]" : "text-[#4f5563]"
                      }`}
                    >
                      {canAddBot ? "Add bot" : "Empty"}
                    </div>
                  </button>
                );
              }

              const isUpload = p.avatar?.startsWith("/uploads/");
              const initial =
                p.avatar && !isUpload ? p.avatar : p.username[0].toUpperCase();

              const isCurrentTurn = currentTurnUserId === p.userId;
              const showRemoveBot = p.isBot && isHost && room.phase === "lobby";

              return (
                <div
                  key={seat}
                  className={`relative flex h-[220px] flex-col items-center rounded-xl border p-2 transition ${
                    isCurrentTurn
                      ? "border-[#eab308]/70 bg-[#eab308]/[0.06] shadow-[0_0_20px_rgba(234,179,8,0.25)]"
                      : p.isMe
                        ? "border-[#8b5cf6]/50 bg-[#8b5cf6]/[0.08]"
                        : "border-[#1b1f2b] bg-[#0b0d13]"
                  }`}
                >
                  {showRemoveBot && (
                    <button
                      type="button"
                      onClick={() => removeBot(seat)}
                      disabled={busy}
                      title="Remove bot"
                      className="absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-md border border-[#eb4b4b]/40 bg-[#eb4b4b]/[0.12] text-[14px] font-bold leading-none text-[#eb4b4b] transition hover:bg-[#eb4b4b]/[0.25] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ×
                    </button>
                  )}

                  <div className="flex h-[90px] items-center justify-center gap-1">
                    {p.hand.length === 0 ? (
                      <div className="text-[9px] text-[#4f5563]">—</div>
                    ) : (
                      p.hand.map((c, i) => <CardMini key={i} card={c} />)
                    )}
                  </div>

                  <div className="mt-auto flex flex-col items-center">
                    <div
                      className="grid h-8 w-8 place-items-center overflow-hidden rounded-full text-[12px] font-bold text-white"
                      style={{
                        background: isUpload
                          ? "#0e1017"
                          : avatarGradient(p.bannerColor, p.accentColor),
                      }}
                    >
                      {isUpload ? (
                        <img
                          src={p.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initial
                      )}
                    </div>
                    <div className="mt-1 max-w-full truncate text-[10px] font-bold">
                      {p.username}
                    </div>
                    {p.bet > 0 && (
                      <div className="text-[9px] font-bold text-[#4ade80]">
                        ${p.bet.toFixed(2)}
                      </div>
                    )}
                    {p.outcome && (
                      <div
                        className="mt-0.5 rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase"
                        style={{
                          background:
                            p.outcome === "win" || p.outcome === "blackjack"
                              ? "rgba(34,197,94,0.2)"
                              : p.outcome === "push"
                                ? "rgba(234,179,8,0.2)"
                                : "rgba(235,75,75,0.2)",
                          color:
                            p.outcome === "win" || p.outcome === "blackjack"
                              ? "#4ade80"
                              : p.outcome === "push"
                                ? "#eab308"
                                : "#eb4b4b",
                        }}
                      >
                        {p.outcome === "blackjack"
                          ? "BJ!"
                          : p.outcome === "win"
                            ? `+$${(p.payout - p.bet).toFixed(2)}`
                            : p.outcome === "push"
                              ? "PUSH"
                              : p.outcome === "bust"
                                ? "BUST"
                                : `-$${p.bet.toFixed(2)}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CONTROLS */}
        <div className="mt-6 rounded-2xl border border-[#1b1f2b] bg-[#0b0d13] p-4">
          {room.phase === "lobby" && (
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-[#737887]">
                {isHost
                  ? "Start the game when everyone is ready."
                  : "Waiting for host..."}
              </div>
              {isHost && (
                <button
                  type="button"
                  onClick={startGame}
                  disabled={busy}
                  className="h-[42px] rounded-lg border border-[#9b7cf8]/25 bg-gradient-to-br from-[#8b5cf6] to-[#633bd0] px-6 text-[11px] font-extrabold uppercase tracking-[0.6px] text-white transition hover:brightness-110 disabled:opacity-40"
                >
                  START GAME
                </button>
              )}
            </div>
          )}

          {room.phase === "betting" && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-[11px] text-[#737887]">
                {me?.bet && me.bet > 0
                  ? `You bet $${me.bet.toFixed(2)}. Waiting for others...`
                  : "Place your bet"}
              </div>
              {canBet && (
                <>
                  <input
                    type="number"
                    min={room.minBet}
                    max={room.maxBet}
                    value={betAmount}
                    onChange={(e) =>
                      setBetAmount(Number(e.target.value) || room.minBet)
                    }
                    className="h-[38px] w-[100px] rounded-lg border border-[#1b1f2b] bg-[#0e1017] px-3 text-[12px] font-bold text-white outline-none focus:border-[#8b5cf6]"
                  />
                  <button
                    type="button"
                    onClick={bet}
                    disabled={busy}
                    className="h-[38px] rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/[0.1] px-5 text-[11px] font-extrabold uppercase tracking-[0.5px] text-[#4ade80] transition hover:bg-[#22c55e]/[0.2] disabled:opacity-40"
                  >
                    BET ${betAmount}
                  </button>
                </>
              )}
            </div>
          )}

          {room.phase === "playing" && (
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-[#737887]">
                {myTurn
                  ? "Your turn"
                  : room.turnUserId == null
                    ? "—"
                    : `Waiting for ${room.players.find((p) => p.userId === room.turnUserId)?.username ?? "..."}`}
              </div>
              {myTurn && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => action("hit")}
                    disabled={busy}
                    className="h-[42px] rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/[0.1] px-6 text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#4ade80] transition hover:bg-[#22c55e]/[0.2] disabled:opacity-40"
                  >
                    HIT
                  </button>
                  <button
                    type="button"
                    onClick={() => action("stand")}
                    disabled={busy}
                    className="h-[42px] rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.1] px-6 text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#eb4b4b] transition hover:bg-[#eb4b4b]/[0.2] disabled:opacity-40"
                  >
                    STAND
                  </button>
                  {me?.hand.length === 2 && balance >= (me?.bet ?? 0) && (
                    <button
                      type="button"
                      onClick={() => action("double")}
                      disabled={busy}
                      className="h-[42px] rounded-lg border border-[#eab308]/30 bg-[#eab308]/[0.1] px-6 text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#eab308] transition hover:bg-[#eab308]/[0.2] disabled:opacity-40"
                    >
                      DOUBLE
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {room.phase === "result" && (
            <div className="text-center text-[11px] text-[#737887]">
              Round finished. Back to lobby in a moment...
            </div>
          )}

          {flash && (
            <div className="mt-3 rounded-lg border border-[#eb4b4b]/30 bg-[#eb4b4b]/[0.08] px-3 py-2 text-center text-[11px] text-[#eb4b4b]">
              {flash}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Card visuals
   ───────────────────────────────────────────────── */

function CardSlot() {
  return (
    <div className="h-[100px] w-[72px] rounded-lg border border-[#1b1f2b] bg-[#0e1017]" />
  );
}

function CardView({ card }: { card: PublicCard }) {
  if ("hidden" in card && card.hidden) {
    return (
      <div className="grid h-[100px] w-[72px] place-items-center rounded-lg border border-[#1b1f2b] bg-gradient-to-br from-[#1e293b] to-[#0f172a]">
        <div className="grid h-9 w-9 place-items-center rounded-full text-[16px] text-[#8b5cf6]">
          ◆
        </div>
      </div>
    );
  }
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div className="relative h-[100px] w-[72px] rounded-lg border border-[#1b1f2b] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <div
        className={`absolute left-1.5 top-1 text-[12px] font-extrabold leading-tight ${
          isRed ? "text-[#c92f2f]" : "text-[#1a1e29]"
        }`}
      >
        {card.rank}
        <br />
        {card.suit}
      </div>
      <div
        className={`absolute inset-0 grid place-items-center text-[32px] ${
          isRed ? "text-[#c92f2f]" : "text-[#1a1e29]"
        }`}
      >
        {card.suit}
      </div>
    </div>
  );
}

function CardMini({ card }: { card: PublicCard }) {
  if ("hidden" in card && card.hidden) {
    return (
      <div className="grid h-[80px] w-[56px] place-items-center rounded-md border border-[#1b1f2b] bg-gradient-to-br from-[#1e293b] to-[#0f172a]">
        <div className="text-[14px] text-[#8b5cf6]">◆</div>
      </div>
    );
  }
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div className="relative h-[80px] w-[56px] rounded-md border border-[#1b1f2b] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
      <div
        className={`absolute left-1 top-0.5 text-[9px] font-extrabold leading-tight ${
          isRed ? "text-[#c92f2f]" : "text-[#1a1e29]"
        }`}
      >
        {card.rank}
        <br />
        {card.suit}
      </div>
      <div
        className={`absolute inset-0 grid place-items-center text-[20px] ${
          isRed ? "text-[#c92f2f]" : "text-[#1a1e29]"
        }`}
      >
        {card.suit}
      </div>
    </div>
  );
}