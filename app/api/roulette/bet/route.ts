import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { placeBet, type BetType } from "@/lib/roulette";
import { enforceLimit } from "@/lib/rate-limit";

const VALID_TYPES: BetType[] = [
  "red", "black", "green", "even", "odd",
  "low", "high", "dozen1", "dozen2", "dozen3", "number",
];

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  // ── Rate limit: 40 zakładów na minutę per user ───────────────
  // Runda ruletki trwa ~30-60s. Gracz może postawić kilka
  // zakładów na rundę (split, kilka typów). 40/min daje zapas.
  const blocked = enforceLimit(`roulette-bet:${user.id}`, 40, 60_000);
  if (blocked) return blocked;

  const body = await request.json();
  const { type, number, amount } = body;

  if (
    !VALID_TYPES.includes(type) ||
    typeof amount !== "number" ||
    !isFinite(amount) ||
    amount < 1
  ) {
    return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
  }

  if (type === "number" && (typeof number !== "number" || number < 0 || number > 36)) {
    return NextResponse.json({ error: "Invalid number" }, { status: 400 });
  }

  try {
    const newBalance = db.transaction(() => {
      const u = db
        .prepare("SELECT balance FROM users WHERE id = ?")
        .get(user.id) as { balance: number };

      if (u.balance < amount) throw new Error("INSUFFICIENT_BALANCE");

      const nb = Math.round((u.balance - amount) * 100) / 100;

      db.prepare(
        "UPDATE users SET balance = ?, total_wagered = total_wagered + ? WHERE id = ?"
      ).run(nb, amount, user.id);

      return nb;
    })();

    const result = placeBet({
      userId: user.id,
      username: user.username,
      type,
      number,
      amount,
    });

    if (!result.ok) {
      // Refund
      db.prepare(
        "UPDATE users SET balance = balance + ?, total_wagered = total_wagered - ? WHERE id = ?"
      ).run(amount, amount, user.id);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, newBalance });
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Not enough balance" }, { status: 400 });
    }
    console.error("[roulette bet] ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}