import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRoom, startBetting, publicRoom } from "@/lib/blackjack-rooms";

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
    return NextResponse.json({ error: "Only host can start" }, { status: 403 });
  }

  if (room.phase !== "lobby" && room.phase !== "result") {
    return NextResponse.json({ error: "Already started" }, { status: 400 });
  }

  if (room.players.length < 1) {
    return NextResponse.json({ error: "No players" }, { status: 400 });
  }

  startBetting(room);

  return NextResponse.json({ ok: true, room: publicRoom(room, user.id) });
}