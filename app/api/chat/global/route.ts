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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "60", 10), 100);
  const before = searchParams.get("before");

  let rows: any[];

  if (before) {
    const beforeId = parseInt(before, 10);
    rows = db
      .prepare(
        `SELECT m.id, m.sender_id, m.content, m.created_at,
                u.username, u.avatar, u.banner_color, u.accent_color
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.receiver_id IS NULL AND m.id < ?
         ORDER BY m.id DESC
         LIMIT ?`
      )
      .all(beforeId, limit) as any[];
  } else {
    rows = db
      .prepare(
        `SELECT m.id, m.sender_id, m.content, m.created_at,
                u.username, u.avatar, u.banner_color, u.accent_color
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.receiver_id IS NULL
         ORDER BY m.id DESC
         LIMIT ?`
      )
      .all(limit) as any[];
  }

  return NextResponse.json({
    messages: rows.reverse().map((r) => ({
      id: r.id,
      senderId: r.sender_id,
      username: r.username,
      avatar: r.avatar ?? "◆",
      bannerColor: r.banner_color ?? "#8b5cf6",
      accentColor: r.accent_color ?? "#a78bfa",
      content: r.content,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
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
       VALUES (?, NULL, ?, ?)`
    )
    .run(user.id, content, now);

  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}