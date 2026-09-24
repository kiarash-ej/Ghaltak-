"use client";

import { useActionState, useState } from "react";
import { shrinkImage } from "@/components/catalog/shrink-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentActionState } from "@/server/orders/payment-actions";

/** Public: the customer sends a card-to-card receipt from their order page. */
export function ReceiptUpload({
  action: upload,
  hasReceipt,
}: {
  action: (state: PaymentActionState, formData: FormData) => Promise<PaymentActionState>;
  hasReceipt: boolean;
}) {
  const [state, action, pending] = useActionState(upload, undefined);
  const [file, setFile] = useState<File | null>(null);
  const [shrinking, setShrinking] = useState(false);

  return (
    <form
      action={(formData) => {
        formData.delete("receipt");
        if (file) formData.set("receipt", file);
        action(formData);
      }}
      className="flex flex-col gap-3"
    >
      <Label htmlFor="receipt">
        {hasReceipt ? "ارسال رسید جدید (جایگزین رسید قبلی)" : "تصویر رسید کارت به کارت"}
      </Label>
      <Input
        id="receipt"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="h-auto py-2"
        onChange={async (e) => {
          const picked = e.target.files?.[0];
          if (!picked) return setFile(null);
          setShrinking(true);
          setFile(await shrinkImage(picked));
          setShrinking(false);
        }}
      />
      <Button type="submit" disabled={!file || pending || shrinking}>
        {shrinking ? "در حال آماده‌سازی تصویر…" : pending ? "در حال ارسال…" : "ارسال رسید"}
      </Button>
      {state?.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
