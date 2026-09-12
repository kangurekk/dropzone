import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { cashOutRocket, publicRocketState } from "@/lib/rocket";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const result = cashOutRocket(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    db.transaction(() => {
      db.prepare(
        `UPDATE users SET balance = balance + ?,
                          highest_balance = MAX(highest_balance, balance + ?),
                          total_won = total_won + ?
         WHERE id = ?`
      ).run(result.payout!, result.payout!, result.payout!, user.id);

      db.prepare(
        `INSERT INTO drop_history
         (user_id, username, item_name, item_image, item_color, item_rarity,
          item_price, case_name, case_id, dropped_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        user.id,
        user.username,
        `+$${result.payout!.toFixed(2)}`,
        null,
        "#4ade80",
        "rocket",
        result.payout!,
        "Rocket Crash",
        String(result.multiplier),
        Date.now()
      );
    })();

    const finalBalance = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(user.id) as { balance: number };

    return NextResponse.json({
      ok: true,
      newBalance: finalBalance.balance,
      payout: result.payout,
      multiplier: result.multiplier,
      state: publicRocketState(user.id),
    });
  } catch (err) {
    console.error("[rocket cashout] ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}