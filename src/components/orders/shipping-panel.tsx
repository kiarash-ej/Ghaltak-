"use client";

import { useActionState, useState } from "react";
import type { OrderStatus, ShippingStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatToman } from "@/lib/format";
import {
  SHIPPING_METHODS,
  SHIPPING_METHOD_LABELS,
  SHIPPING_STATUS_LABELS,
  isShippingMethod,
  shippingMethodLabel,
} from "@/server/orders/shipping";
import { saveShippingAction, type ShippingFormState } from "@/server/orders/shipping-actions";

const selectClass = "h-10 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-sm";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {messages[0]}
    </p>
  );
}

export function ShippingPanel({
  orderId,
  status,
  method,
  cost,
  trackingCode,
  shippingStatus,
}: {
  orderId: string;
  status: OrderStatus;
  method: string | null;
  cost: number | null;
  trackingCode: string | null;
  shippingStatus: ShippingStatus;
}) {
  const [state, action, pending] = useActionState<ShippingFormState, FormData>(
    saveShippingAction.bind(null, orderId),
    undefined,
  );
  const errors = state?.errors ?? {};
  // Older rows may hold free text; the seller picks one of the standard methods.
  const [chosenMethod, setChosenMethod] = useState(isShippingMethod(method) ? method : "");
  const [costText, setCostText] = useState(cost === null ? "" : String(cost));
  const [tracking, setTracking] = useState(trackingCode ?? "");
  const [manualStatus, setManualStatus] = useState(
    shippingStatus === "IN_TRANSIT" || shippingStatus === "FAILED" ? shippingStatus : "",
  );

  const closed = status === "CANCELED" || status === "RETURNED";
  const summary = (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant={shippingStatus === "FAILED" ? "danger" : shippingStatus === "DELIVERED" ? "success" : "neutral"}>
        {SHIPPING_STATUS_LABELS[shippingStatus]}
      </Badge>
      {method && <span>{shippingMethodLabel(method)}</span>}
      {cost !== null && <span className="text-neutral-500">· هزینه {formatToman(cost)}</span>}
      {trackingCode && (
        <span className="text-neutral-500">
          · کد رهگیری <span dir="ltr" className="font-mono">{trackingCode}</span>
        </span>
      )}
    </div>
  );

  if (closed) return summary;

  return (
    <form action={action} className="flex flex-col gap-4">
      {summary}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="shipping-method">روش ارسال</Label>
          <select
            id="shipping-method"
            name="method"
            value={chosenMethod}
            onChange={(e) => setChosenMethod(e.target.value)}
            className={selectClass}
          >
            <option value="">— انتخاب کنید —</option>
            {SHIPPING_METHODS.map((m) => (
              <option key={m} value={m}>
                {SHIPPING_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <FieldError messages={errors.method} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="shipping-cost">هزینهٔ ارسال (تومان)</Label>
          <Input
            id="shipping-cost"
            name="cost"
            inputMode="numeric"
            dir="ltr"
            value={costText}
            onChange={(e) => setCostText(e.target.value)}
          />
          <FieldError messages={errors.cost} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tracking-code">کد رهگیری (اختیاری)</Label>
          <Input
            id="tracking-code"
            name="trackingCode"
            dir="ltr"
            maxLength={40}
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
          />
          <FieldError messages={errors.trackingCode} />
        </div>
      </div>

      {status === "SHIPPED" ? (
        <div className="flex max-w-xs flex-col gap-2">
          <Label htmlFor="shipping-status">وضعیت مرسوله</Label>
          <select
            id="shipping-status"
            name="shippingStatus"
            value={manualStatus}
            onChange={(e) => setManualStatus(e.target.value)}
            className={selectClass}
          >
            <option value="IN_TRANSIT">{SHIPPING_STATUS_LABELS.IN_TRANSIT}</option>
            <option value="FAILED">{SHIPPING_STATUS_LABELS.FAILED}</option>
          </select>
          <p className="text-xs text-neutral-500">برای تحویل، وضعیت سفارش را «تحویل‌شده» کنید.</p>
        </div>
      ) : (
        <input type="hidden" name="shippingStatus" value="" />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === "PREPARING" && (
          <Button type="submit" name="intent" value="ship" disabled={pending}>
            ثبت و ارسال سفارش
          </Button>
        )}
        <Button
          type="submit"
          name="intent"
          value="save"
          variant={status === "PREPARING" ? "outline" : "default"}
          disabled={pending}
        >
          ذخیرهٔ اطلاعات ارسال
        </Button>
        {state?.ok && !pending && <span className="text-sm text-green-700">ذخیره شد.</span>}
      </div>
      {state?.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
