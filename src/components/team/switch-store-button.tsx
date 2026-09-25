"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { SwitchStoreState } from "@/server/team/actions";

export function SwitchStoreButton({
  action: switchStore,
  label,
  current,
}: {
  action: () => Promise<SwitchStoreState>;
  label: string;
  current: boolean;
}) {
  const [state, action, pending] = useActionState(async () => switchStore(), undefined);
  return (
    <form action={action} className="flex flex-col gap-1">
      <Button type="submit" variant={current ? "default" : "outline"} disabled={pending} className="w-full justify-between">
        <span>{label}</span>
        {current && <span className="text-xs">فروشگاه فعلی</span>}
      </Button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
