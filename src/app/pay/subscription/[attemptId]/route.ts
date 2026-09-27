import { NextResponse, type NextRequest } from "next/server";
import { handleSubscriptionReturn, type SubscriptionReturnOutcome } from "@/server/billing/subscription-payment";

// Where the platform's gateway sends a seller back after paying for a
// subscription (A9). Public like /pay/callback: a lost session must not lose a
// payment, so everything is resolved from the payment attempt, and the query
// only carries the gateway's Authority and Status, which are checked.
export async function GET(req: NextRequest, ctx: RouteContext<"/pay/subscription/[attemptId]">) {
  const { attemptId } = await ctx.params;
  const q = req.nextUrl.searchParams;

  let outcome: SubscriptionReturnOutcome;
  try {
    outcome = await handleSubscriptionReturn({ attemptId, authority: q.get("Authority"), status: q.get("Status") });
  } catch (err) {
    // Only reached if the attempt itself couldn't be read (e.g. the database is down).
    const e = err as { name?: string; code?: string };
    console.error("[subscription payment return] failed before reading the attempt", {
      attemptId,
      name: e?.name,
      code: e?.code,
    });
    outcome = "pending";
  }

  if (outcome === "invalid") return new NextResponse("Not found", { status: 404 });
  const back = new URL("/settings/billing", req.url);
  back.searchParams.set("payment", outcome);
  return NextResponse.redirect(back, 303);
}
