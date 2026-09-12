import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import db from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (!isFinite(userId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const { action, amount } = body;

  const target = db
    .prepare("SELECT id, username, balance FROM users WHERE id = ?")
    .get(userId) as { id: number; username: string; balance: number } | undefined;

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const num = typeof amount === "number" && isFinite(amount) ? amount : 0;

  switch (action) {
    case "give":
      db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(
        num,
        userId
      );
      break;

    case "take":
      db.prepare(
        "UPDATE users SET balance = MAX(0, balance - ?) WHERE id = ?"
      ).run(num, userId);
      break;

    case "set":
      db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(
        Math.max(0, num),
        userId
      );
      break;

    case "reset":
      db.prepare(
        "UPDATE users SET balance = 20, cases_opened = 0, total_wagered = 0, total_won = 0 WHERE id = ?"
      ).run(userId);
      break;

    case "toggle_admin":
      // Safety: cannot demote yourself
      if (userId === admin.id) {
        return NextResponse.json(
          { error: "You can't change your own admin status" },
          { status: 400 }
        );
      }
      db.prepare(
        "UPDATE users SET is_admin = CASE WHEN is_admin = 1 THEN 0 ELSE 1 END WHERE id = ?"
      ).run(userId);
      break;

    case "delete":
      if (userId === admin.id) {
        return NextResponse.json(
          { error: "You can't delete yourself" },
          { status: 400 }
        );
      }
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}