import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  try {
    const u = db
      .prepare(
        `SELECT id, username, balance, avatar, avatar_focal_x, avatar_focal_y,
                avatar_zoom, banner_color, accent_color, bio,
                cases_opened, highest_balance, total_wagered, total_won,
                is_admin, created_at
         FROM users WHERE id = ?`
      )
      .get(user.id) as any;

    if (!u) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Most opened case
    let mostOpened: { case_name: string; c: number } | undefined;
    try {
      mostOpened = db
        .prepare(
          `SELECT case_name, COUNT(*) as c
           FROM case_openings
           WHERE user_id = ?
           GROUP BY case_id
           ORDER BY c DESC
           LIMIT 1`
        )
        .get(user.id) as { case_name: string; c: number } | undefined;
    } catch {
      mostOpened = undefined;
    }

    // Best pull
    let topSkin:
      | { item_name: string; item_price: number; opened_at: number }
      | undefined;
    try {
      topSkin = db
        .prepare(
          `SELECT item_name, item_price, opened_at
           FROM case_openings
           WHERE user_id = ?
           ORDER BY item_price DESC
           LIMIT 1`
        )
        .get(user.id) as
        | { item_name: string; item_price: number; opened_at: number }
        | undefined;
    } catch {
      topSkin = undefined;
    }

    return NextResponse.json({
      username: u.username,
      balance: u.balance,
      highestBalance: u.highest_balance ?? u.balance,
      casesOpened: u.cases_opened ?? 0,
      totalWagered: u.total_wagered ?? 0,
      totalWon: u.total_won ?? 0,
      memberSince: u.created_at,
      avatar: u.avatar ?? "◆",
      avatarFocalX: u.avatar_focal_x ?? 50,
      avatarFocalY: u.avatar_focal_y ?? 50,
      avatarZoom: u.avatar_zoom ?? 1,
      bannerColor: u.banner_color ?? "#8b5cf6",
      accentColor: u.accent_color ?? "#a78bfa",
      bio: u.bio ?? "",
      mostOpenedCase: mostOpened
        ? { name: mostOpened.case_name, count: mostOpened.c }
        : null,
      topSkin: topSkin
        ? {
            name: topSkin.item_name,
            price: topSkin.item_price,
            pulledAt: topSkin.opened_at,
          }
        : null,
    });
  } catch (err) {
    console.error("[stats] ERROR:", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err) },
      { status: 500 }
    );
  }
}