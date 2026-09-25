import { describe, expect, it } from "vitest";
import { deviceLabel } from "./user-agent";

describe("deviceLabel", () => {
  it("names common phones and computers", () => {
    expect(
      deviceLabel("Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"),
    ).toBe("کروم روی اندروید");
    expect(
      deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
    ).toBe("سافاری روی آیفون");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0")).toBe(
      "اج روی ویندوز",
    );
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 13) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36")).toBe(
      "مرورگر سامسونگ روی اندروید",
    );
  });

  it("falls back when unknown", () => {
    expect(deviceLabel(null)).toBe("دستگاه ناشناخته");
    expect(deviceLabel("curl/8.5")).toBe("دستگاه ناشناخته");
  });
});
