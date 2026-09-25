import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { deviceLabel } from "@/lib/user-agent";
import { requireMember } from "@/server/auth";
import { listMemberSessions } from "@/server/sessions";
import { signOutDeviceAction, signOutOtherDevicesAction } from "@/server/team/actions";

// «دستگاه‌های من» (A10): every member, their OWN devices in this store only.

export const metadata: Metadata = { title: "دستگاه‌های من | غلتک" };

export default async function DevicesPage() {
  const me = await requireMember();
  const sessions = await listMemberSessions(me.id, me.userId);
  const others = sessions.filter((s) => s.id !== me.sessionId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>دستگاه‌های من</CardTitle>
        <CardDescription>
          دستگاه‌هایی که با شمارهٔ شما در این فروشگاه وارد شده‌اند. اگر گوشی یا رایانه‌ای را نمی‌شناسید یا گم
          کرده‌اید، از آن خارج شوید.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y divide-neutral-200">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-medium">
                  {deviceLabel(s.userAgent)}
                  {s.id === me.sessionId && <Badge variant="success">همین دستگاه</Badge>}
                </div>
                <div className="text-sm text-neutral-600">
                  ورود: {formatDateTime(s.createdAt)} · آخرین استفاده: {formatDateTime(s.lastSeenAt)}
                </div>
              </div>
              {s.id !== me.sessionId && (
                <form action={signOutDeviceAction.bind(null, s.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    خروج
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {others.length > 1 && (
          <form action={signOutOtherDevicesAction}>
            <Button type="submit" variant="outline">
              خروج از همهٔ دستگاه‌های دیگر
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
