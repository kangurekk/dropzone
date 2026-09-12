import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { rollPlinko, isValidRisk, isValidRows } from "@/lib/plinko";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await request.json();
  const { bet, risk, rows } = body;

  if (
    typeof bet !== "number" ||
    !isFinite(bet) ||
    bet <= 0 ||
    !isValidRisk(risk) ||
    !isValidRows(rows)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = db.transaction(() => {
      const u = db
        .prepare("SELECT balance FROM users WHERE id = ?")
        .get(user.id) as { balance: number };

      if (u.balance < bet) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const { slot, multiplier } = rollPlinko(risk, rows);
      const payout = Math.round(bet * multiplier * 100) / 100;

      const newBalance = Math.round((u.balance - bet + payout) * 100) / 100;

      db.prepare(
        `UPDATE users
         SET balance = ?,
             highest_balance = MAX(highest_balance, ?),
             total_wagered = total_wagered + ?,
             total_won = total_won + ?
         WHERE id = ?`
      ).run(newBalance, newBalance, bet, payout, user.id);

      return { slot, multiplier, payout, newBalance, bet };
    })();

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Not enough balance" },
        { status: 400 }
      );
    }
    console.error("[plinko] ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}