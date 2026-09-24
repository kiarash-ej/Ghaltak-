"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MAX_NOTE_LENGTH, previewStock, type AdjustMode } from "@/server/catalog/adjust-form";
import { adjustStockAction, type AdjustStockState } from "@/server/catalog/inventory-actions";
import type { InventoryRow as Row } from "@/server/catalog/inventory-queries";
import { variantLabel } from "@/server/catalog/labels";
import { parseWholeNumber } from "@/server/catalog/product-form";

const MODES: { value: AdjustMode; label: string }[] = [
  { value: "add", label: "افزودن" },
  { value: "remove", label: "کم‌کردن" },
  { value: "set", label: "تنظیم روی" },
];

export function StockBadge({ status }: { status: Row["status"] }) {
  if (status === "OUT_OF_STOCK") return <Badge variant="danger">ناموجود</Badge>;
  if (status === "LOW") return <Badge variant="warning">کم‌موجودی</Badge>;
  return <Badge variant="success">کافی</Badge>;
}

export function InventoryRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AdjustMode>("add");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const [state, formAction, pending] = useActionState(
    async (prev: AdjustStockState, formData: FormData) => {
      const result = await adjustStockAction(row.variantId, prev, formData);
      if (result?.ok) {
        setOpen(false);
        setQuantity("");
        setNote("");
      }
      return result;
    },
    undefined,
  );

  const qty = parseWholeNumber(quantity);
  const preview = previewStock(row.stock, mode, qty);
  const invalid =
    preview === null || preview < 0 || (mode !== "set" && qty === 0) || preview === row.stock;
  const label = variantLabel(row);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.imageUrl}
            alt=""
            className="size-12 shrink-0 rounded-lg border border-neutral-200 object-cover"
          />
        ) : (
          <div className="size-12 shrink-0 rounded-lg bg-neutral-100" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {row.productName}
            {!row.isActive && <Badge>غیرفعال</Badge>}
          </div>
          <div className="text-sm text-neutral-600">
            {label}
            {row.sku && (
              <>
                {" · "}
                <span dir="ltr">{row.sku}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold leading-none">{formatNumber(row.stock)}</div>
            <div className="mt-1 text-xs text-neutral-500">
              آستانه {formatNumber(row.lowStockThreshold)}
            </div>
          </div>
          <StockBadge status={row.status} />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={open ? "ghost" : "outline"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "بستن" : "تغییر موجودی"}
          </Button>
          <Link
            href={`/inventory/${row.variantId}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            تاریخچه
          </Link>
        </div>
      </div>

      {state?.ok && !open && (
        <p role="status" className="text-sm text-green-700">
          موجودی ثبت شد: {formatNumber(state.newStock)}
        </p>
      )}

      {open && (
        <form
          action={formAction}
          className="flex flex-col gap-3 rounded-lg bg-neutral-50 p-3"
          aria-label={`تغییر موجودی ${row.productName} ${label}`}
        >
          <input type="hidden" name="expectedStock" value={row.stock} />

          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">نوع تغییر</legend>
            {MODES.map((m) => (
              <label
                key={m.value}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-sm",
                  mode === m.value
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white",
                )}
              >
                <input
                  type="radio"
                  name="mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  className="sr-only"
                />
                {m.label}
              </label>
            ))}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`qty-${row.variantId}`}>
                {mode === "set" ? "موجودی جدید" : "تعداد"}
              </Label>
              <Input
                id={`qty-${row.variantId}`}
                name="quantity"
                inputMode="numeric"
                dir="ltr"
                autoFocus
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`note-${row.variantId}`}>توضیح (اختیاری)</Label>
              <Input
                id={`note-${row.variantId}`}
                name="note"
                maxLength={MAX_NOTE_LENGTH}
                placeholder="مثلاً: رسید بار جدید، شمارش انبار، کالای معیوب"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {preview !== null && (
            <p className={cn("text-sm", preview < 0 ? "text-red-700" : "text-neutral-700")}>
              {preview < 0
                ? `بیشتر از موجودی فعلی (${formatNumber(row.stock)}) است.`
                : `موجودی از ${formatNumber(row.stock)} به ${formatNumber(preview)} تغییر می‌کند.`}
            </p>
          )}

          {state && !state.ok && (
            <p role="alert" className="text-sm text-red-700">
              {state.error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending || invalid}>
              {pending ? "در حال ثبت…" : "ثبت"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
