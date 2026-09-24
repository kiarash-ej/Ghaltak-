"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatToman } from "@/lib/format";
import type { BuyFormState } from "@/server/orders/buy-actions";
import type { PublicLinkProduct } from "@/server/orders/purchase-links";

type Choice = { variantId: string; quantity: number };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {messages[0]}
    </p>
  );
}

function variantLabel(v: PublicLinkProduct["variants"][number]) {
  const detail = [v.color, v.size].filter(Boolean).join(" / ") || "استاندارد";
  return v.inStock ? detail : `${detail} (ناموجود)`;
}

export function BuyForm({
  products,
  action: submit,
}: {
  products: PublicLinkProduct[];
  action: (state: BuyFormState, formData: FormData) => Promise<BuyFormState>;
}) {
  const [state, action, pending] = useActionState(submit, undefined);
  const errors = state?.errors ?? {};

  // One product: preselect it. Several: the customer picks quantities.
  const [choices, setChoices] = useState<Choice[]>(() =>
    products.map((p) => {
      const available = p.variants.filter((v) => v.inStock);
      return {
        variantId: available.length === 1 ? available[0].id : "",
        quantity: products.length === 1 && available.length > 0 ? 1 : 0,
      };
    }),
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const setChoice = (i: number, patch: Partial<Choice>) =>
    setChoices((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const total = products.reduce((sum, p, i) => sum + p.price * choices[i].quantity, 0);

  return (
    <form action={action} className="flex flex-col gap-6">
      <ul className="flex flex-col gap-4">
        {products.map((p, i) => {
          const choice = choices[i];
          const soldOut = !p.variants.some((v) => v.inStock);
          const showVariants = p.variants.length > 1 || Boolean(p.variants[0]?.color || p.variants[0]?.size);
          return (
            <li key={p.id} className="flex gap-3 rounded-xl border border-neutral-200 p-3">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-20 shrink-0 rounded-lg border border-neutral-200 object-cover"
                />
              ) : (
                <div className="size-20 shrink-0 rounded-lg bg-neutral-100" aria-hidden />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-neutral-600">{formatToman(p.price)}</div>
                </div>

                {soldOut ? (
                  <p className="text-sm text-red-600">ناموجود</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {showVariants ? (
                      <select
                        name={`items.${i}.variantId`}
                        aria-label={`رنگ و سایز ${p.name}`}
                        value={choice.variantId}
                        onChange={(e) => setChoice(i, { variantId: e.target.value })}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-2 text-sm"
                      >
                        <option value="">رنگ / سایز</option>
                        {p.variants.map((v) => (
                          <option key={v.id} value={v.id} disabled={!v.inStock}>
                            {variantLabel(v)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input type="hidden" name={`items.${i}.variantId`} value={choice.variantId} />
                    )}
                    <div className="flex items-center gap-1" role="group" aria-label={`تعداد ${p.name}`}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="size-10 p-0 text-lg"
                        aria-label="کم کردن"
                        disabled={choice.quantity <= 0}
                        onClick={() => setChoice(i, { quantity: choice.quantity - 1 })}
                      >
                        −
                      </Button>
                      <input
                        name={`items.${i}.quantity`}
                        value={choice.quantity}
                        readOnly
                        aria-label="تعداد"
                        className="w-10 bg-transparent text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="size-10 p-0 text-lg"
                        aria-label="زیاد کردن"
                        disabled={choice.quantity >= 99}
                        onClick={() => setChoice(i, { quantity: choice.quantity + 1 })}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                )}
                <FieldError messages={errors[`items.${i}.variantId`] ?? errors[`items.${i}.quantity`]} />
              </div>
            </li>
          );
        })}
      </ul>
      <FieldError messages={errors.items} />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">مشخصات گیرنده</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">نام و نام خانوادگی</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <FieldError messages={errors.name} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">شمارهٔ موبایل</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            dir="ltr"
            placeholder="09123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <FieldError messages={errors.phone} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="address">آدرس کامل</Label>
          <textarea
            id="address"
            name="address"
            rows={3}
            maxLength={500}
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            className="w-full rounded-lg border border-neutral-300 bg-transparent p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          />
          <FieldError messages={errors.address} />
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>جمع</span>
          <span>{formatToman(total)}</span>
        </div>
        <Button type="submit" size="lg" disabled={pending || total === 0}>
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
