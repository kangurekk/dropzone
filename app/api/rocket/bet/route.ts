import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { placeRocketBet, publicRocketState } from "@/lib/rocket";
import { enforceLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // ── Rate limit: 30 zakładów na minutę per user ───────────────
  // Runda rocket trwa kilkadziesiąt sekund, więc 30/min to
  // bardzo liberalnie — a i tak zatrzyma skrypty spamujące.
  const blocked = enforceLimit(`rocket-bet:${user.id}`, 30, 60_000);
  if (blocked) return blocked;

  const body = await request.json();
  const amount = Number(body.amount);
  if (!isFinite(amount) || amount < 1) {
    return NextResponse.json({ error: "Minimum bet is $1" }, { status: 400 });
  }

  const row = db
    .prepare("SELECT avatar, banner_color, accent_color FROM users WHERE id = ?")
    .get(user.id) as
    | { avatar: string | null; banner_color: string | null; accent_color: string | null }
    | undefined;

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

    const result = placeRocketBet({
      userId: user.id,
      username: user.username,
      avatar: row?.avatar ?? "◆",
      bannerColor: row?.banner_color ?? "#8b5cf6",
      accentColor: row?.accent_color ?? "#a78bfa",
      bet: amount,
    });

    if (!result.ok) {
      // refund
      db.prepare(
        "UPDATE users SET balance = balance + ?, total_wagered = total_wagered - ? WHERE id = ?"
      ).run(amount, amount, user.id);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      newBalance,
      state: publicRocketState(user.id),
    });
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Not enough balance" }, { status: 400 });
    }
    console.error("[rocket bet] ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}