import "server-only";
import { prisma } from "@/lib/prisma";
import type { BuyInput } from "./buy-form";
import { createOrderInTx } from "./create-order";
import { expireUnpaidLinkOrders } from "./expire-orders";
import { purchaseQuotaProblem } from "./purchase-limits";

/** The link is at a limit (per phone or per hour); the message is shown to the customer. */
export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}

/**
 * Places an order from a public purchase link. Kept out of the "use server"
 * file so it isn't callable from the browser on its own and can be tested.
 * Throws QuotaError, OrderError or OutOfStockError for the customer to see.
 */
export async function placeLinkOrder(
  link: { linkId: string; sellerId: string },
  input: BuyInput,
): Promise<{ id: string; publicToken: string }> {
  // Free stock held by abandoned orders before checking stock for this one.
  await expireUnpaidLinkOrders(link.sellerId);

  return prisma.$transaction(async (tx) => {
    // Orders on the same link take turns from here to commit, so the counts
    // below can't be raced by simultaneous requests (issue #18). The lock is
    // per link and released automatically when the transaction ends.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${link.linkId}))`;

    // Limits that don't depend on the IP (see purchase-limits.ts).
    const [openOrdersForPhone, linkOrdersLastHour] = await Promise.all([
      tx.order.count({
        where: {
          purchaseLinkId: link.linkId,
          status: "PENDING_PAYMENT",
          customer: { sellerId: link.sellerId, phone: input.phone },
        },
      }),
      tx.order.count({
        where: {
          purchaseLinkId: link.linkId,
          createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
        },
      }),
    ]);
    const quota = purchaseQuotaProblem({ openOrdersForPhone, linkOrdersLastHour });
    if (quota) throw new QuotaError(quota);

    return createOrderInTx(tx, {
      sellerId: link.sellerId,
      customer: { kind: "new", name: input.name, phone: input.phone },
      shippingAddress: input.address,
      items: input.items,
      source: "PURCHASE_LINK",
      purchaseLinkId: link.linkId,
    });
  });
}
