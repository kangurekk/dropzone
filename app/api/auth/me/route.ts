import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });

  const row = db
    .prepare(
      `SELECT id, username, balance, avatar, banner_color, accent_color, bio,
              avatar_focal_x, avatar_focal_y, avatar_zoom
      FROM users WHERE id = ?`
    )
    .get(user.id) as any;

  return NextResponse.json({
    user: row
      ? {
          id: row.id,
          username: row.username,
          balance: row.balance,
          avatar: row.avatar ?? "◆",
          avatarFocalX: row.avatar_focal_x ?? 50,
          avatarFocalY: row.avatar_focal_y ?? 50,
          avatarZoom: row.avatar_zoom ?? 1,
          bannerColor: row.banner_color,
          accentColor: row.accent_color,
          bio: row.bio,
        }
      : null,
  });
}