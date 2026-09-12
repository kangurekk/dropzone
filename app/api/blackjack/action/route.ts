import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { getRoom, playerAction, publicRoom } from "@/lib/blackjack-rooms";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const body = await request.json();
  const action = body.action;
  if (!["hit", "stand", "double"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const result = playerAction(room, user.id, action);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // If doubled, deduct extra bet
  if (result.extraBet != null) {
    try {
      const newBalance = db.transaction(() => {
        const u = db
          .prepare("SELECT balance FROM users WHERE id = ?")
          .get(user.id) as { balance: number };

        if (u.balance < result.extraBet!) throw new Error("INSUFFICIENT_BALANCE");

        const nb = Math.round((u.balance - result.extraBet!) * 100) / 100;
        db.prepare(
          "UPDATE users SET balance = ?, total_wagered = total_wagered + ? WHERE id = ?"
        ).run(nb, result.extraBet!, user.id);

        return nb;
      })();
      // handle possible payouts later (in tick result)
    } catch (err: any) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        return NextResponse.json({ error: "Not enough balance for double" }, { status: 400 });
      }
    }
  }

  // If room is in result phase, do the payouts
  if (room.phase === "result") {
    payOutRoom(room);
  }

  return NextResponse.json({
    ok: true,
    room: publicRoom(room, user.id),
  });
}

/* Payout all winners when round is over */
function payOutRoom(room: any) {
  const now = Date.now();
  for (const p of room.players) {
    if (p.payout > 0 && !p.isBot) {
      db.prepare(
        `UPDATE users SET balance = balance + ?,
                          highest_balance = MAX(highest_balance, balance + ?),
                          total_won = total_won + ?
         WHERE id = ?`
      ).run(p.payout, p.payout, p.payout, p.userId);

      db.prepare(
        `INSERT INTO drop_history
         (user_id, username, item_name, item_image, item_color, item_rarity,
          item_price, case_name, case_id, dropped_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        p.userId,
        p.username,
        `+$${(p.payout - p.bet).toFixed(2)}`,
        null,
        "#4ade80",
        "blackjack",
        p.payout,
        p.outcome === "blackjack" ? "Blackjack (BJ)" : "Blackjack",
        p.outcome,
        now
      );
    }
  }
}