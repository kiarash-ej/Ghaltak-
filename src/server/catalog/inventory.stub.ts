import type { Prisma } from "@/generated/prisma/client";
import type { AdjustStockOptions } from "./inventory";

/**
 * TEMPORARY STUB, used by Track B until it switches to the real `adjustStock`
 * in `./inventory.ts` (A4). Same signature as the real one, so switching is a
 * one-line import change. Delete this file once nothing imports it.
 *
 * Do not switch while purchase-link orders can be placed without limits
 * (issue #10): with the real function, unpaid fake orders would hold stock.
 */
export async function adjustStock(
  variantId: string,
  delta: number,
  tx?: Prisma.TransactionClient,
  options: AdjustStockOptions = {},
): Promise<void> {
  void tx;
  console.warn(
    `[adjustStock stub] variant=${variantId} delta=${delta} reason=${options.reason ?? "-"} order=${options.orderId ?? "-"}`,
  );
}
