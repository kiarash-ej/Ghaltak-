"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseBuyForm } from "./buy-form";
import { OrderError, createOrderInTx } from "./create-order";
import { expireUnpaidLinkOrders } from "./expire-orders";
import { purchaseQuotaProblem } from "./purchase-limits";
import type { FieldErrors } from "./order-form";
import { getPublicLink } from "./purchase-links";
import { clientIp, createRateLimiter } from "./rate-limit";
import { OutOfStockError } from "./stock";

// PUBLIC action behind /buy/[token]: no login. The seller comes from the
// link token only, never from anything the visitor sends.

export type BuyFormState = { errors?: FieldErrors; message?: string } | undefined;

// Generous on purpose: many Iranian mobile users share an IP (carrier NAT).
const orderLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

const GENERIC_ERROR = "خطایی رخ داد. لطفاً دوباره تلاش کنید.";

class QuotaError extends Error {}

export async function submitPurchaseAction(
  token: string,
  _prev: BuyFormState,
  formData: FormData,
): Promise<BuyFormState> {
  const parsed = parseBuyForm(formData);
  if (!parsed.success) return { errors: parsed.errors };

  if (!orderLimiter.hit(clientIp(await headers()))) {
    return { message: "تعداد سفارش‌ها از این اتصال زیاد است. چند دقیقه دیگر دوباره تلاش کنید." };
  }

  const link = await getPublicLink(token);
  if (!link) return { message: "این لینک خرید دیگر فعال نیست." };

  // Free stock held by abandoned orders before checking stock for this one.
  await expireUnpaidLinkOrders(link.sellerId);

  let publicToken: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Limits that don't depend on the IP (see purchase-limits.ts).
      const [openOrdersForPhone, linkOrdersLastHour] = await Promise.all([
        tx.order.count({
          where: {
            purchaseLinkId: link.linkId,
            status: "PENDING_PAYMENT",
            customer: { sellerId: link.sellerId, phone: parsed.data.phone },
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
        customer: { kind: "new", name: parsed.data.name, phone: parsed.data.phone },
        shippingAddress: parsed.data.address,
        items: parsed.data.items,
        source: "PURCHASE_LINK",
        purchaseLinkId: link.linkId,
      });
    });
    publicToken = order.publicToken;
  } catch (err) {
    if (err instanceof QuotaError) return { message: err.message };
    if (err instanceof OrderError) return { errors: { items: [err.message] } };
    if (err instanceof OutOfStockError) {
      return { errors: { items: ["موجودی یکی از کالاها کافی نیست."] } };
    }
    console.error("purchase-link order failed", err);
    return { message: GENERIC_ERROR };
  }

  revalidatePath("/orders");
  redirect(`/buy/order/${publicToken}`);
}
