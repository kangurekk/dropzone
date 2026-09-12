import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const dmRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM messages
       WHERE receiver_id = ? AND read_at IS NULL`
    )
    .get(user.id) as { c: number };

  const friendReqRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM friendships
       WHERE friend_id = ? AND status = 'pending' AND initiator_id != ?`
    )
    .get(user.id, user.id) as { c: number };

  const friendMsgRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM messages
       WHERE receiver_id = ? AND read_at IS NULL AND sender_id IN (
         SELECT CASE
           WHEN f.user_id = ? THEN f.friend_id
           ELSE f.user_id
         END
         FROM friendships f
         WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
       )`
    )
    .get(user.id, user.id, user.id, user.id) as { c: number };

  return NextResponse.json({
    unreadDMs: dmRow.c ?? 0,
    unreadFriendMessages: friendMsgRow.c ?? 0,
    pendingFriendRequests: friendReqRow.c ?? 0,
  });
}