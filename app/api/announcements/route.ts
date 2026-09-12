import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminUser } from "@/lib/admin";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — public, returns active announcements
export async function GET() {
  const now = Date.now();
  const rows = db
    .prepare(
      `SELECT id, message, type, created_at, expires_at
       FROM announcements
       WHERE active = 1
         AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY created_at DESC`
    )
    .all(now) as {
    id: number;
    message: string;
    type: string;
    created_at: number;
    expires_at: number | null;
  }[];

  return NextResponse.json({
    announcements: rows.map((r) => ({
      id: r.id,
      message: r.message,
      type: r.type,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    })),
  });
}

// POST — admin only, creates a new announcement
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { message, type, durationHours } = body;

  if (typeof message !== "string" || message.trim().length < 3) {
    return NextResponse.json({ error: "Message too short" }, { status: 400 });
  }
  if (message.length > 300) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const allowedTypes = ["info", "success", "warning", "error"];
  const safeType = allowedTypes.includes(type) ? type : "info";

  const now = Date.now();
  const expiresAt =
    typeof durationHours === "number" && durationHours > 0
      ? now + durationHours * 60 * 60 * 1000
      : null;

  const result = db
    .prepare(
      `INSERT INTO announcements (message, type, active, created_at, created_by, expires_at)
       VALUES (?, ?, 1, ?, ?, ?)`
    )
    .run(message.trim(), safeType, now, admin.id, expiresAt);

  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}