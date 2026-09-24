"use client";

import { useActionState, useState } from "react";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { shrinkImage } from "@/components/catalog/shrink-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentState } from "@/server/orders/payment";
import {
  confirmPaymentAction,
  rejectReceiptAction,
  type PaymentActionState,
} from "@/server/orders/payment-actions";

export function PaymentPanel({
  orderId,
  state: payment,
  method,
  paidAtText,
  hasReceipt,
}: {
  orderId: string;
  state: PaymentState;
  method: PaymentMethod | null;
  paidAtText: string | null;
  hasReceipt: boolean;
}) {
  const [confirmState, confirmAction, confirming] = useActionState<PaymentActionState, FormData>(
    confirmPaymentAction.bind(null, orderId),
    undefined,
  );
  const [rejectState, rejectAction, rejecting] = useActionState<PaymentActionState, FormData>(
    rejectReceiptAction.bind(null, orderId),
    undefined,
  );

  // The shrunk photo lives in state so it survives a failed submit.
  const [receipt, setReceipt] = useState<File | null>(null);
  const [shrinking, setShrinking] = useState(false);
  const [chosenMethod, setChosenMethod] = useState<PaymentMethod>(method ?? "CARD_TO_CARD");

  const receiptLink = hasReceipt && (
    <a
      href={`/orders/${orderId}/receipt`}
      target="_blank"
      rel="noopener"
      className="inline-block w-fit overflow-hidden rounded-lg border border-neutral-200"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/orders/${orderId}/receipt`} alt="رسید پرداخت" className="max-h-72 w-auto" />
    </a>
  );

  if (payment === "PAID") {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">پرداخت‌شده</Badge>
          {method && <span>{PAYMENT_METHOD_LABELS[method]}</span>}
          {paidAtText && <span className="text-neutral-500">· {paidAtText}</span>}
        </div>
        {receiptLink}
      </div>
    );
  }

  if (payment === "NOT_APPLICABLE") {
    return <p className="text-sm text-neutral-500">پرداختی برای این سفارش ثبت نشده است.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {payment === "RECEIPT_SUBMITTED" ? (
        <div className="flex flex-col gap-3">
          <Badge variant="warning" className="w-fit">
            رسید مشتری در انتظار بررسی
          </Badge>
          {receiptLink}
          <form action={rejectAction}>
            <Button type="submit" variant="ghost" size="sm" disabled={rejecting}>
              رد رسید (مشتری می‌تواند رسید دیگری بفرستد)
            </Button>
            {rejectState?.message && <p className="text-sm text-red-600">{rejectState.message}</p>}
          </form>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">منتظر پرداخت مشتری.</p>
      )}

      <form
        action={(formData) => {
          formData.delete("receipt");
          if (receipt) formData.set("receipt", receipt);
          confirmAction(formData);
        }}
        className="flex flex-col gap-4 border-t border-neutral-200 pt-4"
      >
        <div className="flex max-w-xs flex-col gap-2">
          <Label htmlFor="method">روش پرداخت</Label>
          <select
            id="method"
            name="method"
            value={chosenMethod}
            onChange={(e) => setChosenMethod(e.target.value as PaymentMethod)}
            className="h-10 rounded-lg border border-neutral-300 bg-transparent px-3 text-sm"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        {!hasReceipt && chosenMethod === "CARD_TO_CARD" && (
          <div className="flex max-w-sm flex-col gap-2">
            <Label htmlFor="receipt">تصویر رسید (اختیاری)</Label>
            <Input
              id="receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="h-auto py-2"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return setReceipt(null);
                setShrinking(true);
                setReceipt(await shrinkImage(file));
                setShrinking(false);
              }}
            />
            {shrinking && <p className="text-xs text-neutral-500">در حال کوچک‌کردن تصویر…</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={confirming || shrinking}>
            {confirming ? "در حال ثبت…" : "تأیید پرداخت"}
          </Button>
          <span className="text-xs text-neutral-500">زمان پرداخت همین لحظه ثبت می‌شود.</span>
        </div>
        {confirmState?.message && (
          <p role="alert" className="text-sm text-red-600">
            {confirmState.message}
          </p>
        )}
      </form>
    </div>
  );
}
