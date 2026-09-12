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
  if (!isFinite(targetId)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  db.prepare(
    `DELETE FROM friendships
     WHERE (user_id = ? AND friend_id = ?)
        OR (user_id = ? AND friend_id = ?)`
  ).run(user.id, targetId, targetId, user.id);

  return NextResponse.json({ ok: true });
}