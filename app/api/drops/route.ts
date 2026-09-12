import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "30", 10),
    100
  );

  const rows = db
    .prepare(
      `SELECT id, username, item_name, item_image, item_color, item_rarity,
              item_price, case_name, dropped_at
       FROM drop_history
       ORDER BY dropped_at DESC
       LIMIT ?`
    )
    .all(limit) as any[];

  return NextResponse.json({
    drops: rows.map((r) => ({
      id: r.id,
      username: r.username,
      itemName: r.item_name,
      itemImage: r.item_image,
      itemColor: r.item_color,
      itemRarity: r.item_rarity,
      itemPrice: r.item_price,
      caseName: r.case_name,
      droppedAt: r.dropped_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const {
    itemName,
    itemImage,
    itemColor,
    itemRarity,
    itemPrice,
    caseName,
    caseId,
  } = body;

  if (typeof itemName !== "string" || typeof itemPrice !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const now = Date.now();
  const result = db
    .prepare(
      `INSERT INTO drop_history
       (user_id, username, item_name, item_image, item_color, item_rarity,
        item_price, case_name, case_id, dropped_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      user.id,
      user.username,
      itemName,
      itemImage ?? null,
      itemColor ?? null,
      itemRarity ?? null,
      itemPrice,
      caseName ?? null,
      caseId ?? null,
      now
    );

  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}