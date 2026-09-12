import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { getRoom, placeBet, publicRoom } from "@/lib/blackjack-rooms";

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
  const amount = Number(body.amount);
  if (!isFinite(amount) || amount < 1) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const player = room.players.find((p) => p.userId === user.id);
  if (!player) return NextResponse.json({ error: "Not in room" }, { status: 400 });

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

    const result = placeBet(room, user.id, amount);
    if (!result.ok) {
      // Refund
      db.prepare(
        "UPDATE users SET balance = balance + ?, total_wagered = total_wagered - ? WHERE id = ?"
      ).run(amount, amount, user.id);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      newBalance,
      room: publicRoom(room, user.id),
    });
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Not enough balance" }, { status: 400 });
    }
    console.error("[blackjack room bet] ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}