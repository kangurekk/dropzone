import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRoom, saveRoom, publicRoom } from "@/lib/blackjack-rooms";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if (room.hostId !== user.id) {
    return NextResponse.json({ error: "Only host" }, { status: 403 });
  }

  if (room.phase !== "lobby") {
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
  }

  const body = await request.json();
  const seat = typeof body.seat === "number" ? body.seat : -1;

  const bot = room.players.find((p) => p.seat === seat && p.isBot);
  if (!bot) {
    return NextResponse.json({ error: "No bot at that seat" }, { status: 400 });
  }

  room.players = room.players.filter((p) => p.userId !== bot.userId);
  saveRoom(room);

  return NextResponse.json({ ok: true, room: publicRoom(room, user.id) });
}