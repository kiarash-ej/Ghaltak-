"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPurchaseLinkAction,
  type PurchaseLinkFormState,
} from "@/server/orders/link-actions";
import { CopyLinkButton } from "./copy-link-button";

export function PurchaseLinkForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<PurchaseLinkFormState, FormData>(
    createPurchaseLinkAction,
    undefined,
  );
  const errors = state?.errors ?? {};

  if (products.length === 0) {
    return <p className="text-neutral-600">برای ساخت لینک خرید، ابتدا یک محصول فعال ثبت کنید.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex max-w-md flex-col gap-2">
        <Label htmlFor="title">عنوان (اختیاری، به مشتری نمایش داده می‌شود)</Label>
        <Input id="title" name="title" maxLength={80} placeholder="مثلاً: فروش ویژهٔ پاییز" />
        {errors.title && <p className="text-sm text-red-600">{errors.title[0]}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">محصولات این لینک</legend>
        <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-neutral-200 p-3 sm:grid-cols-2">
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="productId" value={p.id} className="size-4" />
              {p.name}
            </label>
          ))}
        </div>
        {errors.productIds && (
          <p role="alert" className="text-sm text-red-600">
            {errors.productIds[0]}
          </p>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ساخت…" : "ساخت لینک خرید"}
        </Button>
        {state?.createdToken && (
          <>
            <span className="text-sm text-green-700">لینک ساخته شد.</span>
            <CopyLinkButton path={`/buy/${state.createdToken}`} />
          </>
        )}
        {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      </div>
    </form>
  );
}
