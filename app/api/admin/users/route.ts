import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = db
    .prepare(
      `SELECT id, username, balance, cases_opened, is_admin, created_at,
              avatar, banner_color, accent_color
       FROM users ORDER BY created_at DESC`
    )
    .all() as any[];

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      balance: u.balance,
      casesOpened: u.cases_opened,
      isAdmin: u.is_admin === 1,
      createdAt: u.created_at,
      avatar: u.avatar,
      bannerColor: u.banner_color,
      accentColor: u.accent_color,
    })),
  });
}