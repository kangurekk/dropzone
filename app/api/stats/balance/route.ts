import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const row = db
    .prepare("SELECT balance FROM users WHERE id = ?")
    .get(user.id) as { balance: number } | undefined;

  return NextResponse.json({ balance: row?.balance ?? 0 });
}

// Atomowy update — delta może być dodatnia lub ujemna
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const delta = typeof body.delta === "number" ? body.delta : NaN;
  if (!isFinite(delta)) {
    return NextResponse.json({ error: "Invalid delta" }, { status: 400 });
  }

  const tx = db.transaction(() => {
    const row = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(user.id) as { balance: number };

    const next = Math.max(0, row.balance + delta);

    db.prepare(
      "UPDATE users SET balance = ?, highest_balance = MAX(highest_balance, ?) WHERE id = ?"
    ).run(next, next, user.id);

    return next;
  });

  const newBalance = tx();
  return NextResponse.json({ balance: newBalance });
}