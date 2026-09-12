import db from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();

  let interval: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      function fetchActive() {
        const now = Date.now();
        return db
          .prepare(
            `SELECT id, message, type, created_at, expires_at
             FROM announcements
             WHERE active = 1
               AND (expires_at IS NULL OR expires_at > ?)
             ORDER BY created_at DESC`
          )
          .all(now) as any[];
      }

      function send(payload: any) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // stream closed
        }
      }

      // Initial snapshot
      let lastHash = "";
      const initial = fetchActive();
      lastHash = JSON.stringify(initial);
      send({ type: "init", announcements: initial });

      // Poll DB every 1.5s — push only when changed
      interval = setInterval(() => {
        const fresh = fetchActive();
        const hash = JSON.stringify(fresh);
        if (hash !== lastHash) {
          lastHash = hash;
          send({ type: "update", announcements: fresh });
        }
      }, 1500);
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