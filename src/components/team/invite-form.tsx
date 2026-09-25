"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InviteState } from "@/server/team/actions";

/** «افزودن عضو» on /settings/team. The role is always operator. */
export function InviteForm({
  action: invite,
  disabled,
}: {
  action: (state: InviteState, formData: FormData) => Promise<InviteState>;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(invite, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Label htmlFor="invite-mobile">شمارهٔ موبایل عضو جدید</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="invite-mobile" name="mobile" inputMode="tel" dir="ltr" placeholder="09121234567" required disabled={disabled} />
        <Button type="submit" disabled={pending || disabled}>
          {pending ? "در حال افزودن…" : "افزودن"}
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-green-700">
          عضو اضافه شد و پیامک ورود برایش فرستاده شد.
        </p>
      )}
    </form>
  );
}
