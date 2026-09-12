import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const targetId = typeof body.userId === "number" ? body.userId : NaN;

  if (!isFinite(targetId) || targetId === user.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const target = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(targetId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Already exists in any direction?
  const existing = db
    .prepare(
      `SELECT id, status, initiator_id FROM friendships
       WHERE (user_id = ? AND friend_id = ?)
          OR (user_id = ? AND friend_id = ?)
       LIMIT 1`
    )
    .get(user.id, targetId, targetId, user.id) as any;

  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "Already friends" }, { status: 400 });
    }

    // If they already sent me a request — accept it instead
    if (existing.status === "pending" && existing.initiator_id === targetId) {
      db.prepare(
        "UPDATE friendships SET status = 'accepted', updated_at = ? WHERE id = ?"
      ).run(Date.now(), existing.id);
      return NextResponse.json({ ok: true, accepted: true });
    }

    // If pending from me — already sent
    if (existing.status === "pending" && existing.initiator_id === user.id) {
      return NextResponse.json({ error: "Request already sent" }, { status: 400 });
    }

    // Rejected — retry by updating
    db.prepare(
      `UPDATE friendships
       SET status = 'pending', initiator_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(user.id, Date.now(), existing.id);
    return NextResponse.json({ ok: true });
  }

  const now = Date.now();
  db.prepare(
    `INSERT INTO friendships (user_id, friend_id, status, initiator_id, created_at, updated_at)
     VALUES (?, ?, 'pending', ?, ?, ?)`
  ).run(user.id, targetId, user.id, now, now);

  return NextResponse.json({ ok: true });
}