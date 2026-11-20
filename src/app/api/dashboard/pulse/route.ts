import { NextResponse } from "next/server";
import { getAttention } from "@/server/dashboard/attention";
import { dashboardPulse } from "@/server/dashboard/pulse";
import { countUnreadNotifications } from "@/server/notifications/seller-notifications";
import { readSession } from "@/server/session";
import { validateSession } from "@/server/sessions";

// What an open dashboard tab polls once a minute: four counts as one string.
// Cheap on purpose (no page render, none of the pages' lazy work), and it
// answers 401 instead of redirecting, so the tab never navigates because of it.
export async function GET() {
  const cookie = await readSession();
  const session = cookie && (await validateSession(cookie));
  if (!session) return NextResponse.json({ error: "signed-out" }, { status: 401 });

  const [attention, unread] = await Promise.all([
    getAttention(session.sellerId),
    countUnreadNotifications(session.sellerId, session.role),
  ]);
  return NextResponse.json(
    { pulse: dashboardPulse(attention, unread) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
