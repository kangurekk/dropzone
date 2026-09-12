import { getState } from "@/lib/roulette";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      function send(payload: any) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {}
      }

      function snapshot() {
        const s = getState();
        return {
          roundId: s.roundId,
          phase: s.phase,
          phaseStartedAt: s.phaseStartedAt,
          phaseEndsAt: s.phaseEndsAt,
          winningNumber:
            s.phase === "spinning" || s.phase === "result"
              ? s.winningNumber
              : null,
          bets: s.bets.map((b) => ({
            username: b.username,
            type: b.type,
            number: b.number,
            amount: b.amount,
          })),
        };
      }

      let lastHash = "";
      const initial = snapshot();
      lastHash = JSON.stringify(initial);
      send({ type: "state", state: initial });

      interval = setInterval(() => {
        const fresh = snapshot();
        const hash = JSON.stringify(fresh);
        if (hash !== lastHash) {
          lastHash = hash;
          send({ type: "state", state: fresh });
        }
      }, 500);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}