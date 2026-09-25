import { NextResponse, type NextRequest } from "next/server";
import { scheduleCustomerSms } from "@/server/notifications/schedule";
import { handleGatewayReturn } from "@/server/payments/online-payment";

// Where the payment gateway sends the customer back (public, no login).
// Everything is resolved from the payment attempt; the query only carries the
// gateway's Authority and Status, which handleGatewayReturn checks.
export async function GET(req: NextRequest, ctx: RouteContext<"/pay/callback/[attemptId]">) {
  const { attemptId } = await ctx.params;
  const q = req.nextUrl.searchParams;

  let result: Awaited<ReturnType<typeof handleGatewayReturn>>;
  try {
    result = await handleGatewayReturn({
      attemptId,
      authority: q.get("Authority"),
      status: q.get("Status"),
    });
  } catch (err) {
    // Left PENDING: a refresh verifies again (the gateway answers "already verified").
    console.error("payment return failed:", (err as Error)?.name);
    result = { outcome: "failed", publicToken: null, orderId: null };
  }

  if (!result.publicToken) return new NextResponse("Not found", { status: 404 });
  // A repeated return is harmless: sendSms keeps one ORDER_PAID per order.
  if (result.outcome === "paid" && result.orderId) await scheduleCustomerSms("ORDER_PAID", result.orderId);
  const back = new URL(`/buy/order/${result.publicToken}`, req.url);
  back.searchParams.set("payment", result.outcome);
  return NextResponse.redirect(back, 303);
}
