// Basic fixed-window rate limiter kept in memory. Good enough for one server
// process; it resets on restart and is not shared between instances. If the
// app ever runs on several instances, move this to the database or Redis.

export type RateLimiter = {
  /** Records a hit for `key` and returns false when the limit is exceeded. */
  hit(key: string, now?: number): boolean;
};

export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    hit(key, now = Date.now()) {
      // Drop expired entries now and then so the map can't grow forever.
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
      }

      const w = windows.get(key);
      if (!w || now - w.start >= windowMs) {
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      w.count += 1;
      return w.count <= limit;
    },
  };
}

/**
 * The client's IP as reported by the reverse proxy. Behind a proxy the first
 * X-Forwarded-For entry is the client; falls back to X-Real-IP.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
