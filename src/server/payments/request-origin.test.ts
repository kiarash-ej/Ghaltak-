import { describe, expect, it } from "vitest";
import { requestOrigin } from "./request-origin";

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
