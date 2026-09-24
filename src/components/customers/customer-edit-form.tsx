"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCustomerAction, type CustomerFormState } from "@/server/customers/actions";

type Props = {
  customerId: string;
  initial: { name: string | null; phone: string; address: string | null };
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {messages.join(" ")}
    </p>
  );
}

export function CustomerEditForm({ customerId, initial }: Props) {
  // Controlled so a failed save never wipes what the seller typed.
  const [name, setName] = useState(initial.name ?? "");
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address ?? "");

  const [state, action, pending] = useActionState(
    async (prev: CustomerFormState, formData: FormData) => {
      const result = await updateCustomerAction(customerId, prev, formData);
      // Show what was actually stored (e.g. "+98 912…" becomes "0912…").
      if (result?.ok) {
        setName(result.saved.name ?? "");
        setPhone(result.saved.phone);
        setAddress(result.saved.address ?? "");
      }
      return result;
    },
    undefined,
  );
  const errors = state && !state.ok ? state.errors : undefined;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">نام</Label>
          <Input id="name" name="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <FieldError messages={errors?.name} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">شمارهٔ موبایل</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <FieldError messages={errors?.phone} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">آدرس</Label>
        <textarea
          id="address"
          name="address"
          rows={3}
          maxLength={500}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        />
        <FieldError messages={errors?.address} />
      </div>

      {state && !state.ok && state.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
        </Button>
        {state?.ok && !pending && (
          <span role="status" className="text-sm text-green-700">
            ذخیره شد.
          </span>
        )}
      </div>
    </form>
  );
}
