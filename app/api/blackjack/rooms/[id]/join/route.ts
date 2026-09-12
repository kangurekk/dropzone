import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { joinRoom, publicRoom } from "@/lib/blackjack-rooms";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await params;

  const row = db
    .prepare("SELECT avatar, banner_color, accent_color FROM users WHERE id = ?")
    .get(user.id) as
    | { avatar: string | null; banner_color: string | null; accent_color: string | null }
    | undefined;

  const result = joinRoom(id, {
    id: user.id,
    username: user.username,
    avatar: row?.avatar ?? "◆",
    bannerColor: row?.banner_color ?? "#8b5cf6",
    accentColor: row?.accent_color ?? "#a78bfa",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, room: publicRoom(result.room!, user.id) });
}