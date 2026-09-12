import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { areFriends } from "@/lib/friends";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { userId } = await params;
  const otherId = parseInt(userId, 10);
  if (!isFinite(otherId) || otherId === user.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  if (!areFriends(user.id, otherId)) {
    return NextResponse.json({ error: "Not friends" }, { status: 403 });
  }

  const rows = db
    .prepare(
      `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.created_at, m.read_at,
            u.username, u.avatar, u.banner_color, u.accent_color
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.id ASC
       LIMIT 200`
    )
    .all(user.id, otherId, otherId, user.id) as any[];

  // Mark as read
  db.prepare(
    `UPDATE messages
     SET read_at = ?
     WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL`
  ).run(Date.now(), user.id, otherId);

  return NextResponse.json({
    messages: rows.map((r) => ({
        id: r.id,
        senderId: r.sender_id,
        receiverId: r.receiver_id,
        username: r.username,
        avatar: r.avatar ?? "◆",
        bannerColor: r.banner_color ?? "#8b5cf6",
        accentColor: r.accent_color ?? "#a78bfa",
        content: r.content,
        createdAt: r.created_at,
        readAt: r.read_at,
    })),
    });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { userId } = await params;
  const otherId = parseInt(userId, 10);
  if (!isFinite(otherId) || otherId === user.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  if (!areFriends(user.id, otherId)) {
    return NextResponse.json({ error: "Not friends" }, { status: 403 });
  }

  const body = await request.json();
  const content =
    typeof body.content === "string" ? body.content.trim() : "";

  if (content.length < 1 || content.length > 500) {
    return NextResponse.json(
      { error: "Message must be 1–500 characters" },
      { status: 400 }
    );
  }

  const now = Date.now();
  const result = db
    .prepare(
      `INSERT INTO messages (sender_id, receiver_id, content, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(user.id, otherId, content, now);

  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}