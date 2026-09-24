import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter, trustedProxyHops } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect([1, 2, 3, 4].map(() => limiter.hit("a", 0))).toEqual([true, true, true, false]);
  });

  it("starts a new window after windowMs", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("a", 999)).toBe(false);
    expect(limiter.hit("a", 1000)).toBe(true);
  });

  it("counts each key separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("b", 0)).toBe(true);
    expect(limiter.hit("a", 0)).toBe(false);
  });
});

describe("clientIp", () => {
  const xff = (value: string) => new Headers({ "x-forwarded-for": value });

  it("uses the address our proxy appended, not the client's forged first entry", () => {
    // Client sent "X-Forwarded-For: 1.1.1.1"; our proxy appended the real 5.6.7.8.
    expect(clientIp(xff("1.1.1.1, 5.6.7.8"), 1)).toBe("5.6.7.8");
  });

  it("counts hops from the end when there are several proxies", () => {
    // forged, real client (seen by proxy 1), proxy 1 (seen by proxy 2)
    expect(clientIp(xff("1.1.1.1, 5.6.7.8, 10.0.0.2"), 2)).toBe("5.6.7.8");
  });

  it("works when the client sent nothing", () => {
    expect(clientIp(xff("5.6.7.8"), 1)).toBe("5.6.7.8");
  });

  it("ignores X-Real-IP, which a client can also send", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.1.1.1" }), 1)).toBe("unknown");
  });

  it("is 'unknown' when there are fewer entries than hops", () => {
    expect(clientIp(new Headers(), 1)).toBe("unknown");
    expect(clientIp(xff("5.6.7.8"), 2)).toBe("unknown");
  });

  it("can't be dodged by changing the forged entry", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const results = Array.from({ length: 6 }, (_, i) =>
      limiter.hit(clientIp(xff(`10.0.${i}.${i}, 5.6.7.8`), 1), 0),
    );
    expect(results).toEqual([true, true, true, false, false, false]);
  });
});

describe("trustedProxyHops", () => {
  it("defaults to 1 and accepts small positive integers", () => {
    expect(trustedProxyHops({})).toBe(1);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "2" })).toBe(2);
  });

  it.each(["0", "-1", "abc", "1.5", "99"])("falls back to 1 for %s", (value) => {
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: value })).toBe(1);
  });
});
