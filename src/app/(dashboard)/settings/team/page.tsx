import type { Metadata } from "next";
import { InviteForm } from "@/components/team/invite-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import { requireOwner } from "@/server/auth";
import { getPlanUsage } from "@/server/billing/usage";
import { inviteMemberAction, removeMemberAction, signOutMemberAction } from "@/server/team/actions";
import { listMembers } from "@/server/team/members";

// «اعضا» tab (A10), owner only: operators get a 404 (requireOwner).

export const metadata: Metadata = { title: "اعضا | غلتک" };

export default async function TeamSettingsPage() {
  const owner = await requireOwner();
  const [members, usage] = await Promise.all([listMembers(owner.id), getPlanUsage(owner.id)]);
  const { used, limit } = usage.members;
  const full = usage.effective.enforced && limit !== null && used >= limit;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>افزودن عضو</CardTitle>
          <CardDescription>
            عضو جدید «اپراتور» است: محصولات، موجودی، مشتریان و سفارش‌ها را مدیریت می‌کند، ولی به تنظیمات، اشتراک و
            گزارش‌های مالی دسترسی ندارد. با همان شماره و کد پیامکی وارد می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <InviteForm action={inviteMemberAction} disabled={full} />
          <p className="text-sm text-neutral-600">
            {limit === null ? `${formatNumber(used)} عضو` : `${formatNumber(used)} از ${formatNumber(limit)} عضو پلن شما`}
            {full && " · برای عضو بیشتر، پلن را از «اشتراک» ارتقا دهید."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اعضای فروشگاه</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-neutral-200">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span dir="ltr" className="font-medium">
                      {m.mobile}
                    </span>
                    <Badge variant={m.role === "OWNER" ? "success" : "neutral"}>{m.role === "OWNER" ? "مالک" : "اپراتور"}</Badge>
                    {m.userId === owner.userId && <span className="text-xs text-neutral-500">(شما)</span>}
                  </div>
                  <div className="text-sm text-neutral-600">
                    عضو از {formatDate(m.joinedAt)} · {formatNumber(m.devices)} دستگاه فعال
                  </div>
                </div>
                <div className="flex gap-2">
                  {m.devices > 0 && m.userId !== owner.userId && (
                    <form action={signOutMemberAction.bind(null, m.userId)}>
                      <Button type="submit" variant="outline" size="sm">
                        خروج از همهٔ دستگاه‌ها
                      </Button>
                    </form>
                  )}
                  {m.role === "OPERATOR" && (
                    <form action={removeMemberAction.bind(null, m.userId)}>
                      <Button type="submit" variant="destructive" size="sm">
                        حذف عضو
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
