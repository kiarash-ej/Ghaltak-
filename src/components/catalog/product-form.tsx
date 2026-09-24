"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductFormState } from "@/server/catalog/actions";
import { parseWholeNumber } from "@/server/catalog/product-form";
import { shrinkImage } from "./shrink-image";

export type ProductFormInitial = {
  name: string;
  price: number;
  category: string | null;
  isActive: boolean;
  lowStockThreshold: number;
  imageUrl: string | null;
  variants: {
    id: string;
    color: string | null;
    size: string | null;
    sku: string | null;
    stock: number;
  }[];
};

type VariantRow = {
  key: number;
  id: string; // "" for a row that does not exist in the database yet
  color: string;
  size: string;
  sku: string;
  stock: string;
  savedStock: number | null; // shown read-only for existing rows
};

type Props = {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  categories: string[];
  submitLabel: string;
  initial?: ProductFormInitial;
  /** Where existing variants' stock is changed (edit form only). */
  inventoryHref?: string;
};

const emptyRow = (key: number): VariantRow => ({
  key,
  id: "",
  color: "",
  size: "",
  sku: "",
  stock: "0",
  savedStock: null,
});

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {messages.join(" ")}
    </p>
  );
}

export function ProductForm({ action, categories, submitLabel, initial, inventoryHref }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.errors;

  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [threshold, setThreshold] = useState(String(initial?.lowStockThreshold ?? 3));
  const [rows, setRows] = useState<VariantRow[]>(() =>
    initial?.variants.length
      ? initial.variants.map((v, i) => ({
          key: i,
          id: v.id,
          color: v.color ?? "",
          size: v.size ?? "",
          sku: v.sku ?? "",
          stock: "",
          savedStock: v.stock,
        }))
      : [emptyRow(0)],
  );

  // The chosen photo lives in state (not only in the file input) so it
  // survives a failed submit.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    const shrunk = await shrinkImage(file);
    setImageBusy(false);
    setImageFile(shrunk);
    setPreviewUrl(URL.createObjectURL(shrunk));
    setRemoveImage(false);
  }

  function updateRow(key: number, patch: Partial<VariantRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function submit(formData: FormData) {
    formData.delete("image");
    if (imageFile) formData.set("image", imageFile);
    formAction(formData);
  }

  const shownImage = previewUrl ?? (removeImage ? null : (initial?.imageUrl ?? null));
  const parsedPrice = parseWholeNumber(price);

  return (
    <form action={submit} className="flex max-w-3xl flex-col gap-6">
      {state?.message && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>اطلاعات محصول</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">نام محصول</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
            />
            <FieldError messages={errors?.name} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="price">قیمت (تومان)</Label>
              <Input
                id="price"
                name="price"
                inputMode="numeric"
                dir="ltr"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              {parsedPrice !== null && parsedPrice > 0 && (
                <p className="text-xs text-neutral-500">{formatToman(parsedPrice)}</p>
              )}
              <FieldError messages={errors?.price} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="category">دسته‌بندی</Label>
              <Input
                id="category"
                name="category"
                list="category-options"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                maxLength={60}
              />
              <datalist id="category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <FieldError messages={errors?.category} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lowStockThreshold">آستانهٔ هشدار کم‌موجودی</Label>
              <Input
                id="lowStockThreshold"
                name="lowStockThreshold"
                inputMode="numeric"
                dir="ltr"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <FieldError messages={errors?.lowStockThreshold} />
            </div>

            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4"
              />
              محصول فعال است (قابل فروش)
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تصویر</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {shownImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownImage}
              alt="پیش‌نمایش تصویر محصول"
              className="size-40 rounded-lg border border-neutral-200 object-cover"
            />
          )}
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPickImage}
            aria-label="انتخاب تصویر محصول"
            className="h-auto py-2"
          />
          {imageBusy && <p className="text-xs text-neutral-500">در حال کوچک‌کردن تصویر…</p>}
          {initial?.imageUrl && !imageFile && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="removeImage"
                checked={removeImage}
                onChange={(e) => setRemoveImage(e.target.checked)}
                className="size-4"
              />
              حذف تصویر فعلی
            </label>
          )}
          <FieldError messages={errors?.image} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تنوع‌ها (رنگ، سایز و موجودی)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {initial && (
            <p className="text-xs text-neutral-500">
              موجودی تنوع‌های ثبت‌شده در این فرم تغییر نمی‌کند تا هر تغییر موجودی ثبت و پیگیری شود.
              {inventoryHref && (
                <>
                  {" "}
                  <Link href={inventoryHref} className="text-neutral-900 underline">
                    تغییر موجودی در صفحهٔ موجودی
                  </Link>
                </>
              )}
            </p>
          )}
          <FieldError messages={errors?.variants} />

          {rows.map((row, i) => (
            <div
              key={row.key}
              className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-3 md:grid-cols-[1fr_1fr_1fr_8rem_auto] md:items-start"
            >
              <input type="hidden" name="variantId" value={row.id} />

              <div className="flex flex-col gap-1">
                <Label htmlFor={`color-${row.key}`} className="text-xs text-neutral-500">
                  رنگ
                </Label>
                <Input
                  id={`color-${row.key}`}
                  name="variantColor"
                  value={row.color}
                  onChange={(e) => updateRow(row.key, { color: e.target.value })}
                />
                <FieldError messages={errors?.[`variants.${i}.color`]} />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor={`size-${row.key}`} className="text-xs text-neutral-500">
                  سایز
                </Label>
                <Input
                  id={`size-${row.key}`}
                  name="variantSize"
                  value={row.size}
                  onChange={(e) => updateRow(row.key, { size: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor={`sku-${row.key}`} className="text-xs text-neutral-500">
                  کد کالا (اختیاری)
                </Label>
                <Input
                  id={`sku-${row.key}`}
                  name="variantSku"
                  dir="ltr"
                  value={row.sku}
                  onChange={(e) => updateRow(row.key, { sku: e.target.value })}
                />
                <FieldError messages={errors?.[`variants.${i}.sku`]} />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor={`stock-${row.key}`} className="text-xs text-neutral-500">
                  موجودی
                </Label>
                {row.savedStock !== null ? (
                  <>
                    <input type="hidden" name="variantStock" value="" />
                    <div className="flex h-10 items-center text-sm">
                      {formatNumber(row.savedStock)}
                    </div>
                  </>
                ) : (
                  <>
                    <Input
                      id={`stock-${row.key}`}
                      name="variantStock"
                      inputMode="numeric"
                      dir="ltr"
                      value={row.stock}
                      onChange={(e) => updateRow(row.key, { stock: e.target.value })}
                    />
                    <FieldError messages={errors?.[`variants.${i}.stock`]} />
                  </>
                )}
              </div>

              <div className="col-span-2 flex md:col-span-1 md:pt-5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                  aria-label="حذف این تنوع"
                >
                  حذف
                </Button>
              </div>
            </div>
          ))}

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRows((rs) => [...rs, emptyRow(Math.max(-1, ...rs.map((r) => r.key)) + 1)])
              }
            >
              افزودن تنوع
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || imageBusy}>
          {pending ? "در حال ذخیره…" : submitLabel}
        </Button>
        <Link href="/products" className={cn(buttonVariants({ variant: "ghost" }))}>
          انصراف
        </Link>
      </div>
    </form>
  );
}
