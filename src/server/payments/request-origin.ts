import "server-only";
import { headers } from "next/headers";

/**
 * The app's public origin, for the gateway's callback URL. APP_URL wins when
 * set (production, behind the reverse proxy); otherwise it comes from the
 * request, which is fine in development.
 */
export async function requestOrigin(): Promise<string> {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}
