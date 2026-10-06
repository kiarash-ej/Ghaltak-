"use server";

import { cookies } from "next/headers";
import { requireMember } from "@/server/auth";
import { tehranDateKey } from "@/server/reports/periods";
import { BRIEF_COOKIE } from "./brief-text";

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
