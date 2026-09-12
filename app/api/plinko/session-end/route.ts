import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const profit = typeof body.profit === "number" ? body.profit : 0;
  const drops = typeof body.drops === "number" ? body.drops : 0;

  // Ignore tiny or empty sessions
  if (Math.abs(profit) < 0.01 || drops === 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const now = Date.now();
  const isWin = profit > 0;

  db.prepare(
    `INSERT INTO drop_history
     (user_id, username, item_name, item_image, item_color, item_rarity,
      item_price, case_name, case_id, dropped_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user.id,
    user.username,
    `${isWin ? "+" : "-"}$${Math.abs(profit).toFixed(2)}`,
    null,
    isWin ? "#4ade80" : "#eb4b4b",
    "session",
    profit,
    "Plinko Session",
    null,
    now
  );

  return NextResponse.json({ ok: true });
}