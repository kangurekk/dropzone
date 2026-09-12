import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { listRooms, createRoom } from "@/lib/blackjack-rooms";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const rooms = listRooms().map((r) => {
    const host = r.players.find((p) => p.userId === r.hostId);
    return {
      id: r.id,
      name: r.name,
      hostName: r.hostName,
      hostAvatar: host?.avatar ?? "◆",
      hostBannerColor: host?.bannerColor ?? "#8b5cf6",
      hostAccentColor: host?.accentColor ?? "#a78bfa",
      playerCount: r.players.length,
      maxPlayers: r.maxPlayers,
      minBet: r.minBet,
      maxBet: r.maxBet,
      phase: r.phase,
      fillWithBots: r.fillWithBots,
    };
  });

  return NextResponse.json({ rooms });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const row = db
    .prepare(
      "SELECT avatar, banner_color, accent_color FROM users WHERE id = ?"
    )
    .get(user.id) as
    | {
        avatar: string | null;
        banner_color: string | null;
        accent_color: string | null;
      }
    | undefined;

  const body = await request.json();
  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim().slice(0, 30)
      : `${user.username}'s room`;

  const maxPlayers = Math.max(2, Math.min(6, Number(body.maxPlayers) || 4));
  const minBet = Math.max(1, Number(body.minBet) || 1);
  const maxBet = Math.max(minBet, Number(body.maxBet) || 100);
  const isPrivate = Boolean(body.isPrivate);
  const fillWithBots = Boolean(body.fillWithBots);

  const room = createRoom({
    hostId: user.id,
    hostName: user.username,
    hostAvatar: row?.avatar ?? "◆",
    hostBannerColor: row?.banner_color ?? "#8b5cf6",
    hostAccentColor: row?.accent_color ?? "#a78bfa",
    name,
    isPrivate,
    maxPlayers,
    minBet,
    maxBet,
    fillWithBots,
  });

  return NextResponse.json({ ok: true, roomId: room.id });
}