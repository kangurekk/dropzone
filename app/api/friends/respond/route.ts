import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const friendshipId = typeof body.friendshipId === "number" ? body.friendshipId : NaN;
  const action = body.action;

  if (!isFinite(friendshipId) || (action !== "accept" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const row = db
    .prepare("SELECT * FROM friendships WHERE id = ?")
    .get(friendshipId) as any;

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the receiver can accept/reject
  if (row.friend_id !== user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const status = action === "accept" ? "accepted" : "rejected";
  db.prepare("UPDATE friendships SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    Date.now(),
    friendshipId
  );

  return NextResponse.json({ ok: true, status });
}