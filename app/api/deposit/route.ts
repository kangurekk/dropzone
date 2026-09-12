import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import db from "@/lib/db";

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

  const used = getUsedInWindow(user.id);
  const remaining = Math.max(0, DAILY_LIMIT - used);

  if (remaining <= 0) {
    return NextResponse.json(
      {
        error: `Daily deposit limit reached. Try again later.`,
        remaining: 0,
        limit: DAILY_LIMIT,
      },
      { status: 429 }
    );
  }

  if (amount > remaining) {
    return NextResponse.json(
      {
        error: `Only $${remaining.toFixed(2)} left in your daily limit.`,
        remaining,
        limit: DAILY_LIMIT,
      },
      { status: 429 }
    );
  }

  const now = Date.now();

  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO deposits (user_id, amount, created_at) VALUES (?, ?, ?)"
    ).run(user.id, amount, now);

    db.prepare(
      "UPDATE users SET balance = balance + ?, highest_balance = MAX(highest_balance, balance + ?) WHERE id = ?"
    ).run(amount, amount, user.id);
  });

  tx();

  const newBalance = db
    .prepare("SELECT balance FROM users WHERE id = ?")
    .get(user.id) as { balance: number };

  const newUsed = used + amount;

  return NextResponse.json({
    ok: true,
    balance: newBalance.balance,
    used: newUsed,
    remaining: Math.max(0, DAILY_LIMIT - newUsed),
    limit: DAILY_LIMIT,
  });
}