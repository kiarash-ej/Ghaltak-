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

/** How many reverse proxies we run in front of the app (TRUSTED_PROXY_HOPS). */
export function trustedProxyHops(env: Record<string, string | undefined> = process.env): number {
  const hops = Number(env.TRUSTED_PROXY_HOPS ?? "1");
  return Number.isInteger(hops) && hops >= 1 && hops <= 10 ? hops : 1;
}

/**
 * The client's IP, taken only from what OUR proxies wrote.
 *
 * X-Forwarded-For is "client, proxy1, proxy2, ...": anything the client sends
 * lands at the FRONT, and each of our proxies appends the address it saw at
 * the END. So the entry `hops` places from the end is the one our outermost
 * proxy saw, and the client can't change it. (Next.js itself only fills the
 * header when it is missing, so without a proxy in front the value is not
 * trustworthy: production must run behind one, see .env.example.)
 */
export function clientIp(headers: Headers, hops: number = trustedProxyHops()): string {
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return entries[entries.length - hops] ?? "unknown";
}
