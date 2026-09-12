import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const { caseId, caseName, itemName, itemPrice, casePrice } = body;

  if (
    typeof caseId !== "string" ||
    typeof caseName !== "string" ||
    typeof itemName !== "string" ||
    typeof itemPrice !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const now = Date.now();

  db.prepare(
    `INSERT INTO case_openings
     (user_id, case_id, case_name, item_name, item_price, opened_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user.id, caseId, caseName, itemName, itemPrice, now);

  db.prepare(
    `UPDATE users
     SET cases_opened = cases_opened + 1,
         total_won = total_won + ?,
         total_wagered = total_wagered + ?
     WHERE id = ?`
  ).run(itemPrice, typeof casePrice === "number" ? casePrice : 0, user.id);

  return NextResponse.json({ ok: true });
}