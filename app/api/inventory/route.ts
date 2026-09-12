import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const rows = db
    .prepare(
      `SELECT id, item_id, name, image, color, rarity, price, dropped_at
       FROM inventory
       WHERE user_id = ?
       ORDER BY dropped_at DESC`
    )
    .all(user.id) as any[];

  return NextResponse.json({
    items: rows.map((r) => ({
      uid: String(r.id),
      id: r.item_id,
      name: r.name,
      image: r.image,
      color: r.color,
      rarity: r.rarity,
      price: r.price,
      droppedAt: r.dropped_at,
    })),
  });
}