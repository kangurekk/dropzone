import { getRoom, publicRoom, tickRoom } from "@/lib/blackjack-rooms";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const viewerId = user.id;
  const { id } = await params;

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
        tickRoom(id);
        const r = getRoom(id);
        if (!r) return null;
        return publicRoom(r, viewerId);
      }

      let lastHash = "";
      const initial = snapshot();
      lastHash = JSON.stringify(initial);
      send({ type: "state", room: initial });

      interval = setInterval(() => {
        const fresh = snapshot();
        const hash = JSON.stringify(fresh);
        if (hash !== lastHash) {
          lastHash = hash;
          send({ type: "state", room: fresh });
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