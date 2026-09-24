import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rate-limit";

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
  it("takes the first X-Forwarded-For entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
  });

  it("falls back to X-Real-IP, then 'unknown'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
