import db from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let lastId = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  // Start from latest existing drop so we don't replay history
  try {
    const row = db
      .prepare("SELECT MAX(id) as max_id FROM drop_history")
      .get() as { max_id: number | null };
    lastId = row.max_id ?? 0;
  } catch {
    lastId = 0;
  }

  const stream = new ReadableStream({
    start(controller) {
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

      send({ type: "init", lastId });

      interval = setInterval(() => {
        try {
          const rows = db
            .prepare(
              `SELECT id, username, item_name, item_image, item_color,
                      item_rarity, item_price, case_name, dropped_at
               FROM drop_history
               WHERE id > ?
               ORDER BY id ASC
               LIMIT 20`
            )
            .all(lastId) as any[];

          for (const r of rows) {
            lastId = r.id;
            send({
              type: "drop",
              drop: {
                id: r.id,
                username: r.username,
                itemName: r.item_name,
                itemImage: r.item_image,
                itemColor: r.item_color,
                itemRarity: r.item_rarity,
                itemPrice: r.item_price,
                caseName: r.case_name,
                droppedAt: r.dropped_at,
              },
            });
          }
        } catch (err) {
          console.error("[drops stream] poll error:", err);
        }
      }, 2000);
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