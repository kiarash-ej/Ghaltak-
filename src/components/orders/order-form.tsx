"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createOrderAction, type OrderFormState } from "@/server/orders/actions";
import type { OrderFormCustomer, OrderFormVariant } from "@/server/orders/queries";

type Line = { key: number; variantId: string; quantity: string };

const selectClass =
  "h-10 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {messages[0]}
    </p>
  );
}

function variantOptionLabel(v: OrderFormVariant) {
  const detail = [v.color, v.size].filter(Boolean).join(" / ") || "بدون تنوع";
  const stock = v.stock > 0 ? `موجودی ${formatNumber(v.stock)}` : "ناموجود";
  return `${detail} · ${formatToman(v.price)} · ${stock}`;
}

export function OrderForm({
  customers,
  variants,
}: {
  customers: OrderFormCustomer[];
  variants: OrderFormVariant[];
}) {
  const [state, action, pending] = useActionState<OrderFormState, FormData>(
    createOrderAction,
    undefined,
  );
  const errors = state?.errors ?? {};

  const [mode, setMode] = useState<"existing" | "new">(customers.length > 0 ? "existing" : "new");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: 0, variantId: "", quantity: "1" }]);
  const [nextKey, setNextKey] = useState(1);

  const variantById = new Map(variants.map((v) => [v.id, v]));
  const products = [...new Set(variants.map((v) => v.productName))];
  const previewTotal = lines.reduce((sum, l) => {
    const price = variantById.get(l.variantId)?.price ?? 0;
    const qty = Number(l.quantity) || 0;
    return sum + price * qty;
  }, 0);

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    // Prefill the address from the customer unless the seller already typed one.
    const picked = customers.find((c) => c.id === id);
    if (picked?.address && address.trim() === "") setAddress(picked.address);
  };

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="customerMode" value={mode} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">مشتری</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="نوع مشتری">
          {(["existing", "new"] as const).map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={mode === m ? "default" : "outline"}
              role="radio"
              aria-checked={mode === m}
              disabled={m === "existing" && customers.length === 0}
              onClick={() => setMode(m)}
            >
              {m === "existing" ? "مشتری فعلی" : "مشتری جدید"}
            </Button>
          ))}
        </div>

        {mode === "existing" ? (
          <div className="flex max-w-md flex-col gap-2">
            <Label htmlFor="customerId">انتخاب مشتری</Label>
            <select
              id="customerId"
              name="customerId"
              value={customerId}
              onChange={(e) => pickCustomer(e.target.value)}
              className={selectClass}
            >
              <option value="">— انتخاب کنید —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? "بی‌نام"} · {c.phone}
                </option>
              ))}
            </select>
            <FieldError messages={errors.customerId} />
          </div>
        ) : (
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="customerName">نام مشتری</Label>
              <Input
                id="customerName"
                name="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                maxLength={80}
              />
              <FieldError messages={errors.customerName} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="customerPhone">شمارهٔ موبایل</Label>
              <Input
                id="customerPhone"
                name="customerPhone"
                type="tel"
                inputMode="numeric"
                dir="ltr"
                placeholder="09123456789"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <FieldError messages={errors.customerPhone} />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">کالاها</h2>
        {variants.length === 0 ? (
          <p className="text-neutral-600">هیچ محصول فعالی برای فروش ندارید.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {lines.map((line, i) => {
              const variant = variantById.get(line.variantId);
              const qtyError = errors[`items.${i}.quantity`];
              return (
                <div key={line.key} className="flex flex-wrap items-end gap-2">
                  <div className="flex min-w-60 flex-1 flex-col gap-2">
                    <Label htmlFor={`variant-${line.key}`}>کالا</Label>
                    <select
                      id={`variant-${line.key}`}
                      name={`items.${i}.variantId`}
                      value={line.variantId}
                      onChange={(e) => updateLine(line.key, { variantId: e.target.value })}
                      className={selectClass}
                    >
                      <option value="">— انتخاب کالا —</option>
                      {products.map((name) => (
                        <optgroup key={name} label={name}>
                          {variants
                            .filter((v) => v.productName === name)
                            .map((v) => (
                              <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                                {variantOptionLabel(v)}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="flex w-24 flex-col gap-2">
                    <Label htmlFor={`qty-${line.key}`}>تعداد</Label>
                    <Input
                      id={`qty-${line.key}`}
                      name={`items.${i}.quantity`}
                      inputMode="numeric"
                      dir="ltr"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      aria-invalid={qtyError ? true : undefined}
                      className={cn(qtyError && "border-red-500")}
                    />
                  </div>
                  <div className="w-36 pb-2 text-sm text-neutral-600">
                    {variant ? formatToman(variant.price * (Number(line.quantity) || 0)) : "—"}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mb-1"
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                  >
                    حذف
                  </Button>
                  {qtyError && (
                    <p role="alert" className="w-full text-sm text-red-600">
                      {qtyError[0]}
                    </p>
                  )}
                </div>
              );
            })}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setLines((ls) => [...ls, { key: nextKey, variantId: "", quantity: "1" }]);
                  setNextKey((k) => k + 1);
                }}
              >
                افزودن کالا
              </Button>
            </div>
            <FieldError messages={errors.items} />
          </div>
        )}
      </section>

      <section className="flex max-w-2xl flex-col gap-2">
        <Label htmlFor="shippingAddress">آدرس ارسال</Label>
        <textarea
          id="shippingAddress"
          name="shippingAddress"
          rows={3}
          maxLength={500}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-transparent p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        />
        <FieldError messages={errors.shippingAddress} />
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-neutral-200 pt-6">
        <div className="text-lg font-semibold">جمع: {formatToman(previewTotal)}</div>
        <Button type="submit" disabled={pending || variants.length === 0}>
          {pending ? "در حال ثبت…" : "ثبت سفارش"}
        </Button>
        {state?.message && (
          <p role="alert" className="text-sm text-red-600">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
