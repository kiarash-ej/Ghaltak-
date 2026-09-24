import "server-only";

// SMS delivery. Production uses Kavenegar (Iranian provider) via its
// "verify/lookup" template API. In development, without credentials, the
// code is printed to the server console instead.

export async function sendLoginCode(mobile: string, code: string): Promise<void> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  const template = process.env.KAVENEGAR_TEMPLATE;

  if (!apiKey || !template) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("KAVENEGAR_API_KEY / KAVENEGAR_TEMPLATE are not configured");
    }
    console.log(`[dev sms] login code for ${mobile}: ${code}`);
    return;
  }

  const url = new URL(`https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`);
  url.searchParams.set("receptor", mobile);
  url.searchParams.set("token", code);
  url.searchParams.set("template", template);

  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`SMS provider responded with ${res.status}`);
  }
}
