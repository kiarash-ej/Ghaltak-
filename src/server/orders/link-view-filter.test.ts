import { describe, expect, it } from "vitest";
import { isCountableView } from "./link-view-filter";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const INSTAGRAM_IN_APP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone14,5; iOS 17_5; fa_IR; fa; scale=3.00; 1170x2532)";
const CUBOT_PHONE =
  "Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const visit = (userAgent: string, extra: Record<string, string> = {}) =>
  new Headers({ "user-agent": userAgent, ...extra });

describe("isCountableView", () => {
  it("counts an ordinary phone browser, the Instagram in-app browser and a CUBOT phone", () => {
    expect(isCountableView(visit(CHROME_ANDROID))).toBe(true);
    expect(isCountableView(visit(INSTAGRAM_IN_APP))).toBe(true);
    expect(isCountableView(visit(CUBOT_PHONE))).toBe(true);
  });

  it("skips link previews and crawlers", () => {
    for (const ua of [
      "TelegramBot (like TwitterBot)",
      "WhatsApp/2.23.20.0 A",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "curl/8.4.0",
      "Wget/1.21",
      "python-requests/2.31.0",
      "Go-http-client/1.1",
    ]) {
      expect(isCountableView(visit(ua)), ua).toBe(false);
    }
  });

  it("skips a request without a user agent: every real browser sends one", () => {
    expect(isCountableView(new Headers())).toBe(false);
    expect(isCountableView(visit("   "))).toBe(false);
  });

  it("skips Next.js and browser prefetches", () => {
    expect(isCountableView(visit(CHROME_ANDROID, { "next-router-prefetch": "1" }))).toBe(false);
    expect(isCountableView(visit(CHROME_ANDROID, { purpose: "prefetch" }))).toBe(false);
    expect(isCountableView(visit(CHROME_ANDROID, { "sec-purpose": "prefetch;prerender" }))).toBe(false);
  });

  it("skips a Server Action posted to the page (the order form), which is not a new view", () => {
    expect(isCountableView(visit(CHROME_ANDROID, { "next-action": "7f3a" }))).toBe(false);
  });
});
