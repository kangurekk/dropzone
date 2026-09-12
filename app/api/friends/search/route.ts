import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.avatar, u.banner_color, u.accent_color,
              f.status as friend_status,
              f.initiator_id as friend_initiator
       FROM users u
       LEFT JOIN friendships f
         ON (f.user_id = u.id AND f.friend_id = ?)
          OR (f.friend_id = u.id AND f.user_id = ?)
       WHERE u.id != ?
         AND LOWER(u.username) LIKE ?
       LIMIT 20`
    )
    .all(user.id, user.id, user.id, `%${q}%`) as any[];

  return NextResponse.json({
    users: rows.map((r) => ({
        id: r.id,
        username: r.username,
        avatar: r.avatar ?? "◆",
        accentColor: r.accent_color ?? "#a78bfa",
        bannerColor: r.banner_color ?? "#8b5cf6",
        friendStatus: r.friend_status ?? null,
        friendInitiator: r.friend_initiator ?? null,
    })),
    });
}