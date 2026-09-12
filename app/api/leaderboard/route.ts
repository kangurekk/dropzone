import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const topBalance = db
    .prepare(
      `SELECT username, balance, avatar, accent_color
       FROM users
       ORDER BY balance DESC LIMIT 10`
    )
    .all() as any[];

  const topCases = db
    .prepare(
      `SELECT username, balance, avatar, banner_color, accent_color
      FROM users
      ORDER BY balance DESC LIMIT 10`
    )
    .all() as any[];

  const topProfit = db
    .prepare(
      `SELECT username, (total_won - total_wagered) as profit, avatar, accent_color
       FROM users
       ORDER BY profit DESC LIMIT 10`
    )
    .all() as any[];

  const topHighest = db
    .prepare(
      `SELECT username, highest_balance, avatar, accent_color
       FROM users
       ORDER BY highest_balance DESC LIMIT 10`
    )
    .all() as any[];

  return NextResponse.json({
    balance: topBalance,
    cases: topCases,
    profit: topProfit,
    highest: topHighest,
  });
}