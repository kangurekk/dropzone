import {
  buildDeck,
  type Card,
  type PublicCard,
  hideCard,
  handValue,
  isBlackjack,
  isBust,
  shouldDealerHit,
} from "./blackjack";
import db from "./db";

export type RoomPhase = "lobby" | "betting" | "playing" | "dealer" | "result";

export type PlayerStatus =
  | "waiting"
  | "betting"
  | "playing"
  | "standing"
  | "bust"
  | "blackjack"
  | "done";

export type RoomPlayer = {
  userId: number;
  username: string;
  avatar: string;
  bannerColor: string;
  accentColor: string;
  seat: number;
  bet: number;
  hand: Card[];
  status: PlayerStatus;
  doubled: boolean;
  outcome: string | null;
  payout: number;
  ready: boolean;
  isBot: boolean;
};

export type Room = {
  id: string;
  name: string;
  hostId: number;
  hostName: string;
  isPrivate: boolean;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  fillWithBots: boolean;
  players: RoomPlayer[];
  dealerHand: Card[];
  deck: Card[];
  phase: RoomPhase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  turnUserId: number | null;
  turnSeat: number | null;
  botActAt: number | null;
  createdAt: number;
  updatedAt: number;
  paidOut: boolean;
};

const BETTING_MS = 20_000;
const TURN_MS = 30_000;
const RESULT_MS = 7_000;
const BOT_DELAY_MS = 1_000;

declare global {
  // eslint-disable-next-line no-var
  var __blackjackRooms: Map<string, Room> | undefined;
}

if (!global.__blackjackRooms) global.__blackjackRooms = new Map();

const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

/* ─────────────────────────────────────────────────
   Storage
   ───────────────────────────────────────────────── */

export function listRooms(): Room[] {
  const map = global.__blackjackRooms!;
  const now = Date.now();
  for (const [id, r] of map.entries()) {
    const idle = now - r.updatedAt;
    const hasHumans = r.players.some((p) => !p.isBot);
    if (r.players.length === 0 || !hasHumans || idle > ROOM_TTL_MS) {
      map.delete(id);
    }
  }
  return Array.from(map.values())
    .filter((r) => !r.isPrivate)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getRoom(id: string): Room | null {
  return global.__blackjackRooms!.get(id) ?? null;
}

export function saveRoom(r: Room) {
  r.updatedAt = Date.now();
  global.__blackjackRooms!.set(r.id, r);
}

export function deleteRoom(id: string) {
  global.__blackjackRooms!.delete(id);
}

function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/* ─────────────────────────────────────────────────
   Room create / join / leave
   ───────────────────────────────────────────────── */

export function createRoom(opts: {
  hostId: number;
  hostName: string;
  hostAvatar: string;
  hostBannerColor: string;
  hostAccentColor: string;
  name: string;
  isPrivate: boolean;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  fillWithBots: boolean;
}): Room {
  let id = generateRoomId();
  while (global.__blackjackRooms!.has(id)) id = generateRoomId();

  const now = Date.now();

  const room: Room = {
    id,
    name: opts.name,
    hostId: opts.hostId,
    hostName: opts.hostName,
    isPrivate: opts.isPrivate,
    maxPlayers: Math.max(2, Math.min(6, opts.maxPlayers)),
    minBet: Math.max(1, opts.minBet),
    maxBet: Math.max(opts.minBet, opts.maxBet),
    fillWithBots: opts.fillWithBots,
    players: [
      {
        userId: opts.hostId,
        username: opts.hostName,
        avatar: opts.hostAvatar,
        bannerColor: opts.hostBannerColor,
        accentColor: opts.hostAccentColor,
        seat: 0,
        bet: 0,
        hand: [],
        status: "waiting",
        doubled: false,
        outcome: null,
        payout: 0,
        ready: false,
        isBot: false,
      },
    ],
    dealerHand: [],
    deck: [],
    phase: "lobby",
    phaseStartedAt: now,
    phaseEndsAt: 0,
    turnUserId: null,
    turnSeat: null,
    botActAt: null,
    createdAt: now,
    updatedAt: now,
    paidOut: false,
  };

  saveRoom(room);
  return room;
}

export function joinRoom(
  roomId: string,
  user: {
    id: number;
    username: string;
    avatar: string;
    bannerColor: string;
    accentColor: string;
  }
): { ok: boolean; error?: string; room?: Room } {
  const room = getRoom(roomId);
  if (!room) return { ok: false, error: "Room not found" };

  if (room.players.some((p) => p.userId === user.id)) {
    return { ok: true, room };
  }

  if (room.players.length >= room.maxPlayers) {
    const bot = room.players.find((p) => p.isBot);
    if (bot) {
      room.players = room.players.filter((p) => p.userId !== bot.userId);
    } else {
      return { ok: false, error: "Room is full" };
    }
  }

  if (room.phase !== "lobby" && room.phase !== "betting") {
    return { ok: false, error: "Game already in progress" };
  }

  const usedSeats = new Set(room.players.map((p) => p.seat));
  let seat = 0;
  while (usedSeats.has(seat)) seat++;

  room.players.push({
    userId: user.id,
    username: user.username,
    avatar: user.avatar,
    bannerColor: user.bannerColor,
    accentColor: user.accentColor,
    seat,
    bet: 0,
    hand: [],
    status: "waiting",
    doubled: false,
    outcome: null,
    payout: 0,
    ready: false,
    isBot: false,
  });

  room.players.sort((a, b) => a.seat - b.seat);

  saveRoom(room);
  return { ok: true, room };
}

export function leaveRoom(roomId: string, userId: number): Room | null {
  const room = getRoom(roomId);
  if (!room) return null;

  const leavingPlayer = room.players.find((p) => p.userId === userId);
  if (!leavingPlayer) return room;

  const wasMyTurn = room.turnUserId === userId;
  const wasHost = room.hostId === userId;

  room.players = room.players.filter((p) => p.userId !== userId);

  if (room.players.length === 0) {
    deleteRoom(roomId);
    return null;
  }

  const hasHumans = room.players.some((p) => !p.isBot);
  if (!hasHumans) {
    deleteRoom(roomId);
    return null;
  }

  if (wasHost) {
    const newHost = room.players.find((p) => !p.isBot) ?? room.players[0];
    room.hostId = newHost.userId;
    room.hostName = newHost.username;
  }

  if (wasMyTurn && room.phase === "playing") {
    nextTurn(room);
    return room;
  }

  saveRoom(room);
  return room;
}

/* ─────────────────────────────────────────────────
   Game flow
   ───────────────────────────────────────────────── */

export function startBetting(room: Room) {
  const now = Date.now();
  room.phase = "betting";
  room.phaseStartedAt = now;
  room.phaseEndsAt = now + BETTING_MS;
  room.dealerHand = [];
  room.deck = [];
  room.turnUserId = null;
  room.turnSeat = null;
  room.botActAt = null;
  room.paidOut = false;

  for (const p of room.players) {
    p.bet = 0;
    p.hand = [];
    p.status = "betting";
    p.doubled = false;
    p.outcome = null;
    p.payout = 0;
  }
  saveRoom(room);
}

export function placeBet(room: Room, userId: number, amount: number) {
  if (room.phase !== "betting") return { ok: false, error: "Not in betting phase" };
  const p = room.players.find((x) => x.userId === userId);
  if (!p) return { ok: false, error: "Not in room" };
  if (p.bet > 0) return { ok: false, error: "Already bet" };
  if (amount < room.minBet || amount > room.maxBet) {
    return { ok: false, error: `Bet must be $${room.minBet}–$${room.maxBet}` };
  }
  p.bet = amount;
  saveRoom(room);
  return { ok: true };
}

function deal(room: Room) {
  const now = Date.now();
  const deck = buildDeck();
  room.deck = deck;
  room.dealerHand = [];
  room.players.forEach((p) => {
    p.hand = [];
    p.status = "playing";
    p.outcome = null;
    p.payout = 0;
    p.doubled = false;
  });

  for (let round = 0; round < 2; round++) {
    for (const p of room.players) {
      p.hand.push(room.deck.pop()!);
    }
    room.dealerHand.push(room.deck.pop()!);
  }

  for (const p of room.players) {
    if (isBlackjack(p.hand)) {
      p.status = "blackjack";
    }
  }

  room.phase = "playing";
  room.phaseStartedAt = now;
  room.paidOut = false;

  const next = room.players.find((p) => p.status === "playing");
  if (!next) {
    startDealerPhase(room);
  } else {
    setTurn(room, next);
  }

  saveRoom(room);
}

function setTurn(room: Room, player: RoomPlayer) {
  room.turnUserId = player.userId;
  room.turnSeat = player.seat;
  room.phaseEndsAt = Date.now() + TURN_MS;
  room.botActAt = player.isBot ? Date.now() + BOT_DELAY_MS : null;
}

function nextTurn(room: Room) {
  const next = room.players.find(
    (p) => p.status === "playing" && p.seat > (room.turnSeat ?? -1)
  );
  if (next) {
    setTurn(room, next);
    saveRoom(room);
  } else {
    startDealerPhase(room);
  }
}

function startDealerPhase(room: Room) {
  room.phase = "dealer";
  room.turnUserId = null;
  room.turnSeat = null;
  room.botActAt = null;
  while (shouldDealerHit(room.dealerHand)) {
    room.dealerHand.push(room.deck.pop()!);
  }
  resolveAll(room);
}

function resolveAll(room: Room) {
  room.phase = "result";
  room.phaseEndsAt = Date.now() + RESULT_MS;

  for (const p of room.players) {
    const pv = handValue(p.hand).total;
    const dv = handValue(room.dealerHand).total;

    if (pv > 21) {
      p.outcome = "bust";
      p.payout = 0;
    } else if (isBlackjack(p.hand) && !isBlackjack(room.dealerHand)) {
      p.outcome = "blackjack";
      p.payout = p.bet * 2.5;
    } else if (isBlackjack(p.hand) && isBlackjack(room.dealerHand)) {
      p.outcome = "push";
      p.payout = p.bet;
    } else if (isBlackjack(room.dealerHand) && !isBlackjack(p.hand)) {
      p.outcome = "lose";
      p.payout = 0;
    } else if (dv > 21) {
      p.outcome = "win";
      p.payout = p.bet * 2;
    } else if (pv > dv) {
      p.outcome = "win";
      p.payout = p.bet * 2;
    } else if (pv < dv) {
      p.outcome = "lose";
      p.payout = 0;
    } else {
      p.outcome = "push";
      p.payout = p.bet;
    }
    p.status = "done";
  }

  payOutRoom(room);
  saveRoom(room);
}

export function payOutRoom(room: Room) {
  if (room.paidOut) return;
  room.paidOut = true;

  const now = Date.now();
  for (const p of room.players) {
    if (p.payout > 0 && !p.isBot) {
      db.prepare(
        `UPDATE users SET balance = balance + ?,
                          highest_balance = MAX(highest_balance, balance + ?),
                          total_won = total_won + ?
         WHERE id = ?`
      ).run(p.payout, p.payout, p.payout, p.userId);

      db.prepare(
        `INSERT INTO drop_history
         (user_id, username, item_name, item_image, item_color, item_rarity,
          item_price, case_name, case_id, dropped_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        p.userId,
        p.username,
        `+$${(p.payout - p.bet).toFixed(2)}`,
        null,
        "#4ade80",
        "blackjack",
        p.payout,
        p.outcome === "blackjack" ? "Blackjack (BJ)" : "Blackjack",
        p.outcome,
        now
      );
    }
  }
}

export function playerAction(
  room: Room,
  userId: number,
  action: "hit" | "stand" | "double"
): { ok: boolean; error?: string; extraBet?: number } {
  if (room.phase !== "playing") return { ok: false, error: "Not in play" };
  const p = room.players.find((x) => x.userId === userId);
  if (!p) return { ok: false, error: "Not in room" };
  if (p.status !== "playing") return { ok: false, error: "Not your turn" };
  if (room.turnUserId !== userId) return { ok: false, error: "Not your turn" };

  if (action === "hit") {
    p.hand.push(room.deck.pop()!);
    if (isBust(p.hand)) {
      p.status = "bust";
      nextTurn(room);
    } else {
      room.phaseEndsAt = Date.now() + TURN_MS;
      room.botActAt = null;
      saveRoom(room);
    }
  } else if (action === "stand") {
    p.status = "standing";
    nextTurn(room);
  } else if (action === "double") {
    if (p.hand.length !== 2) {
      return { ok: false, error: "Can only double on first two cards" };
    }
    p.doubled = true;
    const extraBet = p.bet;
    p.bet *= 2;
    p.hand.push(room.deck.pop()!);
    if (isBust(p.hand)) {
      p.status = "bust";
    } else {
      p.status = "standing";
    }
    nextTurn(room);
    return { ok: true, extraBet };
  }

  return { ok: true };
}

/* ─────────────────────────────────────────────────
   Tick
   ───────────────────────────────────────────────── */

export function tickRoom(roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;
  const now = Date.now();

  // ── BETTING PHASE ───────────────────────────────
  if (room.phase === "betting") {
    const humans = room.players.filter((p) => !p.isBot);
    const humansWhoBet = humans.filter((p) => p.bet > 0);
    const allHumansBet =
      humans.length > 0 && humansWhoBet.length === humans.length;

    if (allHumansBet) {
      const humanBets = humansWhoBet.map((p) => p.bet);
      const avgHuman = humanBets.reduce((s, b) => s + b, 0) / humanBets.length;

      let changed = false;
      for (const p of room.players) {
        if (p.isBot && p.bet === 0) {
          const mult = 0.8 + Math.random() * 0.4;
          const raw = Math.round(avgHuman * mult);
          p.bet = Math.max(room.minBet, Math.min(room.maxBet, raw));
          changed = true;
        }
      }
      if (changed) saveRoom(room);
    }

    const everyoneBet = room.players.every((p) => p.bet > 0);
    if (everyoneBet) {
      room.players.forEach((p, i) => (p.seat = i));
      deal(room);
      return;
    }

    if (now >= room.phaseEndsAt) {
      const before = room.players.length;
      room.players = room.players.filter(
        (p) => p.bet > 0 || p.userId === room.hostId
      );
      if (room.players.length !== before) {
        room.players.forEach((p, i) => (p.seat = i));
      }

      const hasHumans = room.players.some((p) => !p.isBot);
      if (!hasHumans || room.players.filter((p) => p.bet > 0).length === 0) {
        deleteRoom(roomId);
        return;
      }

      deal(room);
    }
    return;
  }

  // ── PLAYING PHASE ───────────────────────────────
  if (room.phase === "playing") {
    const current = room.players.find((p) => p.userId === room.turnUserId);

    if (current?.isBot && room.botActAt != null && now >= room.botActAt) {
      const { total } = handValue(current.hand);

      if (total < 17) {
        current.hand.push(room.deck.pop()!);
        if (isBust(current.hand)) {
          current.status = "bust";
          nextTurn(room);
        } else {
          room.botActAt = Date.now() + BOT_DELAY_MS;
          saveRoom(room);
        }
      } else {
        current.status = "standing";
        nextTurn(room);
      }
      return;
    }

    if (now >= room.phaseEndsAt && !current?.isBot) {
      if (current && current.status === "playing") {
        current.status = "standing";
      }
      nextTurn(room);
    }
    return;
  }

  // ── RESULT PHASE ────────────────────────────────
  if (room.phase === "result" && now >= room.phaseEndsAt) {
    const hasHumans = room.players.some((p) => !p.isBot);
    if (!hasHumans) {
      deleteRoom(roomId);
      return;
    }

    room.phase = "lobby";
    room.phaseEndsAt = 0;
    room.dealerHand = [];
    room.deck = [];
    room.turnUserId = null;
    room.turnSeat = null;
    room.botActAt = null;
    room.paidOut = false;

    for (const p of room.players) {
      p.bet = 0;
      p.hand = [];
      p.status = "waiting";
      p.doubled = false;
      p.outcome = null;
      p.payout = 0;
    }

    saveRoom(room);
    return;
  }
}

/* ─────────────────────────────────────────────────
   Public serialization
   ───────────────────────────────────────────────── */

export function publicRoom(room: Room, viewerId: number) {
  const hideDealer = room.phase === "playing" && room.dealerHand.length >= 2;

  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    hostName: room.hostName,
    isPrivate: room.isPrivate,
    maxPlayers: room.maxPlayers,
    minBet: room.minBet,
    maxBet: room.maxBet,
    fillWithBots: room.fillWithBots,
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    turnUserId: room.turnUserId,
    turnSeat: room.turnSeat,
    createdAt: room.createdAt,
    players: room.players.map((p) => {
      let revealHand: boolean;

      if (p.isBot) {
        revealHand = room.phase === "result" || room.phase === "dealer";
      } else {
        revealHand =
          p.userId === viewerId ||
          room.phase === "result" ||
          room.phase === "dealer" ||
          p.status === "bust" ||
          p.status === "blackjack" ||
          p.status === "done";
      }

      return {
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        bannerColor: p.bannerColor,
        accentColor: p.accentColor,
        seat: p.seat,
        bet: p.bet,
        hand: revealHand
          ? p.hand
          : p.hand.map(() => ({ hidden: true })),
        status: p.status,
        doubled: p.doubled,
        outcome: p.outcome,
        payout: p.payout,
        ready: p.ready,
        isBot: p.isBot,
        isMe: p.userId === viewerId,
      };
    }),
    dealerHand: room.dealerHand.map((c, i) => {
      if (i === 1 && hideDealer) return { hidden: true };
      return c;
    }),
  };
}