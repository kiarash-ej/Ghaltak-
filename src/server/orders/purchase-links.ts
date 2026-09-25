import "server-only";
import { prisma } from "@/lib/prisma";
import { amountDue, paymentState } from "./payment";
import { shippingMethodLabel } from "./shipping";
import { orderCode } from "./queries";

// Purchase links: seller-side queries take the sellerId from requireSeller().
// Public queries resolve everything from an unguessable token and return only
// what the customer needs to see (no seller data, no other products).

/** Tokens are base64url; anything else can't be a real token, so skip the query. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export function isWellFormedToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export async function listPurchaseLinks(sellerId: string) {
  return prisma.purchaseLink.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      title: true,
      isActive: true,
      createdAt: true,
      products: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      _count: { select: { orders: true } },
    },
  });
}

/** Active products the seller can attach to a new link. */
export async function listLinkableProducts(sellerId: string) {
  return prisma.product.findMany({
    where: { sellerId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export type PublicLinkProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  variants: { id: string; color: string | null; size: string | null; inStock: boolean }[];
};

/**
 * The link behind /buy/[token], or null if it doesn't exist or was turned off.
 * `sellerId` and `linkId` are for the server only; never pass them to the client.
 */
export async function getPublicLink(token: string) {
  if (!isWellFormedToken(token)) return null;

  const link = await prisma.purchaseLink.findUnique({
    where: { token },
    select: {
      id: true,
      sellerId: true,
      title: true,
      isActive: true,
      products: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          variants: {
            orderBy: { id: "asc" },
            select: { id: true, color: true, size: true, stock: true },
          },
        },
      },
    },
  });
  if (!link || !link.isActive) return null;

  const products: PublicLinkProduct[] = link.products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    // Only "in stock or not": exact stock counts are the seller's business.
    variants: p.variants.map((v) => ({
      id: v.id,
      color: v.color,
      size: v.size,
      inStock: v.stock > 0,
    })),
  }));

  return { linkId: link.id, sellerId: link.sellerId, title: link.title, products };
}

/** The customer's view of their order, looked up by its public token. */
export async function getPublicOrder(publicToken: string) {
  if (!isWellFormedToken(publicToken)) return null;

  const order = await prisma.order.findUnique({
    where: { publicToken },
    select: {
      id: true,
      sellerId: true,
      status: true,
      totalPrice: true,
      createdAt: true,
      paidAt: true,
      receiptImageUrl: true,
      shippingMethod: true,
      shippingCost: true,
      trackingCode: true,
      shippingStatus: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          product: { select: { name: true } },
          productVariant: { select: { color: true, size: true } },
        },
      },
    },
  });
  if (!order) return null;

  return {
    // For server-side lookups only (e.g. the seller's card for payment
    // instructions); never pass it to the client.
    sellerId: order.sellerId,
    code: orderCode(order.id),
    status: order.status,
    // Only the state, never the receipt itself: the customer page is public.
    payment: paymentState(order),
    totalPrice: order.totalPrice,
    shippingCost: order.shippingCost,
    amountDue: amountDue(order),
    shipping: {
      method: shippingMethodLabel(order.shippingMethod),
      trackingCode: order.trackingCode,
      status: order.shippingStatus,
    },
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      id: i.id,
      name: i.product.name,
      detail: [i.productVariant?.color, i.productVariant?.size].filter(Boolean).join(" / "),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  };
}
