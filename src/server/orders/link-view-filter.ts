// Which requests for /buy/[token] count as a view in the link funnel (B8).
// Pure, no database. Nothing about the visitor is stored: this only decides
// whether the day's counter goes up by one.

// Link previews (Telegram, WhatsApp, Instagram/Facebook), search crawlers,
// headless browsers and scripts. Deliberately short: a missed bot costs one
// extra view, a wrong match hides a real customer.
const NOT_A_PERSON =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|meta-externalagent|whatsapp|headless|lighthouse|^curl\/|^wget\/|python-|go-http-client|node-fetch|undici/i;

// Phone brands whose model names end in "bot" (e.g. "CUBOT X30").
const PHONE_BRANDS = /cubot/gi;

export function isCountableView(headers: Headers): boolean {
  // The order form posts back to this page as a Server Action.
  if (headers.has("next-action")) return false;

  // Prefetches: Next.js <Link>, and the browser's own (Chrome sends Sec-Purpose).
  if (headers.has("next-router-prefetch")) return false;
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""}`;
  if (/prefetch/i.test(purpose)) return false;

  const userAgent = headers.get("user-agent")?.trim() ?? "";
  if (userAgent === "") return false;
  return !NOT_A_PERSON.test(userAgent.replace(PHONE_BRANDS, ""));
}
