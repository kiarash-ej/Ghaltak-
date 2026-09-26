"use server";

import { revalidatePath } from "next/cache";
import { requireSeller } from "@/server/auth";
import { formatNumber } from "@/lib/format";
import { parseAdjustForm } from "./adjust-form";
import {
  InsufficientStockError,
  StaleStockError,
  VariantNotFoundError,
  changeStock,
  setStock,
} from "./inventory";
import { errorSummary } from "@/lib/error-summary";

export type AdjustStockState =
  | { ok: true; newStock: number }
  | { ok: false; error: string; currentStock?: number }
  | undefined;

function refreshStockPages() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/[variantId]", "page");
  revalidatePath("/products");
}

export async function adjustStockAction(
  variantId: string,
  _prev: AdjustStockState,
  formData: FormData,
): Promise<AdjustStockState> {
  const seller = await requireSeller();

  const parsed = parseAdjustForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error };
  const req = parsed.data;

  let newStock: number;
  try {
    newStock =
      req.kind === "set"
        ? await setStock({
            sellerId: seller.id,
            variantId,
            expectedStock: req.expectedStock,
            target: req.target,
            note: req.note,
          })
        : await changeStock({
            sellerId: seller.id,
            variantId,
            delta: req.delta,
            reason: "MANUAL_ADJUSTMENT",
            note: req.note,
          });
  } catch (err) {
    // The stock changed under us: refresh so the row (and the expected value
    // in the form) show the real stock, and a retry can succeed.
    if (err instanceof InsufficientStockError || err instanceof StaleStockError) {
      refreshStockPages();
    }
    if (err instanceof InsufficientStockError) {
      return {
        ok: false,
        currentStock: err.currentStock,
        error: `این تغییر ممکن نیست. موجودی فعلی ${formatNumber(err.currentStock)} است.`,
      };
    }
    if (err instanceof StaleStockError) {
      return {
        ok: false,
        currentStock: err.currentStock,
        error: `موجودی در این فاصله تغییر کرده و اکنون ${formatNumber(err.currentStock)} است. دوباره بررسی کنید.`,
      };
    }
    if (err instanceof VariantNotFoundError) {
      return { ok: false, error: "این تنوع پیدا نشد. صفحه را دوباره باز کنید." };
    }
    console.error("stock adjustment failed", errorSummary(err));
    return { ok: false, error: "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید." };
  }

  refreshStockPages();
  return { ok: true, newStock };
}
