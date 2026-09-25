import "server-only";
import { headers } from "next/headers";

/**
 * The app's public origin, for the gateway's callback URL and SMS links.
 * APP_URL wins when set. In production it is REQUIRED: a callback built from
 * the Host header would break behind a misconfigured proxy, and a forged
 * header would put another domain into the address registered at the gateway.
 * In development it comes from the request.
 */
export async function requestOrigin(env: Record<string, string | undefined> = process.env): Promise<string> {
  const configured = env.APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (env.NODE_ENV === "production") {
    throw new Error("APP_URL is required in production (see .env.example)");
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}
