import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import {
  startHand,
  setSession,
  getSession,
  clearSession,
} from "@/lib/blackjack";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  // Clear any previous session
  clearSession(user.id);

  const body = await request.json();
  const bet = typeof body.bet === "number" ? body.bet : 0;

  if (!isFinite(bet) || bet < 1) {
    return NextResponse.json({ error: "Minimum bet is $1" }, { status: 400 });
  }

  try {
    // Deduct bet first
    const newBalance = db.transaction(() => {
      const u = db
        .prepare("SELECT balance FROM users WHERE id = ?")
        .get(user.id) as { balance: number };

      if (u.balance < bet) throw new Error("INSUFFICIENT_BALANCE");

      const nb = Math.round((u.balance - bet) * 100) / 100;

      db.prepare(
        "UPDATE users SET balance = ?, total_wagered = total_wagered + ? WHERE id = ?"
      ).run(nb, bet, user.id);

      return nb;
    })();

    const session = startHand(user.id, user.username, bet);
    setSession(session);

    // If natural blackjack, resolve immediately (pay out now)
    if (session.done && session.outcome && session.payout != null) {
      db.transaction(() => {
        if (session.payout! > 0) {
          db.prepare(
            `UPDATE users SET balance = balance + ?,
                              highest_balance = MAX(highest_balance, balance + ?),
                              total_won = total_won + ?
             WHERE id = ?`
          ).run(session.payout!, session.payout!, session.payout!, user.id);
        }
      })();
    }

    const finalBalance = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(user.id) as { balance: number };

    return NextResponse.json({
      ok: true,
      newBalance: finalBalance.balance,
      session: publicSession(session),
    });
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Not enough balance" },
        { status: 400 }
      );
    }
    console.error("[blackjack start] ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function publicSession(s: any) {
  return {
    playerHand: s.playerHand,
    dealerHand: s.dealerHand,
    bet: s.bet,
    doubled: s.doubled,
    done: s.done,
    outcome: s.outcome ?? null,
    payout: s.payout ?? null,
  };
}