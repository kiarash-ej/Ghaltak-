import "server-only";
import { randomBytes } from "node:crypto";
import type { OrderSource, Prisma } from "@/generated/prisma/client";
import { MAX_ORDER_TOTAL, computeOrderTotal, type OrderLineInput } from "./order-form";
import { takeStock } from "./stock";

// Order creation shared by the manual order form and the public purchase link.

/** A user-facing failure raised inside the transaction so everything rolls back. */
export class OrderError extends Error {
  constructor(
    public readonly field: "customerId" | "items",
    message: string,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export type CreateOrderInput = {
  sellerId: string;
  customer: { kind: "existing"; id: string } | { kind: "new"; name: string; phone: string };
  shippingAddress: string | null;
  items: OrderLineInput[];
  source: OrderSource;
  /** When set, only products attached to this purchase link can be ordered. */
  purchaseLinkId?: string;
};

function variantLabel(v: { color: string | null; size: string | null; product: { name: string } }) {
  const detail = [v.color, v.size].filter(Boolean).join(" / ");
  return detail ? `${v.product.name} (${detail})` : v.product.name;
}

/** Creates the order and reduces stock. Must run inside a transaction. */
export async function createOrderInTx(
  tx: Prisma.TransactionClient,
  input: CreateOrderInput,
): Promise<{ id: string; publicToken: string }> {
  const { sellerId } = input;

  // Customer: an existing one must belong to this seller. A "new" one reuses
  // the seller's customer with the same phone if there is one, without
  // overwriting their saved name or address.
  let customer: { id: string; address: string | null };
  if (input.customer.kind === "existing") {
    const found = await tx.customer.findFirst({
      where: { id: input.customer.id, sellerId },
      select: { id: true, address: true },
    });
    if (!found) throw new OrderError("customerId", "مشتری پیدا نشد.");
    customer = found;
  } else {
    // INSERT ... ON CONFLICT DO NOTHING, then read. Safe when two orders with
    // the same new phone arrive together (a double-click): the second insert
    // waits for the first, skips, and both orders get the same customer.
    // (Catching the unique-constraint error instead is not an option: Postgres
    // aborts the whole transaction on it.)
    await tx.customer.createMany({
      data: [
        {
          sellerId,
          name: input.customer.name,
          phone: input.customer.phone,
          address: input.shippingAddress,
        },
      ],
      skipDuplicates: true,
    });
    customer = await tx.customer.findUniqueOrThrow({
      where: { sellerId_phone: { sellerId, phone: input.customer.phone } },
      select: { id: true, address: true },
    });
  }

  // Variants: only this seller's, only active products (and only the link's
  // products for a purchase link). Prices are read here, never from the
  // form, and snapshotted onto each OrderItem.
  const variants = await tx.productVariant.findMany({
    where: {
      id: { in: input.items.map((i) => i.variantId) },
      sellerId,
      product: {
        isActive: true,
        ...(input.purchaseLinkId
          ? { purchaseLinks: { some: { id: input.purchaseLinkId } } }
          : {}),
      },
    },
    select: {
      id: true,
      stock: true,
      color: true,
      size: true,
      product: { select: { id: true, name: true, price: true } },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines = input.items.map((item) => {
    const variant = byId.get(item.variantId);
    if (!variant) throw new OrderError("items", "یکی از کالاها دیگر برای فروش موجود نیست.");
    if (variant.stock < item.quantity) {
      throw new OrderError("items", `موجودی «${variantLabel(variant)}» کافی نیست.`);
    }
    return {
      productId: variant.product.id,
      productVariantId: variant.id,
      quantity: item.quantity,
      unitPrice: variant.product.price,
    };
  });

  const totalPrice = computeOrderTotal(lines);
  if (totalPrice > MAX_ORDER_TOTAL) {
    throw new OrderError("items", "جمع سفارش بیش از حد مجاز است.");
  }

  const publicToken = randomBytes(16).toString("base64url");
  const order = await tx.order.create({
    data: {
      sellerId,
      customerId: customer.id,
      source: input.source,
      purchaseLinkId: input.purchaseLinkId ?? null,
      status: "PENDING_PAYMENT",
      totalPrice,
      shippingAddress: input.shippingAddress ?? customer.address,
      publicToken,
      items: { create: lines },
    },
    select: { id: true },
  });

  await takeStock(order.id, lines, tx);
  return { id: order.id, publicToken };
}
