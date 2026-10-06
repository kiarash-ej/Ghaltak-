import { describe, expect, it } from "vitest";
import { appUrl, requestOrigin } from "./request-origin";

describe("requestOrigin", () => {
  it("uses APP_URL, without a trailing slash", async () => {
    await expect(requestOrigin({ APP_URL: "https://ghaltak.ir/", NODE_ENV: "production" })).resolves.toBe(
      "https://ghaltak.ir",
    );
  });

  it("refuses to guess from the Host header in production", async () => {
    await expect(requestOrigin({ NODE_ENV: "production" })).rejects.toThrow(/APP_URL is required/);
    await expect(requestOrigin({ APP_URL: "", NODE_ENV: "production" })).rejects.toThrow(/APP_URL is required/);
  });
});

describe("appUrl", () => {
  it("redirects on APP_URL, not on the address the proxy handed the app", () => {
    const back = appUrl("/buy/order/abc?payment=paid", "http://10.0.0.7:3000/pay/callback/x", { APP_URL: "https://ghaltak.ir/" });
    expect(back.toString()).toBe("https://ghaltak.ir/buy/order/abc?payment=paid");
  });

  it("falls back to the request's own URL without APP_URL (development)", () => {
    expect(appUrl("/login", "http://localhost:3000/logout", {}).toString()).toBe("http://localhost:3000/login");
  });
});
