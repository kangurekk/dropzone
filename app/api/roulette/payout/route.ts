import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { getState, payoutFor } from "@/lib/roulette";

declare global {
  // eslint-disable-next-line no-var
  var __roulettePaid: Set<number> | undefined;
}

if (!global.__roulettePaid) global.__roulettePaid = new Set();

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const state = getState();
  const winning = state.winningNumber;

  if (winning == null || state.phase !== "result") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (global.__roulettePaid!.has(state.roundId)) {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  global.__roulettePaid!.add(state.roundId);

  try {
    const result = db.transaction(() => {
      const winners: { username: string; amount: number }[] = [];
      let totalPayout = 0;

      for (const bet of state.bets) {
        const payout = payoutFor(bet, winning);
        if (payout > 0) {
          db.prepare(
            `UPDATE users SET balance = balance + ?,
                              highest_balance = MAX(highest_balance, balance + ?),
                              total_won = total_won + ?
             WHERE id = ?`
          ).run(payout, payout, payout, bet.userId);

          db.prepare(
            `INSERT INTO drop_history
             (user_id, username, item_name, item_image, item_color, item_rarity,
              item_price, case_name, case_id, dropped_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            bet.userId,
            bet.username,
            `+$${payout.toFixed(2)}`,
            null,
            "#4ade80",
            "roulette",
            payout,
            "Roulette",
            String(winning),
            Date.now()
          );

          totalPayout += payout;
          winners.push({ username: bet.username, amount: payout });
        }
      }

      return { winners, totalPayout, winning };
    })();

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[roulette payout] ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}