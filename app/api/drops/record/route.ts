import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const { itemName, itemImage, itemColor, itemRarity, itemPrice, caseName, caseId } = body;

  if (typeof itemName !== "string" || typeof itemPrice !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  db.prepare(
    `INSERT INTO drop_history
     (user_id, username, item_name, item_image, item_color, item_rarity,
      item_price, case_name, case_id, dropped_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user.id,
    user.username,
    itemName,
    itemImage ?? null,
    itemColor ?? null,
    itemRarity ?? null,
    itemPrice,
    caseName ?? null,
    caseId ?? null,
    Date.now()
  );

  return NextResponse.json({ ok: true });
}