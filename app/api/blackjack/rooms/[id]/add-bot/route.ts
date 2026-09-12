import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRoom, saveRoom, publicRoom } from "@/lib/blackjack-rooms";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if (room.hostId !== user.id) {
    return NextResponse.json({ error: "Only host can add bots" }, { status: 403 });
  }

  if (room.phase !== "lobby") {
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
  }

  if (room.players.length >= room.maxPlayers) {
    return NextResponse.json({ error: "Room is full" }, { status: 400 });
  }

  const usedSeats = new Set(room.players.map((p) => p.seat));
  let seat = 0;
  while (usedSeats.has(seat)) seat++;

  const botCount = room.players.filter((p) => p.isBot).length;

  room.players.push({
    userId: -1000 - botCount - Math.floor(Math.random() * 1000),
    username: `Bot #${botCount + 1}`,
    avatar: "🤖",
    bannerColor: "#8b5cf6",
    accentColor: "#a78bfa",
    seat,
    bet: 0,
    hand: [],
    status: "waiting",
    doubled: false,
    outcome: null,
    payout: 0,
    ready: false,
    isBot: true,
  });

  saveRoom(room);

  return NextResponse.json({ ok: true, room: publicRoom(room, user.id) });
}