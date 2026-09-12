import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";
import { enforceLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DAILY_LIMIT = 20;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_SINGLE = 1000; // sanity cap per request

function getUsedInWindow(userId: number): number {
  const since = Date.now() - WINDOW_MS;
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM deposits WHERE user_id = ? AND created_at > ?"
    )
    .get(userId, since) as { total: number };
  return row.total ?? 0;
}

// GET — returns remaining daily limit
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const used = getUsedInWindow(user.id);
  return NextResponse.json({
    limit: DAILY_LIMIT,
    used,
    remaining: Math.max(0, DAILY_LIMIT - used),
    windowHours: 24,
  });
}

// POST — deposit with daily limit
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  // ── Rate limit: 5 depositów na minutę per user ───────────────
  // Daily limit ($20) jest głównym ograniczeniem. Rate limit to
  // druga warstwa — chroni bazę przed spamem (bot wysyłający
  // setki requestów na sekundę nawet jak każdy jest odrzucany).
  const blocked = enforceLimit(`deposit:${user.id}`, 5, 60_000);
  if (blocked) return blocked;

  const body = await request.json();
  const amount = typeof body.amount === "number" ? body.amount : NaN;

  if (!isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (amount > MAX_SINGLE) {
    return NextResponse.json(
      { error: `Max $${MAX_SINGLE} per deposit` },
      { status: 400 }
    );
  }

  const now = Date.now();

  // ── Check + zapis w JEDNEJ transakcji ────────────────────────
  // Wcześniej `getUsedInWindow` było POZA transakcją, co pozwalało
  // na race condition: dwa równoległe requesty widziały to samo
  // `used` i oba przechodziły sprawdzenie limitu, przekraczając
  // dobowy cap.
  let result: { newUsed: number } | null = null;
  let errorCode: "DAILY_LIMIT_REACHED" | "OVER_LIMIT" | null = null;
  let errorMeta: { remaining: number } | null = null;

  const tx = db.transaction(() => {
    const used = getUsedInWindow(user.id);
    const remaining = Math.max(0, DAILY_LIMIT - used);

    if (remaining <= 0) {
      errorCode = "DAILY_LIMIT_REACHED";
      errorMeta = { remaining: 0 };
      throw new Error("__ROLLBACK__");
    }

    if (amount > remaining) {
      errorCode = "OVER_LIMIT";
      errorMeta = { remaining };
      throw new Error("__ROLLBACK__");
    }

    db.prepare(
      "INSERT INTO deposits (user_id, amount, created_at) VALUES (?, ?, ?)"
    ).run(user.id, amount, now);

    db.prepare(
      "UPDATE users SET balance = balance + ?, highest_balance = MAX(highest_balance, balance + ?) WHERE id = ?"
    ).run(amount, amount, user.id);

    result = { newUsed: used + amount };
  });

  try {
    tx();
  } catch (err: any) {
    if (err.message === "__ROLLBACK__" && errorCode) {
      if (errorCode === "DAILY_LIMIT_REACHED") {
        return NextResponse.json(
          {
            error: "Daily deposit limit reached. Try again later.",
            remaining: 0,
            limit: DAILY_LIMIT,
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error: `Only $${errorMeta!.remaining.toFixed(2)} left in your daily limit.`,
          remaining: errorMeta!.remaining,
          limit: DAILY_LIMIT,
        },
        { status: 429 }
      );
    }
    console.error("[deposit] ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const newBalance = db
    .prepare("SELECT balance FROM users WHERE id = ?")
    .get(user.id) as { balance: number };

  return NextResponse.json({
    ok: true,
    balance: newBalance.balance,
    used: result!.newUsed,
    remaining: Math.max(0, DAILY_LIMIT - result!.newUsed),
    limit: DAILY_LIMIT,
  });
}