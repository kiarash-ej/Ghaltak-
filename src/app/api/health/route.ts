import { prisma } from "@/lib/prisma";

// Uptime check for the host's monitor: 200 when the app can reach the
// database, 503 when it can't. Public, and says nothing else about the app.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
