import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getState } from "@/lib/roulette";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const s = getState();

  return NextResponse.json({
    roundId: s.roundId,
    phase: s.phase,
    phaseStartedAt: s.phaseStartedAt,
    phaseEndsAt: s.phaseEndsAt,
    winningNumber:
      s.phase === "spinning" || s.phase === "result" ? s.winningNumber : null,
    bets: s.bets.map((b) => ({
      username: b.username,
      type: b.type,
      number: b.number,
      amount: b.amount,
    })),
  });
}