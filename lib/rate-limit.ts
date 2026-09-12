import db from "./db";

export type RateLimitOk = {
  ok: true;
  remaining: number;
  resetAt: number;
};

export type RateLimitBlocked = {
  ok: false;
  remaining: 0;
  resetAt: number;
  retryAfter: number;
};

export type RateLimitResult = RateLimitOk | RateLimitBlocked;

/**
 * Sprawdza i inkrementuje licznik dla danego klucza.
 *
 * @param key      unikalny identyfikator (np. `case-open:42` lub `login:1.2.3.4`)
 * @param limit    max liczba żądań w oknie
 * @param windowMs długość okna w milisekundach
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const resetAt = now + windowMs;

  // Atomowy upsert: resetuje okno jeśli wygasło, inaczej inkrementuje.
  const row = db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count    = CASE WHEN rate_limits.reset_at <= ? THEN 1
                         ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= ? THEN ?
                         ELSE rate_limits.reset_at END
       RETURNING count, reset_at`
    )
    .get(key, resetAt, now, now, resetAt) as {
    count: number;
    reset_at: number;
  };

  // Okazjonalny cleanup — usuwa wygasłe wpisy (1% szansy na request).
  if (Math.random() < 0.01) {
    try {
      db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now);
    } catch {
      // ignore — kolejny request spróbuje
    }
  }

  if (row.count > limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: row.reset_at,
      retryAfter: Math.max(1, Math.ceil((row.reset_at - now) / 1000)),
    };
  }

  return {
    ok: true,
    remaining: limit - row.count,
    resetAt: row.reset_at,
  };
}

/**
 * Pobiera IP klienta z nagłówków (Railway ustawia x-forwarded-for).
 */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Helper dla route handlerów. Zwraca Response 429 jeśli limit przekroczony,
 * albo null jeśli można kontynuować.
 *
 * Użycie:
 *   const blocked = enforceLimit(`case-open:${userId}`, 10, 60_000);
 *   if (blocked) return blocked;
 */
export function enforceLimit(
  key: string,
  limit: number,
  windowMs: number
): Response | null {
  const r = rateLimit(key, limit, windowMs);
  if (r.ok) return null;

  return new Response(
    JSON.stringify({
      error: "rate_limited",
      retryAfter: r.retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(r.retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(r.resetAt / 1000)),
      },
    }
  );
}