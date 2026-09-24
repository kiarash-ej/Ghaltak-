import type { StockMovementReason } from "@/generated/prisma/client";

export const STOCK_REASON_LABELS: Record<StockMovementReason, string> = {
  INITIAL: "موجودی اولیه",
  MANUAL_ADJUSTMENT: "تنظیم دستی",
  ORDER_PLACED: "ثبت سفارش",
  ORDER_CANCELED: "لغو سفارش",
  ORDER_RETURNED: "مرجوعی",
};

/** "مشکی / M", or a fallback when a variant has neither color nor size. */
export function variantLabel(v: { color: string | null; size: string | null }): string {
  return [v.color, v.size].filter(Boolean).join(" / ") || "بدون رنگ و سایز";
}
