// The seller's gateway settings form (Phase 2, B6). Pure, no database.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GatewayFormInput = {
  /** undefined = keep the saved one (it is never shown again after saving). */
  merchantId?: string;
  sandbox: boolean;
  isActive: boolean;
  /** The e2e-only fake gateway; accepted only where fakeGatewayAllowed(). */
  fake: boolean;
};

export type GatewayFormResult =
  | { success: true; data: GatewayFormInput }
  | { success: false; errors: Record<string, string[]> };

function text(input: FormDataEntryValue | null): string {
  return typeof input === "string" ? input.trim() : "";
}

export function parseGatewayForm(
  formData: FormData,
  ctx: { hasSavedMerchant: boolean; fakeAllowed: boolean },
): GatewayFormResult {
  const errors: Record<string, string[]> = {};
  const fake = ctx.fakeAllowed && formData.get("fake") === "on";
  const data: GatewayFormInput = {
    sandbox: formData.get("sandbox") === "on",
    isActive: formData.get("isActive") === "on",
    fake,
  };

  const merchant = text(formData.get("merchantId"));
  if (merchant !== "") {
    if (UUID.test(merchant)) data.merchantId = merchant.toLowerCase();
    else errors.merchantId = ["مرچنت کد زرین‌پال ۳۶ نویسه است، مثل xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx."];
  }

  if (data.isActive && !fake && !data.merchantId && !ctx.hasSavedMerchant && !errors.merchantId) {
    errors.merchantId = ["برای فعال کردن پرداخت آنلاین، مرچنت کد را وارد کنید."];
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data };
}
