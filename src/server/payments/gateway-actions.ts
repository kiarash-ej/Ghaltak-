"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/server/auth";
import { fakeGatewayAllowed } from "./fake-gateway";
import { parseGatewayForm } from "./gateway-form";
import { gatewayForSeller, getGatewayForSettings, hasSavedMerchant, saveGateway, type GatewayForSettings } from "./gateway-store";
import { createRateLimiter } from "@/server/orders/rate-limit";
import { requestOrigin } from "./request-origin";

// Each test is a real request to the seller's Zarinpal account; a few are plenty.
const testLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export type GatewayFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      saved?: GatewayForSettings | null;
      savedAt?: number;
      test?: { ok: boolean; text: string };
    }
  | undefined;

/** Saves the seller's gateway (merchant id encrypted) and its on/off switch. */
export async function saveGatewayAction(
  _prev: GatewayFormState,
  formData: FormData,
): Promise<GatewayFormState> {
  // TODO(A10): requireMember("OWNER"); today every seller is its owner.
  const seller = await requireSeller();
  const parsed = parseGatewayForm(formData, {
    hasSavedMerchant: await hasSavedMerchant(seller.id),
    fakeAllowed: fakeGatewayAllowed(),
  });
  if (!parsed.success) return { errors: parsed.errors };

  try {
    await saveGateway(seller.id, parsed.data);
  } catch (err) {
    // Never the error object: it could carry the merchant id.
    console.error("gateway save failed:", (err as Error)?.name);
    return { message: "ذخیره انجام نشد. دوباره تلاش کنید." };
  }
  revalidatePath("/settings/payments");
  return { saved: await getGatewayForSettings(seller.id), savedAt: Date.now() };
}

/**
 * "آزمایش اتصال": asks the saved gateway for a small test payment and reports
 * whether it answered with a payment page. Nothing is charged or recorded.
 */
export async function testGatewayAction(
  _prev: GatewayFormState,
  _formData: FormData,
): Promise<GatewayFormState> {
  void _formData;
  const seller = await requireSeller();
  if (!testLimiter.hit(seller.id)) {
    return { test: { ok: false, text: "چند بار پشت سر هم آزمایش کردید. ده دقیقه دیگر دوباره امتحان کنید." } };
  }
  const gateway = await gatewayForSeller(seller.id, { activeOnly: false });
  if (!gateway) return { test: { ok: false, text: "ابتدا مرچنت کد را ذخیره کنید." } };

  const result = await gateway.request({
    amount: 1_000,
    callbackUrl: `${await requestOrigin().catch(() => "https://example.invalid")}/pay/callback/connection-test`,
    description: "آزمایش اتصال غلتک",
  });
  return result.ok
    ? { test: { ok: true, text: "اتصال به درگاه برقرار است." } }
    : { test: { ok: false, text: `درگاه درخواست را نپذیرفت (${result.detail}). مرچنت کد و حالت آزمایشی را بررسی کنید.` } };
}
