"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireMember, requireOwner } from "@/server/auth";
import { parseReportKey } from "@/server/finance/report-periods";
import { tehranDateKey } from "@/server/reports/periods";
import { BRIEF_COOKIE, RECAP_COOKIE } from "./brief-text";

// The daily brief's × (spec §7.1): remembered for the rest of the Tehran day
// on this device, so the next visit shows the folded pill without a flash.

export async function dismissBriefAction(): Promise<void> {
  await requireMember();
  (await cookies()).set(BRIEF_COOKIE, tehranDateKey(new Date()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 36, // outlives the day; the value says which day
  });
}

/**
 * The period recap's × (finance spec §7.2): this recap stays closed, and
 * today's brief starts folded, so Home goes back to normal from tomorrow.
 */
export async function dismissRecapAction(key: string): Promise<void> {
  await requireOwner();
  if (!parseReportKey(key)) return;
  const jar = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  jar.set(RECAP_COOKIE, key, { ...options, maxAge: 60 * 60 * 24 * 10 }); // a recap lasts 7 days at most
  jar.set(BRIEF_COOKIE, tehranDateKey(new Date()), { ...options, maxAge: 60 * 60 * 36 });
  revalidatePath("/");
}
