import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSession } from "@/lib/blackjack";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const s = getSession(user.id);
  if (!s) return NextResponse.json({ session: null });

  return NextResponse.json({
    session: {
      playerHand: s.playerHand,
      dealerHand: s.dealerHand,
      bet: s.bet,
      doubled: s.doubled,
      done: s.done,
      outcome: s.outcome ?? null,
      payout: s.payout ?? null,
    },
  });
}