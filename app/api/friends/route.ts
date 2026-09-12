import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  // Accepted friends — user may be on either side
  const friends = db
    .prepare(
      `SELECT f.id, f.user_id, f.friend_id, f.status, f.initiator_id, f.created_at, f.updated_at,
              u.id as other_id, u.username, u.avatar, u.banner_color, u.accent_color
       FROM friendships f
       JOIN users u ON u.id = CASE
         WHEN f.user_id = ? THEN f.friend_id
         ELSE f.user_id
       END
       WHERE (f.user_id = ? OR f.friend_id = ?)
         AND f.status = 'accepted'
       ORDER BY u.username ASC`
    )
    .all(user.id, user.id, user.id) as any[];

  // Incoming requests — I'm the friend_id, initiator is other
  const incoming = db
    .prepare(
      `SELECT f.id, f.user_id, f.friend_id, f.status, f.initiator_id, f.created_at,
              u.id as other_id, u.username, u.avatar, u.accent_color
       FROM friendships f
       JOIN users u ON u.id = f.initiator_id
       WHERE f.friend_id = ? AND f.status = 'pending' AND f.initiator_id != ?
       ORDER BY f.created_at DESC`
    )
    .all(user.id, user.id) as any[];

  // Outgoing requests — I'm the initiator
  const outgoing = db
    .prepare(
      `SELECT f.id, f.user_id, f.friend_id, f.status, f.initiator_id, f.created_at,
              u.id as other_id, u.username, u.avatar, u.accent_color
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.initiator_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`
    )
    .all(user.id) as any[];

    const mapRow = (r: any) => ({
        friendshipId: r.id,
        userId: r.other_id,
        username: r.username,
        avatar: r.avatar ?? "◆",
        accentColor: r.accent_color ?? "#a78bfa",
        bannerColor: r.banner_color ?? "#8b5cf6",
        since: r.updated_at ?? r.created_at,
    });

  return NextResponse.json({
    friends: friends.map(mapRow),
    incoming: incoming.map(mapRow),
    outgoing: outgoing.map(mapRow),
  });
}