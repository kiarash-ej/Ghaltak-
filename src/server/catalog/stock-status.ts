export type StockStatus = "OUT_OF_STOCK" | "LOW" | "OK";

/**
 * OUT_OF_STOCK: every variant is at zero.
 * LOW: at least one variant is at or below the product's threshold.
 */
export function getStockStatus(
  variantStocks: number[],
  lowStockThreshold: number,
): StockStatus {
  if (variantStocks.length === 0 || variantStocks.every((s) => s <= 0)) {
    return "OUT_OF_STOCK";
  }
  return variantStocks.some((s) => s <= lowStockThreshold) ? "LOW" : "OK";
}
