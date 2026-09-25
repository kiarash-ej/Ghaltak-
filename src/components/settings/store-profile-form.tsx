"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StoreProfileFormState } from "@/server/store/actions";
import type { PublicStoreProfile } from "@/server/store/profile";
import { STORE_NAME_MAX } from "@/server/store/profile-form";
import { squareImage } from "./square-image";

type Props = {
  action: (state: StoreProfileFormState, formData: FormData) => Promise<StoreProfileFormState>;
  initial: PublicStoreProfile;
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {messages.join(" ")}
    </p>
  );
}

export function StoreProfileForm({ action, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.errors;

  const [name, setName] = useState(initial.name);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone ?? "");
  const [instagram, setInstagram] = useState(initial.instagram ?? "");
  const [telegram, setTelegram] = useState(initial.telegram ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);

  // The chosen logo lives in state (not only in the file input) so it
  // survives a failed submit.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // After a successful save, show the values as stored ("@shop" becomes
  // "shop") and forget the uploaded file, so saving again doesn't re-upload it.
  const [handledSave, setHandledSave] = useState(state?.savedAt);
  if (state?.saved && state.savedAt !== handledSave) {
    setHandledSave(state.savedAt);
    setName(state.saved.name);
    setContactPhone(state.saved.contactPhone ?? "");
    setInstagram(state.saved.instagram ?? "");
    setTelegram(state.saved.telegram ?? "");
    setLogoUrl(state.saved.logoUrl);
    setLogoFile(null);
    setPreviewUrl(null);
    setRemoveLogo(false);
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    const square = await squareImage(file);
    setLogoBusy(false);
    setLogoFile(square);
    setPreviewUrl(URL.createObjectURL(square));
    setRemoveLogo(false);
  }

  function submit(formData: FormData) {
    formData.delete("logo");
    if (logoFile) formData.set("logo", logoFile);
    formAction(formData);
  }

  const shownLogo = previewUrl ?? (removeLogo ? null : logoUrl);
  const justSaved = state?.saved && state.savedAt === handledSave && !pending;

  return (
    <form action={submit} className="flex max-w-2xl flex-col gap-6">
      {state?.message && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>فروشگاه</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            نام، لوگو و راه‌های تماسی که اینجا وارد می‌کنید روی صفحهٔ خرید مشتری نمایش داده می‌شود. شمارهٔ
            موبایلی که با آن وارد غلتک می‌شوید نمایش داده نمی‌شود.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">نام فروشگاه</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={STORE_NAME_MAX}
              required
            />
            <FieldError messages={errors?.name} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لوگو</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {shownLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownLogo}
              alt="لوگوی فروشگاه"
              className="size-24 rounded-xl border border-neutral-200 object-cover"
            />
          )}
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPickLogo}
            aria-label="انتخاب لوگوی فروشگاه"
            className="h-auto py-2"
          />
          <p className="text-xs text-neutral-500">
            {logoBusy ? "در حال آماده‌کردن لوگو…" : "لوگو به شکل مربع از وسط تصویر برش می‌خورد."}
          </p>
          {logoUrl && !logoFile && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="removeLogo"
                checked={removeLogo}
                onChange={(e) => setRemoveLogo(e.target.checked)}
                className="size-4"
              />
              حذف لوگوی فعلی
            </label>
          )}
          <FieldError messages={errors?.logo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>راه‌های تماس (اختیاری)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="contactPhone">موبایل تماس</Label>
            <Input
              id="contactPhone"
              name="contactPhone"
              inputMode="tel"
              dir="ltr"
              placeholder="09121234567"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
            <FieldError messages={errors?.contactPhone} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="instagram">آیدی اینستاگرام</Label>
            <Input
              id="instagram"
              name="instagram"
              dir="ltr"
              placeholder="@myshop"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
            <FieldError messages={errors?.instagram} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="telegram">آیدی تلگرام</Label>
            <Input
              id="telegram"
              name="telegram"
              dir="ltr"
              placeholder="@myshop"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
            />
            <FieldError messages={errors?.telegram} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || logoBusy}>
          {pending ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
        </Button>
        {justSaved && (
          <p role="status" className="text-sm text-green-700">
            تغییرات ذخیره شد.
          </p>
        )}
      </div>
    </form>
  );
}
